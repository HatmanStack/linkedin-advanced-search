import { logger } from '@/utils/logger.js';
import fs from 'fs/promises';
import sodium from 'libsodium-wrappers-sumo';

async function readPrivateKeyB64() {
  const path = process.env.CRED_SEALBOX_PRIVATE_KEY_PATH;
  if (!path) return null;
  try {
    const content = await fs.readFile(path, 'utf8');
    const b64 = content.trim();
    const buf = Buffer.from(b64, 'base64');
    if (buf.length !== 32) return null; // X25519 sk length
    return b64;
  } catch {
    return null;
  }
}

export async function decryptSealboxB64Tag(ciphertextTag) {
  try {
    if (typeof ciphertextTag !== 'string') return null;
    const prefix = 'sealbox_x25519:b64:';
    if (!ciphertextTag.startsWith(prefix)) return null;
    const b64 = ciphertextTag.substring(prefix.length);
    const sealed = Buffer.from(b64, 'base64');

    const privB64 = await readPrivateKeyB64();
    if (!privB64) {
      logger.warn('Private key not configured for sealbox decryption');
      return null;
    }

    await sodium.ready;
    const sk = sodium.from_base64(privB64, sodium.base64_variants.ORIGINAL);

    // Derive public key from private key (libsodium doesn't ship direct fn, use scalar mult base point)
    const pk = sodium.crypto_scalarmult_base(sk);

    const plaintext = sodium.crypto_box_seal_open(
      new Uint8Array(sealed),
      new Uint8Array(pk),
      new Uint8Array(sk)
    );
    return Buffer.from(plaintext).toString('utf8');
  } catch (err) {
    logger.error('Failed to decrypt sealed-box ciphertext', { error: err.message });
    return null;
  }
}

/**
 * Extract LinkedIn credentials from request body.
 * Supports either ciphertext (preferred) or plaintext object fallback.
 * Returns { searchName, searchPassword } or null if unavailable.
 */
export async function extractLinkedInCredentials(body = {}) {
  try {
    // Preferred: ciphertext
    if (body.linkedinCredentialsCiphertext) {
      const decrypted = await decryptSealboxB64Tag(body.linkedinCredentialsCiphertext);
      if (decrypted) {
        const obj = JSON.parse(decrypted);
        if (obj?.email && obj?.password) {
          return { searchName: obj.email, searchPassword: obj.password };
        }
      }
    }
    // Fallback: plaintext
    if (body.linkedinCredentials && body.linkedinCredentials.email && body.linkedinCredentials.password) {
      return { searchName: body.linkedinCredentials.email, searchPassword: body.linkedinCredentials.password };
    }
    // Legacy fields
    if (body.searchName && body.searchPassword) {
      return { searchName: body.searchName, searchPassword: body.searchPassword };
    }
    return null;
  } catch (err) {
    logger.error('Failed to extract LinkedIn credentials', { error: err.message });
    return null;
  }
}

