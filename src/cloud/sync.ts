import * as os from 'os';
import { createHash, randomUUID } from 'crypto';
import { CLOUD } from './config';
import { getAccessToken } from './auth';
import * as box from './crypto';

// ---------------------------------------------------------------------------
// Reconciliation sync engine (zero-knowledge).
//
// Identity: a clip is identified locally by (type, sha256(content)) and
// globally by a client_id (uuid). A shadow `sync_map` records the last-known
// synced state per client_id. Each cycle:
//   push  = diff local clips vs sync_map  → new / pin-changed / deleted
//   pull  = apply server changes since a cursor (LWW by version)
// Clip contents are AES-256-GCM encrypted before upload; the server sees only
// ciphertext. No changes to the core clipboard tables/paths are required.
// ---------------------------------------------------------------------------

export interface LocalClip {
    id: number;
    type: 'text' | 'image';
    content: string;
    pinned: number;
}

export interface SyncMapRow {
    clientId: string;
    contentHash: string;
    type: string;
    version: number;
    pinned: number;
    deleted: number; // 0 = live, 1 = tombstoned+synced, 2 = pending user deletion
    updatedAt: number;
}

export interface SyncHost {
    getState(key: string): string | null;
    setState(key: string, value: string): void;
    readClips(): LocalClip[];
    findClipByContent(type: string, content: string): { id: number; pinned: number } | null;
    insertClip(type: 'text' | 'image', content: string, timestamp: number, pinned: boolean): void;
    deleteClip(id: number): void;
    setPinned(id: number, pinned: boolean): void;
    readSyncMap(): SyncMapRow[];
    upsertSyncMap(row: SyncMapRow): void;
    clearSyncMap(): void;
    // Mark a synced clip as a *pending* user deletion (deleted=2) so the next
    // push tombstones it cloud-wide. Distinct from local cap-eviction, which
    // must NOT propagate. markAllDeleted covers "clear history".
    markDeletedByContent(type: string, contentHash: string): void;
    markAllDeleted(): void;
    refreshUi(): void;
    onRemoteSignout(): void;
    saveKey(keyB64: string | null): void; // OS-encrypted at rest (safeStorage)
    loadKey(): string | null;
}

export interface SyncStatus {
    enabled: boolean;
    unlocked: boolean;
    lastSync: number | null;
    lastError: string | null;
    syncing: boolean;
    /** Device-registration problem (e.g. device limit reached). Not sync-specific. */
    deviceError: string | null;
}

const MAX_CLIP_BYTES = 1024 * 1024;
const PULL_LIMIT = 200;

let host: SyncHost | null = null;
let key: Buffer | null = null; // derived encryption key — in memory only
// Has `key` been checked against the server's *current* verifier since this
// unlock? An auto-unlocked (OS-cached) key can be stale if another device reset
// the passphrase, so we must verify it once before trusting it for sync.
let keyVerified = false;
let syncing = false;
let lastSync: number | null = null;
let lastError: string | null = null;
// Kept separate from lastError: device registration is not Pro-gated and runs
// even with sync off, so its failures must survive a sync cycle overwriting
// lastError (and must be showable to free users).
let deviceError: string | null = null;
let autoTimer: NodeJS.Timeout | null = null;

export function initSync(h: SyncHost): void {
    host = h;
    const stored = h.getState('sync_last_sync');
    lastSync = stored ? Number(stored) : null;
    // Auto-unlock from the OS-encrypted key cache (no passphrase re-entry).
    const kb = h.loadKey();
    if (kb) {
        try {
            const decoded = Buffer.from(kb, 'base64');
            // A valid derived key is exactly 32 bytes (AES-256). A wrong length
            // means the cache is corrupt/truncated — treat as locked rather than
            // let isUnlocked() report true for a key that can't encrypt/decrypt.
            key = decoded.length === 32 ? decoded : null;
        } catch {
            key = null;
        }
    }
    // The cached key is loaded but NOT yet checked against the server — the
    // first syncNow verifies it before use (see BUG 1 handling there).
    keyVerified = false;
}

