# Phase 5: Frontend Integration & Testing

## Phase Goal

Integrate the new placeholder search API with the React frontend, update UI components to handle placeholder responses gracefully, and perform comprehensive end-to-end testing. By the end of this phase, the application will be fully functional with the new architecture: Puppeteer extracts text → uploads to S3 → frontend calls placeholder search API. Users will see a clear message that search is coming soon.

**Success Criteria:**
- Frontend calls new placeholder search API
- UI gracefully handles empty search results
- User sees informative message about search being unavailable
- No broken functionality from Pinecone removal
- Application builds without errors
- All existing features (connections, messaging, posting) still work
- End-to-end workflow tested: scraping → text extraction → S3 upload → search API call

**Estimated tokens:** ~25,000

---

## Prerequisites

- **Previous Phases:**
  - Phase 1 (Code Cleanup) complete
  - Phase 4 (Placeholder Search API) deployed
- **External Dependencies:**
  - Placeholder search API deployed and accessible
  - API Gateway URL configured
  - Cognito authentication working
- **Environment Requirements:**
  - Frontend development server running
  - Puppeteer backend running
  - Valid LinkedIn credentials for testing

---

## Tasks

### Task 1: Update Frontend Search Service

**Goal:** Update the frontend API service to call the new placeholder search endpoint instead of Pinecone search.

**Files to Modify:**
- `src/services/lambdaApiService.ts` (if search logic exists here)
- `src/hooks/useSearchResults.ts`

**Files to Review:**
- Frontend components that display search results

**Prerequisites:**
- Phase 4 search API deployed
- API Gateway URL available
- Understanding of current search implementation

**Implementation Steps:**

1. **Locate existing search logic:**
   - Review `src/hooks/useSearchResults.ts` to understand current search flow
   - Review `src/services/lambdaApiService.ts` for search API calls
   - Review `src/services/puppeteerApiService.ts` (search might be here)
   - Identify all places where search is called or displayed

2. **Add search API method to lambdaApiService:**
   - If not already present, add a search method:
     ```typescript
     async searchProfiles(query: string, filters?: any, limit = 10, offset = 0) {
       try {
         const response = await this.apiClient.post('search', {
           query,
           filters,
           limit,
           offset,
         });

         // Handle Lambda proxy response format
         const data = typeof response.data === 'object' && 'statusCode' in response.data
           ? JSON.parse(response.data.body)
           : response.data;

         return {
           success: data.success,
           message: data.message,
           results: data.results || [],
           total: data.total || 0,
           metadata: data.metadata,
         };
       } catch (error) {
         console.error('Search API error:', error);
         return {
           success: false,
           message: error instanceof Error ? error.message : 'Search failed',
           results: [],
           total: 0,
         };
       }
     }
     ```

3. **Update useSearchResults hook:**
   - If the hook currently expects Pinecone results, update it for placeholder API:
     ```typescript
     const searchProfiles = useCallback(
       async (searchData: SearchFormData) => {
         setLoading(true);
         setError(null);

         try {
           const result = await lambdaApiService.searchProfiles(
             searchData.query,
             searchData.filters,
             searchData.limit
           );

           if (!result.success) {
             setError(result.message || 'Search failed');
             setResults([]);
           } else {
             // Placeholder response will have empty results
             setResults(result.results);

             // Show informational message to user
             if (result.message) {
               setInfoMessage(result.message);
             }
           }
         } catch (err) {
           setError('An error occurred during search');
           setResults([]);
         } finally {
           setLoading(false);
         }
       },
       [lambdaApiService]
     );
     ```

4. **Handle placeholder response:**
   - Add state for informational messages:
     ```typescript
     const [infoMessage, setInfoMessage] = useState<string | null>(null);
     ```
   - Return info message from hook:
     ```typescript
     return {
       results,
       loading,
       error,
       infoMessage, // NEW
       searchProfiles,
       clearResults,
     };
     ```

5. **Remove Pinecone-specific logic:**
   - If any Pinecone-specific code remains (vector scores, similarity, etc.), remove it
   - Simplify search logic to basic query string

6. **Update error handling:**
   - Handle 401 errors (authentication failures)
   - Handle 400 errors (invalid queries)
   - Handle 500 errors (server errors)
   - Display user-friendly error messages

**Verification Checklist:**
- [ ] searchProfiles method added to lambdaApiService
- [ ] useSearchResults hook updated to call new API
- [ ] Placeholder response handling implemented
- [ ] Info message state added and returned
- [ ] Pinecone-specific logic removed
- [ ] Error handling updated

