import type React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Building, User, Search, X, Loader2, AlertCircle, Info } from 'lucide-react';
import VirtualConnectionList from '@/features/connections';
import { connectionCache } from '@/features/connections';
import type { Connection } from '@/types';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('NewConnectionsTab');

interface NewConnectionsTabProps {
    searchResults: Connection[];
    onSearch: (filters: { company: string; job: string; location: string; userId: string }) => void;
    isSearching: boolean;
    userId: string;
    connectionsLoading?: boolean;
    connectionsError?: string | null;
    searchInfoMessage?: string | null;
    onRefresh?: () => void;
    onRemoveConnection?: (connectionId: string, newStatus: 'processed' | 'outgoing') => void;
}

const NewConnectionsTab = ({
    searchResults,
    onSearch,
    isSearching,
    userId,
    connectionsLoading = false,
    connectionsError = null,
    searchInfoMessage = null,
    onRefresh,
    onRemoveConnection
}: NewConnectionsTabProps) => {
    const [searchFilters, setSearchFilters] = useState({
        company: '',
        job: '',
        location: ''
    });
    const [activeTags, setActiveTags] = useState<string[]>([]);

    // Use real data from props instead of fake data, filtering for 'possible' status only
    const displayResults = searchResults.filter(connection => connection.status === 'possible');

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
        logger.info("LinkedIn credentials are not persistent for security. Please add them each time the application is initiated");
        onSearch({
            ...searchFilters,
            userId
        });
    };

    const clearAllTags = () => {
        setActiveTags([]);
    };

    // Handle connection removal with optimistic updates
    const handleRemoveConnection = useCallback((connectionId: string, newStatus: string) => {
        try {
            // Validate that newStatus is a valid ConnectionStatus before updating cache
            const validStatuses = ['possible', 'incoming', 'outgoing', 'ally', 'processed'];
            if (validStatuses.includes(newStatus)) {
                // API call is performed in the card component; here we just update UI/cache to trigger re-render
                connectionCache.update(connectionId, { status: newStatus as unknown });
            }

            // Inform parent (Dashboard) so its source-of-truth updates and persists across tab switches
            if (onRemoveConnection && (newStatus === 'processed' || newStatus === 'outgoing')) {
                onRemoveConnection(connectionId, newStatus as 'processed' | 'outgoing');
            }
        } catch (error) {
            logger.error('Error removing connection', { error });
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
                                    placeholder="Company (coming soon)"
                                    value={searchFilters.company}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFilters(prev => ({ ...prev, company: e.target.value }))}
                                    className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
                                />
                            </div>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Job Title (coming soon)"
                                    value={searchFilters.job}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFilters(prev => ({ ...prev, job: e.target.value }))}
                                    className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
                                />
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Location (coming soon)"
                                    value={searchFilters.location}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFilters(prev => ({ ...prev, location: e.target.value }))}
                                    className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
                                />
                            </div>
                        </div>

                        {/* Search Info Message Banner */}
                        {searchInfoMessage && (
                            <Alert className="mt-4 bg-blue-500/10 border-blue-500/30">
                                <Info className="h-4 w-4 text-blue-400" />
                                <AlertDescription className="text-blue-200">
                                    {searchInfoMessage}
                                </AlertDescription>
                            </Alert>
                        )}
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

export default NewConnectionsTab;