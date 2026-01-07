# Phase 2: Frontend Search Integration

## Phase Goal

Integrate RAGStack semantic search into the frontend Connections tab, enabling users to search their network with natural language queries. Search results are hydrated from DynamoDB and displayed using existing connection card components.

**Success Criteria:**
- Search bar visible in Connections tab
- Queries sent to RAGStack via backend proxy
- Results displayed as profile cards
- Existing filtering works on search results
- Loading and error states handled
- All tests passing with mocked services

**Estimated Tokens:** ~35,000

---

## Prerequisites

- Phase 1 complete (RAGStack deployed, ingestion working)
- RAGStack proxy Lambda accessible
- Profiles ingested and searchable
- Understanding of existing Connections tab architecture

---

## Tasks

### Task 1: RAGStack Search Service

**Goal:** Create frontend service to communicate with RAGStack proxy Lambda for search operations.

**Files to Create:**
- `frontend/src/shared/services/ragstackSearchService.ts` - Search service
- `frontend/src/shared/services/ragstackSearchService.test.ts` - Unit tests

**Prerequisites:**
- Understanding of existing `puppeteerApiService` patterns
- RAGStack proxy Lambda endpoint available

**Implementation Steps:**

1. Create service with methods:
   ```typescript
   interface SearchResult {
     profileId: string;
     score: number;
     snippet: string;
   }

   interface SearchResponse {
     results: SearchResult[];
     totalResults: number;
   }

   async function searchProfiles(query: string, maxResults?: number): Promise<SearchResponse>
   ```

2. HTTP client setup:
   - Use same axios instance pattern as `puppeteerApiService`
   - Attach JWT token from session storage
   - Target RAGStack proxy endpoint

3. Request format:
   ```typescript
   {
     operation: 'search',
     query: string,
     maxResults: number // default 100
   }
   ```

4. Response transformation:
   - Extract profile IDs from RAGStack source field
   - Parse scores for potential relevance display
   - Extract snippet for search highlighting (future)

5. Error handling:
   - Network errors → throw `SearchError`
   - Empty results → return empty array (not error)
   - Rate limiting → surface to UI

**Verification Checklist:**
- [ ] Service exports `searchProfiles` function
- [ ] JWT token attached to requests
- [ ] Response transformed to `SearchResponse` shape
- [ ] Empty results handled correctly
- [ ] Network errors throw typed exception
- [ ] Timeout configured appropriately

**Testing Instructions:**

Unit tests with mocked axios:
```typescript
describe('ragstackSearchService', () => {
  it('should return profile IDs from search', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        results: [
          { source: 'profile_abc123', score: 0.95, content: '...' }
        ],
        totalResults: 1
      }
    });

    const response = await searchProfiles('software engineer');

    expect(response.results[0].profileId).toBe('abc123');
    expect(response.totalResults).toBe(1);
  });

  it('should handle empty results', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { results: [], totalResults: 0 }
    });

    const response = await searchProfiles('nonexistent');

    expect(response.results).toEqual([]);
  });
});
```

**Commit Message Template:**
```
feat(frontend): add RAGStack search service

- Calls RAGStack proxy Lambda for profile search
- Transforms responses to typed interface
- Handles errors and empty results
```

---

### Task 2: Profile Search Hook

**Goal:** Create React hook that manages search state, debouncing, and result hydration from DynamoDB.

**Files to Create:**
- `frontend/src/features/connections/hooks/useProfileSearch.ts` - Search hook
- `frontend/src/features/connections/hooks/useProfileSearch.test.ts` - Unit tests

**Prerequisites:**
- Task 1 complete (search service)
- Understanding of existing `useConnections` hook
- Understanding of `lambdaApiService` for profile fetching

**Implementation Steps:**

1. Create hook with state management:
   ```typescript
   interface UseProfileSearchResult {
     searchQuery: string;
     setSearchQuery: (query: string) => void;
     searchResults: Connection[];
     isSearching: boolean;
     searchError: Error | null;
     clearSearch: () => void;
     isSearchActive: boolean;
   }

   function useProfileSearch(allConnections: Connection[]): UseProfileSearchResult
   ```

2. Debounce search input:
   - Wait 300ms after user stops typing
   - Cancel pending searches on new input
   - Clear results when query cleared

