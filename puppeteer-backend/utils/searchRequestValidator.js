import { logger } from './logger.js';

export class SearchRequestValidator {
  static validateRequest(body, jwtToken) {
    const { companyName, companyRole, companyLocation, searchName, searchPassword, linkedinCredentialsCiphertext, linkedinCredentials } = body;

    logger.info('Request body received:', {
      companyName,
      companyRole,
      companyLocation,
      searchName,
      hasPassword: !!searchPassword,
      hasJwtToken: !!jwtToken
    });

    // Allow either plaintext credentials OR ciphertext/structured credentials to be present
    const hasPlaintext = !!(searchName && searchPassword);
    const hasCiphertext = typeof linkedinCredentialsCiphertext === 'string' && linkedinCredentialsCiphertext.startsWith('rsa_oaep_sha256:b64:');
    const hasStructured = !!(linkedinCredentials && linkedinCredentials.email && linkedinCredentials.password);

    if (!hasPlaintext && !hasCiphertext && !hasStructured) {
      return {
        isValid: false,
        statusCode: 400,
        error: 'Missing credentials: provide searchName/searchPassword or linkedinCredentialsCiphertext'
      };
    }

    if (!jwtToken) {
      return {
        isValid: false,
        statusCode: 401,
        error: 'Authentication required',
        message: 'User ID is required to perform searches'
      };
    }

    return { isValid: true };
  }

  
}
