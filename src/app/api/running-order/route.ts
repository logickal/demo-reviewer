// src/app/api/running-order/route.ts
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ROOT_DIR } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path');
  const legacyPath = searchParams.get('legacyPath');

  if (!rawPath) {
    return new Response('Path is required', { status: 400 });
  }

  const path = `${ROOT_DIR}${rawPath}`;
  const legacyFullPath = legacyPath ? `${ROOT_DIR}${legacyPath}` : null;

  try {
    const data = await storage.getFile(path);
    if (data) {
      return NextResponse.json(data);
    } else {
      if (legacyFullPath) {
        const legacyData = await storage.getFile(legacyFullPath);
        if (legacyData) {
          await storage.saveFile(path, legacyData);
          return NextResponse.json(legacyData);
        }
      }
      return new Response('Running order not found', { status: 404 });
    }
  } catch (error) {
    // 404 is handled by getFile returning null or we can catch distinct error
    return new Response('Running order not found', { status: 404 });
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
    return NextResponse.json({ message: 'Running order saved successfully' });
  } catch (error) {
    console.error(`Error saving running order for ${path}:`, error);
    return new Response('Error saving running order', { status: 500 });
  }
}
