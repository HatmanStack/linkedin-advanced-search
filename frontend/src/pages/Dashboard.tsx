import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { MessageSquare, Users, Settings, UserPlus, FileText, LogOut, AlertCircle, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useHealAndRestore } from '@/features/workflow';
import { useToast } from '@/shared/hooks';
import { useSearchResults } from '@/features/search';
import { useProfileInit } from '@/features/profile';
import type { SearchFormData } from '@/shared/utils/validation';
import { ConversationTopicPanel, MessageModal } from '@/features/messages';
import { NewConnectionsTab, VirtualConnectionList } from '@/features/connections';
import { NewPostTab } from '@/features/posts';
import { StatusPicker } from '@/features/workflow';
import type { StatusValue, ConnectionCounts } from '@/shared/types';
import { lambdaApiService as dbConnector, ApiError } from '@/shared/services';
import type { Connection, Message } from '@/shared/types';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('Dashboard');
import { connectionCache } from '@/features/connections';
import { connectionChangeTracker } from '@/features/connections';
import { ConnectionListSkeleton } from '@/features/connections';
import { NoConnectionsState } from '@/shared/components/ui/empty-state';
import { messageGenerationService } from '@/features/messages';
import { connectionDataContextService } from '@/features/connections';
import { useErrorHandler } from '@/shared/hooks';
import { useProgressTracker, ProgressIndicator } from '@/features/workflow';
import { useUserProfile } from '@/features/profile';


