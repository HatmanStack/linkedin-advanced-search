import { jwtVerify, createRemoteJWKSet } from 'jose';
import { logger } from '#utils/logger.js';

/**
 * JWKS-based JWT Signature Verification
 *
 * Verifies JWT tokens using public keys fetched from the Cognito JWKS endpoint.
 * Caches the JWKS client per issuer for performance.
 */

// Cache JWKS clients by issuer URL
let cachedJWKS = null;
let cachedIssuer = null;

/**
 * Get or create a JWKS client for the given issuer.
 * @param {string} issuer - The JWT issuer (Cognito User Pool URL)
 * @returns {Promise<ReturnType<typeof createRemoteJWKSet>>} JWKS client
 */
async function getJWKS(issuer) {
  if (cachedJWKS && cachedIssuer === issuer) {
    return cachedJWKS;
  }

  const jwksUrl = `${issuer}/.well-known/jwks.json`;
  logger.debug('Creating JWKS client', { jwksUrl });

  cachedJWKS = createRemoteJWKSet(new URL(jwksUrl));
  cachedIssuer = issuer;
  return cachedJWKS;
}

/**
 * Verify JWT signature using Cognito JWKS.
 *
 * @param {string} token - The JWT token to verify
 * @returns {Promise<{valid: boolean, payload?: object, userId?: string, reason?: string}>}
 */
export async function verifyJwtSignature(token) {
  if (!token) {
    return { valid: false, reason: 'No token provided' };
  }

  try {
    // Decode payload to get issuer (don't verify yet)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, reason: 'Malformed token' };
    }

    // Decode payload to extract issuer
    const payloadB64 = parts[1];
    let base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }

    const decodedPayload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    const issuer = decodedPayload.iss;

    // Validate issuer is a Cognito User Pool
    if (!issuer || !issuer.includes('cognito-idp')) {
      logger.warn('JWT signature verification: Invalid issuer', { issuer });
      return { valid: false, reason: 'Invalid issuer - not a Cognito token' };
    }

    // Get JWKS client for this issuer
    const jwks = await getJWKS(issuer);

    // Verify the token signature
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      clockTolerance: 30, // 30 second clock skew tolerance
    });

    // Extract user ID from verified payload
    const userId = payload.sub || payload.user_id || payload.userId || payload.id;

    if (!userId) {
      return { valid: false, reason: 'Missing user identifier in token' };
    }

    logger.debug('JWT signature verification successful', {
      userId: String(userId).substring(0, 8) + '...',
      iss: issuer,
    });

    return {
      valid: true,
      payload,
      userId: String(userId),
      signatureVerified: true,
    };
  } catch (error) {
    logger.warn('JWT signature verification failed', {
      error: error.message,
      code: error.code,
    });

    // Provide specific error messages for common failures
    if (error.code === 'ERR_JWT_EXPIRED') {
      return { valid: false, reason: 'Token expired' };
    }
    if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      return { valid: false, reason: 'Invalid signature' };
    }
    if (error.code === 'ERR_JWKS_NO_MATCHING_KEY') {
      return { valid: false, reason: 'No matching key found in JWKS' };
    }

    return {
      valid: false,
      reason: `Signature verification failed: ${error.message}`,
    };
  }
}

/**
 * Clear the cached JWKS client.
 * Useful for testing or when keys are rotated.
 */
export function clearJWKSCache() {
  cachedJWKS = null;
  cachedIssuer = null;
  logger.info('JWKS cache cleared');
}

export default verifyJwtSignature;
