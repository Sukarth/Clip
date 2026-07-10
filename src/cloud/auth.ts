import * as http from 'http';
import * as crypto from 'crypto';
import { shell } from 'electron';
import { CLOUD } from './config';
import {
    StoredSession,
    loadSession,
    saveSession,
    clearSession,
} from './tokenStore';

export interface AuthState {
    loggedIn: boolean;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    isPro: boolean;
    plan: 'free' | 'pro' | null;
}

let session: StoredSession | null = null;
let cachedIsPro = false;
let cachedPlan: 'free' | 'pro' | null = null;
let cachedName: string | null = null;
let cachedAvatar: string | null = null;
let onChange: (() => void) | null = null;
let activeServer: http.Server | null = null;

const LOGGED_OUT: AuthState = {
    loggedIn: false,
    email: null,
    name: null,
    avatarUrl: null,
    isPro: false,
    plan: null,
};

export function initAuth(onChangeCb: () => void): void {
    onChange = onChangeCb;
    session = loadSession();
}

function emit(): void {
    try {
        onChange?.();
    } catch {
        /* ignore */
    }
}

export function isLoggedIn(): boolean {
    return session !== null;
}

/** Returns the user id (sub) from the (unverified) access-token payload. */
export function currentUserId(): string | null {
    if (!session) return null;
    try {
        const payload = session.accessToken.split('.')[1] ?? '';
        const json = Buffer.from(
            payload.replace(/-/g, '+').replace(/_/g, '/'),
            'base64'
        ).toString('utf8');
        return (JSON.parse(json).sub as string) ?? null;
    } catch {
        return null;
    }
}