3. Search flow:
   ```
   User types query
   → Debounce 300ms
   → Call ragstackSearchService.searchProfiles(query)
   → Receive profile IDs
   → Match against allConnections by ID
   → Return matched connections in score order
   ```

4. Result hydration:
   - Match RAGStack profile IDs to existing connections
   - Preserve RAGStack relevance ordering
   - Fall back to DynamoDB fetch for missing profiles (edge case)

5. State management:
   - `isSearchActive` true when query has content
   - `isSearching` true during API call
   - Clear search returns to showing all connections

**Verification Checklist:**
- [ ] Debounces input at 300ms
- [ ] Cancels pending searches on new input
- [ ] Returns hydrated Connection objects
- [ ] Preserves relevance ordering
- [ ] `isSearchActive` reflects query state
- [ ] `isSearching` reflects loading state
- [ ] `clearSearch` resets all state

**Testing Instructions:**

Unit tests with mocked services:
```typescript
describe('useProfileSearch', () => {
  it('should debounce search queries', async () => {
    const { result } = renderHook(() => useProfileSearch(mockConnections));

    act(() => result.current.setSearchQuery('eng'));
    act(() => result.current.setSearchQuery('engi'));
    act(() => result.current.setSearchQuery('engineer'));

    // Only one search after debounce
    await waitFor(() => {
      expect(mockSearchProfiles).toHaveBeenCalledTimes(1);
      expect(mockSearchProfiles).toHaveBeenCalledWith('engineer', 100);
    });
  });

  it('should hydrate results from connections', async () => {
    vi.mocked(searchProfiles).mockResolvedValue({
      results: [{ profileId: 'abc123', score: 0.9, snippet: '' }],
      totalResults: 1
    });

    const { result } = renderHook(() => useProfileSearch([
      { id: 'abc123', first_name: 'John', ...otherFields }
    ]));

    act(() => result.current.setSearchQuery('john'));

    await waitFor(() => {
      expect(result.current.searchResults[0].first_name).toBe('John');
    });
  });
});
```

**Commit Message Template:**
```
feat(frontend): add useProfileSearch hook

- Debounced search with 300ms delay
- Hydrates results from existing connections
- Manages loading and error states
```

---

### Task 3: Connection Search Bar Component

**Goal:** Create search input component for the Connections tab with clear button and loading indicator.

**Files to Create:**
- `frontend/src/features/connections/components/ConnectionSearchBar.tsx` - Component
- `frontend/src/features/connections/components/ConnectionSearchBar.test.tsx` - Unit tests

**Prerequisites:**
- Understanding of existing UI components (Input, Button from shadcn/ui)
- Design system patterns from existing components

**Implementation Steps:**

1. Create component with props:
   ```typescript
   interface ConnectionSearchBarProps {
     value: string;
     onChange: (value: string) => void;
     onClear: () => void;
     isLoading: boolean;
     placeholder?: string;
     className?: string;
   }
   ```

2. UI elements:
   - Search icon (left side)
   - Text input (center)
   - Loading spinner (replaces clear button when searching)
   - Clear button (X icon, visible when has value)

3. Styling:
   - Match existing filter input styles
   - Full width in container
   - Focus ring on input
   - Subtle background

