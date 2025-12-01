import { describe, it, expect } from 'vitest';
import { SearchStateManager } from '../../../../src/domains/search/utils/searchStateManager.js';

describe('SearchStateManager', () => {
  describe('buildInitialState', () => {
    it('should build state with all required fields', () => {
      const input = {
        companyName: 'Acme Corp',
        companyRole: 'Engineer',
        companyLocation: 'San Francisco',
        searchName: 'user@example.com',
        searchPassword: 'password123',
        credentialsCiphertext: null,
        jwtToken: 'jwt-token',
      };

      const state = SearchStateManager.buildInitialState(input);

      expect(state.companyName).toBe('Acme Corp');
      expect(state.companyRole).toBe('Engineer');
      expect(state.companyLocation).toBe('San Francisco');
      expect(state.searchName).toBe('user@example.com');
      expect(state.searchPassword).toBe('password123');
      expect(state.jwtToken).toBe('jwt-token');
    });

    it('should set default values for optional fields', () => {
      const input = {
        companyName: 'Acme Corp',
        searchName: 'user@example.com',
        searchPassword: 'password123',
        jwtToken: 'jwt-token',
      };

      const state = SearchStateManager.buildInitialState(input);

      expect(state.resumeIndex).toBe(0);
      expect(state.recursionCount).toBe(0);
      expect(state.lastPartialLinksFile).toBe(null);
      expect(state.extractedCompanyNumber).toBe(null);
      expect(state.extractedGeoNumber).toBe(null);
      expect(state.healPhase).toBe(null);
      expect(state.healReason).toBe(null);
    });

    it('should allow overriding default values', () => {
      const input = {
        companyName: 'Acme Corp',
        searchName: 'user@example.com',
        searchPassword: 'password123',
        jwtToken: 'jwt-token',
        resumeIndex: 5,
        recursionCount: 2,
        lastPartialLinksFile: '/path/to/file.json',
        extractedCompanyNumber: '12345',
        extractedGeoNumber: '67890',
      };

      const state = SearchStateManager.buildInitialState(input);

      expect(state.resumeIndex).toBe(5);
      expect(state.recursionCount).toBe(2);
      expect(state.lastPartialLinksFile).toBe('/path/to/file.json');
      expect(state.extractedCompanyNumber).toBe('12345');
      expect(state.extractedGeoNumber).toBe('67890');
    });

    it('should set heal phase and reason', () => {
      const input = {
        companyName: 'Acme Corp',
        searchName: 'user@example.com',
        searchPassword: 'password123',
        jwtToken: 'jwt-token',
        healPhase: 'link-collection',
        healReason: 'session-timeout',
      };

      const state = SearchStateManager.buildInitialState(input);

      expect(state.healPhase).toBe('link-collection');
      expect(state.healReason).toBe('session-timeout');
    });

    it('should pass through additional options', () => {
      const input = {
        companyName: 'Acme Corp',
        searchName: 'user@example.com',
        searchPassword: 'password123',
        jwtToken: 'jwt-token',
        customOption1: 'value1',
        customOption2: 'value2',
      };

      const state = SearchStateManager.buildInitialState(input);

      expect(state.customOption1).toBe('value1');
      expect(state.customOption2).toBe('value2');
    });

    it('should handle undefined inputs', () => {
      const input = {
        companyName: undefined,
        companyRole: undefined,
        searchName: 'user@example.com',
        searchPassword: 'password123',
        jwtToken: 'jwt-token',
      };

      const state = SearchStateManager.buildInitialState(input);

      expect(state.companyName).toBeUndefined();
      expect(state.companyRole).toBeUndefined();
    });

    it('should handle empty string inputs', () => {
      const input = {
        companyName: '',
        companyRole: '',
        companyLocation: '',
        searchName: 'user@example.com',
        searchPassword: 'password123',
        jwtToken: 'jwt-token',
      };

      const state = SearchStateManager.buildInitialState(input);

      expect(state.companyName).toBe('');
      expect(state.companyRole).toBe('');
      expect(state.companyLocation).toBe('');
    });

    it('should handle credentials ciphertext', () => {
      const input = {
        companyName: 'Acme Corp',
        credentialsCiphertext: 'sealbox_x25519:b64:encrypted-data',
        jwtToken: 'jwt-token',
      };

      const state = SearchStateManager.buildInitialState(input);

      expect(state.credentialsCiphertext).toBe('sealbox_x25519:b64:encrypted-data');
    });
  });
});
