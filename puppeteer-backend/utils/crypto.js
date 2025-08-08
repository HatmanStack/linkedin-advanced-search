import crypto from 'crypto';
import { logger } from './logger.js';

function getPrivateKeyPem() {
  const pem = process.env.LINKEDIN_CRED_PRIVATE_KEY;
  if (!pem || !pem.includes('BEGIN')) {
    return null;
  }
  return pem.replace(/\\n/g, '\n');
}

/**
 * Decrypt RSA-OAEP(SHA-256) base64 ciphertext with server private key
 * Accepts strings like: rsa_oaep_sha256:b64:<base64>
 */
export function decryptRsaOaepB64Tag(ciphertextTag) {
  try {
    if (typeof ciphertextTag !== 'string') return null;
    const prefix = 'rsa_oaep_sha256:b64:';
    if (!ciphertextTag.startsWith(prefix)) return null;
    const b64 = ciphertextTag.substring(prefix.length);
    const buffer = Buffer.from(b64, 'base64');
    const privateKeyPem = getPrivateKeyPem();
    if (!privateKeyPem) {
      logger.warn('Private key not configured for RSA-OAEP decryption');
      return null;
    }
    const plaintextBuffer = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buffer
    );
    return plaintextBuffer.toString('utf8');
  } catch (err) {
    logger.error('Failed to decrypt RSA-OAEP ciphertext', { error: err.message });
    return null;
  }
}

/**
 * Extract LinkedIn credentials from request body.
 * Supports either ciphertext (preferred) or plaintext object fallback.
 * Returns { searchName, searchPassword } or null if unavailable.
 */
export function extractLinkedInCredentials(body = {}) {
  try {
    // Preferred: ciphertext
    if (body.linkedinCredentialsCiphertext) {
      const decrypted = decryptRsaOaepB64Tag(body.linkedinCredentialsCiphertext);
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



