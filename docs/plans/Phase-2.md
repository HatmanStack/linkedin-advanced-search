# Phase 2: Frontend Modernization

## Phase Goal

Modernize the frontend data layer by migrating to React Query and decomposing the oversized `useMessageGeneration` hook. This eliminates manual caching code, removes polling-based patterns, and establishes clean separation of concerns.

**Success criteria:**
- Three data-fetching hooks migrated to React Query (`useConnections`, `useConnectionsManager`, `useSearchResults`)
- `useMessageGeneration` split into 3 focused hooks with callback-based approval
- Manual cache utilities (`connectionCache`, `connectionChangeTracker`) removed
- All existing tests pass (updated for React Query)
- New tests cover migrated hooks
- No ESLint exhaustive-deps violations

**Estimated tokens:** ~45,000

---

## Prerequisites

- Phase-0 complete (patterns and ADRs understood)
- React Query v5 fundamentals understood
- Access to frontend codebase
- Understanding of current hook implementations

**Required reading:**
- `frontend/src/features/connections/hooks/useConnectionsManager.ts` - Complex manual caching
- `frontend/src/features/connections/hooks/useConnections.ts` - Simpler fetch pattern
- `frontend/src/features/search/hooks/useSearchResults.ts` - localStorage persistence
- `frontend/src/features/messages/hooks/useMessageGeneration.ts` - Hook to decompose
- `frontend/src/App.tsx` - QueryClientProvider already configured

---

## Task 1: Establish React Query Patterns

**Goal:** Create shared utilities and patterns for React Query usage before migrating individual hooks.

**Files to Create:**
- `frontend/src/shared/lib/queryClient.ts` - Configured QueryClient with defaults
- `frontend/src/shared/lib/queryKeys.ts` - Centralized query key factory
- `frontend/src/shared/hooks/useQueryWrapper.ts` - Optional wrapper for common patterns

**Prerequisites:**
- Read current `App.tsx` QueryClient setup
- Understand React Query v5 API

**Implementation Steps:**

1. **Create QueryClient configuration**

   Move QueryClient creation from `App.tsx` to a dedicated module with sensible defaults:

   ```typescript
   // queryClient.ts
   import { QueryClient } from '@tanstack/react-query';

   export const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000, // 5 minutes
         gcTime: 30 * 60 * 1000,   // 30 minutes (formerly cacheTime)
         retry: 2,
         refetchOnWindowFocus: true,
         refetchOnReconnect: true,
       },
       mutations: {
         retry: 1,
       },
     },
   });
   ```

2. **Create query key factory**

   Centralize query keys to prevent typos and enable type-safe invalidation:

   ```typescript
   // queryKeys.ts
   export const queryKeys = {
     connections: {
       all: ['connections'] as const,
       byStatus: (status: string) => ['connections', 'status', status] as const,
       byUser: (userId: string) => ['connections', 'user', userId] as const,
     },
     search: {
       results: ['search', 'results'] as const,
       visited: ['search', 'visited'] as const,
     },
     messages: {
       history: (connectionId: string) => ['messages', 'history', connectionId] as const,
     },
   } as const;
   ```

3. **Update App.tsx to use shared QueryClient**

   ```typescript
   import { queryClient } from '@/shared/lib/queryClient';

   // Remove inline QueryClient creation
   // const queryClient = new QueryClient();

   const App = () => (
     <QueryClientProvider client={queryClient}>
       {/* ... */}
     </QueryClientProvider>
   );
   ```

4. **Create test utilities**

   First, create the test-utils directory:
   ```bash
   mkdir -p frontend/src/test-utils
   ```

   Then create the wrapper:
   ```typescript
   // frontend/src/test-utils/queryWrapper.tsx
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   import type { ReactNode } from 'react';

   export function createTestQueryClient() {
     return new QueryClient({
       defaultOptions: {
         queries: { retry: false },
         mutations: { retry: false },
       },
     });
   }

   export function createWrapper() {
     const testQueryClient = createTestQueryClient();
     return ({ children }: { children: ReactNode }) => (
       <QueryClientProvider client={testQueryClient}>
         {children}
       </QueryClientProvider>
     );
   }
   ```

**Verification Checklist:**
- [x] `npm run build` succeeds
- [x] `npm test` passes
- [x] QueryClientProvider uses shared queryClient
- [x] No functionality changes yet

