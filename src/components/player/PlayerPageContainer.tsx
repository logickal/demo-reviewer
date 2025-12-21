'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OnDragEndResponder } from '@hello-pangea/dnd';
import { useParams, useSearchParams } from 'next/navigation';

import FolderView from './FolderView';
import PlayerView from './PlayerView';
import { useComments } from './hooks/useComments';
import { useWavesurferPlayer } from './hooks/useWavesurferPlayer';
import { buildTrackDataFromAudioUrl, type TrackData, type TrackDataProgress } from './utils/trackData';
import type { FileItem } from './types';

const PlayerPageContainer = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const slugParam = params.slug;
  const slug = Array.isArray(slugParam) ? slugParam : slugParam ? [slugParam] : [];
  const token = searchParams.get('token');
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
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isGeneratingTrackData, setIsGeneratingTrackData] = useState(false);
  const [generatingTrackName, setGeneratingTrackName] = useState<string | null>(null);
  const [trackDataTotal, setTrackDataTotal] = useState(0);
  const [trackDataCompleted, setTrackDataCompleted] = useState(0);
  const [trackDataPhase, setTrackDataPhase] = useState<TrackDataProgress['phase'] | null>(null);
  const [trackDataPercent, setTrackDataPercent] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackDataInitRef = useRef<string | null>(null);

  const commentsPath = currentTrack ? `${folderPath}/${currentTrack.name}.comments.json` : null;
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
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/files?path=${folderPath}`).then((res) => res.json()) as Promise<{ files: FileItem[] }>,
      fetch(`/api/running-order?path=${runningOrderPath}&legacyPath=${legacyRunningOrderPath}`).then((res) =>
        res.ok ? res.json() : null
      ) as Promise<{ playlist: string[]; durations?: Record<string, number> } | null>,
    ]).then(([filesData, orderData]) => {
      const allFiles = filesData.files || [];
      const audioFiles = allFiles.filter((f) => f.type === 'file' && f.name.match(/\.(mp3|wav|ogg)$/i));
      const subDirectories = allFiles.filter((f) => f.type === 'directory');

      if (audioFiles.length > 0) {
        setIsFolderView(false);
        let pl = audioFiles;
        if (orderData) {
          if (orderData.durations) {
            setTrackDurations(orderData.durations);
          }
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
          saveRunningOrder(pl);
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
    if (trackDataInitRef.current === folderPath) return;
    trackDataInitRef.current = folderPath;

    let isCancelled = false;

    const generateMissingTrackData = async () => {
      const missingTracks: FileItem[] = [];

      for (const track of playlist) {
        const trackDataPath = `${folderPath}/${track.name}.track-data.v2.json`;
        const audioPath = `${folderPath}/${track.name}`;
        const res = await fetch(`/api/track-data?path=${trackDataPath}&audioPath=${audioPath}&check=1`);
        if (!res.ok) continue;
        const data = (await res.json()) as { exists: boolean };
        if (!data.exists) {
          missingTracks.push(track);
        }
      }

      if (missingTracks.length === 0 || isCancelled) return;

      console.log(`Generating track data for ${missingTracks.length} track(s) in ${folderPath}`);
      setTrackDataTotal(missingTracks.length);
      setTrackDataCompleted(0);
      setTrackDataPhase('downloading');
      setTrackDataPercent(null);
      setIsGeneratingTrackData(true);
      let nextDurations: Record<string, number> = {};

      let completedCount = 0;
      for (const track of missingTracks) {
        if (isCancelled) break;
        setGeneratingTrackName(track.name);
        console.log(`Generating track data (${completedCount + 1}/${missingTracks.length}): ${track.name}`);

        const trackDataPath = `${folderPath}/${track.name}.track-data.v2.json`;
        const nextTrackData: TrackData = await buildTrackDataFromAudioUrl(
          `/api/audio?path=${folderPath}/${track.name}`,
          256,
          (progress) => {
            if (isCancelled) return;
            setTrackDataPhase(progress.phase);
            if (progress.percent !== undefined) {
              setTrackDataPercent(progress.percent);
            } else {
              setTrackDataPercent(null);
            }
          }
        );

        setTrackDataPhase('saving');
        await fetch(`/api/track-data?path=${trackDataPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextTrackData),
        });

        setTrackDataPhase('verifying');
        let verified = false;
        for (let attempt = 1; attempt <= 8; attempt += 1) {
          if (isCancelled) break;
          await new Promise((resolve) => setTimeout(resolve, attempt * 750));
          const verifyRes = await fetch(
            `/api/track-data?path=${trackDataPath}&check=1`
          );
          if (!verifyRes.ok) continue;
          const verifyData = (await verifyRes.json()) as { exists: boolean };
          if (verifyData.exists) {
            verified = true;
            break;
          }
        }

        if (!verified) {
          console.warn(`Track data save still pending for ${track.name}`);
        }

        setTrackDataPercent(null);

        nextDurations = { ...nextDurations, [track.name]: nextTrackData.duration };
        setTrackDurations((prev) => ({ ...prev, [track.name]: nextTrackData.duration }));
        completedCount += 1;
        setTrackDataCompleted(completedCount);
      }

      if (Object.keys(nextDurations).length > 0 && !isCancelled) {
        const mergedDurations = { ...trackDurations, ...nextDurations };
        fetch(`/api/running-order?path=${runningOrderPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playlist: playlist.map((file) => file.name),
            durations: mergedDurations,
          }),
        });
      }

      if (!isCancelled) {
        setIsGeneratingTrackData(false);
        setGeneratingTrackName(null);
        setTrackDataTotal(0);
        setTrackDataCompleted(0);
        setTrackDataPhase(null);
        setTrackDataPercent(null);
      }
    };

    generateMissingTrackData().catch((error) => {
      console.error('Failed to generate track data:', error);
      if (!isCancelled) {
        setIsGeneratingTrackData(false);
        setGeneratingTrackName(null);
        setTrackDataTotal(0);
        setTrackDataCompleted(0);
        setTrackDataPhase(null);
        setTrackDataPercent(null);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [folderPath, playlist, runningOrderPath, trackDurations]);

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination || isGuest) return;
    const items = Array.from(playlist);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setPlaylist(items);
    saveRunningOrder(items);
  };

  const saveRunningOrder = (currentPlaylist: FileItem[]) => {
    fetch(`/api/running-order?path=${runningOrderPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlist: currentPlaylist.map((f) => f.name),
        durations: trackDurations,
      }),
    });
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
      />
      {isGeneratingTrackData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl px-8 py-6 text-center max-w-sm w-full">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-lg font-black text-slate-900">Generating track data</div>
            {trackDataTotal > 0 && (
              <div className="text-sm text-slate-500 mt-2">
                {trackDataCompleted} of {trackDataTotal} complete
              </div>
            )}
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
          </div>
        </div>
      )}
    </>
  );
};

export default PlayerPageContainer;
