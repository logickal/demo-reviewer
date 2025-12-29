'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import { buildTrackDataFromAudioUrl } from '../utils/trackData';
import { fetchTrackData } from '../utils/trackDataClient';

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
  setTrackDataPhase?: (value: 'downloading' | 'decoding' | 'waveform' | 'saving' | 'verifying' | null) => void;
  setTrackDataPercent?: (value: number | null) => void;
  queueRunningOrderSave?: (playlist: FileItem[]) => void;
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
  setTrackDataPhase,
  setTrackDataPercent,
  queueRunningOrderSave,
}: UseWavesurferPlayerOptions) => {
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[] | undefined>(undefined);
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | undefined>(undefined);

  const autoplayRef = useRef(isAutoplay);
  const playlistRef = useRef(playlist);
  const currentTrackRef = useRef(currentTrack);
  const trackDurationsRef = useRef(trackDurations);

  autoplayRef.current = isAutoplay;
  playlistRef.current = playlist;
  currentTrackRef.current = currentTrack;
  trackDurationsRef.current = trackDurations;

  const peaksForWavesurfer = useMemo(() => (peaks ? [peaks] : undefined), [peaks]);
  const audioPath = useMemo(() => {
    if (!currentTrack) return null;
    return `${folderPath}/${currentTrack.name}`;
  }, [currentTrack, folderPath]);

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 100,
    waveColor: 'rgb(200, 200, 200)',
    progressColor: 'rgb(255, 85, 0)',
    url: signedAudioUrl,
    peaks: peaksForWavesurfer,
    duration: peaks ? duration : undefined,
    autoplay: isAutoplay,
  });

  useEffect(() => {
    if (!currentTrack) {
      setDuration(0);
      setPeaks(undefined);
      setSignedAudioUrl(undefined);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!audioPath) {
      setSignedAudioUrl(undefined);
      return;
    }

    let isCancelled = false;

    const loadSignedUrl = async () => {
      try {
        const res = await fetch(`/api/audio-url?path=${encodeURIComponent(audioPath)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { url?: string };
        if (isCancelled) return;
        setSignedAudioUrl(data.url);
      } catch (error) {
        if (!isCancelled) {
          setSignedAudioUrl(undefined);
        }
      }
    };

    loadSignedUrl();

    return () => {
      isCancelled = true;
    };
  }, [audioPath]);

  useEffect(() => {
    if (!currentTrack) return;
    let isCancelled = false;

    const updateTrackDurations = (nextDuration: number) => {
      if (trackDurationsRef.current[currentTrack.name]) return;
      setTrackDurations((prev) => {
        const next = { ...prev, [currentTrack.name]: nextDuration };
        queueRunningOrderSave?.(playlistRef.current);

        return next;
      });
    };

    const loadTrackData = async () => {
      const trackDataPath = `${folderPath}/${currentTrack.name}.track-data.v2.json`;
      const audioPathForCheck = `${folderPath}/${currentTrack.name}`;
      const encodedTrackDataPath = encodeURIComponent(trackDataPath);
      const encodedAudioPath = encodeURIComponent(audioPathForCheck);

      const getSignedAudioUrl = async () => {
        if (signedAudioUrl) return signedAudioUrl;
        const res = await fetch(`/api/audio-url?path=${encodedAudioPath}`);
        if (!res.ok) {
          throw new Error('Failed to load signed audio URL');
        }
        const data = (await res.json()) as { url?: string };
        if (!data.url) {
          throw new Error('Signed audio URL missing');
        }
        return data.url;
      };

      try {
        const checkRes = await fetch(
          `/api/track-data?path=${encodedTrackDataPath}&audioPath=${encodedAudioPath}&check=1`
        );
        if (!checkRes.ok) return;
        const checkData = (await checkRes.json()) as { exists: boolean; needsRegeneration: boolean };

        if (checkData.exists && !checkData.needsRegeneration) {
          const trackData = await fetchTrackData(trackDataPath);
          if (!trackData) return;
          if (isCancelled) return;
          setPeaks(trackData.peaks);
          setDuration(trackData.duration);
          updateTrackDurations(trackData.duration);
          return;
        }

        // If track data is missing or stale, generate it on demand.

        if (isCancelled) return;
        console.log(`Regenerating track data for ${currentTrack.name}`);
        setIsGeneratingTrackData(true);
        setGeneratingTrackName(currentTrack.name);
        setTrackDataPhase?.('downloading');
        setTrackDataPercent?.(null);

        const nextTrackData = await buildTrackDataFromAudioUrl(await getSignedAudioUrl(), 256, (progress) => {
          setTrackDataPhase?.(progress.phase);
          if (progress.percent !== undefined) {
            setTrackDataPercent?.(progress.percent);
          } else {
            setTrackDataPercent?.(null);
          }
        });

        setTrackDataPhase?.('saving');
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
          setTrackDataPhase?.(null);
          setTrackDataPercent?.(null);
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
    queueRunningOrderSave,
    setGeneratingTrackName,
    setIsGeneratingTrackData,
    setTrackDataPercent,
    setTrackDataPhase,
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
      if (Number.isFinite(nextDuration)) {
        setDuration((prev) => (prev === nextDuration ? prev : nextDuration));

        if (currentTrackRef.current && !trackDurationsRef.current[currentTrackRef.current.name]) {
          setTrackDurations((prev) => {
            const next = { ...prev, [currentTrackRef.current!.name]: nextDuration };
            queueRunningOrderSave?.(playlistRef.current);

            return next;
          });
        }
      }

      if (autoplayRef.current) {
        wavesurfer.setVolume(0);
        wavesurfer.play().catch((err) => {
          console.error('Autoplay failed:', err);
        });

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
    // Avoid double-triggering duration updates on both ready and decode.

    return () => {
      wavesurfer.un('finish', onEnd);
      wavesurfer.un('ready', onReady);
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
