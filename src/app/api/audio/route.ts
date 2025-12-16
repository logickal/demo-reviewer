// src/app/api/audio/route.ts
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import path from 'path';
import { ROOT_DIR } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path');

  if (!rawPath) {
    return new Response('File not found', { status: 404 });
  }

  const filePath = `${ROOT_DIR}${rawPath}`;

  try {
    const stream = await storage.getAudioStream(filePath);

    const headers = new Headers();
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.wav') {
      headers.set('Content-Type', 'audio/wav');
    } else if (extension === '.mp3') {
      headers.set('Content-Type', 'audio/mpeg');
    } else {
      // Fallback or specific type
      headers.set('Content-Type', 'application/octet-stream');
    }

    // @ts-ignore - ReadableStream from node is compatible with Response body but types conflict sometimes
    return new Response(stream, { headers });
  } catch (error) {
    console.error(error);
    return new Response('File not found', { status: 404 });
  }
}
