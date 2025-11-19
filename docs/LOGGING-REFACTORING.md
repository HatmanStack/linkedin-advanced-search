# Logging Refactoring - Production Readiness

## Overview

This document tracks the replacement of `console.log/error/warn` statements with a centralized, production-safe logging service.

## Problem

Found **140 console statements** across **24 files** that need to be replaced:

### Issues with console statements:
- ❌ Expose sensitive data in production logs
- ❌ Clutter production console
- ❌ No structured logging or context
- ❌ Can't be filtered by environment (dev/prod)
- ❌ No integration with error tracking services
- ❌ Performance impact in production

## Solution

Created `src/shared/utils/logger.ts` - a centralized logging service with:

✅ **Environment-aware logging** (dev vs production)
✅ **Structured logging** with context objects
✅ **Automatic sensitive data masking** (passwords, tokens, etc.)
✅ **Log levels**: debug, info, warn, error
✅ **Production-safe**: Only errors/warnings in prod
✅ **Extensible**: Ready for Sentry/Datadog integration

## Progress

### ✅ Completed (34/140 console statements)

| File | Statements | Status |
|------|------------|--------|
| `src/features/auth/contexts/AuthContext.tsx` | 12 | ✅ Done |
| `src/features/profile/contexts/UserProfileContext.tsx` | 9 | ✅ Done |
| `src/shared/utils/logger.ts` | 4 | ✅ N/A (legitimate console use) |
| **Total** | **25/140** | **18% complete** |

### ⏳ In Progress (0/140)

None currently.

### 📋 Remaining (115/140)

| File | Console Statements | Priority |
|------|-------------------|----------|
| `src/features/posts/contexts/PostComposerContext.tsx` | 25 | 🔴 High |
| `src/shared/services/lambdaApiService.ts` | 21 | 🔴 High |
| `src/pages/Dashboard.tsx` | 15 | 🔴 High |
| `src/pages/Profile.tsx` | 7 | 🟡 Medium |
| `src/shared/services/puppeteerApiService.ts` | 7 | 🟡 Medium |
| `src/features/posts/services/postsService.ts` | 5 | 🟡 Medium |
| `src/shared/hooks/useLocalStorage.ts` | 4 | 🟡 Medium |
| `src/features/posts/components/PostAIAssistant.tsx` | 4 | 🟡 Medium |
| `src/features/auth/services/cognitoService.ts` | 3 | 🟡 Medium |
| `src/features/workflow/services/healAndRestoreService.ts` | 3 | 🟡 Medium |
| `src/features/posts/components/PostEditor.tsx` | 3 | 🟡 Medium |
| `src/features/posts/components/NewPostTab.tsx` | 3 | 🟡 Medium |
| `src/config/appConfig.ts` | 2 | 🟢 Low |
| `src/features/connections/components/NewConnectionCard.tsx` | 2 | 🟢 Low |
| `src/shared/types/validators.ts` | 2 | 🟢 Low |
| `src/features/connections/components/NewConnectionsTab.tsx` | 2 | 🟢 Low |
| `src/features/workflow/contexts/HealAndRestoreContext.tsx` | 2 | 🟢 Low |
| `src/features/workflow/services/workflowProgressService.ts` | 2 | 🟢 Low |
| `src/shared/utils/errorHandling.ts` | 1 | 🟢 Low |
| `src/features/messages/components/MessageModal.tsx` | 1 | 🟢 Low |
| `src/features/messages/services/messageGenerationService.ts` | 1 | 🟢 Low |

## Migration Guide

### Step 1: Add Logger Import

```typescript
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('ModuleName');
```

### Step 2: Replace Console Statements

| Before | After |
|--------|-------|
| `console.log('User logged in:', user)` | `logger.info('User logged in', { user })` |
| `console.error('Failed to load:', error)` | `logger.error('Failed to load', { error })` |
| `console.warn('Deprecated method')` | `logger.warn('Deprecated method')` |
| `console.debug('Debug info:', data)` | `logger.debug('Debug info', { data })` |

### Key Differences

#### ❌ Old Way (Console)
```typescript
console.log('User authenticated:', {
  id: user.id,
  email: user.email,
  token: user.accessToken // ⚠️ Sensitive data exposed!
});
```

