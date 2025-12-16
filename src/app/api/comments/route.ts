// src/app/api/comments/route.ts
import { NextResponse } from 'next/server';

let mockComments: any = { comments: [] };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  console.log(`GET /api/comments for path: ${path}`);

  return NextResponse.json(mockComments);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const data = await request.json();

  console.log(`POST /api/comments for path: ${path}`);
  console.log('Received data:', data);

  mockComments = data;

  return NextResponse.json({ message: 'Comments saved successfully' });
}