**Testing Instructions:**
- Test search API call:
  ```typescript
  import { lambdaApiService } from '@/services/lambdaApiService';

  const result = await lambdaApiService.searchProfiles('software engineer');
  console.log('Search result:', result);
  // Verify: success: true, results: [], message: "Search functionality is currently unavailable..."
  ```
- Test hook:
  ```typescript
  const { searchProfiles, results, infoMessage } = useSearchResults();
  await searchProfiles({ query: 'test' });
  console.log('Results:', results); // []
  console.log('Info message:', infoMessage); // "Search functionality is currently unavailable..."
  ```

**Commit Message Template:**
```
feat(search): integrate placeholder search API

- Add searchProfiles method to lambdaApiService
- Update useSearchResults hook to call new search endpoint
- Add info message state for placeholder response
- Remove Pinecone-specific search logic
- Update error handling for search API
- Prepare for UI integration
```

**Estimated tokens:** ~5,000

---

### Task 2: Update Search UI Components

**Goal:** Update UI components to display the placeholder search message and handle empty results gracefully.

**Files to Modify:**
- `src/components/ConnectionFilters.tsx` (or wherever search UI exists)
- `src/components/ResearchResultsCard.tsx` (if it displays search results)
- `src/pages/Dashboard.tsx` (if search is on dashboard)

**Files to Review:**
- All components that interact with search

**Prerequisites:**
- Task 1 search service updated
- Understanding of current search UI

**Implementation Steps:**

1. **Locate search UI components:**
   - Find where search query input is rendered
   - Find where search results are displayed
   - Identify any Pinecone-specific UI elements (similarity scores, etc.)

2. **Update search input component:**
   - Ensure search input still works
   - Add placeholder text: "Search profiles (coming soon)"
   - Optionally add tooltip or help text explaining placeholder status

3. **Update search results display:**
   - Handle empty results gracefully:
     ```tsx
     {results.length === 0 && !loading && (
       <div className="empty-state">
         <p className="text-muted-foreground">
           {infoMessage || 'No results found'}
         </p>
       </div>
     )}
     ```

4. **Add informational banner:**
   - Display placeholder message prominently:
     ```tsx
     {infoMessage && (
       <Alert>
         <AlertDescription>
           {infoMessage}
         </AlertDescription>
       </Alert>
     )}
     ```

5. **Remove Pinecone-specific UI:**
   - Remove any UI elements related to:
     - Vector similarity scores
     - Semantic search explanations
     - Pinecone branding or references

6. **Update loading states:**
   - Ensure loading spinner shows during API call
   - Add skeleton loaders for better UX

7. **Update empty state styling:**
   - Make empty state clear but not alarming
   - Include helpful text about future functionality
   - Consider adding illustration or icon

**Verification Checklist:**
- [ ] Search input component updated
- [ ] Search results display handles empty results
- [ ] Info message banner added
- [ ] Pinecone-specific UI removed
- [ ] Loading states working correctly
- [ ] Empty state styled appropriately

**Testing Instructions:**
- Manually test search UI:
  1. Open application in browser
  2. Navigate to search page/tab
  3. Enter search query
  4. Submit search
  5. Verify info message displays
  6. Verify empty state shows gracefully
  7. Verify no console errors

**Commit Message Template:**
```
feat(ui): update search UI for placeholder API

- Update search results display to handle empty results
- Add informational banner for placeholder message
- Remove Pinecone-specific UI elements
- Update empty state styling
- Add helpful messaging about future functionality
- Ensure loading states work correctly
```

**Estimated tokens:** ~4,000

---

### Task 3: Update Environment Configuration

**Goal:** Update frontend environment variables to point to the new search API endpoint.

**Files to Modify:**
- `.env.example`
- Frontend environment configuration documentation

**Prerequisites:**
- Phase 4 search API deployed
- API Gateway URL available

**Implementation Steps:**

1. **Get API Gateway URL:**
   - From CloudFormation outputs or AWS Console:
     ```bash
     aws cloudformation describe-stacks \
       --stack-name linkedin-advanced-search-stack \
       --query 'Stacks[0].Outputs[?OutputKey==`ApiBaseUrl`].OutputValue' \
       --output text
     ```
   - Example: `https://abc123.execute-api.us-west-2.amazonaws.com/prod`

2. **Update .env.example:**
   - Ensure `VITE_API_GATEWAY_URL` is documented:
     ```bash
     # API Gateway base URL for Lambda functions (including search)
     VITE_API_GATEWAY_URL=https://abc123.execute-api.us-west-2.amazonaws.com/prod
     ```
   - Add comment explaining search endpoint:
     ```bash
     # Search API endpoint: POST /search
     # Note: Currently returns placeholder response (empty results)
     ```

