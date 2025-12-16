// src/app/api/comments/route.ts
import { NextResponse } from 'next/server';

const mockCommentsStore: { [key: string]: any } = {};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return new Response('Path is required', { status: 400 });
  }

  console.log(`GET /api/comments for path: ${path}`);
  const comments = mockCommentsStore[path] || { comments: [] };
  
  return NextResponse.json(comments);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const data = await request.json();

  if (!path) {
    return new Response('Path is required', { status: 400 });
  }

  console.log(`POST /api/comments for path: ${path}`);
  console.log('Received data:', data);

  mockCommentsStore[path] = data;

  return NextResponse.json({ message: 'Comments saved successfully' });
}