**Testing Instructions:**

```bash
cd frontend && npm run build && npm test
```

**Commit Message Template:**
```
refactor(frontend): establish React Query patterns and utilities

- Create shared queryClient with sensible defaults
- Add centralized queryKeys factory
- Create test utilities for React Query hooks
- Update App.tsx to use shared queryClient
```

---

## Task 2: Migrate useConnections to React Query

**Goal:** Migrate the simpler `useConnections` hook to React Query as a warm-up before tackling the more complex hooks.

**Files to Modify:**
- `frontend/src/features/connections/hooks/useConnections.ts` - Migrate to useQuery/useMutation
- `frontend/src/features/connections/hooks/useConnections.test.ts` - Update tests

**Prerequisites:**
- Task 1 complete
- Read current `useConnections.ts` implementation

**Implementation Steps:**

1. **Analyze current hook**

   Current structure:
   - `connections` state
   - `loading` state
   - `error` state
   - `fetchConnections` callback (auto-runs in useEffect)
   - `createConnection` mutation
   - `updateConnection` mutation

2. **Rewrite with useQuery and useMutation**

   ```typescript
   import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
   import { queryKeys } from '@/shared/lib/queryKeys';

   export const useConnections = (filters?: ConnectionFilters) => {
     const { user } = useAuth();
     const queryClient = useQueryClient();

     // Query for fetching connections
     const {
       data: connections = [],
       isLoading: loading,
       error,
       refetch,
     } = useQuery({
       queryKey: queryKeys.connections.byUser(user?.id ?? ''),
       queryFn: () => puppeteerApiService.getConnections(filters),
       enabled: !!user, // Don't fetch without user
       select: (response) => response.data?.connections ?? [],
     });

     // Mutation for creating connection
     const createMutation = useMutation({
       mutationFn: (data: Partial<Connection>) =>
         puppeteerApiService.createConnection(data),
       onSuccess: (response) => {
         if (response.success && response.data) {
           queryClient.setQueryData(
             queryKeys.connections.byUser(user?.id ?? ''),
             (old: Connection[] = []) => [...old, response.data as Connection]
           );
         }
       },
     });

     // Mutation for updating connection
     const updateMutation = useMutation({
       mutationFn: ({ id, updates }: { id: string; updates: Partial<Connection> }) =>
         puppeteerApiService.updateConnection(id, updates),
       onSuccess: (response, { id }) => {
         if (response.success) {
           queryClient.setQueryData(
             queryKeys.connections.byUser(user?.id ?? ''),
             (old: Connection[] = []) =>
               old.map((conn) => (conn.id === id ? { ...conn, ...response.data } : conn))
           );
         }
       },
     });

     return {
       connections,
       loading,
       error: error?.message ?? null,
       refetch,
       createConnection: async (data: Partial<Connection>) => {
         const result = await createMutation.mutateAsync(data);
         return result.success;
       },
       updateConnection: async (id: string, updates: Partial<Connection>) => {
         const result = await updateMutation.mutateAsync({ id, updates });
         return result.success;
       },
     };
   };
   ```

3. **Maintain API compatibility**

   The return type must match the original:
   - `connections: Connection[]`
   - `loading: boolean`
   - `error: string | null`
   - `refetch: () => void`
   - `createConnection: (data) => Promise<boolean>`
   - `updateConnection: (id, updates) => Promise<boolean>`

4. **Update tests**

   Tests need to wrap with QueryClientProvider:

   ```typescript
   import { renderHook, waitFor } from '@testing-library/react';
   import { createWrapper } from '@/test-utils/queryWrapper';

   describe('useConnections', () => {
     it('fetches connections on mount', async () => {
       const { result } = renderHook(() => useConnections(), {
         wrapper: createWrapper(),
       });

       await waitFor(() => {
         expect(result.current.loading).toBe(false);
       });

       expect(result.current.connections).toEqual(mockConnections);
     });
   });
   ```

**Verification Checklist:**
- [x] Hook returns same shape as before
- [x] Auto-fetches on mount when user exists
- [x] Doesn't fetch when user is null
- [x] `createConnection` optimistically updates cache
- [x] `updateConnection` optimistically updates cache
- [x] All tests pass

