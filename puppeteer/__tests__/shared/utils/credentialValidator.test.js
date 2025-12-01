import { describe, it, expect } from 'vitest';
import { validateLinkedInCredentials } from '../../../src/shared/utils/credentialValidator.js';

describe('CredentialValidator', () => {
  describe('validateLinkedInCredentials', () => {
    it('should return valid for plaintext credentials with JWT', () => {
      const result = validateLinkedInCredentials({
        searchName: 'user@example.com',
        searchPassword: 'password123',
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(true);
    });

    it('should return valid for ciphertext credentials with JWT', () => {
      const result = validateLinkedInCredentials({
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:encrypteddata',
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(true);
    });

    it('should return valid for structured credentials with JWT', () => {
      const result = validateLinkedInCredentials({
        linkedinCredentials: {
          email: 'user@example.com',
          password: 'password123',
        },
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(true);
    });

    it('should return invalid when no credentials provided', () => {
      const result = validateLinkedInCredentials({
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('Missing credentials');
    });

    it('should return invalid when only searchName provided without searchPassword', () => {
      const result = validateLinkedInCredentials({
        searchName: 'user@example.com',
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should return invalid when only searchPassword provided without searchName', () => {
      const result = validateLinkedInCredentials({
        searchPassword: 'password123',
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should return invalid for ciphertext without proper prefix', () => {
      const result = validateLinkedInCredentials({
        linkedinCredentialsCiphertext: 'invalid-prefix:data',
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should return invalid for non-string ciphertext', () => {
      const result = validateLinkedInCredentials({
        linkedinCredentialsCiphertext: 12345,
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should return invalid for structured credentials missing email', () => {
      const result = validateLinkedInCredentials({
        linkedinCredentials: {
          password: 'password123',
        },
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should return invalid for structured credentials missing password', () => {
      const result = validateLinkedInCredentials({
        linkedinCredentials: {
          email: 'user@example.com',
        },
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should return 401 when JWT token is missing', () => {
      const result = validateLinkedInCredentials({
        searchName: 'user@example.com',
        searchPassword: 'password123',
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toBe('Authentication required');
    });

    it('should include custom actionType in error message', () => {
      const result = validateLinkedInCredentials({
        searchName: 'user@example.com',
        searchPassword: 'password123',
        actionType: 'search',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('search');
    });

    it('should use default actionType when not provided', () => {
      const result = validateLinkedInCredentials({
        searchName: 'user@example.com',
        searchPassword: 'password123',
      });

      expect(result.message).toContain('request');
    });

    it('should return 401 when JWT is empty string', () => {
      const result = validateLinkedInCredentials({
        searchName: 'user@example.com',
        searchPassword: 'password123',
        jwtToken: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should return 401 when JWT is null', () => {
      const result = validateLinkedInCredentials({
        searchName: 'user@example.com',
        searchPassword: 'password123',
        jwtToken: null,
      });

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should accept multiple credential types simultaneously', () => {
      const result = validateLinkedInCredentials({
        searchName: 'user@example.com',
        searchPassword: 'password123',
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:encrypteddata',
        linkedinCredentials: {
          email: 'user@example.com',
          password: 'password123',
        },
        jwtToken: 'valid-jwt-token',
      });

      expect(result.isValid).toBe(true);
    });
  });
});