export function isEnabled(): boolean {
    return host?.getState('sync_enabled') === '1';
}

export function isUnlocked(): boolean {
    return key !== null;
}

export function getStatus(): SyncStatus {
    return { enabled: isEnabled(), unlocked: isUnlocked(), lastSync, lastError, syncing, deviceError };
}

export function lock(): void {
    key = null;
    keyVerified = false;
    host?.saveKey(null);
}

function hashOf(type: string, content: string): string {
    return createHash('sha256').update(type + '\0' + content).digest('hex');
}

function hkey(type: string, content: string): string {
    return type + ':' + hashOf(type, content);
}

async function api(path: string, init: RequestInit, timeoutMs = 60000): Promise<Response | null> {
    const token = await getAccessToken();
    if (!token) return null;
    // Bound every request so a half-open socket (sleep/resume, captive portal)
    // can't leave the caller (and the `syncing` guard) hung indefinitely.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(`${CLOUD.siteUrl}${path}`, {
            ...init,
            signal: ctrl.signal,
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
                ...(init.headers || {}),
            },
        });
    } catch {
        // Network failure / abort / offline — callers treat null as "retry later".
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** Turn raw fetch/network failures into a friendly, offline-aware message. */
function netMessage(e: unknown): string {
    const m = e instanceof Error ? e.message : String(e);
    if (/fetch failed|network|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|timeout|ERR_/i.test(m)) {
        return 'You appear to be offline. Sync will retry automatically.';
    }
    return m;
}

// --- Passphrase / key material --------------------------------------------

/** Unlock (or first-time set up) sync with a passphrase. */
export async function setupPassphrase(
    passphrase: string
): Promise<{ ok: boolean; error?: string }> {
    const res = await api('/api/sync/keys', { method: 'GET' });
    if (!res) return { ok: false, error: 'You need to be signed in.' };
    if (res.status === 402) return { ok: false, error: 'Cloud sync requires Clip Pro.' };
    if (!res.ok) return { ok: false, error: 'Could not reach the sync service.' };

    const data = (await res.json()) as {
        configured: boolean;
        salt?: string;
        verifier?: string | null;
        verifierNonce?: string | null;
    };

    if (data.configured && data.salt) {
        // A configured key must always carry a verifier. If it doesn't (partial
        // setup / interrupted reset), we cannot validate the passphrase — refuse
        // rather than silently accept a wrong key that would corrupt every sync.
        if (!data.verifier || !data.verifierNonce) {
            return { ok: false, error: 'Your sync key is incomplete. Please reset your passphrase to continue.' };
        }
        const salt = Buffer.from(data.salt, 'base64');
        const k = await box.deriveKey(passphrase, salt);
        const ok = box.checkVerifier(
            k,
            Buffer.from(data.verifier, 'base64'),
            Buffer.from(data.verifierNonce, 'base64')
        );
        if (!ok) return { ok: false, error: 'That passphrase is incorrect.' };
        key = k;
        keyVerified = true; // checkVerifier just passed against the server's current verifier
        host?.saveKey(k.toString('base64'));
        return { ok: true };
    }

    // First-time setup: mint salt + verifier and store them server-side.
    const salt = box.newSalt();
    const k = await box.deriveKey(passphrase, salt);
    const { verifier, verifierNonce } = box.makeVerifier(k);
    const put = await api('/api/sync/keys', {
        method: 'PUT',
        body: JSON.stringify({
            salt: salt.toString('base64'),
            verifier: verifier.toString('base64'),
            verifierNonce: verifierNonce.toString('base64'),
            kdf: 'argon2id',
        }),
    });
    if (!put || !put.ok) return { ok: false, error: 'Could not save your sync key.' };
    key = k;
    keyVerified = true; // first-time setup: this key defines the server verifier, so it is trusted
    host?.saveKey(k.toString('base64'));
    return { ok: true };
}

/**
 * Forgot-passphrase recovery: wipe all cloud data + key material, then set a
 * brand-new passphrase and re-upload the current local clips. Local history is
 * never touched destructively.
 */
export async function resetPassphrase(
    newPassphrase: string
): Promise<{ ok: boolean; error?: string }> {
    const reset = await api('/api/sync/reset', { method: 'POST' });
    if (!reset) return { ok: false, error: 'You need to be signed in.' };
    if (reset.status === 402) return { ok: false, error: 'Cloud sync requires Clip Pro.' };
    if (!reset.ok) return { ok: false, error: 'Could not reset cloud data.' };

    // The server key material is now gone, so the old key is useless. Establish
    // the NEW key before touching local shadow state: if setup fails (network
    // blip), we don't leave this device wiped-and-locked — the user can retry
    // resetPassphrase, which re-runs the (idempotent) wipe and setup.
    key = null;
    keyVerified = false;
    const setup = await setupPassphrase(newPassphrase);
    if (!setup.ok) return setup;

    // New key is live. Now clear the shadow map + cursor so the next sync
    // re-uploads every local clip fresh under the new key.
    host?.clearSyncMap();
    host?.setState('sync_cursor', '');
    await syncNow();
    return { ok: true };
}

// --- Device registration ----------------------------------------------------

/**
 * Register or heartbeat this device with the server so it shows up in the
 * account's "Devices & sessions" list. This is NOT tied to Pro or cloud sync —
 * any signed-in app registers a device. If the device was removed from the web
 * ("sign out this device"), we stand the app down locally. Never throws.
 */
export async function registerDevice(): Promise<{ ok: boolean; removed?: boolean }> {
    if (!host) return { ok: false };
    const existing = host.getState('sync_device_id');
    let res: Response | null = null;
    try {
        res = await api('/api/sync/device', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: existing || null,
                name: os.hostname(),
                platform: process.platform,
            }),
        });
    } catch {
        return { ok: false };
    }
    if (!res) return { ok: false };
    if (!res.ok) {
        // A rejected registration used to be silent, so hitting the device cap
        // looked like "my app just never appears in the devices list". Keep the
        // server's message so the UI can tell the user what to do about it.
        if (res.status === 409 || res.status === 429) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            deviceError = body.error
                || 'This device could not be registered. Please try again later.';
        } else if (res.status !== 401 && res.status !== 402) {
            deviceError = null;
        }
        return { ok: false };
    }
    deviceError = null;
    const d = (await res.json().catch(() => ({}))) as { deviceId?: string; removed?: boolean };
    if (d.removed) {
        // This device was signed out from the web — stand down locally.
        host.setState('sync_device_id', '');
        host.onRemoteSignout();
        return { ok: true, removed: true };
    }
    if (d.deviceId) host.setState('sync_device_id', d.deviceId);
    return { ok: true };
}

