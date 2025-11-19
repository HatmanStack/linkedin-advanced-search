import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Users, Settings, UserPlus, FileText, LogOut, AlertCircle, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useHealAndRestore } from '@/contexts/HealAndRestoreContext'; // Added
import { useToast } from '@/hooks/use-toast';
import { useSearchResults } from '@/hooks';
import { useProfileInit } from '@/hooks/useProfileInit';
import type { SearchFormData } from '@/utils/validation';
import ConversationTopicPanel from '@/features/messages';
import NewConnectionsTab from '@/features/connections';
import NewPostTab from '@/features/posts';
import StatusPicker from '@/components/StatusPicker';
import type { StatusValue, ConnectionCounts } from '@/types';
import VirtualConnectionList from '@/features/connections';
import MessageModal from '@/features/messages';
import { lambdaApiService as dbConnector, ApiError } from '@/services/lambdaApiService';
import type { Connection, Message } from '@/types';
import { connectionCache } from '@/features/connections';
import { connectionChangeTracker } from '@/features/connections';
import { ConnectionListSkeleton } from '@/features/connections';
import { NoConnectionsState } from '@/components/ui/empty-state';
import { messageGenerationService } from '@/features/messages';
import { connectionDataContextService } from '@/features/connections';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useProgressTracker } from '@/hooks/useProgressTracker';
import ProgressIndicator from '@/components/ProgressIndicator';
import { useUserProfile } from '@/contexts/UserProfileContext';

// Removed unused demo sampleConnections to reduce noise

