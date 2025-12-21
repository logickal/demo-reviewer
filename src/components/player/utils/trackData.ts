'use client';

import WaveformData, { type WaveformDataInstance } from 'waveform-data';

export type TrackData = {
  duration: number;
  peaks: number[];
  sampleRate: number;
  scale: number;
  generatedAt: string;
};

export const buildTrackDataFromAudioUrl = async (audioUrl: string, scale = 256): Promise<TrackData> => {
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error('Failed to load audio');
  }

  const arrayBuffer = await audioRes.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    const waveform = await new Promise<WaveformDataInstance>((resolve, reject) => {
      WaveformData.createFromAudio(
        {
          audio_context: audioContext,
          audio_buffer: decodedBuffer,
          scale,
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

    return {
      duration: decodedBuffer.duration,
      peaks: computedPeaks,
      sampleRate: decodedBuffer.sampleRate,
      scale,
      generatedAt: new Date().toISOString(),
    };
  } finally {
    await audioContext.close();
  }
};
