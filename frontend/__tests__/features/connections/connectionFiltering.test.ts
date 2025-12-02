import { describe, it, expect, beforeEach } from 'vitest';
import { filterConnections, sortConnections } from '@/features/connections/utils/connectionFiltering';
import type { ConnectionFilters } from '@/shared/types';
import { createMockConnection, resetFactoryCounters } from '../../utils/mockFactories';

describe('connectionFiltering', () => {
  beforeEach(() => {
    resetFactoryCounters();
  });

  describe('filterConnections', () => {
    describe('empty and no-filter scenarios', () => {
      it('returns empty array for empty input', () => {
        const result = filterConnections([], {});
        expect(result).toEqual([]);
      });

      it('returns all connections when no filters applied', () => {
        const connections = [
          createMockConnection(),
          createMockConnection(),
          createMockConnection(),
        ];

        const result = filterConnections(connections, {});
        expect(result).toHaveLength(3);
      });

      it('returns all connections when status is "all"', () => {
        const connections = [
          createMockConnection({ status: 'incoming' }),
          createMockConnection({ status: 'outgoing' }),
          createMockConnection({ status: 'ally' }),
        ];

        const result = filterConnections(connections, { status: 'all' });
        expect(result).toHaveLength(3);
      });
    });

    describe('status filtering', () => {
      it('filters by incoming status', () => {
        const connections = [
          createMockConnection({ status: 'incoming' }),
          createMockConnection({ status: 'outgoing' }),
          createMockConnection({ status: 'incoming' }),
        ];

        const result = filterConnections(connections, { status: 'incoming' });
        expect(result).toHaveLength(2);
        expect(result.every(c => c.status === 'incoming')).toBe(true);
      });

      it('filters by outgoing status', () => {
        const connections = [
          createMockConnection({ status: 'incoming' }),
          createMockConnection({ status: 'outgoing' }),
          createMockConnection({ status: 'outgoing' }),
        ];

        const result = filterConnections(connections, { status: 'outgoing' });
        expect(result).toHaveLength(2);
        expect(result.every(c => c.status === 'outgoing')).toBe(true);
      });

      it('filters by ally status', () => {
        const connections = [
          createMockConnection({ status: 'ally' }),
          createMockConnection({ status: 'outgoing' }),
          createMockConnection({ status: 'ally' }),
        ];

        const result = filterConnections(connections, { status: 'ally' });
        expect(result).toHaveLength(2);
        expect(result.every(c => c.status === 'ally')).toBe(true);
      });

      it('filters by possible status', () => {
        const connections = [
          createMockConnection({ status: 'possible' }),
          createMockConnection({ status: 'outgoing' }),
        ];

        const result = filterConnections(connections, { status: 'possible' });
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('possible');
      });
    });

    describe('searchTerm filtering', () => {
      it('filters by first_name (case-insensitive)', () => {
        const connections = [
          createMockConnection({ first_name: 'John' }),
          createMockConnection({ first_name: 'Jane' }),
          createMockConnection({ first_name: 'Bob' }),
        ];

        const result = filterConnections(connections, { searchTerm: 'john' });
        expect(result).toHaveLength(1);
        expect(result[0].first_name).toBe('John');
      });

      it('filters by last_name (case-insensitive)', () => {
        const connections = [
          createMockConnection({ last_name: 'Smith' }),
          createMockConnection({ last_name: 'Johnson' }),
          createMockConnection({ last_name: 'Williams' }),
        ];

        const result = filterConnections(connections, { searchTerm: 'SMITH' });
        expect(result).toHaveLength(1);
        expect(result[0].last_name).toBe('Smith');
      });

      it('filters by position', () => {
        const connections = [
          createMockConnection({ position: 'Frontend Developer' }),
          createMockConnection({ position: 'Product Manager' }),
          createMockConnection({ position: 'Backend Developer' }),
        ];

        const result = filterConnections(connections, { searchTerm: 'developer' });
        expect(result).toHaveLength(2);
      });

      it('filters by company', () => {
        const connections = [
          createMockConnection({ company: 'Google' }),
          createMockConnection({ company: 'Microsoft' }),
          createMockConnection({ company: 'Google Cloud' }),
        ];

        const result = filterConnections(connections, { searchTerm: 'google' });
        expect(result).toHaveLength(2);
      });

      it('filters by headline', () => {
        const connections = [
          createMockConnection({ headline: 'AI/ML Specialist' }),
          createMockConnection({ headline: 'Data Scientist' }),
          createMockConnection({ headline: undefined }),
        ];

        const result = filterConnections(connections, { searchTerm: 'AI' });
        expect(result).toHaveLength(1);
        expect(result[0].headline).toBe('AI/ML Specialist');
      });

      it('filters by location', () => {
        const connections = [
          createMockConnection({ location: 'San Francisco, CA' }),
          createMockConnection({ location: 'New York, NY' }),
          createMockConnection({ location: undefined }),
        ];

        const result = filterConnections(connections, { searchTerm: 'san francisco' });
        expect(result).toHaveLength(1);
      });

      it('trims whitespace from search term', () => {
        const connections = [
          createMockConnection({ first_name: 'John' }),
          createMockConnection({ first_name: 'Jane' }),
        ];

        const result = filterConnections(connections, { searchTerm: '  john  ' });
        expect(result).toHaveLength(1);
      });

      it('returns all when searchTerm is empty string', () => {
        const connections = [
          createMockConnection(),
          createMockConnection(),
        ];

        const result = filterConnections(connections, { searchTerm: '' });
        expect(result).toHaveLength(2);
      });

      it('returns all when searchTerm is whitespace only', () => {
        const connections = [
          createMockConnection(),
          createMockConnection(),
        ];

        const result = filterConnections(connections, { searchTerm: '   ' });
        expect(result).toHaveLength(2);
      });
    });

    describe('location filtering (exact match)', () => {
      it('filters by exact location match', () => {
        const connections = [
          createMockConnection({ location: 'San Francisco, CA' }),
          createMockConnection({ location: 'San Francisco' }),
          createMockConnection({ location: 'New York, NY' }),
        ];

        const result = filterConnections(connections, { location: 'San Francisco, CA' });
        expect(result).toHaveLength(1);
        expect(result[0].location).toBe('San Francisco, CA');
      });

      it('excludes connections without location when filter applied', () => {
        const connections = [
          createMockConnection({ location: 'San Francisco, CA' }),
          createMockConnection({ location: undefined }),
        ];

        const result = filterConnections(connections, { location: 'San Francisco, CA' });
        expect(result).toHaveLength(1);
      });
    });

    describe('company filtering (exact match)', () => {
      it('filters by exact company match', () => {
        const connections = [
          createMockConnection({ company: 'Google' }),
          createMockConnection({ company: 'Google LLC' }),
          createMockConnection({ company: 'Microsoft' }),
        ];

        const result = filterConnections(connections, { company: 'Google' });
        expect(result).toHaveLength(1);
        expect(result[0].company).toBe('Google');
      });
    });

    describe('conversionLikelihoodRange filtering', () => {
      it('filters by min and max range', () => {
        const connections = [
          createMockConnection({ conversion_likelihood: 25 }),
          createMockConnection({ conversion_likelihood: 50 }),
          createMockConnection({ conversion_likelihood: 75 }),
          createMockConnection({ conversion_likelihood: 100 }),
        ];

        const result = filterConnections(connections, {
          conversionLikelihoodRange: { min: 40, max: 80 },
        });
        expect(result).toHaveLength(2);
        expect(result.map(c => c.conversion_likelihood)).toEqual([50, 75]);
      });

      it('includes values at range boundaries', () => {
        const connections = [
          createMockConnection({ conversion_likelihood: 50 }),
          createMockConnection({ conversion_likelihood: 75 }),
        ];

        const result = filterConnections(connections, {
          conversionLikelihoodRange: { min: 50, max: 75 },
        });
        expect(result).toHaveLength(2);
      });

      it('excludes connections with undefined conversion_likelihood', () => {
        const connections = [
          createMockConnection({ conversion_likelihood: 50 }),
          createMockConnection({ conversion_likelihood: undefined }),
        ];

        const result = filterConnections(connections, {
          conversionLikelihoodRange: { min: 0, max: 100 },
        });
        expect(result).toHaveLength(1);
      });

      it('excludes connections with null conversion_likelihood', () => {
        const connections = [
          createMockConnection({ conversion_likelihood: 50 }),
          createMockConnection({ conversion_likelihood: null as unknown as number }),
        ];

        const result = filterConnections(connections, {
          conversionLikelihoodRange: { min: 0, max: 100 },
        });
        expect(result).toHaveLength(1);
      });
    });

    describe('tags filtering', () => {
      it('filters by single tag', () => {
        const connections = [
          createMockConnection({ tags: ['developer', 'react'] }),
          createMockConnection({ tags: ['manager', 'leadership'] }),
          createMockConnection({ tags: ['developer', 'node'] }),
        ];

        const result = filterConnections(connections, { tags: ['developer'] });
        expect(result).toHaveLength(2);
      });

      it('filters by any matching tag (OR logic)', () => {
        const connections = [
          createMockConnection({ tags: ['developer', 'react'] }),
          createMockConnection({ tags: ['manager', 'leadership'] }),
          createMockConnection({ tags: ['designer', 'ux'] }),
        ];

        const result = filterConnections(connections, { tags: ['developer', 'manager'] });
        expect(result).toHaveLength(2);
      });

      it('excludes connections with empty tags array', () => {
        const connections = [
          createMockConnection({ tags: ['developer'] }),
          createMockConnection({ tags: [] }),
        ];

        const result = filterConnections(connections, { tags: ['developer'] });
        expect(result).toHaveLength(1);
      });

      it('excludes connections with undefined tags', () => {
        const connections = [
          createMockConnection({ tags: ['developer'] }),
          createMockConnection({ tags: undefined }),
        ];

        const result = filterConnections(connections, { tags: ['developer'] });
        expect(result).toHaveLength(1);
      });

      it('returns all when tags filter is empty array', () => {
        const connections = [
          createMockConnection({ tags: ['developer'] }),
          createMockConnection({ tags: [] }),
        ];

        const result = filterConnections(connections, { tags: [] });
        expect(result).toHaveLength(2);
      });
    });

    describe('combined filters', () => {
      it('applies multiple filters (AND logic)', () => {
        const connections = [
          createMockConnection({
            status: 'incoming',
            company: 'Google',
            conversion_likelihood: 80
          }),
          createMockConnection({
            status: 'incoming',
            company: 'Google',
            conversion_likelihood: 30
          }),
          createMockConnection({
            status: 'outgoing',
            company: 'Google',
            conversion_likelihood: 80
          }),
          createMockConnection({
            status: 'incoming',
            company: 'Microsoft',
            conversion_likelihood: 80
          }),
        ];

        const filters: ConnectionFilters = {
          status: 'incoming',
          company: 'Google',
          conversionLikelihoodRange: { min: 50, max: 100 },
        };

        const result = filterConnections(connections, filters);
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('incoming');
        expect(result[0].company).toBe('Google');
        expect(result[0].conversion_likelihood).toBe(80);
      });

      it('applies status and searchTerm filters together', () => {
        const connections = [
          createMockConnection({ status: 'ally', first_name: 'John' }),
          createMockConnection({ status: 'ally', first_name: 'Jane' }),
          createMockConnection({ status: 'incoming', first_name: 'John' }),
        ];

        const result = filterConnections(connections, {
          status: 'ally',
          searchTerm: 'john',
        });
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('ally');
        expect(result[0].first_name).toBe('John');
      });
    });
  });

  describe('sortConnections', () => {
    describe('sort by name', () => {
      it('sorts by name ascending (default)', () => {
        const connections = [
          createMockConnection({ first_name: 'Charlie', last_name: 'Brown' }),
          createMockConnection({ first_name: 'Alice', last_name: 'Smith' }),
          createMockConnection({ first_name: 'Bob', last_name: 'Jones' }),
        ];

        const result = sortConnections(connections);
        expect(result[0].first_name).toBe('Alice');
        expect(result[1].first_name).toBe('Bob');
        expect(result[2].first_name).toBe('Charlie');
      });

      it('sorts by name descending', () => {
        const connections = [
          createMockConnection({ first_name: 'Alice', last_name: 'Smith' }),
          createMockConnection({ first_name: 'Charlie', last_name: 'Brown' }),
          createMockConnection({ first_name: 'Bob', last_name: 'Jones' }),
        ];

        const result = sortConnections(connections, 'name', 'desc');
        expect(result[0].first_name).toBe('Charlie');
        expect(result[1].first_name).toBe('Bob');
        expect(result[2].first_name).toBe('Alice');
      });

      it('is case-insensitive', () => {
        const connections = [
          createMockConnection({ first_name: 'bob', last_name: 'smith' }),
          createMockConnection({ first_name: 'Alice', last_name: 'jones' }),
        ];

        const result = sortConnections(connections, 'name', 'asc');
        expect(result[0].first_name).toBe('Alice');
        expect(result[1].first_name).toBe('bob');
      });
    });

    describe('sort by company', () => {
      it('sorts by company ascending', () => {
        const connections = [
          createMockConnection({ company: 'Zebra Inc' }),
          createMockConnection({ company: 'Apple' }),
          createMockConnection({ company: 'Microsoft' }),
        ];

        const result = sortConnections(connections, 'company', 'asc');
        expect(result[0].company).toBe('Apple');
        expect(result[1].company).toBe('Microsoft');
        expect(result[2].company).toBe('Zebra Inc');
      });

      it('sorts by company descending', () => {
        const connections = [
          createMockConnection({ company: 'Apple' }),
          createMockConnection({ company: 'Zebra Inc' }),
          createMockConnection({ company: 'Microsoft' }),
        ];

        const result = sortConnections(connections, 'company', 'desc');
        expect(result[0].company).toBe('Zebra Inc');
        expect(result[1].company).toBe('Microsoft');
        expect(result[2].company).toBe('Apple');
      });
    });

    describe('sort by date_added', () => {
      it('sorts by date_added ascending', () => {
        const connections = [
          createMockConnection({ date_added: '2024-03-15T00:00:00Z' }),
          createMockConnection({ date_added: '2024-01-01T00:00:00Z' }),
          createMockConnection({ date_added: '2024-02-10T00:00:00Z' }),
        ];

        const result = sortConnections(connections, 'date_added', 'asc');
        expect(result[0].date_added).toBe('2024-01-01T00:00:00Z');
        expect(result[1].date_added).toBe('2024-02-10T00:00:00Z');
        expect(result[2].date_added).toBe('2024-03-15T00:00:00Z');
      });

      it('sorts by date_added descending', () => {
        const connections = [
          createMockConnection({ date_added: '2024-01-01T00:00:00Z' }),
          createMockConnection({ date_added: '2024-03-15T00:00:00Z' }),
          createMockConnection({ date_added: '2024-02-10T00:00:00Z' }),
        ];

        const result = sortConnections(connections, 'date_added', 'desc');
        expect(result[0].date_added).toBe('2024-03-15T00:00:00Z');
        expect(result[1].date_added).toBe('2024-02-10T00:00:00Z');
        expect(result[2].date_added).toBe('2024-01-01T00:00:00Z');
      });

      it('handles missing date_added (uses epoch fallback)', () => {
        const connections = [
          createMockConnection({ date_added: '2024-01-01T00:00:00Z' }),
          createMockConnection({ date_added: undefined }),
        ];

        const result = sortConnections(connections, 'date_added', 'asc');
        // undefined date should come first (epoch is earliest)
        expect(result[0].date_added).toBeUndefined();
        expect(result[1].date_added).toBe('2024-01-01T00:00:00Z');
      });
    });

    describe('sort by conversion_likelihood', () => {
      it('sorts by conversion_likelihood ascending', () => {
        const connections = [
          createMockConnection({ conversion_likelihood: 75 }),
          createMockConnection({ conversion_likelihood: 25 }),
          createMockConnection({ conversion_likelihood: 50 }),
        ];

        const result = sortConnections(connections, 'conversion_likelihood', 'asc');
        expect(result[0].conversion_likelihood).toBe(25);
        expect(result[1].conversion_likelihood).toBe(50);
        expect(result[2].conversion_likelihood).toBe(75);
      });

      it('sorts by conversion_likelihood descending', () => {
        const connections = [
          createMockConnection({ conversion_likelihood: 25 }),
          createMockConnection({ conversion_likelihood: 75 }),
          createMockConnection({ conversion_likelihood: 50 }),
        ];

        const result = sortConnections(connections, 'conversion_likelihood', 'desc');
        expect(result[0].conversion_likelihood).toBe(75);
        expect(result[1].conversion_likelihood).toBe(50);
        expect(result[2].conversion_likelihood).toBe(25);
      });

      it('handles undefined conversion_likelihood (uses 0 fallback)', () => {
        const connections = [
          createMockConnection({ conversion_likelihood: 50 }),
          createMockConnection({ conversion_likelihood: undefined }),
        ];

        const result = sortConnections(connections, 'conversion_likelihood', 'asc');
        // undefined should come first (treated as 0)
        expect(result[0].conversion_likelihood).toBeUndefined();
        expect(result[1].conversion_likelihood).toBe(50);
      });

      it('handles null conversion_likelihood (uses 0 fallback)', () => {
        const connections = [
          createMockConnection({ conversion_likelihood: 50 }),
          createMockConnection({ conversion_likelihood: null as unknown as number }),
        ];

        const result = sortConnections(connections, 'conversion_likelihood', 'asc');
        expect(result[0].conversion_likelihood).toBeNull();
        expect(result[1].conversion_likelihood).toBe(50);
      });
    });

    describe('edge cases', () => {
      it('returns empty array for empty input', () => {
        const result = sortConnections([]);
        expect(result).toEqual([]);
      });

      it('does not mutate original array', () => {
        const connections = [
          createMockConnection({ first_name: 'Charlie' }),
          createMockConnection({ first_name: 'Alice' }),
        ];
        const original = [...connections];

        sortConnections(connections, 'name', 'asc');
        expect(connections).toEqual(original);
      });

      it('handles single element array', () => {
        const connections = [createMockConnection({ first_name: 'Solo' })];

        const result = sortConnections(connections, 'name', 'asc');
        expect(result).toHaveLength(1);
        expect(result[0].first_name).toBe('Solo');
      });

      it('handles equal values (stable sort behavior)', () => {
        const connections = [
          createMockConnection({ first_name: 'Alice', company: 'Same' }),
          createMockConnection({ first_name: 'Bob', company: 'Same' }),
        ];

        const result = sortConnections(connections, 'company', 'asc');
        expect(result).toHaveLength(2);
        // Both have same company, order should be stable
        expect(result.every(c => c.company === 'Same')).toBe(true);
      });
    });
  });
});
