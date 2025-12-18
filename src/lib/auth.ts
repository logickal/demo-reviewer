const SHARE_SECRET = process.env.SHARE_SECRET || 'fallback-secret-for-dev';
const APP_PASSPHRASE = process.env.APP_PASSPHRASE || 'admin';

const encoder = new TextEncoder();

async function getCryptoKey() {
    return await crypto.subtle.importKey(
        'raw',
        encoder.encode(SHARE_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

async function hmacSha256(data: string): Promise<string> {
    const key = await getCryptoKey();
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function generateShareToken(slug: string): Promise<string> {
    return await hmacSha256(slug);
}

export async function verifyShareToken(slug: string, token: string): Promise<boolean> {
    const expectedToken = await generateShareToken(slug);
    // Simple comparison is usually fine for this use case in Edge, 
    // but we can do a basic timing-safe loop if desired.
    if (token.length !== expectedToken.length) return false;
    let result = 0;
    for (let i = 0; i < token.length; i++) {
        result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
    }
    return result === 0;
}

export async function generateAuthSessionToken(): Promise<string> {
    return await hmacSha256(`auth-session-${APP_PASSPHRASE}`);
}

export async function verifyAuthSessionToken(token: string): Promise<boolean> {
    const expectedToken = await generateAuthSessionToken();
    if (!token || token.length !== expectedToken.length) return false;
    let result = 0;
    for (let i = 0; i < token.length; i++) {
        result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
    }
    return result === 0;
}
