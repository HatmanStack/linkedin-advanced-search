# Phase 1: Auth + Search Feature Tests

## Phase Goal

Implement comprehensive unit and integration tests for the two priority feature modules: **Auth** and **Search**. These are the highest-priority features as auth is foundational to the application and search is core functionality.

**Success Criteria:**
- Auth feature has unit tests for all components, hooks, and services
- Search feature has unit tests for all components and hooks
- Integration tests cover complete auth flows (sign in, sign up, sign out)
- Integration tests cover search submission flow
- All tests pass with `npm test`
- Coverage for auth and search features reaches 80%+

**Estimated Tokens:** ~45,000

## Prerequisites

- Phase 0 complete (test infrastructure established)
- All mock modules functional
- `renderWithProviders` utility working
- Vitest and Testing Library configured

---

## Tasks

### Task 1: Auth Context Unit Tests

**Goal:** Test the AuthContext provider and useAuth hook in isolation, covering all authentication states and methods.

**Files to Create:**
- `frontend/__tests__/features/auth/AuthContext.test.tsx` - Context provider tests

**Prerequisites:**
- Cognito service mock available
- renderWithProviders utility available
- App config mock for `isCognitoConfigured` flag

**Implementation Steps:**
- Import the AuthProvider and useAuth hook from the auth feature
- Create a test consumer component to access context values
- Test the following scenarios:
  - Initial loading state (should show loading=true initially)
  - Authenticated state (when Cognito returns a user)
  - Unauthenticated state (when Cognito returns null)
  - signIn success flow (mock returns user, state updates)
  - signIn failure flow (mock returns error)
  - signUp success flow with Cognito configured (shows verification needed)
  - signUp success flow without Cognito (auto-signs in with mock user)
  - signOut flow (clears user state)
  - getToken returns token when authenticated
  - getToken returns null when unauthenticated
  - Email validation on signIn/signUp (invalid email returns error)
  - confirmSignUp flow (only available when Cognito configured)
  - resendConfirmationCode flow
  - forgotPassword and confirmPassword flows

**Key Testing Patterns:**
- Use `act()` for state updates
- Use `waitFor()` for async operations
- Configure mocks before rendering
- Reset mocks between tests

**Verification Checklist:**
- [ ] All auth context states tested (loading, authenticated, unauthenticated)
- [ ] All auth methods tested (signIn, signUp, signOut, getToken)
- [ ] Cognito-specific methods tested when isCognitoConfigured=true
- [ ] Mock user mode tested when isCognitoConfigured=false
- [ ] Error handling tested for all methods
- [ ] Email validation tested

**Testing Instructions:**
- Run `npm test -- AuthContext` to run only these tests
- Verify all tests pass
- Check coverage report shows AuthContext.tsx covered

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

test(auth): add AuthContext unit tests

Test all authentication states and methods
Cover Cognito and mock user modes
Test error handling and validation
```

---

### Task 2: Cognito Service Unit Tests

**Goal:** Test the CognitoAuthService class methods with mocked Cognito SDK.

**Files to Create:**
- `frontend/__tests__/features/auth/cognitoService.test.ts` - Service layer tests

**Prerequisites:**
- Task 1 complete (patterns established)
- Understanding of amazon-cognito-identity-js library structure

**Implementation Steps:**
- Mock the entire `amazon-cognito-identity-js` module
- Create mocks for CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserSession
- Test CognitoAuthService static methods:
  - signUp: success case, error case, with optional name fields
  - signIn: success case, failure case, newPasswordRequired challenge
  - signOut: clears session
  - getCurrentUser: returns user when session valid, null when invalid
  - getCurrentUserToken: returns JWT when authenticated
  - confirmSignUp: success and error cases
  - resendConfirmationCode: success and error cases
  - forgotPassword: success and error cases
  - confirmPassword: success and error cases

**Mocking Strategy:**
- Mock the CognitoUserPool constructor to return controllable mock
- Mock CognitoUser methods (authenticateUser, getUserAttributes, etc.)
- Control callback invocations to simulate success/failure
- Mock session object with getIdToken().payload.sub and getJwtToken()

**Verification Checklist:**
- [ ] All CognitoAuthService static methods tested
- [ ] Success and failure paths covered for each method
- [ ] Callback-based SDK properly mocked
- [ ] User data extraction tested
- [ ] Session validation tested

**Testing Instructions:**
- Run `npm test -- cognitoService` to run only these tests
- Verify coverage shows cognitoService.ts at 80%+

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

test(auth): add CognitoAuthService unit tests

Test all Cognito SDK integration methods
Mock callback-based authentication flow
Cover error handling and edge cases
```

---

### Task 3: ProtectedRoute Component Tests

**Goal:** Test the ProtectedRoute component's routing behavior based on auth state.

