import { logger } from './logger.js';
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
    logger.info('=== DECRYPTION DEBUG ===');
    logger.info(`Ciphertext tag type: ${typeof ciphertextTag}`);
    logger.info(`Ciphertext tag length: ${ciphertextTag ? ciphertextTag.length : 0}`);
    logger.info(`Ciphertext tag preview: ${ciphertextTag ? ciphertextTag.substring(0, 50) + '...' : 'null'}`);

    if (typeof ciphertextTag !== 'string') {
      logger.error('Ciphertext tag is not a string');
      return null;
    }

    const prefix = 'sealbox_x25519:b64:';
    if (!ciphertextTag.startsWith(prefix)) {
      logger.error(`Ciphertext tag missing prefix. Expected: ${prefix}`);
      return null;
    }

    const b64 = ciphertextTag.substring(prefix.length);
    logger.info(`Base64 ciphertext length: ${b64.length}`);

    const sealed = Buffer.from(b64, 'base64');
    logger.info(`Sealed buffer length: ${sealed.length} bytes`);

    const privKeyPath = process.env.CRED_SEALBOX_PRIVATE_KEY_PATH;
    logger.info(`Private key path: ${privKeyPath}`);

    const privB64 = await readPrivateKeyB64();
    if (!privB64) {
      logger.error('Private key not configured for sealbox decryption');
      return null;
    }
    logger.info(`Private key loaded, length: ${privB64.length}`);

    await sodium.ready;
    const sk = sodium.from_base64(privB64, sodium.base64_variants.ORIGINAL);
    logger.info(`Private key decoded, length: ${sk.length} bytes`);

    // Derive public key from private key (libsodium doesn't ship direct fn, use scalar mult base point)
    const pk = sodium.crypto_scalarmult_base(sk);
    logger.info(`Public key derived, length: ${pk.length} bytes`);

    logger.info('Attempting to decrypt...');
    const plaintext = sodium.crypto_box_seal_open(
      new Uint8Array(sealed),
      new Uint8Array(pk),
      new Uint8Array(sk)
    );
    logger.info(`Decryption successful! Plaintext length: ${plaintext.length} bytes`);

    const result = Buffer.from(plaintext).toString('utf8');
    logger.info(`Plaintext preview: ${result.substring(0, 50)}...`);
    return result;
  } catch (err) {
    logger.error('Failed to decrypt sealed-box ciphertext', {
      error: err.message,
      stack: err.stack
    });
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
    logger.info('=== EXTRACTING CREDENTIALS ===');
    logger.info(`Body has linkedinCredentialsCiphertext: ${!!body.linkedinCredentialsCiphertext}`);

    // Preferred: ciphertext
    if (body.linkedinCredentialsCiphertext) {
      logger.info('Attempting to decrypt ciphertext...');
      const decrypted = await decryptSealboxB64Tag(body.linkedinCredentialsCiphertext);

      if (decrypted) {
        logger.info('Decryption successful, parsing JSON...');
        const obj = JSON.parse(decrypted);
        logger.info(`Parsed object has email: ${!!obj?.email}, password: ${!!obj?.password}`);

        if (obj?.email && obj?.password) {
          logger.info('Credentials extracted successfully from ciphertext');
          return { searchName: obj.email, searchPassword: obj.password };
        } else {
          logger.warn('Decrypted object missing email or password');
        }
      } else {
        logger.error('Decryption returned null');
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

