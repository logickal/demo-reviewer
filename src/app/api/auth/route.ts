import { NextRequest, NextResponse } from 'next/server';
import { generateAuthSessionToken } from '@/lib/auth';

const APP_PASSPHRASE = process.env.APP_PASSPHRASE || 'admin';

export async function POST(request: NextRequest) {
    try {
        const { passphrase } = await request.json();

        if (passphrase === APP_PASSPHRASE) {
            const token = await generateAuthSessionToken();

            const response = NextResponse.json(
                { message: 'Authenticated' },
                { status: 200 }
            );

            // Set cookie
            response.cookies.set('auth-token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // 1 week
                path: '/',
            });

            return response;
        }

        return NextResponse.json(
            { error: 'Invalid passphrase' },
            { status: 401 }
        );
    } catch (error) {
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