/** Remove this device's server record (called on local sign-out). */
export async function deregisterDevice(): Promise<void> {
    if (!host) return;
    const id = host.getState('sync_device_id');
    if (!id) return;
    try {
        await api(`/api/sync/device?deviceId=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
        /* best effort */
    }
    host.setState('sync_device_id', '');
}

let deviceTimer: NodeJS.Timeout | null = null;

/**
 * Keep the device record fresh (last-seen) and detect a remote sign-out, on a
 * slow timer that runs whenever the user is signed in — independent of sync.
 */
export function startDeviceHeartbeat(intervalMs = 60 * 1000): void {
    stopDeviceHeartbeat();
    void registerDevice();
    deviceTimer = setInterval(() => {
        void registerDevice();
    }, intervalMs);
}

export function stopDeviceHeartbeat(): void {
    if (deviceTimer) {
        clearInterval(deviceTimer);
        deviceTimer = null;
    }
}

// --- Deletions + local-state reset ------------------------------------------

/**
 * Record that the user genuinely deleted a clip, so the next push tombstones it
 * across devices. Call this from the real user-delete path only — NOT from
 * history-cap eviction or trimming, which are local capacity management.
 */
export function notePendingDeletion(type: string, content: string): void {
    host?.markDeletedByContent(type, hashOf(type, content));
}

/** Record a "clear all history" as pending deletions of every synced clip. */
export function notePendingDeletionAll(): void {
    host?.markAllDeleted();
}

/**
 * Wipe this device's local sync shadow state (map, cursor, enabled flag, device
 * id). Used on sign-out and remote sign-out so a different account on the same
 * machine never inherits the previous user's sync state.
 */
export function resetLocalSyncState(): void {
    if (!host) return;
    host.clearSyncMap();
    host.setState('sync_cursor', '');
    host.setState('sync_enabled', '0');
    host.setState('sync_device_id', '');
    host.setState('sync_last_sync', '');
    lastSync = null;
    lastError = null;
    deviceError = null;
}

// --- Push -------------------------------------------------------------------

type Outbound = {
    clientId: string;
    ciphertext?: string;
    nonce?: string;
    contentBytes?: number;
    version: number;
    deleted: boolean;
};

function buildPayload(clientId: string, clip: LocalClip, version: number, k: Buffer): Outbound | null {
    const plaintext = JSON.stringify({ t: clip.type, c: clip.content, p: clip.pinned ? 1 : 0 });
    const { nonce, ciphertext } = box.encrypt(plaintext, k);
    if (ciphertext.length > MAX_CLIP_BYTES) return null;
    return {
        clientId,
        ciphertext: ciphertext.toString('base64'),
        nonce: nonce.toString('base64'),
        contentBytes: ciphertext.length,
        version,
        deleted: false,
    };
}

async function pushPhase(): Promise<{ accepted: number; skippedTooLarge: number }> {
    // Capture the key up front: lock()/reset can null the module-level `key`
    // mid-cycle, and we must not encrypt with null.
    const k = key;
    if (!host || !k) return { accepted: 0, skippedTooLarge: 0 };
    const local = host.readClips();
    const localByHash = new Map<string, LocalClip>();
    for (const c of local) localByHash.set(hkey(c.type, c.content), c);

    const mapRows = host.readSyncMap();
    const mapByHash = new Map<string, SyncMapRow>();
    for (const r of mapRows) if (!r.deleted) mapByHash.set(r.type + ':' + r.contentHash, r);

    const outbound: Outbound[] = [];
    const pending: SyncMapRow[] = [];
    const now = Date.now();
    // Clips whose ciphertext exceeds MAX_CLIP_BYTES (buildPayload returns null).
    // They can never sync, so count them and surface the total to the user
    // rather than dropping them silently every cycle.
    let skippedTooLarge = 0;

    // new + pin-changed
    for (const [k2, clip] of localByHash) {
        const existing = mapByHash.get(k2);
        if (!existing) {
            const clientId = randomUUID();
            const payload = buildPayload(clientId, clip, 1, k);
            if (!payload) { skippedTooLarge++; continue; } // too large to sync
            outbound.push(payload);
            pending.push({
                clientId,
                contentHash: hashOf(clip.type, clip.content),
                type: clip.type,
                version: 1,
                pinned: clip.pinned ? 1 : 0,
                deleted: 0,
                updatedAt: now,
            });
        } else if ((existing.pinned ? 1 : 0) !== (clip.pinned ? 1 : 0)) {
            const version = existing.version + 1;
            const payload = buildPayload(existing.clientId, clip, version, k);
            if (!payload) { skippedTooLarge++; continue; }
            outbound.push(payload);
            pending.push({ ...existing, version, pinned: clip.pinned ? 1 : 0, updatedAt: now });
        }
    }

    // Explicit user deletions only (deleted === 2, set by notePendingDeletion*).
    // A clip merely absent locally is NOT a deletion: the local history is a
    // capped rotating buffer, so eviction/trim would otherwise tombstone clips
    // cloud-wide and on every other device.
    for (const r of mapRows) {
        if (r.deleted === 2) {
            const version = r.version + 1;
            outbound.push({ clientId: r.clientId, version, deleted: true });
            pending.push({ ...r, version, deleted: 1, updatedAt: now });
        }
    }

    if (outbound.length === 0) return { accepted: 0, skippedTooLarge };

    let accepted = 0;
    for (let i = 0; i < outbound.length; i += 500) {
        const batch = outbound.slice(i, i + 500);
        const res = await api('/api/sync/push', {
            method: 'POST',
            body: JSON.stringify({ deviceId: host.getState('sync_device_id'), clips: batch }),
        });
        if (!res || !res.ok) {
            // quota/other rejection — stop; keep pending un-committed so we retry
            const msg = res ? `push failed (${res.status})` : 'push failed (offline)';
            throw new Error(msg);
        }
        const result = (await res.json()) as { accepted?: string[] };
        const ok = new Set(result.accepted ?? []);
        for (const p of pending) {
            if (ok.has(p.clientId)) {
                host.upsertSyncMap(p);
                accepted++;
            }
        }
    }
    return { accepted, skippedTooLarge };
}

// --- Pull -------------------------------------------------------------------

async function pullPhase(): Promise<{ applied: number; failed: number }> {
    // Capture the key: lock()/reset can null the module-level `key` between the
    // awaits below, and decrypting with null would throw, skip the clip, yet
    // still advance the cursor — silently losing those remote clips forever.
    const k = key;
    if (!host || !k) return { applied: 0, failed: 0 };
    let cursor = host.getState('sync_cursor') || '';
    let applied = 0;
    // Clips whose ciphertext couldn't be decrypted/parsed. The cursor still
    // advances past them (a stuck cursor would be worse), so surface the count
    // to the user instead of dropping them silently.
    let failed = 0;
    let hasMore = true;
    let guard = 0;

    const mapByClient = new Map<string, SyncMapRow>();
    for (const r of host.readSyncMap()) mapByClient.set(r.clientId, r);

    while (hasMore && guard++ < 100) {
        const res = await api(
            `/api/sync/pull?since=${encodeURIComponent(cursor)}&limit=${PULL_LIMIT}`,
            { method: 'GET' }
        );
        if (!res || !res.ok) break;
        const data = (await res.json()) as {
            clips: Array<{
                clientId: string;
                ciphertext: string;
                nonce: string;
                version: number;
                deleted: boolean;
                updatedAt: string;
            }>;
            cursor: string | null;
            hasMore: boolean;
        };

        for (const rc of data.clips) {
            const existing = mapByClient.get(rc.clientId);
            if (existing && rc.version <= existing.version) continue; // not newer

            try {
                if (rc.deleted) {
                    if (existing && !existing.deleted) {
                        const localMatch = host
                            .readClips()
                            .find((c) => hashOf(c.type, c.content) === existing.contentHash && c.type === existing.type);
                        if (localMatch) host.deleteClip(localMatch.id);
                    }
                    const row: SyncMapRow = existing
                        ? { ...existing, version: rc.version, deleted: 1, updatedAt: Date.now() }
                        : { clientId: rc.clientId, contentHash: '', type: '', version: rc.version, pinned: 0, deleted: 1, updatedAt: Date.now() };
                    host.upsertSyncMap(row);
                    mapByClient.set(rc.clientId, row);
                    applied++;
                } else {
                    const plaintext = box.decrypt(
                        Buffer.from(rc.ciphertext, 'base64'),
                        Buffer.from(rc.nonce, 'base64'),
                        k
                    );
                    const parsed = JSON.parse(plaintext) as { t: 'text' | 'image'; c: string; p?: number };
                    const type = parsed.t;
                    const content = parsed.c;
                    const pinned = parsed.p ? true : false;

                    const local = host.findClipByContent(type, content);
                    if (local) {
                        if ((local.pinned ? true : false) !== pinned) host.setPinned(local.id, pinned);
                    } else {
                        host.insertClip(type, content, Date.now(), pinned);
                    }
                    const row: SyncMapRow = {
                        clientId: rc.clientId,
                        contentHash: hashOf(type, content),
                        type,
                        version: rc.version,
                        pinned: pinned ? 1 : 0,
                        deleted: 0,
                        updatedAt: Date.now(),
                    };
                    host.upsertSyncMap(row);
                    mapByClient.set(rc.clientId, row);
                    applied++;
                }
            } catch (e) {
                // Undecryptable (stale key/garbage) or malformed — skip this clip
                // but record it so syncNow can surface the loss to the user.
                console.error('[sync] could not apply remote clip', rc.clientId, e);
                failed++;
            }
        }

        if (data.cursor) {
            cursor = data.cursor;
            host.setState('sync_cursor', cursor);
        }
        hasMore = Boolean(data.hasMore);
    }
    return { applied, failed };
}

// --- Cycle + scheduling -----------------------------------------------------

export async function syncNow(): Promise<{ pushed: number; pulled: number; error?: string }> {
    if (!host) return { pushed: 0, pulled: 0, error: 'not-initialized' };
    if (!isEnabled()) return { pushed: 0, pulled: 0, error: 'disabled' };
    if (!key) return { pushed: 0, pulled: 0, error: 'locked' };
    if (syncing) return { pushed: 0, pulled: 0, error: 'busy' };

    syncing = true;
    try {
        // BUG 1: an auto-unlocked (OS-cached) key is trusted blindly. If another
        // device ran resetPassphrase, the server now has a new salt/verifier and
        // our cached key is stale — every push would upload ciphertext no one can
        // read. Verify the key against the server's current verifier once per
        // unlock, before pushing/pulling anything.
        if (!keyVerified) {
            const res = await api('/api/sync/keys', { method: 'GET' });
            // Only a definitive server response can confirm or refute the key. A
            // null/failed response = offline/transient: don't verify, don't block
            // (network calls below simply no-op), and retry verification next cycle.
            if (res && res.ok) {
                const kd = (await res.json().catch(() => null)) as {
                    configured?: boolean;
                    salt?: string;
                    verifier?: string | null;
                    verifierNonce?: string | null;
                } | null;
                const k = key; // re-read: a concurrent lock() during the await may have cleared it
                if (k && kd && kd.configured && kd.salt && kd.verifier && kd.verifierNonce) {
                    const ok = box.checkVerifier(
                        k,
                        Buffer.from(kd.verifier, 'base64'),
                        Buffer.from(kd.verifierNonce, 'base64')
                    );
                    if (!ok) {
                        // Definitive mismatch: the passphrase was reset elsewhere.
                        // Drop the stale key (+ OS cache), reset the pull cursor and
                        // shadow map so re-unlock re-syncs cleanly, and stop here.
                        lock();
                        lastError =
                            'Your saved passphrase is out of date (it was reset on another device). Please enter your passphrase again.';
                        host.setState('sync_cursor', '');
                        host.clearSyncMap();
                        return { pushed: 0, pulled: 0, error: lastError };
                    }
                }
                // Passed, or the server has no verifier configured → trust the key.
                keyVerified = true;
            }
        }

        const dev = await registerDevice();
        if (dev.removed) throw new Error('This device was signed out remotely.');
        // Pull BEFORE push: mapping existing cloud content locally first lets
        // pushPhase's content-hash dedupe recognize it, so we don't re-upload
        // content that's already in the cloud under a fresh clientId (duplicate
        // clips + wasted quota). Pull-then-push is the safe order: pending local
        // deletions (deleted===2) and un-pushed local clips are keyed by
        // version/content and are not clobbered by an incoming pull.
        const pull = await pullPhase();
        const push = await pushPhase();
        const pushed = push.accepted;
        const pulled = pull.applied;
        lastSync = Date.now();
        // BUG 2: don't overwrite a decrypt-failure signal with null. Surface both
        // non-fatal skip signals from this cycle (undecryptable pulled clips and
        // too-large local clips that can't be pushed) instead of dropping them.
        const notes: string[] = [];
        if (pull.failed > 0) notes.push(`${pull.failed} clip(s) couldn't be decrypted and were skipped.`);
        if (push.skippedTooLarge > 0) notes.push(`${push.skippedTooLarge} clip(s) are too large to sync and were skipped.`);
        lastError = notes.length > 0 ? notes.join(' ') : null;
        host.setState('sync_last_sync', String(lastSync));
        if (pushed > 0 || pulled > 0) host.refreshUi();
        return { pushed, pulled, error: lastError || undefined };
    } catch (e) {
        lastError = netMessage(e);
        return { pushed: 0, pulled: 0, error: lastError };
    } finally {
        syncing = false;
    }
}

export function startAutoSync(intervalMs = 20000): void {
    stopAutoSync();
    autoTimer = setInterval(() => {
        if (isEnabled() && isUnlocked()) void syncNow();
    }, intervalMs);
}

export function stopAutoSync(): void {
    if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
    }
}