async function refreshIfNeeded(): Promise<void> {
    if (!session) return;
    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt - now > 60) return; // still valid

    const res = await fetch(
        `${CLOUD.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
            method: 'POST',
            headers: {
                apikey: CLOUD.supabaseAnonKey,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: session.refreshToken }),
        }
    );

    if (!res.ok) {
        // Refresh token no longer valid — force a clean logout.
        await logout();
        throw new Error('Your session expired. Please sign in again.');
    }

    const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_at?: number;
        expires_in?: number;
        user?: { email?: string };
    };
    session = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? session.refreshToken,
        expiresAt: data.expires_at ?? now + (data.expires_in ?? 3600),
        email: data.user?.email ?? session.email,
    };
    saveSession(session);
}

/** A valid access token, refreshing transparently, or null if signed out. */
export async function getAccessToken(): Promise<string | null> {
    if (!session) return null;
    try {
        await refreshIfNeeded();
    } catch {
        return null;
    }
    return session?.accessToken ?? null;
}

async function fetchProfile(): Promise<void> {
    const token = await getAccessToken();
    if (!token) {
        cachedIsPro = false;
        cachedPlan = null;
        cachedName = null;
        cachedAvatar = null;
        return;
    }
    try {
        // RLS returns only the caller's own row.
        const res = await fetch(
            `${CLOUD.supabaseUrl}/rest/v1/profiles?select=is_pro,plan,full_name,avatar_url`,
            {
                headers: {
                    apikey: CLOUD.supabaseAnonKey,
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        if (res.ok) {
            const rows = (await res.json()) as Array<{
                is_pro?: boolean;
                plan?: string;
                full_name?: string | null;
                avatar_url?: string | null;
            }>;
            const row = rows?.[0];
            cachedIsPro = Boolean(row?.is_pro);
            cachedPlan = (row?.plan as 'free' | 'pro') ?? 'free';
            cachedName = row?.full_name ?? null;
            cachedAvatar = row?.avatar_url ?? null;
        }
    } catch {
        /* keep last-known values */
    }
}

export async function getAuthState(refresh = true): Promise<AuthState> {
    if (!session) return LOGGED_OUT;
    if (refresh) await fetchProfile();
    return {
        loggedIn: true,
        email: session.email,
        name: cachedName,
        avatarUrl: cachedAvatar,
        isPro: cachedIsPro,
        plan: cachedPlan,
    };
}

export async function logout(): Promise<void> {
    const token = session?.accessToken;
    session = null;
    cachedIsPro = false;
    cachedPlan = null;
    cachedName = null;
    cachedAvatar = null;
    clearSession();
    if (token) {
        try {
            await fetch(`${CLOUD.supabaseUrl}/auth/v1/logout`, {
                method: 'POST',
                headers: {
                    apikey: CLOUD.supabaseAnonKey,
                    Authorization: `Bearer ${token}`,
                },
            });
        } catch {
            /* best effort */
        }
    }
    emit();
}

const CALLBACK_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Clip sign-in</title>
<meta name="color-scheme" content="dark"></head>
<body style="font-family:system-ui,sans-serif;background:#0b0c0e;color:#f3f6f9;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center;max-width:420px;padding:24px">
<h2 style="font-weight:700;margin:0 0 8px">Signing you in…</h2>
<p id="s" style="color:#98a2ad;margin:0">One moment.</p></div>
<script>
var h=location.hash.slice(1);
fetch('/deliver',{method:'POST',headers:{'content-type':'text/plain'},body:h})
.then(function(r){document.getElementById('s').textContent=r.ok?'Signed in! You can close this tab and return to Clip.':'Something went wrong. Return to Clip and try again.';})
.catch(function(){document.getElementById('s').textContent='Could not reach the app. Return to Clip and try again.';});
</script></body></html>`;

/**
 * Opens the browser to the site's /desktop handoff page and waits on a
 * temporary 127.0.0.1 listener for the session to be handed back (via the URL
 * fragment, which a tiny served page POSTs to /deliver). Resolves with the
 * new auth state.
 */
export function login(): Promise<AuthState> {
    return new Promise<AuthState>((resolve, reject) => {
        if (activeServer) {
            reject(new Error('A sign-in is already in progress.'));
            return;
        }

        const state = crypto.randomBytes(16).toString('hex');
        let settled = false;
        let timer: NodeJS.Timeout;

        const finish = (fn: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                server.close();
            } catch {
                /* ignore */
            }
            activeServer = null;
            fn();
        };

        const server = http.createServer((req, res) => {
            const url = new URL(req.url ?? '/', 'http://127.0.0.1');

            if (req.method === 'GET' && url.pathname === '/callback') {
                res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
                res.end(CALLBACK_HTML);
                return;
            }

            if (req.method === 'POST' && url.pathname === '/deliver') {
                let body = '';
                req.on('data', (chunk) => {
                    body += chunk;
                    if (body.length > 16384) req.destroy();
                });
                req.on('end', () => {
                    const params = new URLSearchParams(body);
                    if (params.get('state') !== state) {
                        res.writeHead(400);
                        res.end('bad state');
                        return;
                    }
                    const accessToken = params.get('access_token') ?? '';
                    const refreshToken = params.get('refresh_token') ?? '';
                    const expiresAt = Number(params.get('expires_at') ?? '0');
                    const email = params.get('email') ?? '';
                    if (!accessToken || !refreshToken) {
                        res.writeHead(400);
                        res.end('missing tokens');
                        return;
                    }
                    session = {
                        accessToken,
                        refreshToken,
                        expiresAt: expiresAt || Math.floor(Date.now() / 1000) + 3600,
                        email,
                    };
                    try {
                        saveSession(session);
                    } catch (e) {
                        res.writeHead(500);
                        res.end('store failed');
                        finish(() => reject(e as Error));
                        return;
                    }
                    res.writeHead(200, { 'content-type': 'text/plain' });
                    res.end('ok');
                    // Load Pro status, notify the app, then resolve.
                    fetchProfile().finally(() => {
                        emit();
                        finish(() =>
                            resolve({
                                loggedIn: true,
                                email: session?.email ?? email,
                                name: cachedName,
                                avatarUrl: cachedAvatar,
                                isPro: cachedIsPro,
                                plan: cachedPlan,
                            })
                        );
                    });
                });
                return;
            }

            res.writeHead(404);
            res.end();
        });

        server.on('error', (e) => finish(() => reject(e)));
        timer = setTimeout(
            () => finish(() => reject(new Error('Sign-in timed out. Please try again.'))),
            5 * 60 * 1000
        );

        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            const port = typeof addr === 'object' && addr ? addr.port : 0;
            if (!port) {
                finish(() => reject(new Error('Could not start the local sign-in listener.')));
                return;
            }
            activeServer = server;
            const authUrl = `${CLOUD.siteUrl}/desktop?port=${port}&state=${state}`;
            void shell.openExternal(authUrl);
        });
    });
}
