// src/app/api/audio/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return new Response('File not found', { status: 404 });
  }

  const absolutePath = path.join(process.cwd(), 'public', filePath);

  try {
    const file = fs.readFileSync(absolutePath);
    const headers = new Headers();
    const extension = path.extname(filePath).toLowerCase();
    
    if (extension === '.wav') {
      headers.set('Content-Type', 'audio/wav');
    } else if (extension === '.mp3') {
      headers.set('Content-Type', 'audio/mpeg');
    } else {
      return new Response('Unsupported audio type', { status: 400 });
    }

    return new Response(file, { headers });
  } catch (error) {
    console.error(error);
    return new Response('File not found', { status: 404 });
  }
}