#### ✅ New Way (Logger)
```typescript
logger.info('User authenticated', {
  id: user.id,
  email: user.email,
  token: user.accessToken // ✅ Automatically redacted as "[REDACTED]"
});
```

## Logger API

### Basic Usage

```typescript
import { logger } from '@/shared/utils/logger';

// Info (dev only)
logger.info('User action completed', { userId: '123' });

// Error (dev and prod)
logger.error('API call failed', { error, endpoint: '/api/users' });

// Warning (dev and prod)
logger.warn('Deprecated feature used', { feature: 'oldMethod' });

// Debug (dev only)
logger.debug('Processing data', { itemCount: 50 });
```

### Scoped Logger (Recommended)

```typescript
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('UserService');

logger.info('Service initialized'); // Output: [UserService] Service initialized
logger.error('Operation failed', { error });
```

### Features

**1. Automatic Sensitive Data Masking**

Patterns automatically redacted:
- `password`, `token`, `secret`, `apiKey`
- `accessToken`, `refreshToken`, `sessionId`
- `ssn`, `creditCard`, `cvv`

**2. Environment-Aware**

```typescript
// Development: All logs shown
logger.debug('Dev info'); // ✅ Shown
logger.info('User action'); // ✅ Shown

// Production: Only warnings & errors
logger.debug('Dev info'); // ❌ Hidden
logger.info('User action'); // ❌ Hidden
logger.warn('Deprecation'); // ✅ Shown
logger.error('Critical'); // ✅ Shown
```

**3. Structured Context**

```typescript
logger.error('Database query failed', {
  query: 'SELECT * FROM users',
  duration: 5000,
  error: err,
  userId: currentUser.id
});

// Output format:
// [2025-11-19T12:34:56.789Z] ERROR Database query failed {"query":"SELECT * FROM users","duration":5000,"error":{...},"userId":"123"}
```

## Production Integration

The logger is designed to integrate with error tracking services:

```typescript
// In logger.ts - uncomment when ready:
if (!isDevelopment() && level === 'error') {
  // Send to Sentry
  Sentry.captureException(new Error(message), { extra: context });

  // Or Datadog
  datadogLogs.logger.error(message, context);
}
```

## Testing

The logger works in test environments:

```typescript
// In tests
import { logger } from '@/shared/utils/logger';

it('should log errors', () => {
  const spy = vi.spyOn(console, 'error');
  logger.error('Test error', { foo: 'bar' });
  expect(spy).toHaveBeenCalled();
});
```

## Completion Checklist

- [x] Create centralized logger (`src/shared/utils/logger.ts`)
- [x] Replace console statements in `AuthContext` (12 statements)
- [x] Replace console statements in `UserProfileContext` (9 statements)
- [ ] Replace console statements in `PostComposerContext` (25 statements)
- [ ] Replace console statements in `lambdaApiService` (21 statements)
- [ ] Replace console statements in `Dashboard` (15 statements)
- [ ] Replace console statements in remaining 18 files (53 statements)
- [ ] Run grep to verify all console statements replaced
- [ ] Test in development (logs visible)
- [ ] Test in production build (only errors/warnings)
- [ ] Update documentation
- [ ] (Optional) Integrate with Sentry/Datadog

## Verification Commands

```bash
# Count remaining console statements
grep -r "console\.(log|error|warn|info|debug)" src --exclude-dir=node_modules | wc -l

# Find files with console statements
grep -r "console\.(log|error|warn|info|debug)" src --exclude-dir=node_modules | cut -d: -f1 | sort | uniq

# Verify logger is imported
grep -r "from '@/shared/utils/logger'" src | wc -l
```

## Timeline

- **Started**: 2025-11-19
- **Completed**: TBD
- **Estimated time**: 2-3 hours for remaining 115 statements

## Notes

- Keep `logger.ts` internal console statements (they're legitimate for the logger itself)
- Use `logger.debug()` for verbose development logs
- Use `logger.info()` for user actions and state changes
- Use `logger.warn()` for recoverable issues
- Use `logger.error()` for failures and exceptions
- Always include context objects for better debugging

## Related PRs

- Initial implementation: #TBD
- Completion PR: #TBD
