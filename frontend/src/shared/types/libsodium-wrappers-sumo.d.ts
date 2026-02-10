/**
 * Type declarations for libsodium-wrappers-sumo
 * Minimal type definitions for the crypto functions we use
 */

declare module 'libsodium-wrappers-sumo' {
  export const ready: Promise<void>;

  export const crypto_box_PUBLICKEYBYTES: number;
  export const crypto_box_SECRETKEYBYTES: number;

  export const base64_variants: {
    ORIGINAL: number;
    URLSAFE: number;
    URLSAFE_NO_PADDING: number;
  };

  export function crypto_box_seal(message: Uint8Array, publicKey: Uint8Array): Uint8Array;

  export function crypto_box_seal_open(
    ciphertext: Uint8Array,
    publicKey: Uint8Array,
    secretKey: Uint8Array
  ): Uint8Array;

  export function crypto_scalarmult_base(secretKey: Uint8Array): Uint8Array;

  export function from_base64(input: string, variant: number): Uint8Array;

  export function to_base64(input: Uint8Array, variant: number): string;
}
