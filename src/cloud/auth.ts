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
// Set synchronously at the very start of login() so a second concurrent call is
// rejected before it can spawn another loopback server. activeServer alone can't
// guard this: it's only assigned inside the async listen() callback.
let loginInProgress = false;
// Set while a login is pending so cancelLogin() can settle it from outside.
let cancelActiveLogin: (() => void) | null = null;

/** Abandon a pending sign-in. No-op when none is running. */
export function cancelLogin(): boolean {
    if (!cancelActiveLogin) return false;
    cancelActiveLogin();
    return true;
}

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

/** Decodes a JWT payload (unverified). Returns null on any malformed input. */
function decodeJwt(token: string): Record<string, unknown> | null {
    try {
        const payload = token.split('.')[1] ?? '';
        const json = Buffer.from(
            payload.replace(/-/g, '+').replace(/_/g, '/'),
            'base64'
        ).toString('utf8');
        return JSON.parse(json) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** Returns the user id (sub) from the (unverified) access-token payload. */
export function currentUserId(): string | null {
    if (!session) return null;
    return (decodeJwt(session.accessToken)?.sub as string) ?? null;
}

let refreshInFlight: Promise<void> | null = null;

async function refreshIfNeeded(): Promise<void> {
    if (!session) return;
    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt - now > 60) return; // still valid
    // Coalesce concurrent refreshes: Supabase rotates refresh tokens, so firing
    // several at once would let the first succeed and the rest 4xx, spuriously
    // logging the user out. All callers await the one in-flight refresh.
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = doRefresh().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
}

async function doRefresh(): Promise<void> {
    if (!session) return;
    const now = Math.floor(Date.now() / 1000);
    // Capture the token we're refreshing. If the user logs out (or re-logs in)
    // during the network round-trip, the session we're refreshing is no longer
    // current and we must NOT resurrect/overwrite it (or sign out the new one).
    const usingRefreshToken = session.refreshToken;
    const res = await fetch(
        `${CLOUD.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
            method: 'POST',
            headers: {
                apikey: CLOUD.supabaseAnonKey,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: usingRefreshToken }),
        }
    );

    // The session changed out from under us during the await — abandon quietly.
    if (!session || session.refreshToken !== usingRefreshToken) return;

    if (!res.ok) {
        // Definitive auth failures sign the user out: 400/401 (invalid/expired
        // refresh token), 403 (account banned/revoked) and 422 (unprocessable —
        // the token can't be used). Without these, a revoked account would retry
        // forever while still showing cached Pro. Transient 429/5xx must NOT sign
        // out — just fail this attempt and let the next tick retry, so a brief
        // outage doesn't wipe the session.
        if (
            res.status === 400 ||
            res.status === 401 ||
            res.status === 403 ||
            res.status === 422
        ) {
            await logout();
            throw new Error('Your session expired. Please sign in again.');
        }
        throw new Error('Could not refresh your session. Will retry.');
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
    // Persisting the rotated token can fail (e.g. OS keystore momentarily
    // unavailable). Don't throw out of the refresh if it does: the refreshed
    // session is already live in memory and usable for this run. Throwing here
    // would surface as a failed refresh while the OLD (now server-invalidated)
    // token remains on disk — forcing a logout on next launch. Residual
    // limitation: if the keystore stays unavailable, the rotated token can't be
    // persisted and re-auth may still be required next launch.
    try {
        saveSession(session);
    } catch (e) {
        console.warn('[auth] could not persist refreshed session (kept in memory):', e);
    }
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

function profileSnapshot(): string {
    return JSON.stringify([cachedIsPro, cachedPlan, cachedName, cachedAvatar]);
}

/**
 * Re-fetch the profile and, if anything the UI shows changed (name, avatar,
 * plan, Pro status), broadcast an auth-changed event so the app updates without
 * a restart. Safe to call on a timer or when the window regains focus.
 */
export async function refreshProfile(): Promise<void> {
    if (!session) return;
    const before = profileSnapshot();
    await fetchProfile();
    if (profileSnapshot() !== before) emit();
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
        // Reject a second concurrent login immediately. loginInProgress is set
        // synchronously (below), unlike activeServer which is only assigned once
        // the async listen() callback fires — a window a rapid second call would
        // otherwise slip through, spawning a duplicate loopback server.
        if (loginInProgress || activeServer) {
            reject(new Error('A sign-in is already in progress.'));
            return;
        }
        loginInProgress = true;

        const state = crypto.randomBytes(16).toString('hex');
        let settled = false;
        let timer: NodeJS.Timeout;

        const finish = (fn: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            cancelActiveLogin = null;
            try {
                server.close();
            } catch {
                /* ignore */
            }
            activeServer = null;
            loginInProgress = false;
            fn();
        };

        // Lets the UI abandon a sign-in that will never complete (browser closed,
        // stuck on the site, wrong account) without waiting out the timeout.
        cancelActiveLogin = () =>
            finish(() => reject(new Error('Sign-in cancelled.')));

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
                        // Deliberately does NOT settle the promise. A stale tab
                        // from an earlier, timed-out attempt can deliver to a
                        // port the OS has since handed back to us; letting that
                        // (or any local probe) cancel a live sign-in would be
                        // worse than ignoring it. The user can cancel explicitly.
                        console.warn('[auth] ignoring /deliver with mismatched state');
                        res.writeHead(400);
                        res.end('bad state');
                        return;
                    }
                    const accessToken = params.get('access_token') ?? '';
                    const refreshToken = params.get('refresh_token') ?? '';
                    const expiresAt = Number(params.get('expires_at') ?? '0');
                    // Prefer the email claim from the (self-consistent) JWT over
                    // the form field, which URLSearchParams would mangle if it
                    // ever contained a '+' (e.g. plus-addressed emails).
                    const email =
                        (decodeJwt(accessToken)?.email as string) ??
                        (params.get('email') ?? '');
                    if (!accessToken || !refreshToken) {
                        // The state matched, so this really is our handoff — it
                        // just arrived broken. Fail now instead of leaving the
                        // caller waiting out the five-minute timeout.
                        res.writeHead(400);
                        res.end('missing tokens');
                        finish(() =>
                            reject(new Error('Sign-in did not return a session. Please try again.'))
                        );
                        return;
                    }
                    const newSession: StoredSession = {
                        accessToken,
                        refreshToken,
                        expiresAt: expiresAt || Math.floor(Date.now() / 1000) + 3600,
                        email,
                    };
                    // Persist FIRST: if the OS keystore write fails we must not
                    // end up "logged in" only in memory with nothing on disk.
                    try {
                        saveSession(newSession);
                    } catch (e) {
                        res.writeHead(500);
                        res.end('store failed');
                        finish(() => reject(e as Error));
                        return;
                    }
                    session = newSession;
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
