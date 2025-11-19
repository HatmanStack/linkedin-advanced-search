# Proposed Structure - Phase 3

**Date**: 2025-11-19
**Branch**: `claude/phase-3-017wq1avxNX41bc7teDSp6aB`
**Purpose**: Detailed proposed directory structure for frontend, backend, and Lambda reorganization

## Overview

This document presents the proposed directory structure for the LinkedIn Advanced Search codebase after Phase 3 reorganization. The structure follows:
- **Frontend**: Feature-based organization with shared layer
- **Backend**: Domain-driven organization
- **Lambda**: Standardized structure with shared utilities

---

## 1. Proposed Frontend Structure

### Directory Tree
```
src/
├── features/                           # Feature-based organization
│   ├── auth/                          # Authentication feature
│   │   ├── components/
│   │   │   └── ProtectedRoute.tsx
│   │   ├── services/
│   │   │   └── cognitoService.ts
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   └── index.ts                   # Barrel export
│   │
│   ├── connections/                   # Connection management feature
│   │   ├── components/
│   │   │   ├── ConnectionCard.tsx
│   │   │   ├── ConnectionsTab.tsx
│   │   │   ├── ConnectionFilters.tsx
│   │   │   ├── VirtualConnectionList.tsx
│   │   │   ├── NewConnectionCard.tsx
│   │   │   └── NewConnectionsTab.tsx
│   │   ├── hooks/
│   │   │   └── useConnections.ts
│   │   ├── services/
│   │   │   └── connectionDataContextService.ts
│   │   ├── utils/
│   │   │   ├── connectionCache.ts
│   │   │   ├── connectionChangeTracker.ts
│   │   │   └── connectionFiltering.ts
│   │   └── index.ts                   # Barrel export
│   │
│   ├── messages/                      # Messaging feature
│   │   ├── components/
│   │   │   ├── MessageModal.tsx
│   │   │   └── ConversationTopicPanel.tsx
│   │   ├── hooks/
│   │   │   └── useMessages.ts
│   │   ├── services/
│   │   │   └── messageGenerationService.ts
│   │   └── index.ts                   # Barrel export
│   │
│   ├── profile/                       # Profile management feature
│   │   ├── components/
│   │   │   └── (future profile components)
│   │   ├── hooks/
│   │   │   ├── useProfile.ts
│   │   │   └── useProfileInit.ts
│   │   ├── contexts/
│   │   │   └── UserProfileContext.tsx
│   │   └── index.ts                   # Barrel export
│   │
│   ├── posts/                         # LinkedIn posts feature
│   │   ├── components/
│   │   │   ├── PostEditor.tsx
│   │   │   ├── PostAIAssistant.tsx
│   │   │   └── NewPostTab.tsx
│   │   ├── hooks/
│   │   │   └── useDrafts.ts
│   │   ├── services/
│   │   │   └── postsService.ts
│   │   ├── contexts/
│   │   │   └── PostComposerContext.tsx
│   │   └── index.ts                   # Barrel export
│   │
│   ├── search/                        # Search feature
│   │   ├── components/
│   │   │   └── ResearchResultsCard.tsx
│   │   ├── hooks/
│   │   │   └── useSearchResults.ts
│   │   └── index.ts                   # Barrel export
│   │
│   └── workflow/                      # Workflow and healing feature
│       ├── components/
│       │   ├── HealAndRestoreModal.tsx
│       │   ├── ProgressIndicator.tsx
│       │   └── StatusPicker.tsx
│       ├── hooks/
│       │   ├── useWorkflowProgress.ts
│       │   └── useProgressTracker.ts
│       ├── services/
│       │   ├── healAndRestoreService.ts
│       │   └── workflowProgressService.ts
│       ├── contexts/
│       │   └── HealAndRestoreContext.tsx
│       └── index.ts                   # Barrel export
│
├── shared/                            # Shared/common code
│   ├── components/
│   │   ├── ui/                       # Radix UI wrappers (keep existing structure)
│   │   │   ├── accordion.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── button.tsx
│   │   │   ├── [... 40+ UI components]
│   │   │   └── use-toast.ts
│   │   └── common/
│   │       ├── Input.tsx
│   │       └── index.ts
│   │
│   ├── hooks/                        # Shared hooks
│   │   ├── useApi.ts
│   │   ├── useErrorHandler.ts
│   │   ├── useLocalStorage.ts
│   │   ├── use-mobile.ts
│   │   ├── use-toast.ts
│   │   └── index.ts
│   │
│   ├── services/                     # Shared services
│   │   ├── lambdaApiService.ts
│   │   ├── puppeteerApiService.ts
│   │   └── index.ts
│   │
│   ├── utils/                        # Utility functions
│   │   ├── crypto.ts
│   │   ├── errorHandling.ts
│   │   ├── userUtils.ts
│   │   └── index.ts
│   │
│   ├── types/                        # Shared type definitions
│   │   ├── index.ts
│   │   ├── validators.ts
│   │   ├── guards.ts
│   │   └── libsodium-wrappers-sumo.d.ts
│   │
│   └── lib/                          # Library utilities
│       └── utils.ts
│
├── config/                            # Application configuration
│   ├── index.ts                      # Main config export
│   ├── api.ts                        # API endpoints and configuration
│   ├── aws.ts                        # AWS configuration (Cognito, etc.)
│   └── app.ts                        # App-level configuration
│
├── constants/                         # Application constants
│   ├── index.ts                      # Barrel export
│   ├── routes.ts                     # Route paths
│   ├── messages.ts                   # UI messages/strings
│   └── app.ts                        # App-level constants
│
├── pages/                             # Route pages (keep at root)
│   ├── Auth.tsx
│   ├── Dashboard.tsx
│   ├── Index.tsx
│   ├── NotFound.tsx
│   └── Profile.tsx
│
├── assets/                            # Static assets
├── styles/                            # Global styles
├── test-setup.ts                      # Test configuration
└── App.tsx                            # Main app component
```