3. **Update local .env file:**
   - Create/update `.env` file with actual API Gateway URL
   - Ensure it's in `.gitignore` (should already be)

4. **Verify frontend can reach API:**
   - Test API Gateway URL from browser dev tools:
     ```javascript
     fetch('https://abc123.execute-api.us-west-2.amazonaws.com/prod/search', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${jwt}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ query: 'test' }),
     })
     .then(r => r.json())
     .then(console.log);
     ```

5. **Update documentation:**
   - Document API Gateway URL setup in README or setup guide
   - Explain how to get URL from CloudFormation outputs
   - Document local development vs. production URLs

**Verification Checklist:**
- [ ] .env.example updated with API Gateway URL
- [ ] Local .env file configured
- [ ] API Gateway URL reachable from frontend
- [ ] Documentation updated

**Testing Instructions:**
- Verify environment variable loaded:
  ```typescript
  console.log('API Gateway URL:', import.meta.env.VITE_API_GATEWAY_URL);
  // Should show URL
  ```
- Test API call with configured URL:
  ```typescript
  const result = await lambdaApiService.searchProfiles('test');
  console.log('API call successful:', result.success);
  ```

**Commit Message Template:**
```
chore(config): update frontend environment for search API

- Update .env.example with API Gateway URL
- Document search endpoint configuration
- Update setup documentation
- Ensure frontend can reach new search API
```

**Estimated tokens:** ~3,000

---

### Task 4: End-to-End Workflow Testing

**Goal:** Test the complete refactored workflow from profile scraping through text extraction, S3 upload, to search API calls.

**Files to Create:**
- `Migration/docs/e2e-test-report.md` - End-to-end test results

**Prerequisites:**
- All previous tasks complete
- Puppeteer backend running
- Frontend running
- Valid LinkedIn credentials

**Implementation Steps:**

1. **Test Profile Scraping & Text Extraction:**
   - Start Puppeteer backend:
     ```bash
     cd puppeteer-backend
     npm start
     ```
   - Trigger profile scraping via frontend or API:
     - Use existing search or profile init feature
     - Or call API directly:
       ```bash
       curl -X POST http://localhost:3001/search \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer {jwt}" \
         -d '{"companyName": "TechCorp", ...}'
       ```
   - Verify:
     - Profile visited and scraped
     - Text extracted (check logs: "Extracted 5 experience entries...")
     - No errors in Puppeteer backend logs

2. **Test S3 Upload:**
   - After profile scraping, verify S3 upload:
     ```bash
     aws s3 ls s3://bucket-name/profiles/
     # Should show newly uploaded JSON files
     ```
   - Download and verify file content:
     ```bash
     aws s3 cp s3://bucket-name/profiles/{profile-id}.json - | jq .
     # Should show valid JSON with profile data
     ```
   - Verify DynamoDB contains S3 URL:
     - Query DynamoDB for processed profile
     - Check `text_s3_key` and `text_s3_url` fields

3. **Test Search API from Frontend:**
   - Open frontend application in browser
   - Navigate to search page/tab
   - Enter search query: "software engineer"
   - Submit search
   - Verify:
     - Info message displays: "Search functionality is currently unavailable..."
     - Results array is empty
     - No errors in browser console
     - No errors in API Gateway CloudWatch logs

4. **Test Existing Features:**
   - Test Connections tab:
     - View existing connections
     - Filter connections
     - Send messages (if implemented)
   - Test New Connections tab:
     - Add new connections (if implemented)
   - Test New Post tab:
     - Create new post (if implemented)
   - Verify all features still work (no regression)

5. **Test Error Scenarios:**
   - **S3 Upload Failure:**
     - Temporarily disconnect network or invalidate AWS credentials
     - Trigger profile scraping
     - Verify: screenshots succeed, S3 upload fails gracefully, error logged
   - **Search API Unavailable:**
     - Stop Lambda or block network
     - Try search from frontend
     - Verify: user-friendly error message, no app crash
   - **Invalid Search Query:**
     - Submit empty search query
     - Verify: 400 error handled gracefully

6. **Document test results:**
   - Create `e2e-test-report.md` with:
     - Test scenarios executed
     - Results (pass/fail)
     - Screenshots of UI
     - Logs from backend and frontend
     - Any issues found and resolutions

