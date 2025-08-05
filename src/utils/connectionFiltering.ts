import type { Connection, ConnectionFilters } from '@/types';

/**
 * Filters connections based on the provided filter criteria
 * 
 * @param connections - Array of connections to filter
 * @param filters - Filter criteria to apply
 * @returns Filtered array of connections
 */
export function filterConnections(
  connections: Connection[], 
  filters: ConnectionFilters
): Connection[] {
  if (!connections.length) return connections;

  return connections.filter(connection => {
    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (connection.status !== filters.status) {
        return false;
      }
    }

    // Search term filter (searches name, position, company, headline)
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase().trim();
      if (searchTerm) {
        const searchableText = [
          connection.first_name,
          connection.last_name,
          connection.position,
          connection.company,
          connection.headline || '',
          connection.location || ''
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }
    }

    // Location filter
    if (filters.location) {
      if (!connection.location || connection.location !== filters.location) {
        return false;
      }
    }

    // Company filter
    if (filters.company) {
      if (!connection.company || connection.company !== filters.company) {
        return false;
      }
    }

    // Conversion likelihood range filter
    if (filters.conversionLikelihoodRange) {
      const { min, max } = filters.conversionLikelihoodRange;
      const likelihood = connection.conversion_likelihood;
      
      // If connection doesn't have conversion likelihood, exclude it
      if (likelihood === undefined || likelihood === null) {
        return false;
      }
      
      if (likelihood < min || likelihood > max) {
        return false;
      }
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      const connectionTags = connection.tags || [];
      const hasMatchingTag = filters.tags.some(filterTag => 
        connectionTags.includes(filterTag)
      );
      
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts connections based on various criteria
 * 
 * @param connections - Array of connections to sort
 * @param sortBy - Field to sort by
 * @param sortOrder - Sort direction
 * @returns Sorted array of connections
 */
export function sortConnections(
  connections: Connection[],
  sortBy: 'name' | 'company' | 'date_added' | 'conversion_likelihood' = 'name',
  sortOrder: 'asc' | 'desc' = 'asc'
): Connection[] {
  const sorted = [...connections].sort((a, b) => {
    let aValue: string | number | Date;
    let bValue: string | number | Date;

    switch (sortBy) {
      case 'name':
        aValue = `${a.first_name} ${a.last_name}`.toLowerCase();
        bValue = `${b.first_name} ${b.last_name}`.toLowerCase();
        break;
      
      case 'company':
        aValue = a.company.toLowerCase();
        bValue = b.company.toLowerCase();
        break;
      
      case 'date_added':
        aValue = new Date(a.date_added || '1970-01-01');
        bValue = new Date(b.date_added || '1970-01-01');
        break;
      
      case 'conversion_likelihood':
        aValue = a.conversion_likelihood || 0;
        bValue = b.conversion_likelihood || 0;
        break;
      
      default:
        aValue = `${a.first_name} ${a.last_name}`.toLowerCase();
        bValue = `${b.first_name} ${b.last_name}`.toLowerCase();
    }

    if (aValue < bValue) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return sorted;
}

/**
 * Gets unique values for a specific field from connections
 * 
 * @param connections - Array of connections
 * @param field - Field to extract unique values from
 * @returns Array of unique values with counts
 */
export function getUniqueFieldValues(
  connections: Connection[],
  field: keyof Connection
): Array<{ value: string; count: number }> {
  const valueCounts = new Map<string, number>();

  connections.forEach(connection => {
    const value = connection[field];
    if (value && typeof value === 'string') {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        valueCounts.set(trimmedValue, (valueCounts.get(trimmedValue) || 0) + 1);
      }
    }
  });

  return Array.from(valueCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Gets conversion likelihood statistics from connections
 * 
 * @param connections - Array of connections
 * @returns Statistics about conversion likelihood
 */
export function getConversionLikelihoodStats(connections: Connection[]): {
  min: number;
  max: number;
  average: number;
  count: number;
} {
  const validLikelihoods = connections
    .map(c => c.conversion_likelihood)
    .filter((likelihood): likelihood is number => 
      likelihood !== undefined && likelihood !== null
    );

  if (validLikelihoods.length === 0) {
    return { min: 0, max: 100, average: 0, count: 0 };
  }

  const min = Math.min(...validLikelihoods);
  const max = Math.max(...validLikelihoods);
  const average = validLikelihoods.reduce((sum, val) => sum + val, 0) / validLikelihoods.length;

  return {
    min,
    max,
    average: Math.round(average * 100) / 100, // Round to 2 decimal places
    count: validLikelihoods.length
  };
}

/**
 * Creates a debounced version of the filter function for performance
 * 
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}