'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import WaveformData, { type WaveformDataInstance } from 'waveform-data';

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
    url: currentTrack ? `/api/audio?path=${folderPath}/${currentTrack.name}` : undefined,
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
    };

    const loadTrackData = async () => {
      const trackDataPath = `${folderPath}/${currentTrack.name}.track-data.v2.json`;
      const audioPath = `${folderPath}/${currentTrack.name}`;

      try {
        const checkRes = await fetch(`/api/track-data?path=${trackDataPath}&audioPath=${audioPath}&check=1`);
        if (!checkRes.ok) return;
        const checkData = (await checkRes.json()) as { exists: boolean; needsRegeneration: boolean };

        if (checkData.exists && !checkData.needsRegeneration) {
          const dataRes = await fetch(`/api/track-data?path=${trackDataPath}`);
          if (!dataRes.ok) return;
          const trackData = (await dataRes.json()) as { peaks: number[]; duration: number };
          if (isCancelled) return;
          setPeaks(trackData.peaks);
          setDuration(trackData.duration);
          updateTrackDurations(trackData.duration);
          return;
        }

        if (isCancelled) return;
        setIsGeneratingTrackData(true);
        setGeneratingTrackName(currentTrack.name);

        const audioRes = await fetch(`/api/audio?path=${audioPath}`);
        if (!audioRes.ok) return;
        const arrayBuffer = await audioRes.arrayBuffer();
        const audioContext = new AudioContext();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

        const waveform = await new Promise<WaveformDataInstance>((resolve, reject) => {
          WaveformData.createFromAudio(
            {
              audio_context: audioContext,
              audio_buffer: decodedBuffer,
              scale: 256,
            },
            (error, data) => {
              if (error) {
                reject(error);
              } else {
                resolve(data);
              }
            }
          );
        });

        const channel = waveform.channel(0);
        const min = channel.min_array();
        const max = channel.max_array();
        const computedPeaks = max.map((value, index) => Math.max(Math.abs(min[index]), Math.abs(value)) / 128);
        const nextDuration = decodedBuffer.duration;

        const nextTrackData = {
          duration: nextDuration,
          peaks: computedPeaks,
          sampleRate: decodedBuffer.sampleRate,
          scale: 256,
          generatedAt: new Date().toISOString(),
        };

        await fetch(`/api/track-data?path=${trackDataPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextTrackData),
        });

        if (isCancelled) return;
        setPeaks(computedPeaks);
        setDuration(nextDuration);
        updateTrackDurations(nextDuration);
        await audioContext.close();
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
