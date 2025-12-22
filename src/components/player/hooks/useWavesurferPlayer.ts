'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import { buildTrackDataFromAudioUrl } from '../utils/trackData';

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
  setIsGeneratingTrackData: (value: boolean) => void;
  setGeneratingTrackName: (value: string | null) => void;
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
  setIsGeneratingTrackData,
  setGeneratingTrackName,
}: UseWavesurferPlayerOptions) => {
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[] | undefined>(undefined);

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
    url: currentTrack
      ? `/api/audio?path=${encodeURIComponent(`${folderPath}/${currentTrack.name}`)}`
      : undefined,
    peaks: peaks ? [peaks] : undefined,
    duration: peaks ? duration : undefined,
  });

  useEffect(() => {
    if (!currentTrack) {
      setDuration(0);
      setPeaks(undefined);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!currentTrack) return;
    let isCancelled = false;

    const updateTrackDurations = (nextDuration: number) => {
      if (trackDurationsRef.current[currentTrack.name]) return;
      setTrackDurations((prev) => {
        const next = { ...prev, [currentTrack.name]: nextDuration };

        fetch(`/api/running-order?path=${encodeURIComponent(runningOrderPath)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playlist: playlistRef.current.map((file) => file.name),
            durations: next,
          }),
        });

        return next;
      });
    };

    const loadTrackData = async () => {
      const trackDataPath = `${folderPath}/${currentTrack.name}.track-data.v2.json`;
      const audioPath = `${folderPath}/${currentTrack.name}`;
      const encodedTrackDataPath = encodeURIComponent(trackDataPath);
      const encodedAudioPath = encodeURIComponent(audioPath);

      try {
        const checkRes = await fetch(
          `/api/track-data?path=${encodedTrackDataPath}&audioPath=${encodedAudioPath}&check=1`
        );
        if (!checkRes.ok) return;
        const checkData = (await checkRes.json()) as { exists: boolean; needsRegeneration: boolean };

        if (checkData.exists && !checkData.needsRegeneration) {
          const dataRes = await fetch(`/api/track-data?path=${encodedTrackDataPath}`);
          if (!dataRes.ok) return;
          const trackData = (await dataRes.json()) as { peaks: number[]; duration: number };
          if (isCancelled) return;
          setPeaks(trackData.peaks);
          setDuration(trackData.duration);
          updateTrackDurations(trackData.duration);
          return;
        }

        if (!checkData.needsRegeneration) {
          return;
        }

        if (isCancelled) return;
        console.log(`Regenerating track data for ${currentTrack.name}`);
        setIsGeneratingTrackData(true);
        setGeneratingTrackName(currentTrack.name);

        const nextTrackData = await buildTrackDataFromAudioUrl(`/api/audio?path=${encodedAudioPath}`, 256, (progress) => {
          console.log(`Track data ${progress.phase} for ${currentTrack.name}`);
        });

        await fetch(`/api/track-data?path=${encodedTrackDataPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextTrackData),
        });

        if (isCancelled) return;
        setPeaks(nextTrackData.peaks);
        setDuration(nextTrackData.duration);
        updateTrackDurations(nextTrackData.duration);
        console.log(`Regenerated track data for ${currentTrack.name}`);
      } catch (error) {
        console.error('Failed to load track data:', error);
      } finally {
        if (!isCancelled) {
          setIsGeneratingTrackData(false);
          setGeneratingTrackName(null);
        }
      }
    };

    loadTrackData();

    return () => {
      isCancelled = true;
      setIsGeneratingTrackData(false);
      setGeneratingTrackName(null);
    };
  }, [
    currentTrack,
    folderPath,
    runningOrderPath,
    setGeneratingTrackName,
    setIsGeneratingTrackData,
    setTrackDurations,
  ]);

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

          fetch(`/api/running-order?path=${encodeURIComponent(runningOrderPath)}`, {
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
