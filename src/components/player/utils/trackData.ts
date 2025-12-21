'use client';

import WaveformData, { type WaveformDataInstance } from 'waveform-data';

export type TrackData = {
  duration: number;
  peaks: number[];
  sampleRate: number;
  scale: number;
  generatedAt: string;
};

export type TrackDataProgress = {
  phase: 'downloading' | 'decoding' | 'waveform' | 'saving';
  percent?: number;
};

const readResponseArrayBuffer = async (
  response: Response,
  onProgress?: (progress: TrackDataProgress) => void
): Promise<ArrayBuffer> => {
  if (!response.body) {
    return response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const contentLengthHeader = response.headers.get('Content-Length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedLength += value.length;
      if (contentLength && onProgress) {
        onProgress({
          phase: 'downloading',
          percent: Math.min(100, Math.round((receivedLength / contentLength) * 100)),
        });
      }
    }
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }
  return result.buffer;
};

export const buildTrackDataFromAudioUrl = async (
  audioUrl: string,
  scale = 256,
  onProgress?: (progress: TrackDataProgress) => void
): Promise<TrackData> => {
  onProgress?.({ phase: 'downloading' });
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    throw new Error('Failed to load audio');
  }

  const arrayBuffer = await readResponseArrayBuffer(audioRes, onProgress);
  const audioContext = new AudioContext();

  try {
    onProgress?.({ phase: 'decoding' });
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    onProgress?.({ phase: 'waveform' });
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