**Verification Checklist:**
- [ ] Profile scraping and text extraction working
- [ ] S3 upload working (files visible in S3)
- [ ] DynamoDB updated with S3 URLs
- [ ] Search API callable from frontend
- [ ] Placeholder response displays correctly in UI
- [ ] Existing features still functional
- [ ] Error scenarios handled gracefully
- [ ] E2E test report created

**Testing Instructions:**
- Follow all test steps above
- Document results in e2e-test-report.md
- Take screenshots of each major step
- Save log outputs for debugging

**Commit Message Template:**
```
test(e2e): complete end-to-end workflow testing

- Test profile scraping and text extraction
- Verify S3 upload and DynamoDB updates
- Test search API from frontend
- Verify existing features (connections, messages, posts)
- Test error scenarios and graceful degradation
- Document all results in e2e-test-report.md
- All workflows functional with new architecture
```

**Estimated tokens:** ~6,000

---

### Task 5: Update Frontend Tests

**Goal:** Update or create frontend tests to cover the new search functionality and ensure no regressions.

**Files to Modify:**
- `tests/hooks/useSearchResults.test.ts` (if exists)
- `tests/services/lambdaApiService.test.ts` (if exists)

**Files to Create:**
- New test files for search components (if needed)

**Prerequisites:**
- Task 1 and Task 2 complete
- Understanding of existing test setup (Vitest)

**Implementation Steps:**

1. **Review existing search tests:**
   - Check if tests exist for search functionality
   - Identify tests that reference Pinecone (need updating)
   - Check test coverage for search-related code

2. **Update useSearchResults hook tests:**
   - Mock lambdaApiService.searchProfiles:
     ```typescript
     vi.mock('@/services/lambdaApiService', () => ({
       lambdaApiService: {
         searchProfiles: vi.fn(),
       },
     }));
     ```
   - Test placeholder response handling:
     ```typescript
     it('should handle placeholder search response', async () => {
       const mockResponse = {
         success: true,
         message: 'Search functionality is currently unavailable',
         results: [],
         total: 0,
       };

       (lambdaApiService.searchProfiles as any).mockResolvedValue(mockResponse);

       const { result } = renderHook(() => useSearchResults());
       await act(async () => {
         await result.current.searchProfiles({ query: 'test' });
       });

       expect(result.current.results).toEqual([]);
       expect(result.current.infoMessage).toBe('Search functionality is currently unavailable');
       expect(result.current.error).toBeNull();
     });
     ```

3. **Update lambdaApiService tests:**
   - Test searchProfiles method:
     ```typescript
     it('should call search API endpoint', async () => {
       const mockResponse = {
         data: {
           success: true,
           results: [],
           total: 0,
           message: 'Placeholder response',
         },
       };

       mockAxios.post.mockResolvedValue(mockResponse);

       const result = await lambdaApiService.searchProfiles('software engineer');

       expect(mockAxios.post).toHaveBeenCalledWith('search', {
         query: 'software engineer',
         filters: undefined,
         limit: 10,
         offset: 0,
       });

       expect(result.success).toBe(true);
       expect(result.results).toEqual([]);
     });
     ```

4. **Test error handling:**
   - Test 400 error (invalid query):
     ```typescript
     it('should handle 400 error', async () => {
       mockAxios.post.mockRejectedValue({
         response: { status: 400, data: { error: 'query is required' } },
       });

       const result = await lambdaApiService.searchProfiles('');

       expect(result.success).toBe(false);
       expect(result.message).toContain('query is required');
     });
     ```
   - Test 401 error (authentication failure)
   - Test 500 error (server error)

5. **Remove Pinecone-specific tests:**
   - Delete or update tests that reference Pinecone
   - Remove tests for vector similarity, semantic search, etc.

6. **Run all tests:**
   ```bash
   npm run test
   ```
   - Verify all tests pass
   - Verify no Pinecone references in test output

7. **Update test coverage:**
   - Ensure search-related code has adequate coverage
   - Aim for >70% coverage on critical paths

**Verification Checklist:**
- [ ] useSearchResults hook tests updated
- [ ] lambdaApiService tests updated
- [ ] Error handling tests added
- [ ] Pinecone-specific tests removed
- [ ] All tests passing
- [ ] Test coverage adequate

**Testing Instructions:**
- Run tests:
  ```bash
  npm run test
  # All tests should pass
  ```
- Run with coverage:
  ```bash
  npm run test -- --coverage
  # Check coverage for search-related files
  ```

**Commit Message Template:**
```
test(search): update frontend tests for placeholder API

- Update useSearchResults hook tests
- Update lambdaApiService tests
- Add tests for placeholder response handling
- Add error handling tests (400, 401, 500)
- Remove Pinecone-specific tests
- All tests passing with adequate coverage
```

