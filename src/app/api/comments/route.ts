// src/app/api/comments/route.ts
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ROOT_DIR } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path');

  if (!rawPath) {
    return new Response('Path is required', { status: 400 });
  }

  const path = `${ROOT_DIR}${rawPath}`;

  try {
    const data = await storage.getFile(path);
    return NextResponse.json(data || { comments: [] });
  } catch (error) {
    console.error(`Error fetching comments for ${path}:`, error);
    // If file doesn't exist, return empty
    return NextResponse.json({ comments: [] });
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
    return NextResponse.json({ message: 'Comments saved successfully' });
  } catch (error) {
    console.error(`Error saving comments for ${path}:`, error);
    return new Response('Error saving comments', { status: 500 });
  }
}