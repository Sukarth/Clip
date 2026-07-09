import { safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Persists the Supabase session, encrypted at rest with the OS keystore
// (Windows DPAPI via Electron safeStorage — ciphertext is tied to the OS user
// account and never written in plaintext).

export interface StoredSession {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // unix seconds
    email: string;
}

let filePath = '';

export function initTokenStore(appDataDir: string): void {
    filePath = path.join(appDataDir, 'clip-auth.dat');
}

export function loadSession(): StoredSession | null {
    try {
        if (!filePath || !fs.existsSync(filePath)) return null;
        if (!safeStorage.isEncryptionAvailable()) return null;
        const buf = fs.readFileSync(filePath);
        const json = safeStorage.decryptString(buf);
        return JSON.parse(json) as StoredSession;
    } catch {
        return null;
    }
}

export function saveSession(session: StoredSession): void {
    if (!filePath) throw new Error('Token store not initialized.');
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('OS encryption (safeStorage) is unavailable on this system.');
    }
    const enc = safeStorage.encryptString(JSON.stringify(session));
    fs.writeFileSync(filePath, enc, { mode: 0o600 });
}

export function clearSession(): void {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
        /* ignore */
    }
}