let initialConnectionsFetchInFlight: Promise<Connection[]> | null = null;
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { startListening } = useHealAndRestore();
  const { toast } = useToast();
  const { ciphertext: linkedInCredsCiphertext, userProfile, refreshUserProfile } = useUserProfile();
  const [conversationTopic, setConversationTopic] = useState('');
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [isSearchingLinkedIn, setIsSearchingLinkedIn] = useState(false);

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

  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedConnectionForMessages, setSelectedConnectionForMessages] = useState<Connection | null>(null);
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);

  const errorHandler = useErrorHandler();
  const progressTracker = useProgressTracker();

  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [currentConnectionIndex, setCurrentConnectionIndex] = useState(0);
  const [generatedMessages, setGeneratedMessages] = useState<Map<string, string>>(new Map());
  const [workflowState, setWorkflowState] = useState<'idle' | 'generating' | 'awaiting_approval' | 'stopping' | 'completed' | 'error'>('idle');

  const {
    loading,
    error,
    infoMessage,
    searchLinkedIn,
  } = useSearchResults();

  const {
    isInitializing,
    initializationMessage,
    initializationError,
    initializeProfile
  } = useProfileInit();

  const resetWorkflowState = useCallback(() => {
    setIsGeneratingMessages(false);
    setCurrentConnectionIndex(0);
    setGeneratedMessages(new Map());
    setWorkflowState('idle');
  }, []);


  useEffect(() => {
    startListening();
  }, [startListening]);

  useEffect(() => {
    refreshUserProfile();
  }, []);

  useEffect(() => {
    if (!user) return;

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
          connectionChangeTracker.clearChanged();
          sessionStorage.setItem(sessionInitKey, 'true');
        } catch (err: unknown) {
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
      if (!hasInitializedThisSession) {
        sessionStorage.setItem(sessionInitKey, 'true');
      }
    }
  }, [user]);

  useEffect(() => {
    logger.debug('Workflow state changed', { workflowState });
  }, [workflowState]);

  const fetchConnections = useCallback(async () => {
    if (!user || connectionsLoading) return;

    setConnectionsLoading(true);
    setConnectionsError(null);

    try {
      const fetchedConnections = await dbConnector.getConnectionsByStatus();

      setConnections(fetchedConnections);

      connectionCache.setMultiple(fetchedConnections);

      const counts = calculateConnectionCounts(fetchedConnections);
      setConnectionCounts(counts);

      connectionChangeTracker.clearChanged();

      logger.info('Connections fetched successfully', { count: fetchedConnections.length });
    } catch (err: unknown) {
      logger.error('Error fetching connections', { error: err });
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

    counts.total = counts.incoming + counts.outgoing + counts.ally;

    return counts;
  }, []);

  const handleMessageClick = useCallback(async (connection: Connection) => {
    setSelectedConnectionForMessages(connection);
    setMessageModalOpen(true);

    try {
      const messages: Message[] = [];
      setMessageHistory(messages);
    } catch (err: unknown) {
      logger.error('Error fetching message history', { error: err });
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to load message history';

      toast({
        title: "Failed to Load Messages",
        description: errorMessage,
        variant: "destructive"
      });

      setMessageHistory([]);
    }
  }, [toast]);

  const handleCloseMessageModal = useCallback(() => {
    setMessageModalOpen(false);
    setSelectedConnectionForMessages(null);
    setMessageHistory([]);
  }, []);

  const handleSendMessage = useCallback(async (message: string): Promise<void> => {
    logger.info('Sending message', { message, connectionId: selectedConnectionForMessages?.id });

    toast({
      title: "Message Sending Not Implemented",
      description: "Message sending functionality will be available in a future update.",
      variant: "default"
    });

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

  const processSelectedConnections = useCallback(async () => {
    if (selectedConnections.length === 0 || !conversationTopic.trim()) {
      errorHandler.showWarningFeedback(
        'Please select connections and enter a conversation topic.',
        'Missing Requirements'
      );
      return;
    }

    logger.info('Starting message generation workflow', { connectionCount: selectedConnections.length });

    progressTracker.initializeProgress(selectedConnections.length);
    progressTracker.setLoadingMessage('Preparing message generation...', 0, true);

    setWorkflowState('generating');
    setIsGeneratingMessages(true);
    setCurrentConnectionIndex(0);
    errorHandler.clearError();

    const selectedConnectionsData = connections.filter(conn =>
      selectedConnections.includes(conn.id) && conn.status === 'ally'
    );

    logger.debug('Processing connections', { connections: selectedConnectionsData.map(c => `${c.first_name} ${c.last_name}`) });

    for (let i = 0; i < selectedConnectionsData.length; i++) {
      if (workflowState === 'stopping') {
        logger.info('Workflow stopped by user');
        progressTracker.resetProgress();
        break;
      }

      setCurrentConnectionIndex(i);
      const connection = selectedConnectionsData[i];
      const connectionName = `${connection.first_name} ${connection.last_name}`;

      progressTracker.updateProgress(i, connectionName, 'generating');
      progressTracker.setLoadingMessage(`Generating message for ${connectionName}...`,
        Math.round((i / selectedConnectionsData.length) * 100), true);

      logger.debug(`Processing connection ${i + 1}/${selectedConnectionsData.length}`, { connectionName });

      let retryCount = 0;
      let shouldContinue = true;

      while (shouldContinue) {
        try {
          const generatedMessage = await generateMessageForConnection(connection);
          logger.debug('Generated message', { name: connection.first_name, preview: generatedMessage.substring(0, 100) });

          setGeneratedMessages(prev => new Map(prev).set(connection.id, generatedMessage));

          progressTracker.updateProgress(i, connectionName, 'waiting_approval');
          setWorkflowState('awaiting_approval');
          setSelectedConnectionForMessages(connection);
          setMessageModalOpen(true);

          await waitForUserApproval();
          break;

        } catch (error) {
          logger.error('Error generating message for connection', { connectionId: connection.id, error });

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
              continue;

            case 'skip':
              errorHandler.showInfoFeedback(`Skipped ${connectionName} due to error.`, 'Connection Skipped');
              shouldContinue = false;
              break;

            case 'stop':
              progressTracker.resetProgress();
              setWorkflowState('error');
              setIsGeneratingMessages(false);
              return;
          }
        }
      }
    }

    logger.info('Message generation workflow completed');
    progressTracker.updateProgress(selectedConnectionsData.length, undefined, 'completed');

    errorHandler.showSuccessFeedback(
      `Successfully generated messages for ${selectedConnectionsData.length} connections.`,
      'Generation Complete'
    );

    setWorkflowState('completed');

    setTimeout(() => {
      resetWorkflowState();
      progressTracker.resetProgress();
    }, 2000);

  }, [selectedConnections, conversationTopic, connections, workflowState, errorHandler, progressTracker]);

  const generateMessageForConnection = useCallback(async (connection: Connection): Promise<string> => {
    try {
      const cleanedTopic = connectionDataContextService.prepareConversationTopic(conversationTopic);
      const connectionWithHistory = { ...connection, message_history: messageHistory } as Connection;
      const context = connectionDataContextService.prepareMessageGenerationContext(
        connectionWithHistory,
        cleanedTopic,
        userProfile || undefined,
        { includeMessageHistory: true }
      );
      const request = connectionDataContextService.createMessageGenerationRequest(context);

      const generatedMessage = await messageGenerationService.generateMessage(request);
      return generatedMessage;

    } catch (error) {
      logger.error('Error in generateMessageForConnection', { error });
      throw error;
    }
  }, [conversationTopic, user]);

  const waitForUserApproval = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
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

    progressTracker.resetProgress();

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

  const displayName = useMemo(() => {
    const fullName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ');
    if (fullName) return fullName;
    return userProfile?.email || user?.firstName || user?.email || 'User';
  }, [userProfile, user]);

  const currentConnectionName = useMemo(() => {
    if (!isGeneratingMessages || currentConnectionIndex >= selectedConnections.length) {
      return undefined;
    }

    const currentConnectionId = selectedConnections[currentConnectionIndex];
    const connection = connections.find(conn => conn.id === currentConnectionId);
    return connection ? `${connection.first_name} ${connection.last_name}` : undefined;
  }, [isGeneratingMessages, currentConnectionIndex, selectedConnections, connections]);
  const filteredConnections = useMemo(() => {
    let list = connections.filter(connection => {
      if (selectedStatus === 'all') {
        return ['incoming', 'outgoing', 'ally'].includes(connection.status);
      }
      return connection.status === selectedStatus;
    });

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

  const handleConnectionCheckboxChange = useCallback((connectionId: string, checked: boolean) => {
    setSelectedConnections(prev => {
      if (checked) {
        return prev.includes(connectionId) ? prev : [...prev, connectionId];
      } else {
        return prev.filter(id => id !== connectionId);
      }
    });
  }, []);

  const selectedConnectionsCount = useMemo(() => {
    return selectedConnections.length;
  }, [selectedConnections]);

  const handleLinkedInSearch = async (filters: { company: string; job: string; location: string; userId: string }) => {
    setIsSearchingLinkedIn(true);

    try {
      const searchData: SearchFormData = {
        companyName: filters.company,
        companyRole: filters.job,
        companyLocation: filters.location,
        searchName: '',
        searchPassword: '',
        userId: filters.userId,
      };
      logger.debug('Search data prepared', { hasCiphertext: !!linkedInCredsCiphertext, searchDataKeys: Object.keys(searchData) });

      await searchLinkedIn(searchData);

      await fetchConnections();

    } catch (error) {
      logger.error('Error searching LinkedIn', { error });
      toast({
        title: "Search Failed",
        description: "Failed to search LinkedIn. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingLinkedIn(false);
    }
  };


  const handleInitializeProfile = async () => {
    await initializeProfile(() => {
      fetchConnections();
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {}
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">LinkedIn Advanced Search</span>
            </div>
            <div className="flex items-center space-x-4">
              {}
              <span className="text-white">Welcome, {displayName}</span>

              {}
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => navigate('/profile')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Profile
              </Button>

              {}
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
        {}
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
            {}
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
                {}
                {connectionsLoading && (
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-white">Your Connections</h2>
                      <div className="text-sm text-slate-400">Loading...</div>
                    </div>
                    <ConnectionListSkeleton count={5} />
                  </div>
                )}

                {}
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

                {}
                {!connectionsLoading && !connectionsError && (
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-white">Your Connections</h2>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-400">
                          {filteredConnections.length} of {connectionCounts.total} connections
                        </div>
                        {}
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
                        selectedConnectionId={selectedConnections[0]}
                        className="min-h-[500px]"
                        itemHeight={220}
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

                {}
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
            {}
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
                setConnections(prev => {
                  const updated = prev.map(c => c.id === connectionId ? { ...c, status: newStatus } : c);
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

      {}
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
