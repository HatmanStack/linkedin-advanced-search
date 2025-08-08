/**
 * Crypto utilities for client-side encryption.
 * Uses Web Crypto API to perform RSA-OAEP encryption with SHA-256.
 */

/** Convert a base64 string to an ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Convert an ArrayBuffer to a base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Import an RSA public key from a PEM string for RSA-OAEP with SHA-256 */
export async function importRsaPublicKey(pem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PUBLIC KEY-----';
  const pemFooter = '-----END PUBLIC KEY-----';
  const pemContents = pem
    .replace(/\r/g, '')
    .replace(/\n/g, '\n')
    .replace(' ', '')
    .trim()
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s+/g, '');

  const derBuffer = base64ToArrayBuffer(pemContents);
  return crypto.subtle.importKey(
    'spki',
    derBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

/** Encrypt a UTF-8 string with RSA-OAEP and return base64 ciphertext */
export async function encryptWithRsaOaep(plaintext: string, publicKeyPem: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await importRsaPublicKey(publicKeyPem);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    encoder.encode(plaintext)
  );
  return arrayBufferToBase64(encrypted);
}


