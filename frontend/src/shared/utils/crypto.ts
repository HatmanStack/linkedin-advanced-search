

import sodium from 'libsodium-wrappers-sumo';


function normalizeBase64(input: string): string {
  const cleaned = input
    .replace(/[\r\n\s]/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const paddingNeeded = cleaned.length % 4;
  return paddingNeeded ? cleaned + '='.repeat(4 - paddingNeeded) : cleaned;
}


function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = normalizeBase64(base64);
  const binaryString = typeof atob === 'function'
    ? atob(normalized)
    : (typeof Buffer !== 'undefined'
        ? Buffer.from(normalized, 'base64').toString('binary')
        : (() => { throw new Error('No base64 decoder available'); })());
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}


function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(binary, 'binary').toString('base64');
  }
  throw new Error('No base64 encoder available');
}


export async function importRsaPublicKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/[\r\n\s]/g, '')
    .trim();

  const derBuffer = base64ToArrayBuffer(pemContents);
  return crypto.subtle.importKey(
    'spki',
    derBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}


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


export async function encryptWithSealboxB64(plaintext: string, publicKeyB64: string): Promise<string> {
  await sodium.ready;
  const messageBytes = new TextEncoder().encode(plaintext);
  const pkBytes = new Uint8Array(base64ToArrayBuffer(publicKeyB64));
  if (pkBytes.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new Error('Invalid public key length for sealed box');
  }
  const sealed = sodium.crypto_box_seal(messageBytes, pkBytes);
  const sealedB64 = arrayBufferToBase64(sealed.buffer.slice(sealed.byteOffset, sealed.byteOffset + sealed.byteLength) as ArrayBuffer);
  return sealedB64;
}