**Files to Create:**
- `frontend/__tests__/features/auth/ProtectedRoute.test.tsx` - Component tests

**Prerequisites:**
- AuthContext mock/test utilities available
- React Router MemoryRouter setup

**Implementation Steps:**
- Create tests for ProtectedRoute with different auth states
- Test scenarios:
  - When loading=true, shows loading indicator
  - When user=null, redirects to /auth
  - When user exists, renders children
- Use MemoryRouter to test navigation behavior
- Mock the useAuth hook to control auth state

**Testing Patterns:**
- Wrap ProtectedRoute in MemoryRouter with initialEntries
- Use Routes and Route components from react-router-dom
- Check for redirect by examining current location
- Use screen.getByText for loading state

**Verification Checklist:**
- [ ] Loading state renders loading indicator
- [ ] Unauthenticated redirects to /auth
- [ ] Authenticated renders children
- [ ] Navigate component used correctly (replace=true)

**Testing Instructions:**
- Run `npm test -- ProtectedRoute` to run these tests
- Verify routing behavior is correct

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

test(auth): add ProtectedRoute component tests

Test route protection based on auth state
Verify redirect behavior for unauthenticated users
Test loading state rendering
```

---

### Task 4: Auth Page Integration Tests

**Goal:** Test the Auth page component with full sign-in and sign-up user flows.

**Files to Create:**
- `frontend/__tests__/features/auth/Auth.integration.test.tsx` - Page integration tests

**Prerequisites:**
- All auth mocks configured
- renderWithProviders working with Router

**Implementation Steps:**
- Test the complete Auth page user experience
- Sign In flow tests:
  - Renders sign in form by default
  - User can enter email and password
  - Submitting form calls signIn method
  - Shows success toast and navigates on success
  - Shows error toast on failure
  - Password visibility toggle works
- Sign Up flow tests:
  - Can switch to sign up tab
  - Renders all sign up fields (first name, last name, email, password)
  - Submitting form calls signUp method
  - Shows verification view when Cognito configured
  - Shows success toast and navigates when mock mode
- Verification flow tests (when Cognito configured):
  - Verification form renders with email prefilled
  - Can enter verification code
  - Submit calls confirmSignUp
  - Can resend code
  - Success navigates back to sign in
- Demo mode banner shows when Cognito not configured

**Testing Patterns:**
- Use userEvent for form interactions
- Use waitFor for async state updates
- Mock useNavigate to verify navigation
- Mock useToast to verify toast calls

**Verification Checklist:**
- [ ] Sign in happy path works end-to-end
- [ ] Sign up happy path works end-to-end
- [ ] Error states display correctly
- [ ] Tab switching works
- [ ] Verification flow works (Cognito mode)
- [ ] Demo mode indicator shows appropriately

**Testing Instructions:**
- Run `npm test -- Auth.integration` to run integration tests
- Verify all user flows pass

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

test(auth): add Auth page integration tests

Test complete sign in and sign up flows
Verify form interactions and validation
Test verification flow for Cognito mode
```

---

### Task 5: useSearchResults Hook Tests

**Goal:** Test the useSearchResults custom hook in isolation.

**Files to Create:**
- `frontend/__tests__/features/search/useSearchResults.test.ts` - Hook unit tests

**Prerequisites:**
- API service mocks available
- renderHook utility from Testing Library

**Implementation Steps:**
- Use renderHook to test the hook in isolation
- Mock dependencies:
  - puppeteerApiService.performLinkedInSearch
  - useLocalStorage (or actual localStorage)
  - connectionChangeTracker
- Test scenarios:
  - Initial state (empty results, no loading, no error)
  - searchLinkedIn sets loading to true during request
  - searchLinkedIn updates infoMessage on success
  - searchLinkedIn sets error on failure
  - markAsVisited updates visitedLinks state
  - clearResults empties results array
  - clearVisitedLinks empties visitedLinks object
  - Results persist to localStorage

**Hook Testing Pattern:**
```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import useSearchResults from '@/features/search/hooks/useSearchResults';

const { result } = renderHook(() => useSearchResults());

await act(async () => {
  await result.current.searchLinkedIn(searchData);
});

expect(result.current.loading).toBe(false);
```

**Verification Checklist:**
- [ ] All hook return values tested
- [ ] Async search operation tested
- [ ] Error handling tested
- [ ] localStorage integration tested
- [ ] connectionChangeTracker integration tested

**Testing Instructions:**
- Run `npm test -- useSearchResults` to run hook tests
- Verify coverage shows hook file at 80%+

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

test(search): add useSearchResults hook tests