4. Accessibility:
   - `aria-label` for search input
   - `aria-busy` when loading
   - Clear button has label "Clear search"
   - Keyboard accessible (Enter doesn't submit form)

5. Behavior:
   - Clear button only visible when value present
   - Loading spinner replaces clear button during search
   - Escape key clears input

**Verification Checklist:**
- [ ] Search icon displayed
- [ ] Input accepts and displays value
- [ ] Clear button visible when value present
- [ ] Loading spinner shown when `isLoading`
- [ ] `onClear` called when clear clicked
- [ ] `onChange` called on input change
- [ ] Escape key clears input
- [ ] Accessible labels present

**Testing Instructions:**

Component tests with React Testing Library:
```typescript
describe('ConnectionSearchBar', () => {
  it('should show clear button when value present', () => {
    render(
      <ConnectionSearchBar
        value="test"
        onChange={vi.fn()}
        onClear={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('should show loading spinner when isLoading', () => {
    render(
      <ConnectionSearchBar
        value="test"
        onChange={vi.fn()}
        onClear={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('should call onChange on input', async () => {
    const onChange = vi.fn();
    render(
      <ConnectionSearchBar
        value=""
        onChange={onChange}
        onClear={vi.fn()}
        isLoading={false}
      />
    );

    await userEvent.type(screen.getByRole('textbox'), 'engineer');

    expect(onChange).toHaveBeenCalled();
  });
});
```

**Commit Message Template:**
```
feat(frontend): add ConnectionSearchBar component

- Search icon and input field
- Clear button with loading state
- Accessible with keyboard support
```

---

### Task 4: Integrate Search into Connections Tab

**Goal:** Wire up search functionality into the existing ConnectionsTab component, showing search results when active.

**Files to Modify:**
- `frontend/src/features/connections/components/ConnectionsTab.tsx` - Add search integration

**Prerequisites:**
- Tasks 1-3 complete
- Understanding of existing ConnectionsTab structure

**Implementation Steps:**

1. Import new components and hooks:
   ```typescript
   import { useProfileSearch } from '../hooks/useProfileSearch';
   import { ConnectionSearchBar } from './ConnectionSearchBar';
   ```

2. Add search hook to component:
   ```typescript
   const {
     searchQuery,
     setSearchQuery,
     searchResults,
     isSearching,
     searchError,
     clearSearch,
     isSearchActive
   } = useProfileSearch(connections);
   ```

3. Render search bar above existing content:
   - Place below tab header, above filter controls
   - Full width with appropriate spacing

4. Conditional rendering logic:
   ```typescript
   const displayedConnections = isSearchActive ? searchResults : connections;
   ```

5. Preserve existing filtering:
   - Apply filters to `displayedConnections`
   - Filters work on both search results and full list
   - Sorting applies after filtering

6. Empty state handling:
   - "No results found for '{query}'" when search returns empty
   - Offer clear search button in empty state
   - Differentiate from "No connections" state

7. Error state:
   - Show error message if `searchError` present
   - Offer retry option

**Verification Checklist:**
- [ ] Search bar visible in Connections tab
- [ ] Typing triggers debounced search
- [ ] Search results replace connection list
- [ ] Existing filters apply to search results
- [ ] Empty search state shows appropriate message
- [ ] Clear search returns to full list
- [ ] Error state displays with retry option
- [ ] Loading state visible during search

**Testing Instructions:**

Integration tests with mocked hooks:
```typescript
describe('ConnectionsTab with search', () => {
  it('should display search results when query active', async () => {
    vi.mocked(useProfileSearch).mockReturnValue({
      searchQuery: 'engineer',
      setSearchQuery: vi.fn(),
      searchResults: [mockConnection],
      isSearching: false,
      searchError: null,
      clearSearch: vi.fn(),
      isSearchActive: true
    });

    render(<ConnectionsTab connections={[]} />);

    expect(screen.getByText(mockConnection.first_name)).toBeInTheDocument();
  });

  it('should show empty state for no results', () => {
    vi.mocked(useProfileSearch).mockReturnValue({
      searchQuery: 'nonexistent',
      searchResults: [],
      isSearchActive: true,
      // ...other values
    });

    render(<ConnectionsTab connections={[]} />);

    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });
});
```

**Commit Message Template:**
```
feat(frontend): integrate search into Connections tab

- Search bar above filter controls
- Search results replace connection list when active
- Preserves existing filtering on results
- Empty and error states handled
```

---

### Task 5: Integrate Search into NewConnections Tab

**Goal:** Add same search functionality to NewConnectionsTab for searching "possible" contacts.

**Files to Modify:**
- `frontend/src/features/connections/components/NewConnectionsTab.tsx` - Add search integration

**Prerequisites:**
- Task 4 complete (ConnectionsTab integration)
- Understanding that NewConnectionsTab shows `status='possible'` contacts

**Implementation Steps:**

1. Follow same pattern as ConnectionsTab:
   - Import search hook and component
   - Add search bar to UI
   - Conditional rendering of results

2. Consider search scope:
   - NewConnections shows "possible" contacts
   - These are NOT ingested into RAGStack (per ADR-003)
   - Search should fall back to client-side filtering

3. Hybrid search approach:
   ```typescript
   // For NewConnectionsTab, use client-side search since possible contacts aren't ingested
   const filteredConnections = useMemo(() => {
     if (!searchQuery) return connections;
     const query = searchQuery.toLowerCase();
     return connections.filter(c =>
       c.first_name?.toLowerCase().includes(query) ||
       c.last_name?.toLowerCase().includes(query) ||
       c.company?.toLowerCase().includes(query) ||
       c.position?.toLowerCase().includes(query) ||
       c.headline?.toLowerCase().includes(query)
     );
   }, [connections, searchQuery]);
   ```

4. UI consistency:
   - Same search bar component
   - Same placement
   - Same clear behavior
   - No loading state (client-side is instant)

5. Future consideration:
   - When contact processing rework happens, this may change
   - Keep architecture flexible for RAGStack integration later

**Verification Checklist:**
- [ ] Search bar visible in NewConnections tab
- [ ] Client-side filtering works
- [ ] Filters across name, company, position, headline
- [ ] No loading spinner (instant results)
- [ ] Clear search works
- [ ] Empty state appropriate

**Testing Instructions:**

```typescript
describe('NewConnectionsTab with search', () => {
  it('should filter connections client-side', async () => {
    render(<NewConnectionsTab connections={[
      { ...mockConnection, first_name: 'John', company: 'Google' },
      { ...mockConnection, first_name: 'Jane', company: 'Meta' }
    ]} />);

    await userEvent.type(screen.getByRole('textbox'), 'Google');

    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.queryByText('Jane')).not.toBeInTheDocument();
  });
});
```

**Commit Message Template:**
```
feat(frontend): add search to NewConnections tab

- Client-side filtering for possible contacts
- Searches name, company, position, headline
- Consistent UI with Connections tab
```

---

### Task 6: Update Lambda API Service

**Goal:** Add RAGStack search method to existing Lambda API service for consistency.

**Files to Modify:**
- `frontend/src/shared/services/lambdaApiService.ts` - Add search method

**Prerequisites:**
- Understanding of existing lambdaApiService structure
- Task 1 search service as reference

**Implementation Steps:**

1. Add search method to service:
   ```typescript
   async searchProfiles(query: string, maxResults = 100): Promise<SearchResponse> {
     const response = await this.post('/ragstack', {
       operation: 'search',
       query,
       maxResults
     });
     return this.transformSearchResponse(response);
   }
   ```

2. Add response transformation:
   - Extract profile IDs from source field
   - Map scores if needed
   - Handle error responses

3. Consider consolidation:
   - Could replace standalone `ragstackSearchService`
   - Or keep separate for separation of concerns
   - Decision: Keep lambdaApiService as single entry point

4. Update types file if needed:
   - Add `SearchResponse` interface
   - Add `SearchResult` interface

**Verification Checklist:**
- [ ] `searchProfiles` method added
- [ ] Uses existing HTTP client
- [ ] Response properly transformed
- [ ] Types exported for consumers

**Testing Instructions:**

```typescript
describe('lambdaApiService.searchProfiles', () => {
  it('should call ragstack endpoint', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { results: [], totalResults: 0 }
    });

    await lambdaApiService.searchProfiles('test');

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/ragstack'),
      expect.objectContaining({ operation: 'search', query: 'test' })
    );
  });
});
```

**Commit Message Template:**
```
feat(frontend): add searchProfiles to lambdaApiService

- Calls RAGStack proxy endpoint
- Consistent with existing service patterns
- Typed response interface
```

---

### Task 7: Search Analytics and Logging

**Goal:** Add logging and analytics for search usage to understand user behavior.

**Files to Modify:**
- `frontend/src/features/connections/hooks/useProfileSearch.ts` - Add logging
- `frontend/src/shared/utils/logger.ts` - Use existing logger

**Prerequisites:**
- Task 2 complete (search hook)
- Understanding of existing logging patterns

**Implementation Steps:**

1. Log search events:
   ```typescript
   // On search execution
   logger.info('Profile search executed', {
     queryLength: query.length,
     resultCount: results.length,
     durationMs: Date.now() - startTime
   });
   ```

2. Log error events:
   ```typescript
   // On search error
   logger.error('Profile search failed', {
     query: query.substring(0, 50), // Truncate for privacy
     error: error.message
   });
   ```

3. Metrics to capture:
   - Search query length (not content for privacy)
   - Result count
   - Search duration
   - Error rate

4. Privacy considerations:
   - Do NOT log full search queries
   - Log query length and result counts only
   - Error messages can include query for debugging

**Verification Checklist:**
- [ ] Search success logged with metrics
- [ ] Search failure logged with error
- [ ] Query content not logged (privacy)
- [ ] Duration captured

**Testing Instructions:**

```typescript
describe('search logging', () => {
  it('should log search metrics on success', async () => {
    const logSpy = vi.spyOn(logger, 'info');

    // Execute search
    await executeSearch('test query');

    expect(logSpy).toHaveBeenCalledWith(
      'Profile search executed',
      expect.objectContaining({
        queryLength: 10,
        resultCount: expect.any(Number)
      })
    );
  });
});
```

**Commit Message Template:**
```
feat(frontend): add search analytics logging

- Log search metrics (count, duration)
- Privacy-preserving (no query content)
- Error tracking for failures
```

---

### Task 8: End-to-End Integration Testing

**Goal:** Create integration tests that verify the full search flow with mocked backend.

**Files to Create:**
- `frontend/src/features/connections/__tests__/search-integration.test.tsx` - Integration tests

**Prerequisites:**
- All previous tasks complete
- Understanding of MSW or similar mocking for integration tests

**Implementation Steps:**

1. Set up mock server:
   ```typescript
   const server = setupServer(
     rest.post('/api/ragstack', (req, res, ctx) => {
       return res(ctx.json({
         results: [
           { source: 'profile_abc', score: 0.9, content: 'John Doe...' }
         ],
         totalResults: 1
       }));
     })
   );
   ```

2. Test full flow:
   - Render Dashboard with Connections tab
   - Type in search bar
   - Wait for debounce
   - Verify API called
   - Verify results displayed

3. Test scenarios:
   - Successful search with results
   - Search with no results
   - Search error handling
   - Clear search
   - Filter on search results

4. Test accessibility:
   - Keyboard navigation through results
   - Screen reader announcements
   - Focus management

**Verification Checklist:**
- [ ] Full flow tested end-to-end
- [ ] Mock server intercepts requests
- [ ] Results render correctly
- [ ] Empty state renders
- [ ] Error state renders
- [ ] Clear search works
- [ ] Filters apply to results

**Testing Instructions:**

```typescript
describe('Search Integration', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should search and display results', async () => {
    render(<Dashboard />);

    // Navigate to Connections tab
    await userEvent.click(screen.getByRole('tab', { name: /connections/i }));

    // Type search query
    await userEvent.type(
      screen.getByRole('textbox', { name: /search/i }),
      'engineer'
    );

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should show empty state for no results', async () => {
    server.use(
      rest.post('/api/ragstack', (req, res, ctx) => {
        return res(ctx.json({ results: [], totalResults: 0 }));
      })
    );

    render(<Dashboard />);
    await userEvent.click(screen.getByRole('tab', { name: /connections/i }));
    await userEvent.type(screen.getByRole('textbox'), 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });
});
```

**Commit Message Template:**
```
test(frontend): add search integration tests

- End-to-end search flow verification
- Mock server for API responses
- Tests success, empty, and error states
```

---

## Phase Verification

This phase is complete when:

- [ ] Search bar visible in Connections tab
- [ ] Search bar visible in NewConnections tab
- [ ] RAGStack search returns relevant results
- [ ] Results display as connection cards
- [ ] Existing filters work on search results
- [ ] Empty state shows for no results
- [ ] Error state handles failures gracefully
- [ ] Loading indicator during search
- [ ] Clear search restores full list
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Accessibility requirements met

**Manual Verification:**

1. Navigate to Connections tab
2. Type a search query (e.g., "software engineer")
3. Verify loading indicator appears
4. Verify results appear after debounce
5. Verify results are relevant to query
6. Apply a filter (e.g., location)
7. Verify filter applies to search results
8. Clear search
9. Verify full connection list restored
10. Repeat for NewConnections tab (client-side)

---

## Known Limitations

1. **NewConnections uses client-side search** - "Possible" contacts not in RAGStack
2. **No relevance score display** - Scores available but not shown in UI
3. **No search highlighting** - Matching terms not highlighted in cards
4. **100 result limit** - May miss relevant profiles beyond limit
5. **No saved searches** - Users can't save frequent queries
6. **No search history** - Recent searches not tracked

---

## Future Enhancements (Out of Scope)

- Search suggestions/autocomplete
- Relevance score visualization
- Search term highlighting in results
- Saved searches
- Search history
- Chat interface for complex queries
- Export search results
