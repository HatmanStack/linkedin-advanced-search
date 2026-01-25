# Phase 0: Foundation

## Phase Goal

Establish architecture decisions, shared patterns, and testing strategies that apply to all subsequent phases. This document serves as the "law" that all implementation work must follow.

**Estimated tokens:** ~5,000

---

## Architecture Decision Records (ADRs)

### ADR-001: JWT Validation Strategy

**Context:** The puppeteer backend parses JWTs without verifying signatures, allowing attackers to forge tokens with arbitrary user IDs.

**Decision:** Implement expiration + structure validation only (no signature verification).

**Rationale:**
- Full signature verification requires fetching Cognito JWKS, adding latency and complexity
- Tokens are issued by our Cognito pool with a 4-hour TTL (configured in SAM template)
- The puppeteer backend runs in a trusted network segment
- Expiration validation prevents replay of old tokens
- Structure validation ensures required claims exist

**Consequences:**
- Forged tokens with valid structure would be accepted if not expired
- Acceptable risk given network topology and use case
- Must configure 4-hour token TTL in Cognito (SAM template change)

---

### ADR-002: Credential Encryption for Healing State Files

**Context:** The `HealingManager` writes LinkedIn credentials to JSON files in plaintext for recovery after browser crashes.

**Decision:** Encrypt credentials using libsodium sealbox (consistent with frontend encryption).

**Rationale:**
- Reuses existing `crypto.js` infrastructure
- Same keypair used for frontend credential encryption
- At-rest encryption protects against filesystem access
- Decryption happens only when healing process consumes the file

**Consequences:**
- Healing worker must have access to private key (already required for normal operation)
- State files become opaque (cannot debug by reading JSON directly)
- Slight increase in file size due to encryption overhead

---

### ADR-003: React Query Adoption Strategy

**Context:** React Query is installed but unused. Custom hooks implement manual caching with sessionStorage.

**Decision:** Full migration of existing data-fetching hooks to React Query.

**Rationale:**
- Eliminates ~100 lines of manual cache management code
- Automatic background refetch on window focus
- Built-in retry logic with exponential backoff
- Consistent data fetching patterns across the app
- QueryClientProvider already configured in App.tsx

**Hooks to migrate:**
1. `useConnectionsManager` - Most complex, has custom cache layer
2. `useSearchResults` - Uses localStorage for persistence
3. `useConnections` - Simpler fetch pattern

**Consequences:**
- Remove `connectionCache.ts` and `connectionChangeTracker.ts` utilities
- Tests must mock React Query's QueryClient
- Background refetch may cause unexpected re-renders (configure staleTime appropriately)

---

### ADR-004: useMessageGeneration Decomposition

**Context:** Single 238-line hook manages workflow state, modal state, message history, and uses polling for user approval.

**Decision:** Split into 3 focused hooks + replace polling with callbacks.

**New hook structure:**
1. `useWorkflowStateMachine` - Workflow state transitions only
2. `useMessageModal` - Modal open/close, selected connection
3. `useMessageHistory` - Message history fetching and state

**Callback approach:**
- Modal component receives `onApprove` and `onReject` callbacks
- Parent hook responds to callbacks synchronously
- Eliminates `waitForUserApproval` polling loop

**Consequences:**
- More files to maintain (3 hooks vs 1)
- Clearer separation of concerns
- Testable in isolation
- ESLint exhaustive-deps violations eliminated

---

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **React Query v5** (`@tanstack/react-query`) - Data fetching and caching
- **Vitest** + React Testing Library - Unit testing
- **Radix UI** + Tailwind CSS - Components and styling

### Puppeteer Backend
- **Node.js v24** with ES Modules
- **Express** - HTTP server
- **libsodium-wrappers-sumo** - Encryption (already installed)
- **Vitest** - Unit testing

### AWS Backend
- **Python 3.13** runtime
- **AWS SAM** - Infrastructure as Code
- **pytest** + moto - Testing

---

## Shared Patterns

### Error Handling

**Frontend:**
```typescript
// Use React Query's error handling
const { data, error, isError } = useQuery({
  queryKey: ['connections', userId],
  queryFn: fetchConnections,
});

if (isError) {
  // error is typed, handle appropriately
}
```

**Puppeteer:**
```javascript
// Throw descriptive errors, let middleware handle response
if (!isValidToken(token)) {
  throw new ValidationError('Token expired or malformed');
}
```

### Logging

**Frontend:** Use `createLogger` from `@/shared/utils/logger`
**Puppeteer:** Use `logger` from `#utils/logger.js`

Log at appropriate levels:
- `error` - Failures requiring attention
- `warn` - Degraded but functional
- `info` - Normal operations worth noting
- `debug` - Development troubleshooting

### File Organization

**New hooks** go in feature directories:
```
frontend/src/features/{feature}/hooks/{hookName}.ts
frontend/src/features/{feature}/hooks/{hookName}.test.ts
```

**New utilities** go in shared:
```
puppeteer/src/shared/utils/{utilName}.js
puppeteer/src/shared/utils/{utilName}.test.js
```

---

## Testing Strategy

### Unit Tests

**Naming:** `{filename}.test.{ext}` co-located with source

**Mocking approach:**
- Mock external dependencies (API calls, localStorage)
- Don't mock internal utilities unless necessary
- Use `vi.mock()` hoisting for module mocks

**React hooks:**
```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Use in tests
const { result } = renderHook(() => useMyHook(), { wrapper: createWrapper() });
```

### Integration Tests

**Backend:** Use moto for AWS service mocking (except transact_write_items)

**CI compatibility:** No live cloud resources, no Docker dependencies

### Test Commands

```bash
# Frontend
cd frontend && npm test

# Puppeteer
cd puppeteer && npm test

# Backend
cd tests/backend && . .venv/bin/activate && python -m pytest unit/ -v
```

---

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): brief description

- Detail 1
- Detail 2
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or updating tests
- `docs` - Documentation only
- `chore` - Maintenance tasks

**Scopes:**
- `puppeteer` - Puppeteer backend changes
- `frontend` - Frontend changes
- `backend` - AWS Lambda changes
- `security` - Security-related changes

**Examples:**
```
feat(puppeteer): add JWT expiration validation

- Parse JWT payload and check exp claim
- Return 401 for expired tokens
- Add validateJwtExpiration utility function
```

```
refactor(frontend): migrate useConnections to React Query

- Replace manual useState/useEffect with useQuery
- Remove connectionCache utility
- Add queryKey for cache invalidation
```

---

## Deployment Strategy

### Frontend
- Build with Vite: `npm run build`
- Deploy static assets to hosting platform
- No changes to deployment for this remediation

### Puppeteer Backend
- Restart Node.js process to pick up changes
- No infrastructure changes required

### AWS Backend (SAM)
- `cd backend && sam build && sam deploy`
- Only Phase 1 requires SAM deployment (Cognito TTL change)

---

## Phase Dependencies

```
Phase-0 (this document)
    │
    ├── Phase-1: Security Hardening
    │   ├── Task 1: JWT validation (puppeteer)
    │   ├── Task 2: Cognito TTL config (SAM)
    │   └── Task 3: Credential encryption (puppeteer)
    │
    └── Phase-2: Frontend Modernization
        ├── Task 1: React Query setup patterns
        ├── Task 2: Migrate useConnections
        ├── Task 3: Migrate useConnectionsManager
        ├── Task 4: Migrate useSearchResults
        ├── Task 5: Decompose useMessageGeneration
        └── Task 6: Remove deprecated utilities
```

Phase 1 and Phase 2 are independent and could be executed in parallel by different engineers.