/** Fetch current cloud usage for display. Returns null if unavailable. */
export async function fetchUsage(): Promise<{ bytesUsed: number; clipCount: number; limits: { storageBytes: number; maxClips: number } } | null> {
    const res = await api('/api/sync/usage', { method: 'GET' });
    if (!res || !res.ok) return null;
    return (await res.json()) as {
        bytesUsed: number;
        clipCount: number;
        limits: { storageBytes: number; maxClips: number };
    };
}

// --- Encrypted cloud backups -----------------------------------------------

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export interface CloudBackup {
    id: string;
    deviceName: string | null;
    sizeBytes: number;
    createdAt: string;
}

/** Encrypt a full-DB backup and upload it. Requires an unlocked passphrase. */
export async function pushBackup(dbBytes: Buffer, deviceName: string): Promise<{ ok: boolean; error?: string }> {
    if (!key) return { ok: false, error: 'locked' };
    try {
        const { nonce, ciphertext } = box.encryptBytes(dbBytes, key);
        if (ciphertext.length > MAX_BACKUP_BYTES) {
            return { ok: false, error: 'Backup is larger than the 10 MB cloud limit.' };
        }
        const res = await api('/api/sync/backup', {
            method: 'POST',
            body: JSON.stringify({
                deviceName,
                nonce: nonce.toString('base64'),
                ciphertext: ciphertext.toString('base64'),
                sizeBytes: ciphertext.length,
            }),
        });
        if (!res) return { ok: false, error: 'You need to be signed in.' };
        if (!res.ok) {
            return { ok: false, error: res.status === 413 ? 'Backup is too large for the cloud.' : `Backup failed (${res.status}).` };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: netMessage(e) };
    }
}

