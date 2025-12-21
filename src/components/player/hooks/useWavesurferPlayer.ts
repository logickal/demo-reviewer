'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useWavesurfer } from '@wavesurfer/react';

import type { FileItem } from '../types';

type UseWavesurferPlayerOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  currentTrack: FileItem | null;
  folderPath: string;
  runningOrderPath: string;
  playlist: FileItem[];
  isAutoplay: boolean;
  setIsAutoplay: (value: boolean) => void;
  setCurrentTrack: (track: FileItem) => void;
  trackDurations: Record<string, number>;
  setTrackDurations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
};

export const useWavesurferPlayer = ({
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
}: UseWavesurferPlayerOptions) => {
  const [duration, setDuration] = useState(0);

  const autoplayRef = useRef(isAutoplay);
  const playlistRef = useRef(playlist);
  const currentTrackRef = useRef(currentTrack);
  const trackDurationsRef = useRef(trackDurations);

  autoplayRef.current = isAutoplay;
  playlistRef.current = playlist;
  currentTrackRef.current = currentTrack;
  trackDurationsRef.current = trackDurations;

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 100,
    waveColor: 'rgb(200, 200, 200)',
    progressColor: 'rgb(255, 85, 0)',
    url: currentTrack ? `/api/audio?path=${folderPath}/${currentTrack.name}` : undefined,
  });

  useEffect(() => {
    if (!currentTrack) {
      setDuration(0);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!wavesurfer) return;

    const onEnd = () => {
      if (!autoplayRef.current) return;
      const currentIndex = playlistRef.current.findIndex((track) => track.name === currentTrackRef.current?.name);
      if (currentIndex < playlistRef.current.length - 1) {
        setCurrentTrack(playlistRef.current[currentIndex + 1]);
      } else {
        setIsAutoplay(false);
      }
    };

    const onReady = () => {
      const nextDuration = wavesurfer.getDuration();
      setDuration(nextDuration);

      if (currentTrackRef.current && !trackDurationsRef.current[currentTrackRef.current.name]) {
        setTrackDurations((prev) => {
          const next = { ...prev, [currentTrackRef.current!.name]: nextDuration };

          fetch(`/api/running-order?path=${runningOrderPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playlist: playlistRef.current.map((file) => file.name),
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
  }, [runningOrderPath, setCurrentTrack, setIsAutoplay, setTrackDurations, wavesurfer]);

  const onPlayPause = useCallback(async () => {
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
      return;
    }

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
  }, [isPlaying, wavesurfer]);

  return {
    wavesurfer,
    isPlaying,
    currentTime,
    duration,
    onPlayPause,
  };
};
