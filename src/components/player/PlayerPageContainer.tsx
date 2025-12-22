'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OnDragEndResponder } from '@hello-pangea/dnd';
import { useParams, useSearchParams } from 'next/navigation';

import FolderView from './FolderView';
import PlayerView from './PlayerView';
import { useComments } from './hooks/useComments';
import { useWavesurferPlayer } from './hooks/useWavesurferPlayer';
import type { TrackDataProgress } from './utils/trackData';
import { fetchTrackData, fetchTrackDataBatch } from './utils/trackDataClient';
import type { FileItem } from './types';

const PlayerPageContainer = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const slugParam = params.slug;
  const slug = Array.isArray(slugParam) ? slugParam : slugParam ? [slugParam] : [];
  const token = searchParams.get('token');
  const debugDurations = searchParams.get('debugDurations') === '1';
  const folderPath = slug.join('/');
  const runningOrderPath = `${folderPath}/running-order.v2.json`;
  const legacyRunningOrderPath = `${folderPath}/running-order.json`;

  const [playlist, setPlaylist] = useState<FileItem[]>([]);
  const [directories, setDirectories] = useState<FileItem[]>([]);
  const [isFolderView, setIsFolderView] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);
  const [newComment, setNewComment] = useState('');
  const [newCommentInitials, setNewCommentInitials] = useState('');
  const [newCommentTimestamp, setNewCommentTimestamp] = useState<number | null>(null);
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [hoveredCommentTimestamp, setHoveredCommentTimestamp] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
  const [trackDataStatus, setTrackDataStatus] = useState<Record<string, 'present' | 'missing'>>({});
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isGeneratingTrackData, setIsGeneratingTrackData] = useState(false);
  const [generatingTrackName, setGeneratingTrackName] = useState<string | null>(null);
  const [trackDataPhase, setTrackDataPhase] = useState<TrackDataProgress['phase'] | null>(null);
  const [trackDataPercent, setTrackDataPercent] = useState<number | null>(null);
  const [isTrackDataOverlayDismissed, setIsTrackDataOverlayDismissed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pendingDurationFetchRef = useRef(new Set<string>());

  useEffect(() => {
    setTrackDurations({});
    setTrackDataStatus({});
    pendingDurationFetchRef.current.clear();
  }, [folderPath]);

  const commentsPath = currentTrack ? `${folderPath}/${currentTrack.name}.comments.json` : null;
  const encodedFolderPath = encodeURIComponent(folderPath);
  const encodedRunningOrderPath = encodeURIComponent(runningOrderPath);
  const encodedLegacyRunningOrderPath = encodeURIComponent(legacyRunningOrderPath);
  const {
    comments,
    addComment,
    deleteComment,
    replyingToCommentId,
    setReplyingToCommentId,
    confirmDeleteId,
    setConfirmDeleteId,
  } = useComments(commentsPath);

  const isGuest = useMemo(() => Boolean(token), [token]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isGeneratingTrackData) {
      setIsTrackDataOverlayDismissed(false);
    }
  }, [isGeneratingTrackData]);

  const saveRunningOrderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueRunningOrderSave = useCallback(
    (nextPlaylist: FileItem[]) => {
      if (saveRunningOrderTimeoutRef.current) {
        clearTimeout(saveRunningOrderTimeoutRef.current);
      }

      saveRunningOrderTimeoutRef.current = setTimeout(() => {
        fetch(`/api/running-order?path=${encodedRunningOrderPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playlist: nextPlaylist.map((file) => file.name),
          }),
        });
      }, 800);
    },
    [encodedRunningOrderPath]
  );

  useEffect(() => {
    return () => {
      if (saveRunningOrderTimeoutRef.current) {
        clearTimeout(saveRunningOrderTimeoutRef.current);
      }
    };
  }, []);

  const { wavesurfer, isPlaying, currentTime, duration, onPlayPause } = useWavesurferPlayer({
    containerRef,
    currentTrack,
    folderPath,
    runningOrderPath,
    playlist,
    isAutoplay,
    setIsAutoplay,
    setCurrentTrack,
    trackDurations,
    setTrackDurations,
    setIsGeneratingTrackData,
    setGeneratingTrackName,
    setTrackDataPhase,
    setTrackDataPercent,
    queueRunningOrderSave,
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/files?path=${encodedFolderPath}`).then((res) => res.json()) as Promise<{ files: FileItem[] }>,
      fetch(`/api/running-order?path=${encodedRunningOrderPath}&legacyPath=${encodedLegacyRunningOrderPath}`).then((res) =>
        res.ok ? res.json() : null
      ) as Promise<{ playlist: string[] } | null>,
    ]).then(([filesData, orderData]) => {
      const allFiles = filesData.files || [];
      const audioFiles = allFiles.filter((f) => f.type === 'file' && f.name.match(/\.(mp3|wav|ogg)$/i));
      const subDirectories = allFiles.filter((f) => f.type === 'directory');

      if (audioFiles.length > 0) {
        setIsFolderView(false);
        let pl = audioFiles;
        if (orderData) {
          if (orderData.playlist) {
            const orderedNames = orderData.playlist;
            const fileMap = new Map(audioFiles.map((f) => [f.name, f]));
            const orderedPlaylist = orderedNames
              .map((name) => fileMap.get(name))
              .filter((item): item is FileItem => !!item);
            const newFiles = audioFiles.filter((f) => !orderedNames.includes(f.name));
            pl = [...orderedPlaylist, ...newFiles];
          }
        }
        setPlaylist(pl);
        if (pl.length > 0) setCurrentTrack(pl[0]);
        if (!orderData && pl.length > 0) {
          queueRunningOrderSave(pl);
        }
      } else {
        setIsFolderView(true);
        setDirectories(subDirectories);
      }
      setIsLoading(false);
    });
  }, [folderPath, runningOrderPath]);

  useEffect(() => {
    if (!playlist.length) return;
    let isCancelled = false;

    const missingTracks = playlist.filter(
      (track) => trackDurations[track.name] === undefined && !pendingDurationFetchRef.current.has(track.name)
    );
    if (missingTracks.length === 0) return;

    const trackDataPaths = missingTracks.map((track) => {
      pendingDurationFetchRef.current.add(track.name);
      return `${folderPath}/${track.name}.track-data.v2.json`;
    });
    const clearPending = () => {
      for (const track of missingTracks) {
        pendingDurationFetchRef.current.delete(track.name);
      }
    };

    const runBatch = async () => {
      try {
        if (debugDurations) {
          console.log('[durations] fetching track-data for', missingTracks.map((track) => track.name));
        }
        const data = await fetchTrackDataBatch(trackDataPaths);
        if (isCancelled) return;

        const updateDurations = (entries: Array<{ track: FileItem; duration: number }>) => {
          if (entries.length === 0) return;
          setTrackDurations((prev) => {
            let next = prev;
            for (const entry of entries) {
              if (next[entry.track.name] !== undefined) continue;
              if (next === prev) {
                next = { ...prev };
              }
              next[entry.track.name] = entry.duration;
            }
            return next;
          });
          setTrackDataStatus((prev) => {
            let next = prev;
            for (const entry of entries) {
              if (prev[entry.track.name] === 'present') continue;
              if (next === prev) {
                next = { ...prev };
              }
              next[entry.track.name] = 'present';
            }
            return next;
          });
        };

        const resolvedEntries: Array<{ track: FileItem; duration: number }> = [];
        const stillMissing: FileItem[] = [];

        for (const track of missingTracks) {
          const path = `${folderPath}/${track.name}.track-data.v2.json`;
          const entry = data[path];
          if (entry && typeof entry.duration === 'number') {
            resolvedEntries.push({ track, duration: entry.duration });
          } else {
            stillMissing.push(track);
          }
        }

        if (debugDurations) {
          const returnedKeys = Object.keys(data || {});
          console.log('[durations] batch keys', returnedKeys);
          console.log('[durations] resolved', resolvedEntries.map((entry) => entry.track.name));
          console.log('[durations] missing after batch', stillMissing.map((track) => track.name));
        }

        updateDurations(resolvedEntries);

        if (stillMissing.length > 0) {
          const fallbackEntries: Array<{ track: FileItem; duration: number }> = [];
          const fallbackMissing: FileItem[] = [];
          for (const track of stillMissing) {
            if (isCancelled) return;
            const path = `${folderPath}/${track.name}.track-data.v2.json`;
            const entry = await fetchTrackData(path);
            if (entry && typeof entry.duration === 'number') {
              fallbackEntries.push({ track, duration: entry.duration });
            } else {
              fallbackMissing.push(track);
            }
          }
          if (debugDurations) {
            console.log('[durations] resolved via fallback', fallbackEntries.map((entry) => entry.track.name));
          }
          updateDurations(fallbackEntries);

          if (fallbackMissing.length > 0) {
            setTrackDataStatus((prev) => {
              let next = prev;
              for (const track of fallbackMissing) {
                if (next[track.name] === 'missing') continue;
                if (next === prev) {
                  next = { ...prev };
                }
                next[track.name] = 'missing';
              }
              return next;
            });
          }
        }
      } finally {
        clearPending();
      }
    };

    runBatch();

    return () => {
      isCancelled = true;
      clearPending();
    };
  }, [folderPath, playlist, trackDurations]);

  useEffect(() => {
    if (Object.keys(trackDurations).length === 0) return;
    setTrackDataStatus((prev) => {
      let next = prev;
      for (const [name, duration] of Object.entries(trackDurations)) {
        if (typeof duration !== 'number') continue;
        if (next[name] === 'present') continue;
        if (next === prev) {
          next = { ...prev };
        }
        next[name] = 'present';
      }
      return next;
    });
  }, [trackDurations]);

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination || isGuest) return;
    const items = Array.from(playlist);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setPlaylist(items);
    saveRunningOrder(items);
  };

  const saveRunningOrder = (currentPlaylist: FileItem[]) => {
    queueRunningOrderSave(currentPlaylist);
  };

  const handlePlayFullSequence = () => {
    if (playlist.length > 0) {
      setIsAutoplay(true);
      if (currentTrack?.name === playlist[0].name) {
        wavesurfer?.setTime(0);
        onPlayPause();
      } else {
        setCurrentTrack(playlist[0]);
      }
    }
  };

  const handleSkipForward = () => {
    const currentIndex = playlist.findIndex((t) => t.name === currentTrack?.name);
    if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
      setCurrentTrack(playlist[currentIndex + 1]);
    }
  };

  const handleSkipBackward = () => {
    if (wavesurfer && wavesurfer.getCurrentTime() > 2) {
      wavesurfer.setTime(0);
      return;
    }
    const currentIndex = playlist.findIndex((t) => t.name === currentTrack?.name);
    if (currentIndex > 0) {
      setCurrentTrack(playlist[currentIndex - 1]);
    }
  };

  const handleSeek = (time: number) => {
    if (!wavesurfer) return;
    setNewCommentTimestamp(null);
    wavesurfer.setTime(time);
  };

  const handleCreateComment = (time: number) => {
    setNewCommentTimestamp(time);
  };

  const handleShare = async () => {
    setIsShareLoading(true);
    setShareSuccess(false);
    try {
      const res = await fetch(`/api/share?slug=${encodeURIComponent(folderPath)}`);
      const data = await res.json();
      if (data.shareUrl) {
        await navigator.clipboard.writeText(data.shareUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to share:', err);
    } finally {
      setIsShareLoading(false);
    }
  };

  if (!isClient || isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
          <div className="text-xl font-bold text-gray-400">Loading...</div>
        </div>
      </main>
    );
  }

  if (isFolderView) {
    return (
      <FolderView
        folderPath={folderPath}
        directories={directories}
        isGuest={isGuest}
        onShare={handleShare}
        isShareLoading={isShareLoading}
        shareSuccess={shareSuccess}
        token={token}
      />
    );
  }

  return (
    <>
      <PlayerView
        folderPath={folderPath}
        isGuest={isGuest}
        playlist={playlist}
        currentTrack={currentTrack}
        onShare={handleShare}
        isShareLoading={isShareLoading}
        shareSuccess={shareSuccess}
        isAutoplay={isAutoplay}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={onPlayPause}
        onPlayFullSequence={handlePlayFullSequence}
        onSkipForward={handleSkipForward}
        onSkipBackward={handleSkipBackward}
        onSeek={handleSeek}
        onCreateComment={handleCreateComment}
        containerRef={containerRef}
        comments={comments}
        hoveredCommentTimestamp={hoveredCommentTimestamp}
        setHoveredCommentTimestamp={setHoveredCommentTimestamp}
        newComment={newComment}
        newCommentInitials={newCommentInitials}
        newCommentTimestamp={newCommentTimestamp}
        setNewComment={setNewComment}
        setNewCommentInitials={setNewCommentInitials}
        setNewCommentTimestamp={setNewCommentTimestamp}
        replyingToCommentId={replyingToCommentId}
        setReplyingToCommentId={setReplyingToCommentId}
        addComment={addComment}
        deleteComment={deleteComment}
        confirmDeleteId={confirmDeleteId}
        setConfirmDeleteId={setConfirmDeleteId}
        onSelectTrack={setCurrentTrack}
        onReorder={onDragEnd}
        trackDurations={trackDurations}
        trackDataStatus={trackDataStatus}
      />
      {isGeneratingTrackData && !isTrackDataOverlayDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl px-8 py-6 text-center max-w-sm w-full">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-lg font-black text-slate-900">Generating track data</div>
            {generatingTrackName && (
              <div className="text-sm text-slate-500 mt-2 truncate">{generatingTrackName}</div>
            )}
            {trackDataPhase && (
              <div className="text-xs text-slate-400 mt-2">
                {trackDataPhase === 'downloading' && 'Downloading audio'}
                {trackDataPhase === 'decoding' && 'Decoding audio'}
                {trackDataPhase === 'waveform' && 'Generating waveform'}
                {trackDataPhase === 'saving' && 'Saving data'}
                {trackDataPhase === 'verifying' && 'Verifying upload'}
                {trackDataPercent !== null && ` • ${trackDataPercent}%`}
              </div>
            )}
            <div className="text-xs text-slate-400 mt-4">This can take a moment the first time.</div>
            <button
              type="button"
              onClick={() => setIsTrackDataOverlayDismissed(true)}
              className="mt-4 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Continue in background
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PlayerPageContainer;