**Testing Instructions:**

```bash
cd frontend && npm test -- --run src/features/connections/hooks/useConnections.test.ts
```

**Commit Message Template:**
```
refactor(frontend): migrate useConnections to React Query

- Replace useState/useEffect with useQuery
- Replace manual mutations with useMutation
- Add optimistic updates for create/update
- Maintain backward-compatible API
```

---

## Task 3: Migrate useConnectionsManager to React Query

**Goal:** Migrate the complex `useConnectionsManager` hook, eliminating the custom `connectionCache` and `connectionChangeTracker` utilities.

**Files to Modify:**
- `frontend/src/features/connections/hooks/useConnectionsManager.ts` - Full rewrite
- `frontend/src/features/connections/hooks/useConnectionsManager.test.ts` - Update tests

**Files to Delete (after migration verified):**
- `frontend/src/features/connections/utils/connectionCache.ts`
- `frontend/src/features/connections/utils/connectionChangeTracker.ts`

**Prerequisites:**
- Task 2 complete
- Read current `useConnectionsManager.ts` (complex caching logic)
- Read `connectionCache.ts` and `connectionChangeTracker.ts`

**Implementation Steps:**

1. **Analyze current hook complexity**

   Current responsibilities:
   - Fetches connections from API
   - Caches in sessionStorage via `connectionCache`
   - Tracks "changed" state via `connectionChangeTracker`
   - Filters by status
   - Filters by tags
   - Calculates counts per status
   - Manages selection state
   - Handles tag clicks

2. **Identify what React Query handles automatically**

   - Fetching → `useQuery`
   - Caching → Query cache (replaces connectionCache)
   - Change tracking → Cache invalidation (replaces connectionChangeTracker)
   - Background refetch → Built-in

3. **Identify what remains as local state**

   - `selectedStatus` filter → `useState`
   - `activeTags` filter → `useState`
   - `selectedConnections` → `useState`

4. **Rewrite the hook**

   ```typescript
   import { useState, useMemo, useCallback } from 'react';
   import { useQuery, useQueryClient } from '@tanstack/react-query';
   import { useAuth } from '@/features/auth';
   import { lambdaApiService } from '@/shared/services';
   import { queryKeys } from '@/shared/lib/queryKeys';
   import type { Connection, ConnectionStatus } from '@/types';

   export function useConnectionsManager() {
     const { user } = useAuth();
     const queryClient = useQueryClient();

     // Local UI state (not server state)
     const [selectedStatus, setSelectedStatus] = useState<ConnectionStatus | 'all'>('all');
     const [activeTags, setActiveTags] = useState<string[]>([]);
     const [selectedConnections, setSelectedConnections] = useState<string[]>([]);

     // Server state via React Query
     const {
       data: connections = [],
       isLoading: connectionsLoading,
       error: connectionsError,
       refetch: fetchConnections,
     } = useQuery({
       queryKey: queryKeys.connections.byUser(user?.id ?? ''),
       queryFn: () => lambdaApiService.getConnectionsByStatus('all'),
       enabled: !!user,
       staleTime: 2 * 60 * 1000, // 2 minutes
     });

     // Derived state (computed from connections)
     const connectionCounts = useMemo(() => {
       return {
         incoming: connections.filter((c) => c.status === 'incoming').length,
         outgoing: connections.filter((c) => c.status === 'outgoing').length,
         ally: connections.filter((c) => c.status === 'ally').length,
         total: connections.filter((c) =>
           ['incoming', 'outgoing', 'ally'].includes(c.status)
         ).length,
       };
     }, [connections]);

     const filteredConnections = useMemo(() => {
       let filtered = connections;

       // Filter by status
       if (selectedStatus === 'all') {
         filtered = filtered.filter((c) =>
           ['incoming', 'outgoing', 'ally'].includes(c.status)
         );
       } else {
         filtered = filtered.filter((c) => c.status === selectedStatus);
       }

       // Filter by tags
       if (activeTags.length > 0) {
         filtered = filtered.filter((c) =>
           activeTags.some((tag) => c.tags?.includes(tag))
         );
       }

       return filtered;
     }, [connections, selectedStatus, activeTags]);

     const newConnections = useMemo(() => {
       return connections.filter((c) => c.status === 'possible');
     }, [connections]);

     // Actions
     const handleTagClick = useCallback((tag: string) => {
       setActiveTags((prev) =>
         prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
       );
     }, []);

     const toggleConnectionSelection = useCallback((connectionId: string) => {
       setSelectedConnections((prev) =>
         prev.includes(connectionId)
           ? prev.filter((id) => id !== connectionId)
           : [...prev, connectionId]
       );
     }, []);

     const updateConnectionStatus = useCallback(
       (connectionId: string, newStatus: ConnectionStatus) => {
         // Optimistic update
         queryClient.setQueryData(
           queryKeys.connections.byUser(user?.id ?? ''),
           (old: Connection[] = []) =>
             old.map((c) =>
               c.id === connectionId ? { ...c, status: newStatus } : c
             )
         );
       },
       [queryClient, user?.id]
     );

     const clearSelectedConnections = useCallback(() => {
       setSelectedConnections([]);
     }, []);

     return {
       // Data
       connections,
       filteredConnections,
       newConnections,
       connectionCounts,
       selectedConnectionsCount: selectedConnections.length,

       // Loading/error state
       connectionsLoading,
       connectionsError: connectionsError?.message ?? null,

       // Filter state
       selectedStatus,
       setSelectedStatus,
       activeTags,

       // Selection state
       selectedConnections,
       toggleConnectionSelection,
       clearSelectedConnections,

       // Actions
       handleTagClick,
       updateConnectionStatus,
       fetchConnections,
     };
   }
   ```