export async function listBackups(): Promise<CloudBackup[]> {
    try {
        const res = await api('/api/sync/backups', { method: 'GET' });
        if (!res || !res.ok) return [];
        return ((await res.json()) as { backups: CloudBackup[] }).backups ?? [];
    } catch {
        return [];
    }
}

/** Delete one cloud backup by id. */
export async function deleteBackup(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await api(`/api/sync/backup?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res) return { ok: false, error: 'You need to be signed in and online.' };
        if (!res.ok) {
            return { ok: false, error: res.status === 404 ? 'That backup no longer exists.' : `Delete failed (${res.status}).` };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: netMessage(e) };
    }
}

/** Rename one cloud backup (display label only, nothing re-encrypted). */
export async function renameBackup(id: string, name: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await api('/api/sync/backup', {
            method: 'PATCH',
            body: JSON.stringify({ id, name }),
        });
        if (!res) return { ok: false, error: 'You need to be signed in and online.' };
        if (!res.ok) {
            return { ok: false, error: res.status === 404 ? 'That backup no longer exists.' : `Rename failed (${res.status}).` };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: netMessage(e) };
    }
}

/** Download + decrypt one backup, returning the raw DB bytes (or null). */
export async function downloadBackup(id: string): Promise<Buffer | null> {
    if (!key) return null;
    try {
        const res = await api(`/api/sync/backup?id=${encodeURIComponent(id)}`, { method: 'GET' });
        if (!res || !res.ok) return null;
        const data = (await res.json()) as { nonce: string; ciphertext: string };
        return box.decryptBytes(Buffer.from(data.ciphertext, 'base64'), Buffer.from(data.nonce, 'base64'), key);
    } catch {
        return null;
    }
}
