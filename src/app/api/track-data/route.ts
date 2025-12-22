import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ROOT_DIR } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path');
  const rawAudioPath = searchParams.get('audioPath');
  const isCheck = searchParams.get('check') === '1';

  if (!rawPath) {
    return new Response('Path is required', { status: 400 });
  }

  const path = `${ROOT_DIR}${rawPath}`;

  if (isCheck) {
    try {
      const metadata = await storage.getFileMetadata(path);
      if (!metadata) {
        return NextResponse.json(
          { exists: false, needsRegeneration: false },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }

      let needsRegeneration = false;
      if (rawAudioPath) {
        const audioMetadata = await storage.getFileMetadata(`${ROOT_DIR}${rawAudioPath}`);
        if (audioMetadata && audioMetadata.updated > metadata.updated) {
          needsRegeneration = true;
        }
      }

      return NextResponse.json(
        { exists: true, needsRegeneration },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      console.error(`Error checking track data for ${path}:`, error);
      return new Response('Error checking track data', { status: 500 });
    }
  }

  try {
    const data = await storage.getFile(path);
    if (data) {
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }
    return new Response('Track data not found', { status: 404 });
  } catch (error) {
    console.error(`Error fetching track data for ${path}:`, error);
    return new Response('Track data not found', { status: 404 });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path');
  const data = await request.json();

  if (!rawPath) {
    return new Response('Path is required', { status: 400 });
  }

  const path = `${ROOT_DIR}${rawPath}`;

  try {
    await storage.saveFile(path, data);
    return NextResponse.json({ message: 'Track data saved successfully' });
  } catch (error) {
    console.error(`Error saving track data for ${path}:`, error);
    return new Response('Error saving track data', { status: 500 });
  }
}
