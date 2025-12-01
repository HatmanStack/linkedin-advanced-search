import type { Connection, ConnectionFilters } from '@/shared/types';


export function filterConnections(
  connections: Connection[], 
  filters: ConnectionFilters
): Connection[] {
  if (!connections.length) return connections;

  return connections.filter(connection => {
    if (filters.status && filters.status !== 'all') {
      if (connection.status !== filters.status) {
        return false;
      }
    }

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

    if (filters.location) {
      if (!connection.location || connection.location !== filters.location) {
        return false;
      }
    }

    if (filters.company) {
      if (!connection.company || connection.company !== filters.company) {
        return false;
      }
    }

    if (filters.conversionLikelihoodRange) {
      const { min, max } = filters.conversionLikelihoodRange;
      const likelihood = connection.conversion_likelihood;
      
      if (likelihood === undefined || likelihood === null) {
        return false;
      }
      
      if (likelihood < min || likelihood > max) {
        return false;
      }
    }

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

