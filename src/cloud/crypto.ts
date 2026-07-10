import { argon2id } from 'hash-wasm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Zero-knowledge clip encryption.
//   key   = Argon2id(passphrase, salt)           (never leaves the device)
//   clip  = AES-256-GCM(key, nonce, plaintext)   (nonce per clip; tag appended)
// The server only ever stores ciphertext + nonce (both opaque bytes).

export const KDF_PARAMS = {
    type: 'argon2id' as const,
    memorySizeKiB: 65536, // 64 MiB
    iterations: 3,
    parallelism: 1,
    hashLength: 32,
};

const VERIFIER_PLAINTEXT = 'clip-sync-verifier-v1';

export function newSalt(): Buffer {
    return randomBytes(16);
}

/** Derive the 32-byte AES key from the passphrase + per-user salt. */
export async function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
    const out = await argon2id({
        password: passphrase,
        salt: new Uint8Array(salt),
        memorySize: KDF_PARAMS.memorySizeKiB,
        iterations: KDF_PARAMS.iterations,
        parallelism: KDF_PARAMS.parallelism,
        hashLength: KDF_PARAMS.hashLength,
        outputType: 'binary',
    });
    return Buffer.from(out as Uint8Array);
}

export function encrypt(plaintext: string, key: Buffer): { nonce: Buffer; ciphertext: Buffer } {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Append the 16-byte GCM tag to the ciphertext.
    return { nonce, ciphertext: Buffer.concat([enc, tag]) };
}

export function decrypt(ciphertext: Buffer, nonce: Buffer, key: Buffer): string {
    if (ciphertext.length < 16) throw new Error('Ciphertext too short.');
    const tag = ciphertext.subarray(ciphertext.length - 16);
    const body = ciphertext.subarray(0, ciphertext.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** A small value encrypted with the key, so another device can confirm the
 *  passphrase without the server learning anything. */
export function makeVerifier(key: Buffer): { verifier: Buffer; verifierNonce: Buffer } {
    const { nonce, ciphertext } = encrypt(VERIFIER_PLAINTEXT, key);
    return { verifier: ciphertext, verifierNonce: nonce };
}

export function checkVerifier(key: Buffer, verifier: Buffer, verifierNonce: Buffer): boolean {
    try {
        return decrypt(verifier, verifierNonce, key) === VERIFIER_PLAINTEXT;
    } catch {
        return false;
    }
}
