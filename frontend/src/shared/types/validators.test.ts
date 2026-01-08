import { describe, it, expect } from 'vitest';
import { validateConnections, validateConnection, BatchValidationResult } from './validators';
import type { Connection } from './index';

// Test fixtures
const validConnection: Connection = {
  id: 'conn-1',
  first_name: 'John',
  last_name: 'Doe',
  position: 'Software Engineer',
  company: 'Test Corp',
  status: 'ally',
  conversion_likelihood: 'high',
};

const validConnectionMedium: Connection = {
  id: 'conn-2',
  first_name: 'Jane',
  last_name: 'Smith',
  position: 'Product Manager',
  company: 'Another Corp',
  status: 'possible',
  conversion_likelihood: 'medium',
};

const validConnectionLow: Connection = {
  id: 'conn-3',
  first_name: 'Bob',
  last_name: 'Wilson',
  position: 'Designer',
  company: 'Design Co',
  status: 'outgoing',
  conversion_likelihood: 'low',
};

const invalidConnection = {
  id: 'conn-invalid',
  // Missing required fields: first_name, last_name, position, company, status
};

const connectionMissingOptional = {
  id: 'conn-fixable',
  first_name: 'Alice',
  last_name: 'Brown',
  position: 'Engineer',
  company: 'Fix Corp',
  status: 'ally', // Valid status
  // Missing optional fields like location, headline
};

describe('validateConnections (BatchValidationResult)', () => {
  it('should return all valid connections when all pass validation', () => {
    const connections = [validConnection, validConnectionMedium];
    const result: BatchValidationResult = validateConnections(connections);

    expect(result.validConnections).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.validConnections[0].conversion_likelihood).toBe('high');
    expect(result.validConnections[1].conversion_likelihood).toBe('medium');
  });

  it('should filter out invalid connections', () => {
    const connections = [validConnection, invalidConnection];
    const result = validateConnections(connections);

    expect(result.validConnections).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(1);
  });

  it('should include valid connections with optional fields missing', () => {
    const connections = [connectionMissingOptional];
    const result = validateConnections(connections);

    expect(result.validConnections).toHaveLength(1);
    expect(result.validConnections[0].status).toBe('ally');
    expect(result.validConnections[0].conversion_likelihood).toBeUndefined();
  });

  it('should handle empty array', () => {
    const result = validateConnections([]);

    expect(result.validConnections).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should collect all valid connections with different conversion likelihoods', () => {
    const connections = [validConnection, validConnectionMedium, validConnectionLow];
    const result = validateConnections(connections);

    expect(result.validConnections).toHaveLength(3);
    expect(result.validConnections[0].conversion_likelihood).toBe('high');
    expect(result.validConnections[1].conversion_likelihood).toBe('medium');
    expect(result.validConnections[2].conversion_likelihood).toBe('low');
  });
});

describe('validateConnection (conversion_likelihood enum)', () => {
  it('should accept high conversion likelihood', () => {
    const connection = { ...validConnection, conversion_likelihood: 'high' as const };
    const result = validateConnection(connection);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept medium conversion likelihood', () => {
    const connection = { ...validConnection, conversion_likelihood: 'medium' as const };
    const result = validateConnection(connection);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept low conversion likelihood', () => {
    const connection = { ...validConnection, conversion_likelihood: 'low' as const };
    const result = validateConnection(connection);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept undefined conversion likelihood', () => {
    const connection = { ...validConnection };
    delete (connection as Partial<Connection>).conversion_likelihood;
    const result = validateConnection(connection);

    expect(result.isValid).toBe(true);
  });

  it('should reject invalid conversion likelihood string', () => {
    const connection = { ...validConnection, conversion_likelihood: 'invalid' as unknown };
    const result = validateConnection(connection);

    // Type guard fails first, so error is about invalid structure
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid connection'))).toBe(true);
  });

  it('should reject numeric conversion likelihood (old format)', () => {
    const connection = { ...validConnection, conversion_likelihood: 75 as unknown };
    const result = validateConnection(connection);

    // Type guard fails first, so error is about invalid structure
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid connection'))).toBe(true);
  });
});
