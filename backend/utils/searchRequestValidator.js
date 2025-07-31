import { logger } from './logger.js';

export class SearchRequestValidator {
  static validateRequest(body, jwtToken) {
    const { companyName, companyRole, companyLocation, searchName, searchPassword } = body;

    logger.info('Request body received:', {
      companyName,
      companyRole,
      companyLocation,
      searchName,
      hasPassword: !!searchPassword,
      hasJwtToken: !!jwtToken
    });

    if (!searchName || !searchPassword) {
      return {
        isValid: false,
        statusCode: 400,
        error: 'Missing required fields: searchName, searchPassword'
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

  static validateStateFields(state) {
    if (!state.searchName || !state.searchPassword) {
      throw new Error('Missing required fields: searchName, searchPassword, or jwtToken.');
    }
  }
}
