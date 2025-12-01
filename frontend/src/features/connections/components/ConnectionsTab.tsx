import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { VirtualConnectionList } from '@/features/connections';
import { useConnections } from '@/features/connections';
import { useProfileInit } from '@/features/profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search, Users, Filter, X, Database } from 'lucide-react';

interface DisplayConnection {
  connection_id: string;
  id?: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  position?: string;
  company?: string;
  headline?: string;
  connection_status?: string;
  status?: string;
  message_count?: number;
  messages?: number;
  tags?: string[];
  conversation_topics?: string[];
  last_activity_summary?: string;
  recent_activity?: string;
  created_at?: string;
  date_added?: string;
  updated_at?: string;
  profile_picture_url?: string;
  isFakeData?: boolean;
  location?: string;
}

const generateFakeConnections = (): DisplayConnection[] => [
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
    conversation_topics: ['AI Strategy', 'Product Roadmaps', 'Team Leadership'],
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
    conversation_topics: ['Code Architecture', 'ML Algorithms', 'Open Source Projects'],
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
    conversation_topics: ['User Research', 'Design Systems', 'Accessibility Standards'],
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
    conversation_topics: ['Data Analytics', 'Statistical Models', 'Python Libraries'],
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
    conversation_topics: ['Growth Strategies', 'B2B Marketing', 'Campaign Analytics'],
    last_activity_summary: 'Launched successful product campaign',
    created_at: '2024-01-28T00:00:00Z',
    updated_at: '2024-01-28T00:00:00Z',
    profile_picture_url: '',
    isFakeData: true
  }
];

interface ConnectionsTabProps {
  onConnectionSelect?: (connection: DisplayConnection) => void;
  selectedConnections?: string[];
  onSelectionChange?: (connectionIds: string[]) => void;
}

const ConnectionsTab: React.FC<ConnectionsTabProps> = ({
  onConnectionSelect,
  selectedConnections = [],
  onSelectionChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const [activeTags, setActiveTags] = useState<string[]>([]);

  const { connections, loading, error, refetch } = useConnections();
  const {
    isInitializing,
    initializationMessage,
    initializationError,
    initializeProfile
  } = useProfileInit();

  const [containerHeight, setContainerHeight] = useState(600);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const handleResize = useCallback(() => {
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      const availableHeight = window.innerHeight - rect.top - 40;
      const minHeight = Math.max(window.innerHeight * 0.9, 700);
      setContainerHeight(Math.max(minHeight, availableHeight));
    }
  }, [containerRef]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const displayConnections: DisplayConnection[] = connections.length > 0
    ? connections.map(c => ({
        connection_id: c.id,
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        position: c.position,
        company: c.company,
        headline: c.headline,
        connection_status: c.status,
        status: c.status,
        message_count: c.messages,
        messages: c.messages,
        tags: c.tags,
        last_activity_summary: c.last_action_summary || c.recent_activity,
        recent_activity: c.recent_activity,
        created_at: c.date_added,
        date_added: c.date_added,
        location: c.location,
        isFakeData: c.isFakeData,
      }))
    : generateFakeConnections();

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    displayConnections.forEach(connection => {
      (connection.tags || []).forEach((tag: string) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [displayConnections]);

  const filteredConnections = useMemo(() => {
    let filtered = displayConnections.filter(connection => {
      const matchesSearch = searchQuery === '' ||
        connection.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connection.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connection.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        connection.position?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });

    if (activeTags.length > 0) {
      filtered = filtered.sort((a, b) => {
        const aTagsMatch = (a.tags || []).filter((tag: string) => activeTags.includes(tag)).length;
        const bTagsMatch = (b.tags || []).filter((tag: string) => activeTags.includes(tag)).length;

        if (aTagsMatch !== bTagsMatch) {
          return bTagsMatch - aTagsMatch;
        }

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

  const handleInitializeProfile = async () => {
    await initializeProfile(() => {
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
              {}
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

    return (
      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-red-400">
              <Users className="h-5 w-5" />
              Error Loading Connections
            </CardTitle>
            <div className="flex items-center gap-2">
              {}
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

          {}
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

          {}
          <div ref={setContainerRef} style={{ height: containerHeight }} className="overflow-y-auto">
            <VirtualConnectionList
              connections={generateFakeConnections().map((c) => ({
                id: c.connection_id,
                first_name: c.first_name,
                last_name: c.last_name,
                position: c.position || '',
                company: c.company || '',
                last_action_summary: c.last_activity_summary,
                recent_activity: c.last_activity_summary,
                common_interests: c.tags,
                tags: c.tags,
                messages: c.message_count,
                date_added: c.created_at,
                status: c.connection_status === 'connected' ? 'ally' : c.connection_status === 'pending' ? 'incoming' : 'ally',
                isFakeData: true
              }))}
              onSelect={handleConnectionClick}
              onTagClick={handleTagClick}
              activeTags={activeTags}
              className="min-h-[80vh]"
              itemHeight={220}
              showFilters={false}
              sortBy="name"
              sortOrder="asc"
              showCheckboxes={true}
              selectedConnections={selectedConnections}
              onCheckboxChange={(connectionId: string) => handleSelectionToggle(connectionId)}
            />
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
            {}
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

        {}
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
        {}
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

          {}
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
                    className={`cursor-pointer text-xs transition-all duration-200 hover:scale-105 ${activeTags.includes(tag)
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

        {}
        <div ref={setContainerRef} style={{ height: containerHeight }} className="overflow-y-auto">
          <VirtualConnectionList
            connections={filteredConnections.map((c) => ({
              id: c.connection_id,
              first_name: c.first_name,
              last_name: c.last_name,
              position: c.position || '',
              company: c.company || '',
              location: c.location,
              last_action_summary: c.last_activity_summary,
              recent_activity: c.last_activity_summary,
              common_interests: c.tags,
              tags: c.tags,
              messages: c.message_count,
              date_added: c.created_at,
              status: c.connection_status === 'connected' ? 'ally' : c.connection_status === 'pending' ? 'incoming' : 'ally'
            }))}
            onSelect={handleConnectionClick}
            onTagClick={handleTagClick}
            activeTags={activeTags}
            className="min-h-[80vh]"
            itemHeight={220}
            showFilters={false}
            sortBy="name"
            sortOrder="asc"
            showCheckboxes={true}
            selectedConnections={selectedConnections}
            onCheckboxChange={(connectionId: string) => handleSelectionToggle(connectionId)}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectionsTab;