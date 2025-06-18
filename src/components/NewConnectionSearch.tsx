import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Building, User, Search, Filter, X } from 'lucide-react';
import ConnectionCard from './ConnectionCard';
import { useToast } from "@/hooks/use-toast";

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
}

interface NewConnectionSearchProps {
  searchResults: NewConnection[];
  onSearch: (filters: { company: string; job: string; location: string }) => void;
  isSearching: boolean;
}

// Fake data for when server is unavailable
const generateFakeConnections = (): NewConnection[] => [
  {
    id: 'fake-1',
    first_name: 'Sarah',
    last_name: 'Johnson',
    position: 'Senior Product Manager',
    company: 'TechCorp Inc',
    location: 'San Francisco, CA',
    headline: 'Building innovative products that scale',
    tags: ['Product Management', 'AI', 'SaaS', 'Leadership'],
    common_interests: ['Product Management', 'AI', 'SaaS', 'Leadership'],
    linkedin_url: 'sarah-johnson-pm',
    last_activity_summary: 'Recently published an article about AI product strategy',
    isFakeData: true
  },
  {
    id: 'fake-2',
    first_name: 'Michael',
    last_name: 'Chen',
    position: 'Full Stack Developer',
    company: 'StartupXYZ',
    location: 'New York, NY',
    headline: 'Passionate about clean code and user experience',
    tags: ['React', 'Node.js', 'TypeScript', 'AWS'],
    common_interests: ['React', 'Node.js', 'TypeScript', 'AWS'],
    linkedin_url: 'michael-chen-dev',
    last_activity_summary: 'Shared insights about modern web development practices',
    isFakeData: true
  },
  {
    id: 'fake-3',
    first_name: 'Emily',
    last_name: 'Rodriguez',
    position: 'UX Designer',
    company: 'DesignStudio',
    location: 'Austin, TX',
    headline: 'Creating delightful user experiences',
    tags: ['UX Design', 'Figma', 'User Research', 'Prototyping'],
    common_interests: ['UX Design', 'Figma', 'User Research', 'Prototyping'],
    linkedin_url: 'emily-rodriguez-ux',
    last_activity_summary: 'Posted about accessibility in design systems',
    isFakeData: true
  },
  {
    id: 'fake-4',
    first_name: 'David',
    last_name: 'Kim',
    position: 'Data Scientist',
    company: 'DataCorp',
    location: 'Seattle, WA',
    headline: 'Turning data into actionable insights',
    tags: ['Machine Learning', 'Python', 'Data Analysis', 'AI'],
    common_interests: ['Machine Learning', 'Python', 'Data Analysis', 'AI'],
    linkedin_url: 'david-kim-data',
    last_activity_summary: 'Presented at the Data Science Summit 2024',
    isFakeData: true
  },
  {
    id: 'fake-5',
    first_name: 'Lisa',
    last_name: 'Thompson',
    position: 'Marketing Director',
    company: 'GrowthLabs',
    location: 'Los Angeles, CA',
    headline: 'Scaling B2B companies through strategic marketing',
    tags: ['Marketing', 'Growth Hacking', 'B2B', 'Analytics'],
    common_interests: ['Marketing', 'Growth Hacking', 'B2B', 'Analytics'],
    linkedin_url: 'lisa-thompson-marketing',
    last_activity_summary: 'Launched a successful multi-channel campaign',
    isFakeData: true
  }
];

const NewConnectionSearch = ({ searchResults, onSearch, isSearching }: NewConnectionSearchProps) => {
  const { toast } = useToast();
  const [searchFilters, setSearchFilters] = useState({
    company: '',
    job: '',
    location: ''
  });
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Use fake data if no search results are available
  const displayResults = searchResults.length > 0 ? searchResults : generateFakeConnections();

  // Get all unique tags from connections
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    displayResults.forEach(connection => {
      (connection.tags || connection.common_interests || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [displayResults]);

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
    onSearch(searchFilters);
  };

  const handleNewConnectionClick = (connection: NewConnection) => {
    if (connection.linkedin_url) {
      const fullLinkedInUrl = `https://www.linkedin.com/in/${connection.linkedin_url}`;
      window.open(fullLinkedInUrl, '_blank', 'noopener,noreferrer');
    } else {
      // For connections without LinkedIn URL, search LinkedIn
      const searchQuery = `${connection.first_name} ${connection.last_name} ${connection.company}`;
      const linkedinSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(searchQuery)}`;
      window.open(linkedinSearchUrl, '_blank', 'noopener,noreferrer');
      
      toast({
        title: "Searching LinkedIn",
        description: `Opening LinkedIn search for ${connection.first_name} ${connection.last_name}`,
      });
    }
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
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, company: e.target.value }))}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
                />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Job Title"
                  value={searchFilters.job}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, job: e.target.value }))}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Location"
                  value={searchFilters.location}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, location: e.target.value }))}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder-slate-400"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 h-[100vh] overflow-y-auto">
            {sortedConnections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={{
                  id: connection.id,
                  first_name: connection.first_name,
                  last_name: connection.last_name,
                  position: connection.position,
                  company: connection.company,
                  location: connection.location,
                  headline: connection.headline,
                  tags: connection.tags,
                  linkedin_url: connection.linkedin_url,
                  recent_activity: connection.last_activity_summary,
                  common_interests: connection.tags || connection.common_interests,
                  messages: 0,
                  date_added: new Date().toISOString(),
                  isFakeData: connection.isFakeData === true,
                  last_activity_summary: connection.last_activity_summary
                }}
                isNewConnection={true}
                onNewConnectionClick={handleNewConnectionClick}
                onTagClick={handleTagClick}
                activeTags={activeTags}
              />
            ))}
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
