// src/app/api/files/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';

  const mockData = {
    '': [
      { name: 'audio-folder-1', type: 'directory' },
      { name: 'audio-folder-2', type: 'directory' },
    ],
    'audio-folder-1': [
      { name: 'track_1.mp3', type: 'file' },
      { name: 'track_2.mp3', type: 'file' },
      { name: 'track_3.mp3', type: 'file' },
      { name: 'track_4.mp3', type: 'file' },
      { name: 'track_5.mp3', type: 'file' },
      { name: 'running-order.json', type: 'file' },
      { name: 'comments.json', type: 'file' },
    ],
    'audio-folder-2': [
      { name: 'track_1.mp3', type: 'file' },
      { name: 'track_2.mp3', type: 'file' },
      { name: 'track_3.mp3', type: 'file' },
      { name: 'track_4.mp3', type: 'file' },
      { name: 'track_5.mp3', type: 'file' },
      { name: 'running-order.json', type: 'file' },
      { name: 'comments.json', type: 'file' },
    ],
  };

  let files = mockData[path] || [];

  if (path) {
    // For a specific path, filter for audio files only
    files = files.filter(file => file.type === 'file' && file.name.match(/\.(mp3|wav|ogg)$/));
  } else {
    // For the root, filter for directories only
    files = files.filter(file => file.type === 'directory');
  }

  return NextResponse.json({ files });
}