**Estimated tokens:** ~5,000

---

### Task 6: Final Verification and Documentation

**Goal:** Perform final verification that all refactor goals are met and update documentation.

**Files to Create:**
- `Migration/docs/refactor-completion-report.md` - Final refactor summary

**Files to Modify:**
- `README.md` (if not done in Phase 1)

**Prerequisites:**
- All previous tasks and phases complete

**Implementation Steps:**

1. **Verify all Phase goals met:**
   - **Phase 1:** Pinecone code removed (grep search returns zero)
   - **Phase 2:** Text extraction working (test with real profile)
   - **Phase 3:** S3 upload working (files in S3)
   - **Phase 4:** Search API deployed (test endpoint)
   - **Phase 5:** Frontend integration complete (test search UI)

2. **Run comprehensive verification:**
   ```bash
   # 1. No Pinecone references
   grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration .
   # Expected: Zero results

   # 2. Application builds
   npm run build
   # Expected: Success

   # 3. Tests pass
   npm run test
   # Expected: All pass

   # 4. Puppeteer backend starts
   cd puppeteer-backend && npm start
   # Expected: Server running on port 3001

   # 5. S3 has profile text files
   aws s3 ls s3://bucket-name/profiles/
   # Expected: JSON files listed

   # 6. Search API responds
   curl -X POST {api-url}/search \
     -H "Authorization: Bearer {jwt}" \
     -H "Content-Type: application/json" \
     -d '{"query": "test"}'
   # Expected: 200 OK with placeholder response
   ```

3. **Create refactor completion report:**
   - Document:
     - All phases completed
     - Files deleted, modified, created (summary)
     - New architecture diagram
     - Testing results
     - Known limitations
     - Future enhancements
     - Migration checklist (all items checked)

4. **Update README.md (if not done in Phase 1):**
   - Update architecture description
   - Remove Pinecone references
   - Add placeholder search explanation
   - Update prerequisites (remove Pinecone API key)
   - Update Quick Start guide

5. **Create migration summary:**
   - Total LOC deleted
   - Total LOC added
   - Number of files changed
   - Time spent per phase
   - Challenges encountered and solutions

6. **Verify documentation completeness:**
   - All phase READMEs complete
   - E2E test report created
   - Refactor completion report created
   - Code comments updated
   - API documentation updated

**Verification Checklist:**
- [ ] All phase goals verified complete
- [ ] Comprehensive verification tests pass
- [ ] Refactor completion report created
- [ ] README.md updated (if needed)
- [ ] Migration summary documented
- [ ] All documentation complete and accurate

**Testing Instructions:**
- Complete all verification steps above
- Review all documentation for accuracy
- Ensure no outdated references to Pinecone

**Commit Message Template:**
```
docs(refactor): complete refactor verification and documentation

- Verify all 5 phases complete
- Run comprehensive verification tests
- Create refactor completion report
- Update documentation
- Document known limitations and future work
- LinkedIn Advanced Search refactor complete
```

**Estimated tokens:** ~4,000

---

## Phase Verification

**How to verify entire Phase 5 is complete:**

1. **Verify frontend builds:**
   ```bash
   npm run build
   # Expected: Build successful, no errors
   ```

2. **Verify frontend tests pass:**
   ```bash
   npm run test
   # Expected: All tests pass
   ```

3. **Verify search UI functional:**
   - Open app in browser: `http://localhost:5173`
   - Navigate to search page
   - Enter query and submit
   - Verify info message displays
   - Verify no console errors

4. **Verify end-to-end workflow:**
   - Scrape profile → verify text extracted
   - Check S3 → verify JSON file uploaded
   - Check DynamoDB → verify S3 URL saved
   - Call search API → verify placeholder response

5. **Verify no Pinecone references:**
   ```bash
   grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration .
   # Expected: Zero results
   ```

6. **Verify documentation complete:**
   - All phase files exist
   - E2E test report exists
   - Refactor completion report exists
   - README updated

**Integration points to test:**
- Frontend → Search API (placeholder)
- Frontend → Puppeteer backend (scraping)
- Puppeteer → S3 (text upload)
- Puppeteer → DynamoDB (metadata)

**Known limitations or technical debt introduced:**
- Search returns empty results (placeholder)
- No actual search functionality until external system integrated
- Frontend may need UX improvements for "coming soon" messaging

---

**Previous Phase:** [Phase 4: Placeholder Search API Implementation](./Phase-4.md)

**Next:** Review [README.md](./README.md) for complete migration overview
