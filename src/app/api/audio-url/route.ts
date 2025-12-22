import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ROOT_DIR } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path');

  if (!rawPath) {
    return new Response('Path is required', { status: 400 });
  }

  const filePath = `${ROOT_DIR}${rawPath}`;

  try {
    const signedUrl = await storage.getAudioUrl?.(filePath);
    if (!signedUrl) {
      return new Response('Signed URL unavailable', { status: 501 });
    }

    return NextResponse.json(
      { url: signedUrl },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (error) {
    console.error(error);
    return new Response('File not found', { status: 404 });
  }
}
