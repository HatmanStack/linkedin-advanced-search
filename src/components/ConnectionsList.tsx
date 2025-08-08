import React, { useState, useMemo } from 'react';
import { useConnections } from '@/hooks/useConnections';
import { useProfileInit } from '@/hooks/useProfileInit';
import { Connection } from '@/services/puppeteerApiService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, MessageSquare, Tag, Calendar, Filter, X, Database } from 'lucide-react';
import ConnectionCard from './ConnectionCard';

// Fake data for when server is unavailable
const generateFakeConnections = (): Connection[] => [
  {
    connection_id: 'fake-1',
    user_id: 'fake-user',
    first_name: 'Sarah',
    last_name: 'Chen',
    position: 'Product Manager',
    company: 'TechCorp',
    headline: 'Building the future of AI-powered products',
    connection_status: 'connected',
    message_count: 12,
    tags: ['AI', 'Product Management', 'Startups', 'Innovation'],
    last_activity_summary: 'Recently shared insights about AI in product development',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    profile_picture_url: '',
    isFakeData: true
  },
  {
    connection_id: 'fake-2',
    user_id: 'fake-user',
    first_name: 'Michael',
    last_name: 'Rodriguez',
    position: 'Software Engineer',
    company: 'DataFlow Inc',
    headline: 'Full-stack developer passionate about clean code',
    connection_status: 'connected',
    message_count: 8,
    tags: ['Machine Learning', 'React', 'Open Source', 'JavaScript'],
    last_activity_summary: 'Just completed a machine learning certification',
    created_at: '2024-02-03T00:00:00Z',
    updated_at: '2024-02-03T00:00:00Z',
    profile_picture_url: '',
    isFakeData: true
  },
  {
    connection_id: 'fake-3',
    user_id: 'fake-user',
    first_name: 'Emily',
    last_name: 'Johnson',
    position: 'UX Designer',
    company: 'DesignLabs',
    headline: 'Creating user-centered experiences that matter',
    connection_status: 'connected',
    message_count: 25,
    tags: ['UX Design', 'Accessibility', 'Design Systems', 'Figma'],
    last_activity_summary: 'Published an article about accessibility in design',
    created_at: '2023-11-22T00:00:00Z',
    updated_at: '2023-11-22T00:00:00Z',
    profile_picture_url: '',
    isFakeData: true
  },
  {
    connection_id: 'fake-4',
    user_id: 'fake-user',
    first_name: 'James',
    last_name: 'Wilson',
    position: 'Data Scientist',
    company: 'Analytics Pro',
    headline: 'Turning data into actionable insights',
    connection_status: 'pending',
    message_count: 3,
    tags: ['Data Science', 'Python', 'Statistics', 'Machine Learning'],
    last_activity_summary: 'Presented at Data Science Conference 2024',
    created_at: '2024-03-10T00:00:00Z',
    updated_at: '2024-03-10T00:00:00Z',
    profile_picture_url: '',
    isFakeData: true
  },
  {
    connection_id: 'fake-5',
    user_id: 'fake-user',
    first_name: 'Lisa',
    last_name: 'Park',
    position: 'Marketing Director',
    company: 'GrowthHub',
    headline: 'Scaling B2B companies through strategic marketing',
    connection_status: 'connected',
    message_count: 17,
    tags: ['Marketing', 'Growth Hacking', 'B2B', 'Analytics'],
    last_activity_summary: 'Launched successful product campaign',
    created_at: '2024-01-28T00:00:00Z',
    updated_at: '2024-01-28T00:00:00Z',
    profile_picture_url: '',
    isFakeData: true
  }
];

interface ConnectionsListProps {
  onConnectionSelect?: (connection: Connection) => void;
  selectedConnections?: string[];
  onSelectionChange?: (connectionIds: string[]) => void;
}

