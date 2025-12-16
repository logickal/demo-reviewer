import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ROOT_DIR } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path') || '';
  const path = `${ROOT_DIR}${rawPath}`;

  try {
    const files = await storage.listFiles(path);

    // Sort directories first, then files
    const sortedFiles = files.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

    return NextResponse.json({ files: sortedFiles });
  } catch (error) {
    console.error("Error listing files:", error);
    return new Response('Error listing files', { status: 500 });
  }
}