### Import Examples (Before vs. After)

**Before (Current)**:
```typescript
import { ConnectionCard } from '@/components/ConnectionCard';
import { useConnections } from '@/hooks/useConnections';
import { connectionDataContextService } from '@/services/connectionDataContextService';
import { connectionCache } from '@/utils/connectionCache';
```

**After (Proposed)**:
```typescript
// Option 1: Direct imports
import { ConnectionCard } from '@/features/connections/components/ConnectionCard';
import { useConnections } from '@/features/connections/hooks/useConnections';

// Option 2: Barrel exports (preferred)
import {
  ConnectionCard,
  ConnectionsTab,
  useConnections,
  connectionDataContextService
} from '@/features/connections';
```

### TypeScript Path Aliases (Updated `tsconfig.json`)
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/features/*": ["./src/features/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/config/*": ["./src/config/*"],
      "@/constants/*": ["./src/constants/*"],
      "@/pages/*": ["./src/pages/*"]
    }
  }
}
```

### Barrel Export Example (`features/connections/index.ts`)
```typescript
// Components
export { ConnectionCard } from './components/ConnectionCard';
export { ConnectionsTab } from './components/ConnectionsTab';
export { ConnectionFilters } from './components/ConnectionFilters';
export { VirtualConnectionList } from './components/VirtualConnectionList';
export { NewConnectionCard } from './components/NewConnectionCard';
export { NewConnectionsTab } from './components/NewConnectionsTab';

// Hooks
export { useConnections } from './hooks/useConnections';

// Services
export { connectionDataContextService } from './services/connectionDataContextService';

// Utils
export { connectionCache } from './utils/connectionCache';
export { connectionChangeTracker } from './utils/connectionChangeTracker';
export { connectionFiltering } from './utils/connectionFiltering';
```

### Benefits
- **Discoverability**: All connection-related code in one place
- **Scalability**: Easy to add new features without cluttering root directories
- **Ownership**: Clear feature boundaries
- **Import Clarity**: Barrel exports reduce import verbosity
- **Testing**: Easier to test feature in isolation

---

## 2. Proposed Backend Structure

### Directory Tree
```
puppeteer-backend/
├── src/                               # All source code under src/
│   ├── domains/                      # Domain-driven organization
│   │   ├── linkedin/                 # LinkedIn automation domain
│   │   │   ├── services/
│   │   │   │   ├── linkedinService.js
│   │   │   │   ├── linkedinContactService.js
│   │   │   │   └── linkedinInteractionService.js
│   │   │   ├── controllers/
│   │   │   │   └── linkedinInteractionController.js
│   │   │   └── utils/
│   │   │       ├── contactProcessor.js
│   │   │       ├── linkCollector.js
│   │   │       ├── linkedinAuditLogger.js
│   │   │       └── linkedinErrorHandler.js
│   │   │
│   │   ├── profile/                  # Profile management domain
│   │   │   ├── services/
│   │   │   │   ├── profileInitService.js
│   │   │   │   └── textExtractionService.js
│   │   │   ├── controllers/
│   │   │   │   └── profileInitController.js
│   │   │   └── utils/
│   │   │       ├── profileInitMonitor.js
│   │   │       └── profileInitStateManager.js
│   │   │
│   │   ├── storage/                  # Storage domain (S3, DynamoDB)
│   │   │   ├── services/
│   │   │   │   ├── dynamoDBService.js
│   │   │   │   └── s3TextUploadService.js
│   │   │   └── utils/
│   │   │       └── s3Helpers.js
│   │   │
│   │   ├── automation/               # Browser automation domain
│   │   │   ├── services/
│   │   │   │   └── puppeteerService.js
│   │   │   └── utils/
│   │   │       ├── humanBehaviorManager.js
│   │   │       ├── interactionQueue.js
│   │   │       └── healingManager.js
│   │   │
│   │   ├── search/                   # Search domain
│   │   │   ├── controllers/
│   │   │   │   └── searchController.js
│   │   │   └── utils/
│   │   │       ├── searchRequestValidator.js
│   │   │       └── searchStateManager.js
│   │   │
│   │   └── workflow/                 # Workflow and healing domain
│   │       └── services/
│   │           └── healAndRestoreService.js
│   │
│   ├── shared/                       # Shared backend code
│   │   ├── config/                   # Configuration management
│   │   │   ├── index.js             # Main config export
│   │   │   ├── server.js            # Server configuration
│   │   │   ├── aws.js               # AWS SDK configuration
│   │   │   ├── linkedin.js          # LinkedIn automation config
│   │   │   ├── puppeteer.js         # Puppeteer browser config
│   │   │   ├── configInitializer.js
│   │   │   ├── configManager.js
│   │   │   └── configValidator.js
│   │   │
│   │   ├── constants/                # Shared constants
│   │   │   ├── index.js             # Barrel export
│   │   │   ├── selectors.js         # LinkedIn selectors
│   │   │   ├── messages.js          # Error/success messages
│   │   │   └── limits.js            # Rate limits, timeouts
│   │   │
│   │   ├── utils/                    # General utilities
│   │   │   ├── crypto.js
│   │   │   ├── fileHelpers.js
│   │   │   ├── logger.js
│   │   │   ├── randomHelpers.js
│   │   │   └── textFormatter.js
│   │   │
│   │   └── middleware/               # Express middleware
│   │       └── (future middleware)
│   │
│   ├── routes/                       # Express routes
│   │   ├── index.js                 # Main router
│   │   ├── linkedin.js              # LinkedIn routes
│   │   ├── profile.js               # Profile routes
│   │   └── search.js                # Search routes
│   │
│   └── server.js                     # Express app entry point
│
├── config/                            # External configuration files
├── schemas/                           # Validation schemas
└── scripts/                           # Utility scripts
```

### Import Examples (Before vs. After)

**Before (Current)**:
```javascript
import { linkedinService } from '../services/linkedinService.js';
import { linkedinContactService } from '../services/linkedinContactService.js';
import { contactProcessor } from '../utils/contactProcessor.js';
import { linkedinAuditLogger } from '../utils/linkedinAuditLogger.js';
```

**After (Proposed)**:
```javascript
import { linkedinService } from '../domains/linkedin/services/linkedinService.js';
import { linkedinContactService } from '../domains/linkedin/services/linkedinContactService.js';
import { contactProcessor } from '../domains/linkedin/utils/contactProcessor.js';
import { linkedinAuditLogger } from '../domains/linkedin/utils/linkedinAuditLogger.js';

// Or with barrel exports:
import {
  linkedinService,
  linkedinContactService,
  contactProcessor,
  linkedinAuditLogger
} from '../domains/linkedin/index.js';
```

### Benefits
- **Domain Clarity**: Related services, controllers, and utils grouped together
- **Separation of Concerns**: Clear boundaries between domains
- **Discoverability**: Easy to find all LinkedIn-related code
- **Scalability**: Can add new domains without cluttering root directories
- **Testing**: Easier to test domain in isolation

---

## 3. Proposed Lambda Structure

### Directory Tree
```
lambda-processing/
├── shared/                            # Shared Lambda utilities
│   ├── python/                       # Shared Python code
│   │   ├── __init__.py
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   ├── response_builder.py  # Common response formatting
│   │   │   ├── error_handler.py     # Common error handling
│   │   │   └── logger.py            # Common logging
│   │   ├── aws_clients/
│   │   │   ├── __init__.py
│   │   │   ├── dynamodb_client.py   # DynamoDB client factory
│   │   │   └── s3_client.py         # S3 client factory
│   │   └── config/
│   │       ├── __init__.py
│   │       ├── aws_config.py        # AWS resource names (tables, buckets)
│   │       └── constants.py         # Lambda constants
│   │
│   └── nodejs/                       # Shared Node.js code
│       ├── utils/
│       │   ├── responseBuilder.js
│       │   └── errorHandler.js
│       └── config/
│           └── awsConfig.js
│
├── linkedin-advanced-search-dynamodb-api-prod/
│   ├── lambda_function.py            # Main handler
│   ├── services/                     # Business logic (if complex)
│   │   └── (future services)
│   ├── utils/                        # Function-specific utilities
│   │   └── (function-specific utils)
│   ├── requirements.txt              # Python dependencies
│   ├── tests/                        # Lambda function tests
│   │   ├── test_lambda_function.py
│   │   └── fixtures/
│   └── README.md
│
├── linkedin-advanced-search-edge-processing-prod/
│   ├── lambda_function.py
│   ├── services/
│   ├── utils/
│   ├── requirements.txt
│   ├── tests/
│   │   ├── test_lambda_function.py
│   │   └── fixtures/
│   └── README.md
│
├── linkedin-advanced-search-llm-prod/
│   ├── lambda_function.py
│   ├── services/
│   ├── utils/
│   │   └── prompts.py               # Move prompts.py to utils/
│   ├── requirements.txt
│   ├── tests/
│   │   └── test_lambda_function.py
│   └── README.md
│
├── linkedin-advanced-search-placeholder-search-prod/
│   ├── index.js                      # Main handler (Node.js)
│   ├── services/
│   ├── utils/
│   ├── package.json
│   ├── tests/
│   │   └── index.test.js
│   └── README.md
│
├── linkedin-advanced-search-profile-api-prod/
│   ├── lambda_function.py
│   ├── services/
│   ├── utils/
│   ├── requirements.txt
│   ├── tests/
│   │   └── test_lambda_function.py
│   └── README.md
│
├── linkedin-advanced-search-profile-processing-dev/
│   ├── lambda_function.py
│   ├── services/
│   ├── utils/
│   ├── requirements.txt
│   ├── tests/
│   │   └── test_lambda_function.py
│   └── README.md
│
├── openai-webhook-handler/
│   ├── lambda_function.py
│   ├── services/
│   ├── utils/
│   ├── requirements.txt
│   ├── tests/
│   │   └── test_lambda_function.py
│   └── README.md
│
├── conftest.py                        # Shared pytest configuration
├── pytest.ini                         # Pytest configuration
├── requirements-test.txt              # Shared test dependencies
└── test_sanity.py                     # Sanity test
```

### Shared Utilities Examples

**`shared/python/utils/response_builder.py`**:
```python
def build_success_response(data, status_code=200):
    """Build standardized success response."""
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'success': True, 'data': data})
    }

def build_error_response(error_message, status_code=500):
    """Build standardized error response."""
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'success': False, 'error': error_message})
    }
```

**`shared/python/config/aws_config.py`**:
```python
import os

# DynamoDB Tables
CONNECTIONS_TABLE = os.environ.get('CONNECTIONS_TABLE', 'linkedin-connections')
PROFILES_TABLE = os.environ.get('PROFILES_TABLE', 'linkedin-profiles')

# S3 Buckets
PROFILE_TEXT_BUCKET = os.environ.get('PROFILE_TEXT_BUCKET', 'linkedin-profile-text')
SCREENSHOTS_BUCKET = os.environ.get('SCREENSHOTS_BUCKET', 'linkedin-screenshots')
```

### Import Examples (Lambda Functions)

**Before (Current)**:
```python
import json
import boto3

def lambda_handler(event, context):
    # Inline response building
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'success': True, 'data': data})
    }
```

**After (Proposed)**:
```python
import json
import boto3
from shared.python.utils.response_builder import build_success_response, build_error_response
from shared.python.config.aws_config import CONNECTIONS_TABLE

def lambda_handler(event, context):
    try:
        # Business logic
        return build_success_response(data)
    except Exception as e:
        return build_error_response(str(e), 500)
```

### Benefits
- **Code Reuse**: Eliminate duplication across Lambda functions
- **Consistency**: Standardized response formats and error handling
- **Maintainability**: Update shared code once, affects all functions
- **Testing**: Easier to test with shared fixtures and utilities

---

## 4. Configuration Consolidation

### Frontend Configuration

**`src/config/index.ts`**:
```typescript
export * from './api';
export * from './aws';
export * from './app';
```

**`src/config/api.ts`**:
```typescript
export const API_CONFIG = {
  PUPPETEER_BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  LAMBDA_API_URL: import.meta.env.VITE_LAMBDA_API_URL,
  REQUEST_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
};
```

**`src/config/aws.ts`**:
```typescript
export const AWS_CONFIG = {
  REGION: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  USER_POOL_ID: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  CLIENT_ID: import.meta.env.VITE_COGNITO_CLIENT_ID,
};
```

**`src/constants/index.ts`**:
```typescript
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  AUTH: '/auth',
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

export const DELAYS = {
  LINKEDIN_ACTION: 2000,
  API_RETRY: 1000,
  TOAST_DURATION: 3000,
};
```

### Backend Configuration

**`puppeteer-backend/src/shared/config/index.js`**:
```javascript
export { serverConfig } from './server.js';
export { awsConfig } from './aws.js';
export { linkedinConfig } from './linkedin.js';
export { puppeteerConfig } from './puppeteer.js';
```

**`puppeteer-backend/src/shared/constants/index.js`**:
```javascript
export const LINKEDIN_SELECTORS = {
  CONNECTIONS_LIST: '.mn-connection-card',
  MESSAGE_BUTTON: '.message-anywhere-button',
  // ... more selectors
};

export const RATE_LIMITS = {
  MAX_CONNECTIONS_PER_DAY: 100,
  MIN_DELAY_BETWEEN_ACTIONS: 2000,
  MAX_DELAY_BETWEEN_ACTIONS: 5000,
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};
```

### Lambda Configuration

**`lambda-processing/shared/python/config/aws_config.py`**:
```python
import os

# Environment
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')

# DynamoDB Tables
CONNECTIONS_TABLE = os.environ.get('CONNECTIONS_TABLE')
PROFILES_TABLE = os.environ.get('PROFILES_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')

# S3 Buckets
PROFILE_TEXT_BUCKET = os.environ.get('PROFILE_TEXT_BUCKET')
SCREENSHOTS_BUCKET = os.environ.get('SCREENSHOTS_BUCKET')

# Validation
if not CONNECTIONS_TABLE:
    raise ValueError('CONNECTIONS_TABLE environment variable is required')
```

---

## 5. Migration Checklist

### Frontend
- [ ] Create `src/features/` directory structure
- [ ] Create `src/shared/` directory structure
- [ ] Move auth components, services, contexts to `features/auth/`
- [ ] Move connections components, hooks, services, utils to `features/connections/`
- [ ] Move messages components, hooks, services to `features/messages/`
- [ ] Move profile hooks, contexts to `features/profile/`
- [ ] Move posts components, hooks, services, contexts to `features/posts/`
- [ ] Move search components, hooks to `features/search/`
- [ ] Move workflow components, hooks, services, contexts to `features/workflow/`
- [ ] Move shared components to `shared/components/` (except ui/)
- [ ] Move shared hooks to `shared/hooks/`
- [ ] Move shared services to `shared/services/`
- [ ] Move shared utils to `shared/utils/`
- [ ] Move shared types to `shared/types/`
- [ ] Create config files in `src/config/`
- [ ] Create constants files in `src/constants/`
- [ ] Create barrel exports for each feature
- [ ] Update TypeScript path aliases
- [ ] Update all imports
- [ ] Run tests and verify

### Backend
- [ ] Create `src/domains/` directory structure
- [ ] Create `src/shared/` directory structure
- [ ] Move LinkedIn services, controllers, utils to `domains/linkedin/`
- [ ] Move profile services, controllers, utils to `domains/profile/`
- [ ] Move storage services, utils to `domains/storage/`
- [ ] Move automation services, utils to `domains/automation/`
- [ ] Move search controllers, utils to `domains/search/`
- [ ] Move workflow services to `domains/workflow/`
- [ ] Move config files to `shared/config/`
- [ ] Create constants files in `shared/constants/`
- [ ] Move general utils to `shared/utils/`
- [ ] Update route imports
- [ ] Update all imports
- [ ] Run tests and verify

### Lambda
- [ ] Create `shared/python/` directory structure
- [ ] Create `shared/nodejs/` directory structure
- [ ] Extract common response builders to shared/python/utils/
- [ ] Extract common AWS clients to shared/python/aws_clients/
- [ ] Create shared config files
- [ ] Create `tests/` subdirectories in each Lambda function
- [ ] Move tests to respective `tests/` directories
- [ ] Update Lambda function imports to use shared utilities
- [ ] Run pytest and verify
- [ ] Test Lambda packaging (dry run)

---

## 6. Success Metrics

**After Migration**:
- ✅ All tests passing (282 tests, 0 failures)
- ✅ Build succeeds with no errors
- ✅ All imports resolve correctly
- ✅ No circular dependencies
- ✅ Improved code discoverability (features/domains clearly separated)
- ✅ Reduced import path length (with barrel exports)
- ✅ Centralized configuration (no scattered config)
- ✅ Eliminated magic numbers/strings (replaced with constants)

---

**Generated**: 2025-11-19
**Previous Document**: [Structure Audit](./structure-audit.md)
**Implementation**: Begin with [Task 2: Reorganize Frontend by Feature](../plans/Phase-3.md#task-2)
