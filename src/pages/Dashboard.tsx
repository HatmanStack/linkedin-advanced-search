import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Users, Settings, UserPlus, FileText, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHealAndRestore } from '@/contexts/HealAndRestoreContext'; // Added
import { useToast } from '@/hooks/use-toast';
import { useSearchResults } from '@/hooks';
import type { SearchFormData } from '@/utils/validation';
import ConnectionsList from '@/components/ConnectionsList';
import ConversationTopicPanel from '@/components/ConversationTopicPanel';
import NewConnectionSearch from '@/components/NewConnectionSearch';
import PostCreator from '@/components/PostCreator';
import SavedPostsList from '@/components/SavedPostsList';
import PostAIAssistant from '@/components/PostAIAssistant';
import { useLinkedInCredentials } from '@/contexts/LinkedInCredentialsContext';

// Sample data for demonstration with new parameters
const sampleConnections = [
  {
    id: '1',
    first_name: 'Sarah',
    last_name: 'Chen',
    position: 'Product Manager',
    company: 'TechCorp',
    headline: 'Building the future of AI-powered products',
    recent_activity: 'Recently shared insights about AI in product development',
    common_interests: ['AI', 'Product Management', 'Startups'],
    messages: 12,
    date_added: '2024-01-15'
  },
  {
    id: '2',
    first_name: 'Michael',
    last_name: 'Rodriguez',
    position: 'Software Engineer',
    company: 'DataFlow Inc',
    headline: 'Full-stack developer passionate about clean code',
    recent_activity: 'Just completed a machine learning certification',
    common_interests: ['Machine Learning', 'React', 'Open Source'],
    messages: 8,
    date_added: '2024-02-03'
  },
  {
    id: '3',
    first_name: 'Emily',
    last_name: 'Johnson',
    position: 'UX Designer',
    company: 'DesignLabs',
    headline: 'Creating user-centered experiences that matter',
    recent_activity: 'Published an article about accessibility in design',
    common_interests: ['UX Design', 'Accessibility', 'Design Systems'],
    messages: 25,
    date_added: '2023-11-22'
  },
  {
    id: '4',
    first_name: 'James',
    last_name: 'Wilson',
    position: 'Data Scientist',
    company: 'Analytics Pro',
    headline: 'Turning data into actionable insights',
    recent_activity: 'Presented at Data Science Conference 2024',
    common_interests: ['Data Science', 'Python', 'Statistics'],
    messages: 3,
    date_added: '2024-03-10'
  },
  {
    id: '5',
    first_name: 'Lisa',
    last_name: 'Park',
    position: 'Marketing Director',
    company: 'GrowthHub',
    headline: 'Scaling B2B companies through strategic marketing',
    recent_activity: 'Launched successful product campaign',
    common_interests: ['Marketing', 'Growth Hacking', 'B2B'],
    messages: 17,
    date_added: '2024-01-28'
  }
];