Test search execution and state management
Verify localStorage persistence
Test error handling and loading states
```

---

### Task 6: ResearchResultsCard Component Tests

**Goal:** Test the ResearchResultsCard component rendering and interactions.

**Files to Create:**
- `frontend/__tests__/features/search/ResearchResultsCard.test.tsx` - Component tests

**Prerequisites:**
- renderWithProviders available
- sessionStorage mock available

**Implementation Steps:**
- Test component rendering in different states:
  - Returns null when not researching and no results
  - Shows loading spinner when isResearching=true
  - Shows research content when sessionStorage has data
  - Shows clear button when results present
- Test interactions:
  - Clear button calls onClear and clears local state
- Test ReactMarkdown rendering (basic validation that content appears)

**Component Props:**
- isResearching: boolean
- onClear: () => void

**Verification Checklist:**
- [ ] Empty state returns null
- [ ] Loading state shows spinner
- [ ] Results state shows markdown content
- [ ] Clear button triggers callback
- [ ] SessionStorage integration works

**Testing Instructions:**
- Run `npm test -- ResearchResultsCard` to run these tests
- Verify component renders correctly in all states

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

test(search): add ResearchResultsCard component tests

Test conditional rendering based on research state
Verify sessionStorage integration
Test clear functionality
```

---

### Task 7: Search Flow Integration Tests

**Goal:** Test the search functionality within the Dashboard context.

**Files to Create:**
- `frontend/__tests__/features/search/search.integration.test.tsx` - Integration tests

**Prerequisites:**
- All search-related mocks configured
- Dashboard component structure understood

**Implementation Steps:**
- Test search flow within the NewConnectionsTab context:
  - Search form renders with correct fields
  - Submitting search form triggers API call
  - Loading state shows during search
  - Results update after successful search
  - Error state shows on failure
  - Info message displays when returned
- Test search + connections refresh flow:
  - After search, connections list refreshes
  - connectionChangeTracker marks search as changed

**Testing Approach:**
- May need to test NewConnectionsTab component directly rather than full Dashboard
- Mock all API services
- Use userEvent for form interactions

**Verification Checklist:**
- [ ] Search form submission works
- [ ] Loading state displays during search
- [ ] Success path updates state correctly
- [ ] Error path shows error message
- [ ] Connections refresh after search

**Testing Instructions:**
- Run `npm test -- search.integration` to run integration tests
- Verify complete search flow works

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

test(search): add search flow integration tests

Test search form submission and API integration
Verify loading and error states
Test connections refresh after search
```

---

### Task 8: Shared Hook Tests (useLocalStorage)

**Goal:** Test the shared useLocalStorage hook used by search and other features.

**Files to Create:**
- `frontend/__tests__/shared/hooks/useLocalStorage.test.ts` - Hook tests

**Prerequisites:**
- localStorage mock functional
- renderHook utility available

**Implementation Steps:**
- Test useLocalStorage hook:
  - Returns initial value when localStorage is empty
  - Returns stored value when localStorage has data
  - setValue updates state and localStorage
  - setValue with function callback works
  - removeValue clears localStorage and resets to initial
  - Storage event listener updates state from external changes
  - Handles JSON parse errors gracefully
  - Handles localStorage errors gracefully

**Verification Checklist:**
- [ ] Initial value behavior tested
- [ ] setValue function tested (value and callback forms)
- [ ] removeValue function tested
- [ ] Storage event synchronization tested
- [ ] Error handling tested

**Testing Instructions:**
- Run `npm test -- useLocalStorage` to run hook tests
- Verify all localStorage scenarios covered

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

test(shared): add useLocalStorage hook tests

Test localStorage read/write operations
Verify cross-tab synchronization
Test error handling for malformed data
```

---

## Phase Verification

**Overall Phase 1 Completion Criteria:**

1. **Auth Tests Complete**
   - AuthContext.test.tsx passes all tests
   - cognitoService.test.ts passes all tests
   - ProtectedRoute.test.tsx passes all tests
   - Auth.integration.test.tsx passes all tests

2. **Search Tests Complete**
   - useSearchResults.test.ts passes all tests
   - ResearchResultsCard.test.tsx passes all tests
   - search.integration.test.tsx passes all tests

3. **Shared Utilities Tested**
   - useLocalStorage.test.ts passes all tests

4. **Coverage Target**
   - `frontend/src/features/auth/` at 80%+ coverage
   - `frontend/src/features/search/` at 80%+ coverage
   - Run `npm run test:coverage` to verify

**Test Run Verification:**
```bash
cd frontend
npm test
npm run test:coverage
```

All tests should pass, and coverage report should show auth and search features at 80%+.

**Integration Points:**
- Auth tests integrate with Cognito mock
- Search tests integrate with API service mocks
- Both features use shared hooks (useLocalStorage)

**Known Limitations:**
- Some Radix UI components may require additional setup for portal rendering
- ReactMarkdown may need to be mocked or tested at a high level
- Deep Dashboard integration tests deferred to Phase 2 (will test connections/messages flows)