const ConnectionsList: React.FC<ConnectionsListProps> = ({
  onConnectionSelect,
  selectedConnections = [],
  onSelectionChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  
  const { connections, loading, error, refetch } = useConnections();
  const { 
    isInitializing, 
    initializationMessage, 
    initializationError, 
    initializeProfile 
  } = useProfileInit();
  
  // Use fake data if no real connections are available
  const displayConnections = connections.length > 0 ? connections : generateFakeConnections();

  // Get all unique tags from connections
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    displayConnections.forEach(connection => {
      (connection.tags || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [displayConnections]);

  // Filter and sort connections based on search and tags
  const filteredConnections = useMemo(() => {
    let filtered = displayConnections.filter(connection => {
      const matchesSearch = searchQuery === '' || 
        connection.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connection.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connection.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connection.position?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });

    // Sort by tag matches if tags are selected
    if (activeTags.length > 0) {
      filtered = filtered.sort((a, b) => {
        const aTagsMatch = (a.tags || []).filter(tag => activeTags.includes(tag)).length;
        const bTagsMatch = (b.tags || []).filter(tag => activeTags.includes(tag)).length;
        
        // Sort by number of matching tags (descending)
        if (aTagsMatch !== bTagsMatch) {
          return bTagsMatch - aTagsMatch;
        }
        
        // If same number of matches, sort alphabetically
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      });
    }

    return filtered;
  }, [displayConnections, searchQuery, activeTags]);

  const handleConnectionClick = (connectionId: string) => {
    const connection = displayConnections.find(c => c.connection_id === connectionId);
    if (connection && onConnectionSelect) {
      onConnectionSelect(connection);
    }
  };

  const handleSelectionToggle = (connectionId: string) => {
    if (!onSelectionChange) return;
    
    const newSelection = selectedConnections.includes(connectionId)
      ? selectedConnections.filter(id => id !== connectionId)
      : [...selectedConnections, connectionId];
    
    onSelectionChange(newSelection);
  };

  const handleTagClick = (tag: string) => {
    setActiveTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearAllTags = () => {
    setActiveTags([]);
  };

  // Handle profile initialization with connection refresh
  const handleInitializeProfile = async () => {
    await initializeProfile(() => {
      // Refresh connections list to show any new data after successful initialization
      refetch();
    });
  };

  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5" />
              Loading Connections...
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Initialize Profile Database Button */}
              <Button 
                onClick={handleInitializeProfile}
                disabled={isInitializing}
                className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
              >
                <Database className="h-4 w-4 mr-2" />
                {isInitializing ? 'Initializing...' : 'Initialize Profile Database'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    // Show fake data with error message when there's an error
    const fakeConnections = generateFakeConnections();
    
    return (
      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-red-400">
              <Users className="h-5 w-5" />
              Error Loading Connections
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Initialize Profile Database Button */}
              <Button 
                onClick={handleInitializeProfile}
                disabled={isInitializing}
                className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
              >
                <Database className="h-4 w-4 mr-2" />
                {isInitializing ? 'Initializing...' : 'Initialize Profile Database'}
              </Button>
            </div>
          </div>
          <CardDescription className="text-slate-300">
            Unable to connect to server. Showing demo data below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-300 mb-2">
              <strong>Connection Error:</strong> {error}
            </p>
            <Button onClick={refetch} className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500 mb-4">
              Try Again
            </Button>
          </div>
          
          <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3 mb-6">
            <p className="text-yellow-200 text-sm font-medium">
              <strong>⚠️ Demo Mode:</strong> The data displayed below is sample data for demonstration purposes. 
              Fix the connection issue above to see your real LinkedIn connections.
            </p>
          </div>

          {/* Search and Filter Controls */}
          <div className="space-y-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search connections by name, company, or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
              />
            </div>
          </div>

          {/* Fake Connections using ConnectionCard */}
          <div className="h-[100vh] overflow-y-auto">
            <div className="space-y-4">
              {fakeConnections.map((connection) => (
                <ConnectionCard
                  key={connection.connection_id}
                  connection={{
                    ...connection,
                    id: connection.connection_id,
                    position: connection.position || '',
                    company: connection.company || '',
                    recent_activity: connection.last_activity_summary,
                    common_interests: connection.tags,
                    messages: connection.message_count,
                    date_added: connection.created_at
                  }}
                  isSelected={selectedConnections.includes(connection.connection_id)}
                  onSelect={handleConnectionClick}
                  onTagClick={handleTagClick}
                  activeTags={activeTags}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 backdrop-blur-md border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Users className="h-5 w-5" />
            Your Connections ({filteredConnections.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Initialize Profile Database Button */}
            <Button 
              onClick={handleInitializeProfile}
              disabled={isInitializing}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
            >
              <Database className="h-4 w-4 mr-2" />
              {isInitializing ? 'Initializing...' : 'Initialize Profile Database'}
            </Button>
            {activeTags.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllTags}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <X className="h-3 w-3 mr-1" />
                Clear Tag Filters
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-slate-300">
          Manage and interact with your LinkedIn connections
        </CardDescription>
        
        {/* Status Messages */}
        {initializationMessage && (
          <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-3 mt-4">
            <p className="text-green-200 text-sm font-medium">
              <strong>✓ Success:</strong> {initializationMessage}
            </p>
          </div>
        )}
        
        {initializationError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-4">
            <p className="text-red-300 text-sm font-medium">
              <strong>✗ Error:</strong> {initializationError}
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Search and Filter Controls */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search connections by name, company, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-300">Filter by tags:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={`cursor-pointer text-xs transition-all duration-200 hover:scale-105 ${
                      activeTags.includes(tag)
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                        : 'border-blue-400/30 text-blue-300 hover:bg-blue-600/20 hover:border-blue-400'
                    }`}
                    onClick={() => handleTagClick(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              {activeTags.length > 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  Showing connections with {activeTags.length} selected tag{activeTags.length > 1 ? 's' : ''}: {activeTags.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Connections List */}
        <div className="h-[100vh] overflow-y-auto">
          {filteredConnections.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-500" />
              <p>No connections found</p>
              <p className="text-sm">Start by searching for new connections</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredConnections.map((connection) => (
                <ConnectionCard
                  key={connection.connection_id}
                  connection={{
                    ...connection,
                    id: connection.connection_id,
                    position: connection.position || '',
                    company: connection.company || '',
                    recent_activity: connection.last_activity_summary,
                    common_interests: connection.tags,
                    messages: connection.message_count,
                    date_added: connection.created_at
                  }}
                  isSelected={selectedConnections.includes(connection.connection_id)}
                  onSelect={handleConnectionClick}
                  onTagClick={handleTagClick}
                  activeTags={activeTags}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectionsList;
