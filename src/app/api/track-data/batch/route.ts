import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ROOT_DIR } from '@/lib/config';

type BatchRequestBody = {
  paths?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as BatchRequestBody;
  const paths = Array.isArray(body.paths) ? body.paths : [];

  if (paths.length === 0) {
    return new Response('Paths are required', { status: 400 });
  }

  const results: Record<string, unknown> = {};
  let index = 0;
  const concurrency = 5;

  const worker = async () => {
    while (true) {
      const nextIndex = index;
      index += 1;
      const rawPath = paths[nextIndex];
      if (!rawPath) break;
      const path = `${ROOT_DIR}${rawPath}`;
      try {
        const data = await storage.getFile(path);
        results[rawPath] = data ?? null;
      } catch (error) {
        console.error(`Error fetching track data for ${path}:`, error);
        results[rawPath] = null;
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, paths.length) }, () => worker());
  await Promise.all(workers);

  return NextResponse.json(
    { data: results },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}