// Sample data for demonstration
// Prevent duplicate initial fetches under React StrictMode double-mount
let initialConnectionsFetchInFlight: Promise<Connection[]> | null = null;
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { startListening } = useHealAndRestore(); // Added
  const { toast } = useToast();
  const { ciphertext: linkedInCredsCiphertext, userProfile, refreshUserProfile } = useUserProfile(); // Include profile for display name
  const [conversationTopic, setConversationTopic] = useState('');
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [isSearchingLinkedIn, setIsSearchingLinkedIn] = useState(false);

  // Connection management state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusValue>('all');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [connectionCounts, setConnectionCounts] = useState<ConnectionCounts>({
    incoming: 0,
    outgoing: 0,
    ally: 0,
    total: 0
  });

  // Message modal state
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedConnectionForMessages, setSelectedConnectionForMessages] = useState<Connection | null>(null);
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);

  // Error handling and progress tracking
  const errorHandler = useErrorHandler();
  const progressTracker = useProgressTracker();

  // Message generation workflow state
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [currentConnectionIndex, setCurrentConnectionIndex] = useState(0);
  const [generatedMessages, setGeneratedMessages] = useState<Map<string, string>>(new Map());
  const [workflowState, setWorkflowState] = useState<'idle' | 'generating' | 'awaiting_approval' | 'stopping' | 'completed' | 'error'>('idle');

  // Use existing search functionality
  const {
    loading,
    error,
    infoMessage,
    searchLinkedIn,
  } = useSearchResults();

  // Profile initialization functionality
  const {
    isInitializing,
    initializationMessage,
    initializationError,
    initializeProfile
  } = useProfileInit();

  // Reset workflow state function - defined early to avoid temporal dead zone
  const resetWorkflowState = useCallback(() => {
    setIsGeneratingMessages(false);
    setCurrentConnectionIndex(0);
    setGeneratedMessages(new Map());
    setWorkflowState('idle');
  }, []);

  // (Post drafts are now handled by PostComposer context)

  // Start listening for heal and restore notifications
  useEffect(() => {
    startListening();
  }, [startListening]);

  // Fetch the user profile once on dashboard mount (preferred fetch site)
  useEffect(() => {
    refreshUserProfile();
  }, []); // Empty dependency array - only run once on mount

  // Initialize connections data on component mount
  useEffect(() => {
    if (!user) return;

    // Namespace the cache per user and load from storage once on mount/session switch
    connectionCache.setNamespace(user.id);
    connectionCache.loadFromStorage();

    const cached = connectionCache.getAll();
    const hasChanged = connectionChangeTracker.hasChanged();
    const sessionInitKey = `connectionsInit:${user.id}`;
    const hasInitializedThisSession = sessionStorage.getItem(sessionInitKey) === 'true';

    const shouldRefetch = hasChanged || (!hasInitializedThisSession && cached.length === 0);

    if (shouldRefetch) {
      (async () => {
        setConnectionsLoading(true);
        setConnectionsError(null);
        try {
          // Use a module-level in-flight promise to avoid duplicate calls in StrictMode
          if (!initialConnectionsFetchInFlight) {
            initialConnectionsFetchInFlight = dbConnector.getConnectionsByStatus();
          }
          const inFlight = initialConnectionsFetchInFlight as Promise<Connection[]>;
          const fetchedConnections = await inFlight;

          setConnections(fetchedConnections);
          connectionCache.setMultiple(fetchedConnections);
          const counts = {
            incoming: 0,
            outgoing: 0,
            ally: 0,
            total: 0
          } as ConnectionCounts;
          fetchedConnections.forEach((conn: Connection) => {
            if (conn.status === 'incoming') counts.incoming++;
            else if (conn.status === 'outgoing') counts.outgoing++;
            else if (conn.status === 'ally') counts.ally++;
          });
          counts.total = counts.incoming + counts.outgoing + counts.ally;
          setConnectionCounts(counts);
          // Clear change flag after successful refresh
          connectionChangeTracker.clearChanged();
          // Mark initialized for this session so subsequent navigations don't refetch unnecessarily
          sessionStorage.setItem(sessionInitKey, 'true');
        } catch (err: any) {
          const errorMessage = err instanceof ApiError ? err.message : 'Failed to fetch connections';
          setConnectionsError(errorMessage);
        } finally {
          setConnectionsLoading(false);
          initialConnectionsFetchInFlight = null;
        }
      })();
    } else {
      setConnections(cached);
      const counts = {
        incoming: 0,
        outgoing: 0,
        ally: 0,
        total: 0
      } as ConnectionCounts;
      cached.forEach((conn: Connection) => {
        if (conn.status === 'incoming') counts.incoming++;
        else if (conn.status === 'outgoing') counts.outgoing++;
        else if (conn.status === 'ally') counts.ally++;
      });
      counts.total = counts.incoming + counts.outgoing + counts.ally;
      setConnectionCounts(counts);
      // Ensure session initialized flag is set when data already exists in cache
      if (!hasInitializedThisSession) {
        sessionStorage.setItem(sessionInitKey, 'true');
      }
    }
  }, [user]);

  // Handle workflow state transitions
  useEffect(() => {
    console.log('Workflow state changed to:', workflowState);
  }, [workflowState]);

  // Connection management functions
  const fetchConnections = useCallback(async () => {
    if (!user || connectionsLoading) return;

    setConnectionsLoading(true);
    setConnectionsError(null);

    try {
      // Fetch all connections from DynamoDB
      const fetchedConnections = await dbConnector.getConnectionsByStatus();

      // Update connections state
      setConnections(fetchedConnections);

      // Update connection cache
      connectionCache.setMultiple(fetchedConnections);

      // Calculate connection counts
      const counts = calculateConnectionCounts(fetchedConnections);
      setConnectionCounts(counts);

      // Clear change flag after successful refresh of cache
      connectionChangeTracker.clearChanged();

      console.log('Connections fetched successfully:', fetchedConnections.length);
    } catch (err: any) {
      console.error('Error fetching connections:', err);
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to fetch connections';
      setConnectionsError(errorMessage);

      toast({
        title: "Failed to Load Connections",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setConnectionsLoading(false);
    }
  }, [user, toast]);

  const calculateConnectionCounts = useCallback((connections: Connection[]): ConnectionCounts => {
    const counts = {
      incoming: 0,
      outgoing: 0,
      ally: 0,
      total: 0
    };

    connections.forEach(connection => {
      switch (connection.status) {
        case 'incoming':
          counts.incoming++;
          break;
        case 'outgoing':
          counts.outgoing++;
          break;
        case 'ally':
          counts.ally++;
          break;
      }
    });

    // Total should only include incoming, outgoing, and ally (exclude possible)
    counts.total = counts.incoming + counts.outgoing + counts.ally;

    return counts;
  }, []);

  // Message modal functions
  const handleMessageClick = useCallback(async (connection: Connection) => {
    setSelectedConnectionForMessages(connection);
    setMessageModalOpen(true);

    try {
      // Fetch message history from database
      // const messages = await dbConnector.getMessageHistory(connection.id);
      const messages: Message[] = []; // Placeholder until API is implemented
      setMessageHistory(messages);
    } catch (err: any) {
      console.error('Error fetching message history:', err);
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to load message history';

      toast({
        title: "Failed to Load Messages",
        description: errorMessage,
        variant: "destructive"
      });

      // Set empty message history on error
      setMessageHistory([]);
    }
  }, [toast]);

  const handleCloseMessageModal = useCallback(() => {
    setMessageModalOpen(false);
    setSelectedConnectionForMessages(null);
    setMessageHistory([]);
  }, []);

  const handleSendMessage = useCallback(async (message: string): Promise<void> => {
    // Placeholder for future API integration
    console.log('Sending message:', message, 'to connection:', selectedConnectionForMessages?.id);

    toast({
      title: "Message Sending Not Implemented",
      description: "Message sending functionality will be available in a future update.",
      variant: "default"
    });

    // For now, just add the message to local state for demo purposes
    if (selectedConnectionForMessages) {
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        content: message,
        timestamp: new Date().toISOString(),
        sender: 'user'
      };

      setMessageHistory(prev => [...prev, newMessage]);
    }
  }, [selectedConnectionForMessages, toast]);

  // Message generation workflow functions
  const processSelectedConnections = useCallback(async () => {
    if (selectedConnections.length === 0 || !conversationTopic.trim()) {
      errorHandler.showWarningFeedback(
        'Please select connections and enter a conversation topic.',
        'Missing Requirements'
      );
      return;
    }

    console.log('Starting message generation workflow for', selectedConnections.length, 'connections');

    // Initialize progress tracking
    progressTracker.initializeProgress(selectedConnections.length);
    progressTracker.setLoadingMessage('Preparing message generation...', 0, true);

    setWorkflowState('generating');
    setIsGeneratingMessages(true);
    setCurrentConnectionIndex(0);
    errorHandler.clearError();

    const selectedConnectionsData = connections.filter(conn =>
      selectedConnections.includes(conn.id) && conn.status === 'ally'
    );

    console.log('Processing connections:', selectedConnectionsData.map(c => `${c.first_name} ${c.last_name}`));

    for (let i = 0; i < selectedConnectionsData.length; i++) {
      // Check if user requested to stop
      if (workflowState === 'stopping') {
        console.log('Workflow stopped by user');
        progressTracker.resetProgress();
        break;
      }

      setCurrentConnectionIndex(i);
      const connection = selectedConnectionsData[i];
      const connectionName = `${connection.first_name} ${connection.last_name}`;

      // Update progress
      progressTracker.updateProgress(i, connectionName, 'generating');
      progressTracker.setLoadingMessage(`Generating message for ${connectionName}...`,
        Math.round((i / selectedConnectionsData.length) * 100), true);

      console.log(`Processing connection ${i + 1}/${selectedConnectionsData.length}:`, connectionName);

      let retryCount = 0;
      let shouldContinue = true;

      while (shouldContinue) {
        try {
          // Generate message for current connection
          const generatedMessage = await generateMessageForConnection(connection);
          console.log('Generated message for', connection.first_name, ':', generatedMessage.substring(0, 100) + '...');

          // Cache the generated message
          setGeneratedMessages(prev => new Map(prev).set(connection.id, generatedMessage));

          // Set workflow to awaiting approval and open modal
          progressTracker.updateProgress(i, connectionName, 'waiting_approval');
          setWorkflowState('awaiting_approval');
          setSelectedConnectionForMessages(connection);
          setMessageModalOpen(true);

          // Wait for user approval before continuing
          await waitForUserApproval();
          break; // Success, move to next connection

        } catch (error) {
          console.error('Error generating message for connection:', connection.id, error);

          // Use comprehensive error handling
          const recoveryAction = await errorHandler.handleError(
            error,
            connection.id,
            connectionName,
            retryCount
          );

          switch (recoveryAction) {
            case 'retry':
              retryCount++;
              progressTracker.setLoadingMessage(`Retrying message generation for ${connectionName}... (Attempt ${retryCount + 1})`,
                Math.round((i / selectedConnectionsData.length) * 100), true);
              continue; // Retry the same connection

            case 'skip':
              errorHandler.showInfoFeedback(`Skipped ${connectionName} due to error.`, 'Connection Skipped');
              shouldContinue = false; // Move to next connection
              break;

            case 'stop':
              progressTracker.resetProgress();
              setWorkflowState('error');
              setIsGeneratingMessages(false);
              return; // Stop entire process
          }
        }
      }
    }

    // Workflow completed successfully
    console.log('Message generation workflow completed');
    progressTracker.updateProgress(selectedConnectionsData.length, undefined, 'completed');

    errorHandler.showSuccessFeedback(
      `Successfully generated messages for ${selectedConnectionsData.length} connections.`,
      'Generation Complete'
    );

    setWorkflowState('completed');

    // Reset after a short delay to show completion
    setTimeout(() => {
      resetWorkflowState();
      progressTracker.resetProgress();
    }, 2000);

  }, [selectedConnections, conversationTopic, connections, workflowState, errorHandler, progressTracker]);

  const generateMessageForConnection = useCallback(async (connection: Connection): Promise<string> => {
    try {
      // Fetch message history for context
      // const messageHistory = await dbConnector.getMessageHistory(connection.id);

      // Build request using shared context service for DRYness
      const cleanedTopic = connectionDataContextService.prepareConversationTopic(conversationTopic);
      const connectionWithHistory = { ...connection, message_history: messageHistory } as Connection;
      const context = connectionDataContextService.prepareMessageGenerationContext(
        connectionWithHistory,
        cleanedTopic,
        userProfile || undefined,
        { includeMessageHistory: true }
      );
      const request = connectionDataContextService.createMessageGenerationRequest(context);

      // Call message generation service
      const generatedMessage = await messageGenerationService.generateMessage(request);
      return generatedMessage;

    } catch (error) {
      console.error('Error in generateMessageForConnection:', error);
      throw error;
    }
  }, [conversationTopic, user]);

  const waitForUserApproval = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      // This will be resolved when user approves or skips in the modal
      const checkApproval = () => {
        if (workflowState !== 'awaiting_approval') {
          resolve();
        } else {
          setTimeout(checkApproval, 100);
        }
      };
      checkApproval();
    });
  }, [workflowState]);

  const handleStopGeneration = useCallback(() => {
    setWorkflowState('stopping');
    setIsGeneratingMessages(false);

    // Reset progress tracking
    progressTracker.resetProgress();

    // Close modal if open
    if (messageModalOpen) {
      setMessageModalOpen(false);
      setSelectedConnectionForMessages(null);
    }

    resetWorkflowState();

    errorHandler.showInfoFeedback('Message generation has been stopped.', 'Generation Stopped');
  }, [messageModalOpen, progressTracker, errorHandler]);

  const handleGenerateMessages = useCallback(() => {
    if (selectedConnections.length === 0 || !conversationTopic.trim()) {
      toast({
        title: "Missing Requirements",
        description: "Please select connections and enter a conversation topic.",
        variant: "destructive"
      });
      return;
    }

    processSelectedConnections();
  }, [selectedConnections, conversationTopic, processSelectedConnections, toast]);

  // Display name from user profile context (fallback to auth user)
  const displayName = useMemo(() => {
    const fullName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ');
    if (fullName) return fullName;
    return userProfile?.email || user?.firstName || user?.email || 'User';
  }, [userProfile, user]);

  // Get current connection name for display
  const currentConnectionName = useMemo(() => {
    if (!isGeneratingMessages || currentConnectionIndex >= selectedConnections.length) {
      return undefined;
    }

    const currentConnectionId = selectedConnections[currentConnectionIndex];
    const connection = connections.find(conn => conn.id === currentConnectionId);
    return connection ? `${connection.first_name} ${connection.last_name}` : undefined;
  }, [isGeneratingMessages, currentConnectionIndex, selectedConnections, connections]);
  const filteredConnections = useMemo(() => {
    // status filter first
    let list = connections.filter(connection => {
      if (selectedStatus === 'all') {
        return ['incoming', 'outgoing', 'ally'].includes(connection.status);
      }
      return connection.status === selectedStatus;
    });

    // if tags active, sort by number of matching tags desc, then name
    if (activeTags.length > 0) {
      list = [...list].sort((a, b) => {
        const aTagsMatch = (a.tags || a.common_interests || []).filter((t: string) => activeTags.includes(t)).length;
        const bTagsMatch = (b.tags || b.common_interests || []).filter((t: string) => activeTags.includes(t)).length;
        if (aTagsMatch !== bTagsMatch) return bTagsMatch - aTagsMatch;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      });
    }
    return list;
  }, [connections, selectedStatus, activeTags]);
  const handleTagClick = useCallback((tag: string) => {
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const newConnections = useMemo(() => {
    return connections.filter(connection => connection.status === 'possible');
  }, [connections]);

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

  // Handle checkbox changes for connection selection
  const handleConnectionCheckboxChange = useCallback((connectionId: string, checked: boolean) => {
    setSelectedConnections(prev => {
      if (checked) {
        return prev.includes(connectionId) ? prev : [...prev, connectionId];
      } else {
        return prev.filter(id => id !== connectionId);
      }
    });
  }, []);

  // Calculate selected connections count for ConversationTopicPanel
  const selectedConnectionsCount = useMemo(() => {
    return selectedConnections.length;
  }, [selectedConnections]);

  const handleLinkedInSearch = async (filters: { company: string; job: string; location: string; userId: string }) => {
    setIsSearchingLinkedIn(true);

    try {
      // Convert the new filter format to the existing SearchFormData format
      const searchData: SearchFormData = {
        companyName: filters.company,
        companyRole: filters.job,
        companyLocation: filters.location,
        // We do not include plaintext; puppeteerApiService will attach ciphertext automatically
        searchName: '',
        searchPassword: '',
        userId: filters.userId, // Include userId from filters
      };
      console.log('Search data (ciphertext will be attached automatically):', { ...searchData, hasCiphertext: !!linkedInCredsCiphertext });

      // Use the existing search functionality - it returns void but updates hook state
      await searchLinkedIn(searchData);

      // Always refresh connections after search completes
      // The hook handles the response internally and updates results state
      await fetchConnections();

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

  // Post creation handlers are now managed by PostComposer context

  // Removed unused generateMessages navigation helper

  // Handle profile initialization with connection refresh
  const handleInitializeProfile = async () => {
    await initializeProfile(() => {
      // Refresh connections list to show any new data after successful initialization
      fetchConnections();
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
              <span className="text-white">Welcome, {displayName}</span>

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
            {/* Profile Init Status Messages */}
            {initializationMessage && (
              <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-3">
                <p className="text-green-200 text-sm font-medium">
                  <strong>✓ Success:</strong> {initializationMessage}
                </p>
              </div>
            )}

            {initializationError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-300 text-sm font-medium">
                  <strong>✗ Error:</strong> {initializationError}
                </p>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {/* Loading State */}
                {connectionsLoading && (
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-white">Your Connections</h2>
                      <div className="text-sm text-slate-400">Loading...</div>
                    </div>
                    <ConnectionListSkeleton count={5} />
                  </div>
                )}

                {/* Error State */}
                {connectionsError && !connectionsLoading && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                      <div>
                        <h3 className="text-red-300 font-medium">Failed to Load Connections</h3>
                        <p className="text-red-400 text-sm mt-1">{connectionsError}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 border-red-500/30 text-red-300 hover:bg-red-500/10"
                          onClick={fetchConnections}
                        >
                          Try Again
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Connections List with Virtual Scrolling */}
                {!connectionsLoading && !connectionsError && (
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-white">Your Connections</h2>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-400">
                          {filteredConnections.length} of {connectionCounts.total} connections
                        </div>
                        {/* Initialize Profile Database Button */}
                        <Button
                          onClick={handleInitializeProfile}
                          disabled={isInitializing}
                          className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
                        >
                          <Database className="h-4 w-4 mr-2" />
                          {isInitializing
                            ? 'Initializing...'
                            : connectionCounts.ally > 0
                              ? 'Refresh'
                              : 'Initialize Profile Database'
                          }
                        </Button>
                      </div>
                    </div>

                    {filteredConnections.length === 0 ? (
                      <NoConnectionsState
                        type="filtered"
                        onRefresh={fetchConnections}
                        onClearFilters={() => setSelectedStatus('all')}
                        className="py-16"
                      />
                    ) : (
                      <VirtualConnectionList
                        connections={filteredConnections}
                        onSelect={toggleConnectionSelection}
                        onMessageClick={handleMessageClick}
                        onTagClick={handleTagClick}
                        activeTags={activeTags}
                        selectedConnectionId={selectedConnections[0]} // Show first selected as highlighted
                        className="min-h-[500px]"
                        itemHeight={220} // Card height + 24px margin (mb-6)
                        showFilters={true}
                        sortBy="name"
                        sortOrder="asc"
                        showCheckboxes={true}
                        selectedConnections={selectedConnections}
                        onCheckboxChange={handleConnectionCheckboxChange}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
                  <StatusPicker
                    selectedStatus={selectedStatus}
                    onStatusChange={setSelectedStatus}
                    connectionCounts={connectionCounts}
                  />
                </div>

                <ConversationTopicPanel
                  topic={conversationTopic}
                  onTopicChange={setConversationTopic}
                  onGenerateMessages={handleGenerateMessages}
                  selectedConnectionsCount={selectedConnectionsCount}
                  isGenerating={isGeneratingMessages}
                  onStopGeneration={handleStopGeneration}
                  currentConnectionName={currentConnectionName}
                />

                {/* Progress Indicator for Message Generation */}
                <ProgressIndicator
                  progressState={progressTracker.progressState}
                  loadingState={progressTracker.loadingState}
                  onCancel={handleStopGeneration}
                  className="mt-4"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="new-connections" className="space-y-6">
            {/* New Connection Search with Virtual Scrolling */}
            <NewConnectionsTab
              searchResults={newConnections}
              onSearch={handleLinkedInSearch}
              isSearching={isSearchingLinkedIn || loading}
              userId={user?.id || ''}
              connectionsLoading={connectionsLoading}
              connectionsError={connectionsError}
              searchInfoMessage={infoMessage}
              onRefresh={fetchConnections}
              onRemoveConnection={(connectionId: string, newStatus: 'processed' | 'outgoing') => {
                // Update status accordingly in state and cache to trigger list re-render
                setConnections(prev => {
                  const updated = prev.map(c => c.id === connectionId ? { ...c, status: newStatus } : c);
                  // Recalculate connection counts after status update
                  const counts = calculateConnectionCounts(updated);
                  setConnectionCounts(counts);
                  return updated;
                });
                connectionCache.update(connectionId, { status: newStatus });
              }}
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
            <NewPostTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Message Modal */}
      {selectedConnectionForMessages && (
        <MessageModal
          isOpen={messageModalOpen}
          connection={selectedConnectionForMessages}
          onClose={handleCloseMessageModal}
          onSendMessage={handleSendMessage}
          prePopulatedMessage={generatedMessages.get(selectedConnectionForMessages.id)}
          isGeneratedContent={workflowState === 'awaiting_approval'}
          showGenerationControls={workflowState === 'awaiting_approval'}
          onApproveAndNext={() => {
            setWorkflowState('generating');
            setMessageModalOpen(false);
            setSelectedConnectionForMessages(null);
          }}
          onSkipConnection={() => {
            setWorkflowState('generating');
            setMessageModalOpen(false);
            setSelectedConnectionForMessages(null);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