// Sample data for demonstration
const sampleNewConnections = [
  {
    id: '4',
    first_name: 'David',
    last_name: 'Thompson',
    position: 'Marketing Director',
    company: 'GrowthLabs',
    location: 'New York, NY',
    headline: 'Scaling B2B SaaS companies through data-driven marketing',
    common_interests: ['Marketing', 'SaaS', 'Analytics'],
    linkedin_url: 'david-thompson-marketing',
    isFakeData: true
  },
  {
    id: '5',
    first_name: 'Lisa',
    last_name: 'Wang',
    position: 'DevOps Engineer',
    company: 'CloudTech',
    location: 'San Francisco, CA',
    headline: 'Building scalable infrastructure for modern applications',
    common_interests: ['DevOps', 'Cloud Computing', 'Kubernetes'],
    linkedin_url: 'lisa-wang-devops',
    isFakeData: true
  },
  {
    id: '6',
    first_name: 'Alex',
    last_name: 'Rivera',
    position: 'Data Scientist',
    company: 'InsightAI',
    location: 'Austin, TX',
    headline: 'Turning data into actionable insights',
    common_interests: ['Data Science', 'Machine Learning', 'Python'],
    linkedin_url: 'alex-rivera-data',
    isFakeData: true
  }
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { startListening } = useHealAndRestore(); // Added
  const { toast } = useToast();
  const { credentials: linkedinUserCredentials } = useLinkedInCredentials(); // Added
  const [conversationTopic, setConversationTopic] = useState('');
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [postContent, setPostContent] = useState('');
  const [savedPosts, setSavedPosts] = useState<Array<{ id: string, title: string, content: string, created_at: string }>>([]);
  const [linkedinSearchResults, setLinkedinSearchResults] = useState([]);
  const [isSearchingLinkedIn, setIsSearchingLinkedIn] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Use existing search functionality
  const {
    results,
    visitedLinks,
    loading,
    error,
    searchLinkedIn,
    markAsVisited,
    clearResults,
    clearVisitedLinks,
  } = useSearchResults();

  // Load saved posts on component mount
  useEffect(() => {
    loadSavedPosts();
  }, []);

  // Start listening for heal and restore notifications
  useEffect(() => {
    startListening();
  }, [startListening]);

  const loadSavedPosts = async () => {
    try {
      const response = await fetch('/api/posts/drafts');
      if (response.ok) {
        const posts = await response.json();
        setSavedPosts(posts);
      }
    } catch (error) {
      console.error('Error loading saved posts:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const toggleConnectionSelection = (connectionId: string) => {
    setSelectedConnections(prev =>
      prev.includes(connectionId)
        ? prev.filter(id => id !== connectionId)
        : [...prev, connectionId]
    );
  };

  const handleLinkedInSearch = async (filters: { company: string; job: string; location: string; userId: string }) => {
    setIsSearchingLinkedIn(true);

    try {
      // Convert the new filter format to the existing SearchFormData format
      const searchData: SearchFormData = {
        companyName: filters.company,
        companyRole: filters.job,
        companyLocation: filters.location,
        searchName: linkedinUserCredentials.email, // Use credentials from context
        searchPassword: linkedinUserCredentials.password, // Use credentials from context
        userId: filters.userId, // Include userId from filters
      };
      console.log('Search data with credentials:', searchData);
      // Use the existing search functionality
      await searchLinkedIn(searchData);

      // Convert results to the new format if needed
      if (results && results.length > 0) {
        const convertedResults = results.map((result, index) => ({
          id: `search-${index}`,
          first_name: 'LinkedIn',
          last_name: 'User',
          position: filters.job || 'Professional',
          company: filters.company || 'Company',
          location: filters.location,
          headline: result,
          common_interests: [],
          linkedin_url: result.includes('linkedin.com') ? result.split('/').pop() : undefined
        }));
        setLinkedinSearchResults(convertedResults);
      }

      console.log('LinkedIn search results:', results);
    } catch (error) {
      console.error('Error searching LinkedIn:', error);
      toast({
        title: "Search Failed",
        description: "Failed to search LinkedIn. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingLinkedIn(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!postContent.trim()) {
      toast({
        title: "Empty Post",
        description: "Please enter some content before saving.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingDraft(true);
    try {
      const response = await fetch('/api/posts/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: postContent,
          title: postContent.substring(0, 50) + (postContent.length > 50 ? '...' : '')
        })
      });

      if (response.ok) {
        const savedPost = await response.json();
        setSavedPosts(prev => [savedPost, ...prev]);
        toast({
          title: "Draft Saved",
          description: "Your post has been saved as a draft."
        });
      } else {
        throw new Error('Failed to save draft');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleDeleteDraft = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/drafts/${postId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSavedPosts(prev => prev.filter(post => post.id !== postId));
        toast({
          title: "Draft Deleted",
          description: "Draft has been deleted successfully."
        });
      } else {
        throw new Error('Failed to delete draft');
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete draft. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleLoadDraft = (post: any) => {
    setPostContent(post.content);
  };

  const handlePublishPost = async () => {
    if (!postContent.trim()) {
      toast({
        title: "Empty Post",
        description: "Please enter some content before publishing.",
        variant: "destructive"
      });
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: postContent,
          user_credentials: user
        })
      });

      if (response.ok) {
        toast({
          title: "Post Published",
          description: "Your post has been published to LinkedIn successfully."
        });
        setPostContent('');
      } else {
        throw new Error('Failed to publish post');
      }
    } catch (error) {
      console.error('Error publishing post:', error);
      toast({
        title: "Publish Failed",
        description: "Failed to publish post. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleGenerateIdeas = async () => {
    setIsGeneratingIdeas(true);
    try {
      const response = await fetch('/api/posts/generate-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_profile: user
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPostContent(data.idea || data.content || '');
        toast({
          title: "Ideas Generated",
          description: "Post ideas have been generated and added to the text field."
        });
      } else {
        throw new Error('Failed to generate ideas');
      }
    } catch (error) {
      console.error('Error generating ideas:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate ideas. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleResearchTopics = async (query: string) => {
    setIsResearching(true);
    try {
      const response = await fetch('/api/mcp/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.post) {
          setPostContent(data.post);
          toast({
            title: "Research Complete",
            description: "Research results have been added to the post content."
          });
        }
      } else {
        throw new Error('Failed to research topics');
      }
    } catch (error) {
      console.error('Error researching topics:', error);
      toast({
        title: "Research Failed",
        description: "Failed to research topics. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsResearching(false);
    }
  };

  const generateMessages = () => {
    if (selectedConnections.length === 0 || !conversationTopic) {
      return;
    }
    navigate('/messages', {
      state: {
        selectedConnections: selectedConnections.map(id =>
          sampleConnections.find(c => c.id === id)
        ),
        topic: conversationTopic
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">LinkedIn Advanced Search</span>
            </div>
            <div className="flex items-center space-x-4">
              {/* Welcome message with current user by name */}
              <span className="text-white">Welcome, {user?.firstName || user?.email}</span>

              {/* User profile section */}
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => navigate('/profile')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Profile
              </Button>

              {/* Sign Out button */}
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Network Dashboard</h1>
          <p className="text-slate-300">Manage your connections, discover new people, and create engaging content.</p>
        </div>

        <Tabs defaultValue="connections" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/5 border-white/10">
            <TabsTrigger value="connections" className="text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Users className="h-4 w-4 mr-2" />
              Connections
            </TabsTrigger>
            <TabsTrigger value="new-connections" className="text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <UserPlus className="h-4 w-4 mr-2" />
              New Connections
            </TabsTrigger>
            <TabsTrigger value="new-post" className="text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileText className="h-4 w-4 mr-2" />
              New Post
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <ConnectionsList
                  connections={sampleConnections}
                  selectedConnections={selectedConnections}
                  onConnectionSelect={toggleConnectionSelection}
                />
              </div>

              <div className="space-y-6">
                <ConversationTopicPanel
                  topic={conversationTopic}
                  onTopicChange={setConversationTopic}
                  onGenerateMessages={generateMessages}
                  selectedConnectionsCount={selectedConnections.length}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="new-connections" className="space-y-6">
            <NewConnectionSearch
              searchResults={linkedinSearchResults}
              onSearch={handleLinkedInSearch}
              isSearching={isSearchingLinkedIn || loading}
              userId={user?.id || ''}
            />

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-300">
                  <strong>Error:</strong> {error}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="new-post" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <PostCreator
                  content={postContent}
                  onContentChange={setPostContent}
                  onSaveDraft={handleSaveDraft}
                  onPublishPost={handlePublishPost}
                  isSavingDraft={isSavingDraft}
                  isPublishing={isPublishing}
                />

                <SavedPostsList
                  posts={savedPosts}
                  onLoadPost={handleLoadDraft}
                  onDeletePost={handleDeleteDraft}
                />
              </div>

              <div className="space-y-6">
                <PostAIAssistant
                  onGenerateIdeas={handleGenerateIdeas}
                  onResearchTopics={handleResearchTopics}
                  isGeneratingIdeas={isGeneratingIdeas}
                  isResearching={isResearching}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
