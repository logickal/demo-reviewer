import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuthSessionToken, verifyShareToken } from './lib/auth';

export async function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;

    // 1. Allow public assets and login page
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/auth') ||
        pathname === '/login' ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    // 2. Check for global session cookie
    const authToken = request.cookies.get('auth-token')?.value;
    if (authToken && await verifyAuthSessionToken(authToken)) {
        return NextResponse.next();
    }

    // 3. Check for share token on player pages
    if (pathname.startsWith('/player/')) {
        const slug = pathname.replace('/player/', '');
        const token = searchParams.get('token');

        if (token && await verifyShareToken(slug, token)) {
            return NextResponse.next();
        }
    }

    // 4. Redirect to login if not authorized
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
