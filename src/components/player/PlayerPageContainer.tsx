'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OnDragEndResponder } from '@hello-pangea/dnd';
import { useParams, useSearchParams } from 'next/navigation';
import { useWavesurfer } from '@wavesurfer/react';

import FolderView from './FolderView';
import PlayerView from './PlayerView';
import { useComments } from './hooks/useComments';
import type { FileItem } from './types';

const PlayerPageContainer = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const slugParam = params.slug;
  const slug = Array.isArray(slugParam) ? slugParam : slugParam ? [slugParam] : [];
  const token = searchParams.get('token');
  const folderPath = slug.join('/');
  const runningOrderPath = `${folderPath}/running-order.json`;

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
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

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

  const autoplayRef = useRef(isAutoplay);
  autoplayRef.current = isAutoplay;
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const trackDurationsRef = useRef(trackDurations);
  trackDurationsRef.current = trackDurations;

  const isGuest = useMemo(() => Boolean(token), [token]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 100,
    waveColor: 'rgb(200, 200, 200)',
    progressColor: 'rgb(255, 85, 0)',
    url: currentTrack ? `/api/audio?path=${folderPath}/${currentTrack.name}` : undefined,
  });

  useEffect(() => {
    if (wavesurfer) {
      const onEnd = () => {
        if (autoplayRef.current) {
          const currentIndex = playlistRef.current.findIndex((t) => t.name === currentTrackRef.current?.name);
          if (currentIndex < playlistRef.current.length - 1) {
            setCurrentTrack(playlistRef.current[currentIndex + 1]);
          } else {
            setIsAutoplay(false);
          }
        }
      };

      const onReady = () => {
        const d = wavesurfer.getDuration();
        setDuration(d);

        if (currentTrackRef.current && !trackDurationsRef.current[currentTrackRef.current.name]) {
          setTrackDurations((prev) => {
            const next = { ...prev, [currentTrackRef.current!.name]: d };

            fetch(`/api/running-order?path=${runningOrderPath}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playlist: playlistRef.current.map((f) => f.name),
                durations: next,
              }),
            });

            return next;
          });
        }

        if (autoplayRef.current) {
          wavesurfer.setVolume(0);
          wavesurfer.play();
          const fadeDuration = 0.05;
          const startTime = Date.now();

          const interval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const ratio = Math.min(1, elapsed / fadeDuration);
            wavesurfer.setVolume(ratio);
            if (ratio === 1) {
              clearInterval(interval);
            }
          }, 5);
        }
      };
      wavesurfer.on('finish', onEnd);
      wavesurfer.on('ready', onReady);
      wavesurfer.on('decode', onReady);

      return () => {
        wavesurfer.un('finish', onEnd);
        wavesurfer.un('ready', onReady);
        wavesurfer.un('decode', onReady);
      };
    }
  }, [runningOrderPath, wavesurfer]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/files?path=${folderPath}`).then((res) => res.json()) as Promise<{ files: FileItem[] }>,
      fetch(`/api/running-order?path=${runningOrderPath}`).then((res) => (res.ok ? res.json() : null)) as Promise<
        { playlist: string[]; durations?: Record<string, number> } | null
      >,
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
      } else {
        setIsFolderView(true);
        setDirectories(subDirectories);
      }
      setIsLoading(false);
    });
  }, [folderPath, runningOrderPath]);

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

  const onPlayPause = async () => {
    if (!wavesurfer) return;

    if (isPlaying) {
      const fadeDuration = 0.05;
      const startVolume = wavesurfer.getVolume();
      const startTime = Date.now();

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          const ratio = Math.max(0, 1 - elapsed / fadeDuration);
          wavesurfer.setVolume(startVolume * ratio);
          if (ratio === 0) {
            clearInterval(interval);
            resolve();
          }
        }, 5);
      });

      wavesurfer.pause();
      wavesurfer.setVolume(startVolume);
    } else {
      wavesurfer.setVolume(0);
      wavesurfer.play();
      const fadeDuration = 0.05;
      const startTime = Date.now();

      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const ratio = Math.min(1, elapsed / fadeDuration);
        wavesurfer.setVolume(ratio);
        if (ratio === 1) {
          clearInterval(interval);
        }
      }, 5);
    }
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

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !wavesurfer) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const time = ratio * wavesurfer.getDuration();
    if ((e.target as HTMLElement).closest('.comment-marker')) return;

    if (e.metaKey || e.ctrlKey) {
      setNewCommentTimestamp(time);
    } else {
      setNewCommentTimestamp(null);
      wavesurfer.setTime(time);
    }
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
      onWaveformClick={handleWaveformClick}
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
      onDragEnd={onDragEnd}
      trackDurations={trackDurations}
    />
  );
};

export default PlayerPageContainer;