5. **Update tests**

   Remove mocks for `connectionCache` and `connectionChangeTracker`. Add QueryClient wrapper.

6. **Remove deprecated utilities**

   After migration is verified working:
   ```bash
   rm frontend/src/features/connections/utils/connectionCache.ts
   rm frontend/src/features/connections/utils/connectionChangeTracker.ts
   ```

   Update barrel exports in `frontend/src/features/connections/index.ts` to remove these exports.

**Verification Checklist:**
- [x] Hook returns same shape as before
- [x] Connections fetch on mount
- [x] Status filtering works
- [x] Tag filtering works
- [x] Selection state works
- [x] Optimistic updates work
- [x] No sessionStorage usage
- [x] Tests pass without cache mocks

**Testing Instructions:**

```bash
cd frontend && npm test -- --run src/features/connections/hooks/useConnectionsManager.test.ts
```

**Commit Message Template:**
```
refactor(frontend): migrate useConnectionsManager to React Query

- Replace connectionCache with React Query cache
- Replace connectionChangeTracker with cache invalidation
- Remove sessionStorage dependencies
- Maintain backward-compatible API
```

---

## Task 4: Migrate useSearchResults to React Query

**Goal:** Migrate `useSearchResults`, handling the localStorage persistence for visited links.

**Files to Modify:**
- `frontend/src/features/search/hooks/useSearchResults.ts` - Migrate to useMutation
- `frontend/src/features/search/hooks/useSearchResults.test.ts` - If exists, update

**Prerequisites:**
- Tasks 1-3 complete
- Read current `useSearchResults.ts`

**Implementation Steps:**

1. **Analyze current hook**

   Key behaviors:
   - `searchLinkedIn` triggers search (mutation, not query)
   - `results` stored in localStorage (via useLocalStorage)
   - `visitedLinks` stored in localStorage
   - Marks `connectionChangeTracker.markChanged('search')` after search

