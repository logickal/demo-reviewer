// src/app/api/running-order/route.ts
import { NextResponse } from 'next/server';

let mockRunningOrder: any = null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  console.log(`GET /api/running-order for path: ${path}`);

  if (mockRunningOrder) {
    return NextResponse.json(mockRunningOrder);
  } else {
    return new Response('Running order not found', { status: 404 });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const data = await request.json();

  console.log(`POST /api/running-order for path: ${path}`);
  console.log('Received data:', data);

  mockRunningOrder = data;

  return NextResponse.json({ message: 'Running order saved successfully' });
}
