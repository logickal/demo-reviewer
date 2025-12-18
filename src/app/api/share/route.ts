import { NextRequest, NextResponse } from 'next/server';
import { generateShareToken, verifyAuthSessionToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
    // Authorization check (only logged in users can generate share links)
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken || !await verifyAuthSessionToken(authToken)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
        return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const token = await generateShareToken(slug);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const shareUrl = `${baseUrl}/player/${slug}?token=${token}`;

    return NextResponse.json({ shareUrl });
}