2. **Decide what uses React Query**

   - `searchLinkedIn` → `useMutation` (it's an action, not a query)
   - `results` → Keep in localStorage (persists across sessions)
   - `visitedLinks` → Keep in localStorage (persists across sessions)

   Note: This hook is more about persisted local state than server state. React Query's value here is primarily for the mutation and triggering refetches.

3. **Rewrite the hook**

   ```typescript
   import { useCallback, useState } from 'react';
   import { useMutation, useQueryClient } from '@tanstack/react-query';
   import useLocalStorage from '@/hooks/useLocalStorage';
   import { puppeteerApiService } from '@/shared/services';
   import { queryKeys } from '@/shared/lib/queryKeys';
   import { STORAGE_KEYS } from '@/config/appConfig';
   import type { SearchFormData } from '@/shared/utils/validation';

   function useSearchResults() {
     const queryClient = useQueryClient();

     // Persisted state (stays in localStorage)
     const [results, setResults] = useLocalStorage<string[]>(
       STORAGE_KEYS.SEARCH_RESULTS,
       []
     );
     const [visitedLinks, setVisitedLinks] = useLocalStorage<Record<string, boolean>>(
       STORAGE_KEYS.VISITED_LINKS,
       {}
     );

     // Transient state
     const [infoMessage, setInfoMessage] = useState<string | null>(null);

     // Search mutation
     const searchMutation = useMutation({
       mutationFn: (searchData: SearchFormData) =>
         puppeteerApiService.performLinkedInSearch(searchData),
       onSuccess: (response) => {
         if (response?.message) {
           setInfoMessage(response.message);
         }
         // Invalidate connections cache to refetch after search
         queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
       },
       onError: () => {
         setInfoMessage(null);
       },
     });

     const searchLinkedIn = useCallback(
       async (searchFormData: SearchFormData) => {
         setInfoMessage(null);
         await searchMutation.mutateAsync(searchFormData);
       },
       [searchMutation]
     );

     const markAsVisited = useCallback(
       (profileId: string) => {
         setVisitedLinks((prev) => ({ ...prev, [profileId]: true }));
       },
       [setVisitedLinks]
     );

     const clearResults = useCallback(() => {
       setResults([]);
     }, [setResults]);

     const clearVisitedLinks = useCallback(() => {
       setVisitedLinks({});
     }, [setVisitedLinks]);

     return {
       results,
       visitedLinks,
       loading: searchMutation.isPending,
       error: searchMutation.error?.message ?? null,
       infoMessage,
       searchLinkedIn,
       markAsVisited,
       clearResults,
       clearVisitedLinks,
     };
   }

   export default useSearchResults;
   ```

4. **Update connectionChangeTracker usage**

   Replace `connectionChangeTracker.markChanged('search')` with:
   ```typescript
   queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
   ```

   This is the React Query way to signal "connections may have changed."

**Verification Checklist:**
- [x] Hook returns same shape as before
- [x] Search triggers API call
- [x] Loading state works during search
- [x] Error state populated on failure
- [x] Info message displayed on success
- [x] Connections cache invalidated after search
- [x] localStorage persistence unchanged

**Testing Instructions:**

```bash
cd frontend && npm test -- --run src/features/search/hooks/useSearchResults.test.ts
```

If no test file exists, create one following the patterns from `useConnectionsManager.test.ts`.

**Commit Message Template:**
```
refactor(frontend): migrate useSearchResults to React Query

- Replace manual loading/error state with useMutation
- Invalidate connections cache after search
- Remove connectionChangeTracker dependency
- Maintain localStorage persistence for results/visited
```

---

## Task 5: Decompose useMessageGeneration into Focused Hooks

**Goal:** Split the 238-line `useMessageGeneration` hook into 3 focused hooks and replace polling with callbacks.

**Files to Create:**
- `frontend/src/features/messages/hooks/useWorkflowStateMachine.ts` - Workflow state only
- `frontend/src/features/messages/hooks/useMessageModal.ts` - Modal state only
- `frontend/src/features/messages/hooks/useMessageHistory.ts` - Message history only
- `frontend/src/features/messages/hooks/useWorkflowStateMachine.test.ts`
- `frontend/src/features/messages/hooks/useMessageModal.test.ts`
- `frontend/src/features/messages/hooks/useMessageHistory.test.ts`

**Files to Modify:**
- `frontend/src/features/messages/hooks/useMessageGeneration.ts` - Compose new hooks
- `frontend/src/features/messages/index.ts` - Update exports

**Prerequisites:**
- Tasks 1-4 complete
- Read current `useMessageGeneration.ts` thoroughly
- Understand polling issue at lines 87-95

**Implementation Steps:**

1. **Create useWorkflowStateMachine**

   Manages workflow state transitions only:

   ```typescript
   // useWorkflowStateMachine.ts
   import { useState, useCallback } from 'react';

   export type WorkflowState =
     | 'idle'
     | 'generating'
     | 'awaiting_approval'
     | 'stopping'
     | 'completed'
     | 'error';

   export function useWorkflowStateMachine() {
     const [state, setState] = useState<WorkflowState>('idle');
     const [currentIndex, setCurrentIndex] = useState(0);

     const startGenerating = useCallback(() => {
       setState('generating');
       setCurrentIndex(0);
     }, []);

     const awaitApproval = useCallback(() => {
       setState('awaiting_approval');
     }, []);

     const approveAndContinue = useCallback(() => {
       setState('generating');
       setCurrentIndex((i) => i + 1);
     }, []);

     const stop = useCallback(() => {
       setState('stopping');
     }, []);

     const complete = useCallback(() => {
       setState('completed');
     }, []);

     const setError = useCallback(() => {
       setState('error');
     }, []);

     const reset = useCallback(() => {
       setState('idle');
       setCurrentIndex(0);
     }, []);

     return {
       state,
       currentIndex,
       isGenerating: state === 'generating',
       isAwaitingApproval: state === 'awaiting_approval',
       startGenerating,
       awaitApproval,
       approveAndContinue,
       stop,
       complete,
       setError,
       reset,
     };
   }
   ```

2. **Create useMessageModal**

   Manages modal open/close and selected connection:

   ```typescript
   // useMessageModal.ts
   import { useState, useCallback } from 'react';
   import type { Connection } from '@/types';

   export function useMessageModal() {
     const [isOpen, setIsOpen] = useState(false);
     const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);

     const openModal = useCallback((connection: Connection) => {
       setSelectedConnection(connection);
       setIsOpen(true);
     }, []);

     const closeModal = useCallback(() => {
       setIsOpen(false);
       setSelectedConnection(null);
     }, []);

     return {
       isOpen,
       selectedConnection,
       openModal,
       closeModal,
     };
   }
   ```

3. **Create useMessageHistory**

   Manages message history fetching with React Query:

   ```typescript
   // useMessageHistory.ts
   import { useQuery, useQueryClient } from '@tanstack/react-query';
   import { queryKeys } from '@/shared/lib/queryKeys';
   import type { Message } from '@/types';

   export function useMessageHistory(connectionId: string | null) {
     const queryClient = useQueryClient();

     const {
       data: messages = [],
       isLoading,
       error,
     } = useQuery({
       queryKey: queryKeys.messages.history(connectionId ?? ''),
       queryFn: async () => {
         // Fetch message history from API
         // For now, return empty (matches current behavior)
         return [] as Message[];
       },
       enabled: !!connectionId,
     });

     const addOptimisticMessage = (message: Message) => {
       queryClient.setQueryData(
         queryKeys.messages.history(connectionId ?? ''),
         (old: Message[] = []) => [...old, message]
       );
     };

     return {
       messages,
       isLoading,
       error: error?.message ?? null,
       addOptimisticMessage,
     };
   }
   ```

4. **Rewrite useMessageGeneration to compose hooks**

   The key change: **callbacks instead of polling**.

   ```typescript
   // useMessageGeneration.ts
   import { useCallback, useMemo } from 'react';
   import { useToast } from '@/shared/hooks';
   import { useErrorHandler } from '@/shared/hooks';
   import { useProgressTracker } from '@/features/workflow';
   import { useWorkflowStateMachine } from './useWorkflowStateMachine';
   import { useMessageModal } from './useMessageModal';
   import { useMessageHistory } from './useMessageHistory';
   import { messageGenerationService } from '@/features/messages';
   import { connectionDataContextService } from '@/features/connections';
   import type { Connection } from '@/types';
   import { createLogger } from '@/shared/utils/logger';

   const logger = createLogger('useMessageGeneration');

   interface UseMessageGenerationOptions {
     connections: Connection[];
     selectedConnections: string[];
     conversationTopic: string;
     userProfile: Record<string, unknown> | null;
   }

   export function useMessageGeneration(options: UseMessageGenerationOptions) {
     const { connections, selectedConnections, conversationTopic, userProfile } = options;
     const { toast } = useToast();
     const errorHandler = useErrorHandler();
     const progressTracker = useProgressTracker();

     // Composed hooks
     const workflow = useWorkflowStateMachine();
     const modal = useMessageModal();
     const history = useMessageHistory(modal.selectedConnection?.id ?? null);

     // Generated messages map (local state)
     const [generatedMessages, setGeneratedMessages] = useState<Map<string, string>>(new Map());

     // Message generation for a single connection
     const generateMessageForConnection = useCallback(
       async (connection: Connection): Promise<string> => {
         const cleanedTopic = connectionDataContextService.prepareConversationTopic(conversationTopic);
         const context = connectionDataContextService.prepareMessageGenerationContext(
           connection,
           cleanedTopic,
           userProfile || undefined,
           { includeMessageHistory: true }
         );
         const request = connectionDataContextService.createMessageGenerationRequest(context);
         return messageGenerationService.generateMessage(request);
       },
       [conversationTopic, userProfile]
     );

     // CALLBACK-BASED approval (no polling!)
     const handleApproveAndNext = useCallback(() => {
       modal.closeModal();
       workflow.approveAndContinue();
     }, [modal, workflow]);

     const handleSkipConnection = useCallback(() => {
       modal.closeModal();
       workflow.approveAndContinue(); // Skip is same as approve for flow purposes
     }, [modal, workflow]);

     const handleStopGeneration = useCallback(() => {
       modal.closeModal();
       workflow.stop();
       progressTracker.resetProgress();
       errorHandler.showInfoFeedback('Message generation has been stopped.', 'Generation Stopped');
     }, [modal, workflow, progressTracker, errorHandler]);

     // Main generation orchestrator
     const handleGenerateMessages = useCallback(async () => {
       if (selectedConnections.length === 0 || !conversationTopic.trim()) {
         toast({
           title: 'Missing Requirements',
           description: 'Please select connections and enter a conversation topic.',
           variant: 'destructive',
         });
         return;
       }

       workflow.startGenerating();
       progressTracker.initializeProgress(selectedConnections.length);

       const selectedConnectionsData = connections.filter(
         (conn) => selectedConnections.includes(conn.id) && conn.status === 'ally'
       );

       for (let i = 0; i < selectedConnectionsData.length; i++) {
         if (workflow.state === 'stopping') {
           break;
         }

         const connection = selectedConnectionsData[i];
         const connectionName = `${connection.first_name} ${connection.last_name}`;

         progressTracker.updateProgress(i, connectionName, 'generating');

         try {
           const generatedMessage = await generateMessageForConnection(connection);
           setGeneratedMessages((prev) => new Map(prev).set(connection.id, generatedMessage));

           // Show modal and await user action via callbacks
           modal.openModal(connection);
           workflow.awaitApproval();

           // Wait for state change (from callbacks)
           await new Promise<void>((resolve) => {
             const checkState = () => {
               if (workflow.state !== 'awaiting_approval') {
                 resolve();
               } else {
                 requestAnimationFrame(checkState);
               }
             };
             checkState();
           });

         } catch (error) {
           logger.error('Error generating message', { connectionId: connection.id, error });
           // Error handling...
         }
       }

       workflow.complete();
       progressTracker.resetProgress();
     }, [
       selectedConnections,
       conversationTopic,
       connections,
       workflow,
       progressTracker,
       modal,
       generateMessageForConnection,
       toast,
     ]);

     // ... rest of the hook

     return {
       // Workflow state
       isGeneratingMessages: workflow.isGenerating || workflow.isAwaitingApproval,
       workflowState: workflow.state,

       // Modal state
       messageModalOpen: modal.isOpen,
       selectedConnectionForMessages: modal.selectedConnection,

       // Message state
       messageHistory: history.messages,
       generatedMessages,

       // Derived
       currentConnectionName: /* compute from workflow.currentIndex */,
       progressTracker,

       // Actions
       handleMessageClick: modal.openModal,
       handleCloseMessageModal: modal.closeModal,
       handleSendMessage: /* ... */,
       handleGenerateMessages,
       handleStopGeneration,
       handleApproveAndNext,
       handleSkipConnection,
     };
   }
   ```

   **Note:** The polling is reduced but not entirely eliminated in the above. For a truly callback-based approach, the orchestration logic needs restructuring. The key insight is that the modal callbacks (`handleApproveAndNext`, `handleSkipConnection`) directly trigger the state machine, and the orchestrator reacts to state changes.

5. **Write tests for each hook**

   Each hook should be testable in isolation:

   ```typescript
   // useWorkflowStateMachine.test.ts
   describe('useWorkflowStateMachine', () => {
     it('starts in idle state', () => { /* ... */ });
     it('transitions to generating on startGenerating', () => { /* ... */ });
     it('transitions to awaiting_approval on awaitApproval', () => { /* ... */ });
     it('increments currentIndex on approveAndContinue', () => { /* ... */ });
     it('resets state on reset', () => { /* ... */ });
   });
   ```

6. **Update barrel exports**

   ```typescript
   // frontend/src/features/messages/index.ts
   export { useMessageGeneration } from './hooks/useMessageGeneration';
   export { useWorkflowStateMachine } from './hooks/useWorkflowStateMachine';
   export { useMessageModal } from './hooks/useMessageModal';
   export { useMessageHistory } from './hooks/useMessageHistory';
   ```

**Verification Checklist:**
- [x] Each sub-hook is independently testable
- [x] Composed hook maintains same return shape
- [x] No ESLint exhaustive-deps violations
- [x] No `setTimeout` polling loops
- [x] Modal callbacks trigger state changes
- [x] Tests pass for all hooks

**Testing Instructions:**

```bash
cd frontend && npm test -- --run src/features/messages/hooks/
```

**Commit Message Template:**
```
refactor(frontend): decompose useMessageGeneration into focused hooks

- Extract useWorkflowStateMachine for state transitions
- Extract useMessageModal for modal state
- Extract useMessageHistory with React Query
- Replace polling with callback-based approval flow
- Eliminate ESLint exhaustive-deps suppressions
```

---

## Task 6: Remove Deprecated Utilities and Clean Up

**Goal:** Remove utilities that are no longer used after React Query migration.

**Files to Delete:**
- `frontend/src/features/connections/utils/connectionCache.ts`
- `frontend/src/features/connections/utils/connectionChangeTracker.ts`

**Files to Modify:**
- `frontend/src/features/connections/index.ts` - Remove deprecated exports
- Any files importing these utilities - Remove imports

**Prerequisites:**
- Tasks 1-5 complete and verified
- All tests passing

**Implementation Steps:**

1. **Search for remaining usages**

   ```bash
   grep -r "connectionCache" frontend/src/
   grep -r "connectionChangeTracker" frontend/src/
   ```

   Remove any remaining imports.

2. **Delete utility files**

   ```bash
   rm frontend/src/features/connections/utils/connectionCache.ts
   rm frontend/src/features/connections/utils/connectionChangeTracker.ts
   ```

3. **Update barrel exports**

   Edit `frontend/src/features/connections/index.ts`:
   - Remove `export { connectionCache } from './utils/connectionCache';`
   - Remove `export { connectionChangeTracker } from './utils/connectionChangeTracker';`

4. **Verify build**

   ```bash
   npm run build
   ```

**Verification Checklist:**
- [ ] No imports of connectionCache anywhere
- [ ] No imports of connectionChangeTracker anywhere
- [ ] Build succeeds
- [ ] All tests pass

**Testing Instructions:**

```bash
cd frontend && npm run build && npm test
```

**Commit Message Template:**
```
chore(frontend): remove deprecated cache utilities

- Delete connectionCache.ts (replaced by React Query)
- Delete connectionChangeTracker.ts (replaced by cache invalidation)
- Update barrel exports
```

---

## Phase Verification

After completing all tasks:

1. **Run full test suite:**
   ```bash
   cd frontend && npm test
   ```

2. **Run linting:**
   ```bash
   cd frontend && npm run lint
   ```

3. **Build for production:**
   ```bash
   cd frontend && npm run build
   ```

4. **Manual verification:**
   - Start frontend: `npm run dev`
   - Navigate to dashboard
   - Verify connections load
   - Verify search works
   - Verify message generation workflow
   - Check React Query DevTools (if installed) shows queries

---

## Known Limitations

1. **Message history fetching:** Currently returns empty array. Real implementation requires API endpoint.

2. **Polling not fully eliminated:** The `handleGenerateMessages` orchestrator still uses a state-checking loop. A more elegant solution would use async generators or event emitters, but that's out of scope.

3. **No optimistic updates for message generation:** Messages are generated server-side; can't show optimistic content.

---

## Rollback Plan

If issues arise after deployment:

1. Revert to previous hook implementations (git revert)
2. Restore `connectionCache.ts` and `connectionChangeTracker.ts`
3. React Query setup can remain (doesn't break anything if unused)
