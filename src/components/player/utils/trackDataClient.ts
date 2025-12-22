'use client';

import type { TrackData } from './trackData';

type TrackDataResponse = TrackData | null;

const trackDataCache = new Map<string, TrackData>();

export const fetchTrackData = async (path: string): Promise<TrackDataResponse> => {
  const cached = trackDataCache.get(path);
  if (cached) {
    return cached;
  }

  const res = await fetch(`/api/track-data?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as TrackData;
  if (data && typeof data.duration === 'number') {
    trackDataCache.set(path, data);
  }
  return data;
};

export const fetchTrackDataBatch = async (paths: string[]): Promise<Record<string, TrackDataResponse>> => {
  const result: Record<string, TrackDataResponse> = {};
  const uniquePaths = Array.from(new Set(paths));
  const uncachedPaths: string[] = [];

  for (const path of uniquePaths) {
    const cached = trackDataCache.get(path);
    if (cached) {
      result[path] = cached;
    } else {
      uncachedPaths.push(path);
    }
  }

  if (uncachedPaths.length === 0) {
    return result;
  }

  const res = await fetch('/api/track-data/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths: uncachedPaths }),
  });

  if (!res.ok) {
    return result;
  }

  const data = (await res.json()) as { data?: Record<string, TrackDataResponse> };
  const payload = data.data || {};

  for (const [path, trackData] of Object.entries(payload)) {
    if (trackData && typeof trackData.duration === 'number') {
      trackDataCache.set(path, trackData as TrackData);
    }
    result[path] = trackData ?? null;
  }

  return result;
};
