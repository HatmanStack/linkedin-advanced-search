import React, { useState, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Filter, 
  X, 
  MapPin, 
  Building, 
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import type { Connection, ConnectionFilters } from '@/types';

interface ConnectionFiltersProps {
  connections: Connection[];
  filters: ConnectionFilters;
  onFiltersChange: (filters: ConnectionFilters) => void;
  isNewConnection?: boolean;
  className?: string;
}

interface FilterStats {
  locations: Array<{ value: string; count: number }>;
  companies: Array<{ value: string; count: number }>;
  conversionRange: { min: number; max: number };
}

const ConnectionFiltersComponent: React.FC<ConnectionFiltersProps> = ({
  connections,
  filters,
  onFiltersChange,
  isNewConnection = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Calculate filter statistics from connections
  const filterStats = useMemo((): FilterStats => {
    const locationCounts = new Map<string, number>();
    const companyCounts = new Map<string, number>();
    let minConversion = 100;
    let maxConversion = 0;

    connections.forEach(connection => {
      // Count locations
      if (connection.location) {
        const location = connection.location.trim();
        locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
      }

      // Count companies
      if (connection.company) {
        const company = connection.company.trim();
        companyCounts.set(company, (companyCounts.get(company) || 0) + 1);
      }

      // Track conversion likelihood range
      if (connection.conversion_likelihood !== undefined) {
        minConversion = Math.min(minConversion, connection.conversion_likelihood);
        maxConversion = Math.max(maxConversion, connection.conversion_likelihood);
      }
    });

    return {
      locations: Array.from(locationCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20), // Limit to top 20 locations
      companies: Array.from(companyCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20), // Limit to top 20 companies
      conversionRange: {
        min: minConversion === 100 ? 0 : minConversion,
        max: maxConversion === 0 ? 100 : maxConversion
      }
    };
  }, [connections]);

  // Handle filter updates
  const updateFilter = useCallback((key: keyof ConnectionFilters, value: unknown) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  // Handle conversion likelihood range change
  const handleConversionRangeChange = useCallback((values: number[]) => {
    updateFilter('conversionLikelihoodRange', {
      min: values[0],
      max: values[1]
    });
  }, [updateFilter]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  // Clear individual filter
  const clearFilter = useCallback((key: keyof ConnectionFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.location) count++;
    if (filters.company) count++;
    if (filters.searchTerm) count++;
    if (filters.conversionLikelihoodRange) count++;
    return count;
  }, [filters]);

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Active filter badges */}
      {filters.location && (
        <Badge 
          variant="secondary" 
          className="bg-blue-500/20 text-blue-300 border-blue-500/30"
        >
          <MapPin className="h-3 w-3 mr-1" />
          {filters.location}
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 ml-1 hover:bg-blue-500/30"
            onClick={() => clearFilter('location')}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {filters.company && (
        <Badge 
          variant="secondary" 
          className="bg-green-500/20 text-green-300 border-green-500/30"
        >
          <Building className="h-3 w-3 mr-1" />
          {filters.company}
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 ml-1 hover:bg-green-500/30"
            onClick={() => clearFilter('company')}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {filters.conversionLikelihoodRange && isNewConnection && (
        <Badge 
          variant="secondary" 
          className="bg-purple-500/20 text-purple-300 border-purple-500/30"
        >
          <TrendingUp className="h-3 w-3 mr-1" />
          {filters.conversionLikelihoodRange.min}%-{filters.conversionLikelihoodRange.max}%
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 ml-1 hover:bg-purple-500/30"
            onClick={() => clearFilter('conversionLikelihoodRange')}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {/* Filter popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 hover:text-white relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge 
                variant="secondary" 
                className="ml-2 h-5 w-5 p-0 bg-blue-500 text-white text-xs flex items-center justify-center"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 bg-slate-800 border-slate-700 text-white" 
          align="start"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filter Connections</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="bg-slate-700 border-white/20 text-white hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>

            {/* Search term filter */}
            <div className="space-y-2">
              <Label htmlFor="search-term" className="text-sm font-medium">
                Search
              </Label>
              <Input
                id="search-term"
                placeholder="Search by name, position, or company..."
                value={filters.searchTerm || ''}
                onChange={(e) => updateFilter('searchTerm', e.target.value || undefined)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>

            {/* Location filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                <MapPin className="h-4 w-4 inline mr-1" />
                Location
              </Label>
              <Select
                value={filters.location || 'all-locations'}
                onValueChange={(value) => updateFilter('location', value === 'all-locations' ? undefined : value)}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all-locations" className="text-white">All Locations</SelectItem>
                  {filterStats.locations.map(({ value, count }) => (
                    <SelectItem key={value} value={value} className="text-white">
                      {value} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                <Building className="h-4 w-4 inline mr-1" />
                Company
              </Label>
              <Select
                value={filters.company || 'all-companies'}
                onValueChange={(value) => updateFilter('company', value === 'all-companies' ? undefined : value)}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select company..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all-companies" className="text-white">All Companies</SelectItem>
                  {filterStats.companies.map(({ value, count }) => (
                    <SelectItem key={value} value={value} className="text-white">
                      {value} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conversion likelihood filter (only for new connections) */}
            {isNewConnection && filterStats.conversionRange.max > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  <TrendingUp className="h-4 w-4 inline mr-1" />
                  Conversion Likelihood
                </Label>
                <div className="px-2">
                  <Slider
                    value={[
                      filters.conversionLikelihoodRange?.min ?? filterStats.conversionRange.min,
                      filters.conversionLikelihoodRange?.max ?? filterStats.conversionRange.max
                    ]}
                    onValueChange={handleConversionRangeChange}
                    min={filterStats.conversionRange.min}
                    max={filterStats.conversionRange.max}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{filters.conversionLikelihoodRange?.min ?? filterStats.conversionRange.min}%</span>
                    <span>{filters.conversionLikelihoodRange?.max ?? filterStats.conversionRange.max}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Filter summary */}
            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-400">
                Showing {connections.length} connection{connections.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ConnectionFiltersComponent;