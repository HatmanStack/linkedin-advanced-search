import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Building, User, Search, X, Loader2, AlertCircle } from 'lucide-react';
import VirtualConnectionList from './VirtualConnectionList';
import { connectionCache } from '@/utils/connectionCache';

interface NewConnection {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  company: string;
  location?: string;
  headline?: string;
  common_interests?: string[];
  tags?: string[];
  linkedin_url?: string;
  isFakeData?: boolean;
  last_activity_summary?: string;
  status?: 'possible' | 'incoming' | 'outgoing' | 'ally';
  conversion_likelihood?: number;
}

interface NewConnectionSearchProps {
  searchResults: NewConnection[];
  onSearch: (filters: { company: string; job: string; location: string; userId: string }) => void;
  isSearching: boolean;
  userId: string;
  connectionsLoading?: boolean;
  connectionsError?: string | null;
  onRefresh?: () => void;
  onRemoveConnection?: (connectionId: string, newStatus: 'processed' | 'outgoing') => void;
}

const NewConnectionSearch = ({
  searchResults,
  onSearch,
  isSearching,
  userId,
  connectionsLoading = false,
  connectionsError = null,
  onRefresh,
  onRemoveConnection
}: NewConnectionSearchProps) => {
  const [searchFilters, setSearchFilters] = useState({
    company: '',
    job: '',
    location: ''
  });
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Use real data from props instead of fake data
  const displayResults = searchResults.length > 0 ? searchResults : [];

  // Get all unique tags from connections (reserved for future filter UI)
  // const allTags = useMemo(() => {
  //   const tagSet = new Set<string>();
  //   displayResults.forEach(connection => {
  //     (connection.tags || connection.common_interests || []).forEach(tag => tagSet.add(tag));
  //   });
  //   return Array.from(tagSet).sort();
  // }, [displayResults]);

  // Sort connections based on active tags
  const sortedConnections = useMemo(() => {
    if (activeTags.length === 0) {
      return displayResults;
    }

    return [...displayResults].sort((a, b) => {
      const aTagsMatch = (a.tags || a.common_interests || []).filter(tag => activeTags.includes(tag)).length;
      const bTagsMatch = (b.tags || b.common_interests || []).filter(tag => activeTags.includes(tag)).length;

      // Sort by number of matching tags (descending)
      if (aTagsMatch !== bTagsMatch) {
        return bTagsMatch - aTagsMatch;
      }

      // If same number of matches, sort alphabetically
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });
  }, [displayResults, activeTags]);

  const handleSearch = () => {
    console.log("Your Linkedin Credentials are not persistent for Security.  For now, add them each time the application is Initiated.");
    onSearch({
      ...searchFilters,
      userId
    });
  };

  const clearAllTags = () => {
    setActiveTags([]);
  };

  // Handle connection removal with optimistic updates
  const handleRemoveConnection = useCallback(async (connectionId: string, newStatus: 'processed' | 'outgoing') => {
    try {
      // API call is performed in the card component; here we just update UI/cache to trigger re-render
      connectionCache.update(connectionId, { status: newStatus });
      // Inform parent (Dashboard) so its source-of-truth updates and persists across tab switches
      if (onRemoveConnection) {
        onRemoveConnection(connectionId, newStatus);
      }
    } catch (error) {
      console.error('Error removing connection:', error);
    }
  }, [onRemoveConnection]);

  // Handle tag clicks for filtering
  const handleTagClick = useCallback((tag: string) => {
    setActiveTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  return (
    <div className="grid lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3">
        <Card className="bg-white/5 backdrop-blur-md border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center">
                <UserPlus className="h-5 w-5 mr-2" />
                Discover New Connections ({sortedConnections.length})
              </CardTitle>
              {activeTags.length > 0 && (
                <Button
                  size="sm"
                  onClick={clearAllTags}
                  className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Demo Data Warning */}
            {searchResults.length === 0 && (
              <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
                <p className="text-yellow-200 text-sm font-medium">
                  <strong>⚠️ Demo Mode:</strong> The data displayed below is sample data for demonstration purposes.
                  Connect to your DynamoDB backend to see real LinkedIn connections.
                </p>
              </div>
            )}

            {/* Search Filters */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Company"
                  value={searchFilters.company}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFilters(prev => ({ ...prev, company: e.target.value }))}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
                />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Job Title"
                  value={searchFilters.job}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFilters(prev => ({ ...prev, job: e.target.value }))}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Location"
                  value={searchFilters.location}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFilters(prev => ({ ...prev, location: e.target.value }))}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-4">
            {/* Loading State */}
            {connectionsLoading && (
              <div className="flex items-center justify-center h-64 p-6">
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  <p className="text-slate-300">Loading new connections...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {connectionsError && !connectionsLoading && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 m-6">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-red-300 font-medium">Failed to Load New Connections</h3>
                    <p className="text-red-400 text-sm mt-1">{connectionsError}</p>
                    {onRefresh && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 border-red-500/30 text-red-300 hover:bg-red-500/10"
                        onClick={onRefresh}
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* New Connections with Virtual Scrolling */}
            {!connectionsLoading && !connectionsError && (
              <>
                {sortedConnections.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-slate-400 p-6">
                    <div className="text-center">
                      <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg mb-2">No new connections available</p>
                      <p className="text-sm">
                        Check back later or use the search above to find new connections.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <VirtualConnectionList
                      connections={sortedConnections}
                      isNewConnection={true}
                      onRemove={handleRemoveConnection}
                      onTagClick={handleTagClick}
                      activeTags={activeTags}
                      className="min-h-[80vh]"
                      itemHeight={260} // Card height + margins for proper spacing
                      showFilters={true}
                      sortBy="conversion_likelihood"
                      sortOrder="desc"
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-white/5 backdrop-blur-md border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Search Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
            >
              <Search className="h-4 w-4 mr-2" />
              {isSearching ? 'Searching...' : 'Search LinkedIn'}
            </Button>
            <p className="text-xs text-slate-400">
              {isSearching ? 'Fetching LinkedIn profiles...' : 'Click profiles to view LinkedIn pages'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewConnectionSearch;
