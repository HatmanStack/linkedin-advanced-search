# Phase 0: Foundation

> **Purpose**: This phase contains architecture decisions, testing strategies, and shared conventions that apply to ALL subsequent phases. Read this document before starting any implementation work.

## Architecture Overview

### System Architecture (Preserved)

This refactoring preserves the existing three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Browser)                  │
│  - Vite + TypeScript + React 18                             │
│  - Radix UI Components + Tailwind CSS                       │
│  - React Query for state management                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP (localhost:3001)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           Puppeteer Backend (Local Node.js Server)          │
│  - Express.js REST API                                      │
│  - Puppeteer for LinkedIn automation                        │
│  - Runs on user's machine (not cloud)                       │
│  - Handles browser automation & local state                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ AWS SDK + HTTPS
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              AWS Lambda (Serverless Cloud)                   │
│  - Python 3.13 (6 functions) + Node.js 20 (1 function)     │
│  - DynamoDB for data persistence                            │
│  - S3 for profile text and screenshots                      │
│  - Cognito for authentication                               │
└─────────────────────────────────────────────────────────────┘
```

**Critical Distinction**: The Puppeteer backend is **NOT** serverless—it runs locally on the user's machine to perform LinkedIn automation. Only the data processing, storage, and AI features run in AWS Lambda.

## Architecture Decision Records (ADRs)

### ADR-001: Preserve Current Architecture

**Decision**: Keep the three-tier architecture (React → Local Puppeteer → AWS Lambda) unchanged.

**Rationale**:
- The architecture is sound and production-ready
- No users exist yet, but the design is validated
- Focus on code quality, not architectural changes
- LinkedIn automation requires local browser control (can't be serverless)

**Consequences**:
- Refactoring focuses on code quality within existing structure
- No infrastructure changes or migrations needed
- Deployment process remains the same

### ADR-002: Test-First Refactoring Approach

**Decision**: Write comprehensive unit tests BEFORE making any refactoring changes.

**Rationale**:
- Ensures existing functionality is preserved during refactoring
- Provides confidence in aggressive code cleanup
- Documents expected behavior through tests
- Catches regressions immediately

**Consequences**:
- Phase 1 (testing) is the largest and most critical phase
- Subsequent phases move faster with test safety net
- Initial investment pays off in reduced debugging time

### ADR-003: Tiered Test Coverage Strategy

**Decision**: Implement tiered test coverage based on code criticality:
- **High coverage (80-90%)**: Business logic, LinkedIn automation, Lambda APIs
- **Medium coverage (60-70%)**: Services, controllers, hooks, contexts
- **Basic coverage (40-50%)**: UI components, utilities, simple helpers

**Rationale**:
- Achieves 60-70% overall coverage goal efficiently
- Focuses effort on code that carries business risk
- UI components are less prone to silent failures
- Balances thoroughness with development speed

**Consequences**:
- Not all files will have equal test coverage
- Critical paths are well-protected
- Faster implementation than 100% coverage approach

### ADR-004: Mock External Dependencies

**Decision**: Mock all external services in unit tests:
- LinkedIn (no real browser automation in tests)
- AWS services (DynamoDB, S3, Cognito via moto)
- AI APIs (Google Gemini, OpenAI)
- Network requests (axios mocks)

**Rationale**:
- Unit tests must be fast and deterministic
- Avoid test flakiness from network/service issues
- No LinkedIn account bans from test automation
- Tests run offline without AWS credentials

**Consequences**:
- Integration tests (not in this scope) would validate real integrations
- Mocks must accurately represent real service behavior
- Test setup requires mock data fixtures

### ADR-005: Separate Test Configurations by Layer

**Decision**: Use different test frameworks optimized for each layer:
- **Frontend (React)**: Vitest + @testing-library/react + jsdom
- **Backend (Node.js)**: Vitest (consistent with frontend)
- **Lambda (Python)**: pytest + moto
- **Lambda (Node.js)**: Vitest

**Rationale**:
- Each layer has different testing needs
- Vitest provides fast, modern testing for JS/TS
- pytest is the Python standard with excellent AWS mocking
- Consistency where possible (Vitest for all JS/TS)

**Consequences**:
- Two test commands: `npm test` (JS/TS) and `pytest` (Python)
- Different assertion styles between JS and Python
- Engineers need familiarity with both ecosystems

### ADR-006: Conventional Commits for All Changes

**Decision**: Enforce conventional commit format: `type(scope): description`

**Rationale**:
- Clear, scannable git history
- Enables automatic changelog generation
- Communicates intent of each change
- Industry standard practice

**Consequences**:
- All commits must follow the format
- Easier to review and understand changes
- Supports semantic versioning in future

## Testing Strategy

### Testing Pyramid

```
        ┌─────────────┐
        │  E2E Tests  │  ← Out of scope (future work)
        │   (None)    │
        └─────────────┘
       ┌───────────────┐
       │ Integration   │  ← 16 existing tests (preserve)
       │     Tests     │
       └───────────────┘
    ┌─────────────────────┐
    │    Unit Tests       │  ← PRIMARY FOCUS (Phase 1)
    │  (Comprehensive)    │
    └─────────────────────┘
```

**Focus**: This refactoring creates comprehensive **unit tests**. Integration tests exist (16 files) and should be preserved but not expanded.

### Unit Test Principles

1. **Isolation**: Each test validates one unit (function, component, class)
2. **Independence**: Tests don't depend on each other or execution order
3. **Deterministic**: Same input always produces same output (no random data)
4. **Fast**: Unit test suite completes in under 30 seconds
5. **Readable**: Test names describe what's being tested and expected outcome

### Test File Organization

```
tests/
├── frontend/                    # React component and hook tests
│   ├── components/             # Component tests (*.test.tsx)
│   ├── hooks/                  # Hook tests (*.test.ts)
│   ├── services/               # Frontend service tests (*.test.ts)
│   └── contexts/               # Context tests (*.test.tsx)
│
├── backend/                     # Puppeteer backend tests
│   ├── controllers/            # Controller tests (*.test.js)
│   ├── services/               # Service tests (*.test.js)
│   └── utils/                  # Utility tests (*.test.js)
│
├── lambda/                      # Lambda function tests
│   ├── python/                 # Python Lambda tests (test_*.py)
│   └── nodejs/                 # Node.js Lambda tests (*.test.js)
│
├── integration/                 # Integration tests (preserve existing)
│   └── [existing files]
│
└── fixtures/                    # Shared test data
    ├── mock-profiles.json      # Sample LinkedIn profile data
    ├── mock-dynamodb.json      # Sample DynamoDB responses
    └── mock-s3.json            # Sample S3 responses
```

### Test Naming Conventions

**Component Tests** (React):
```typescript
describe('ComponentName', () => {
  describe('when condition', () => {
    it('should expected_behavior', () => {
      // Test implementation
    });
  });
});
```

**Service Tests** (Node.js):
```javascript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should expected_behavior when condition', () => {
      // Test implementation
    });
  });
});
```

**Lambda Tests** (Python):
```python
class TestLambdaFunctionName:
    def test_should_expected_behavior_when_condition(self):
        # Test implementation
```

### Mocking Strategy

#### Frontend Mocking
- **API calls**: Mock axios with `vi.mock('axios')`
- **React Router**: Mock `useNavigate`, `useParams` with `vi.mock('react-router-dom')`
- **Contexts**: Wrap components with mock context providers
- **LocalStorage/SessionStorage**: Mock with `vi.stubGlobal()`

#### Backend Mocking
- **Puppeteer**: Mock browser, page, and selectors
- **File system**: Mock `fs` module for file operations
- **AWS SDK**: Mock DynamoDB, S3, Cognito clients
- **External APIs**: Mock axios for Gemini/OpenAI calls

#### Lambda Mocking (Python)
- **AWS Services**: Use `moto` library for DynamoDB, S3, Cognito
- **Environment variables**: Mock via `os.environ` or `monkeypatch`
- **External APIs**: Use `responses` library for HTTP mocks

### Test Coverage Targets

| Layer | Files | Target Coverage | Priority |
|-------|-------|----------------|----------|
| LinkedIn Automation Services | ~10 files | 80-90% | High |
| Lambda Functions | 7 files | 80-90% | High |
| Backend Controllers | ~8 files | 70-80% | High |
| Backend Services | ~15 files | 70-80% | High |
| Frontend Services | ~8 files | 70-80% | Medium |
| React Hooks | ~12 files | 60-70% | Medium |
| React Components | ~60 files | 40-60% | Medium |
| Utilities | ~40 files | 50-60% | Low |

**Overall Target**: 60-70% code coverage across entire codebase

### Test Execution Commands

```bash
# Run all frontend/backend JS/TS tests
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with UI (visualize test results)
npm run test:ui

# Run Python Lambda tests
cd lambda-processing
pytest

# Run Python tests with coverage
pytest --cov=. --cov-report=html

# Run all tests (JS + Python)
npm test && cd lambda-processing && pytest
```

## Shared Patterns and Conventions

### File Naming Conventions

- **React Components**: PascalCase (e.g., `ConnectionList.tsx`)
- **Hooks**: camelCase with 'use' prefix (e.g., `useSearchResults.ts`)
- **Services**: camelCase with 'Service' suffix (e.g., `linkedinService.js`)
- **Utilities**: camelCase (e.g., `humanBehaviorManager.js`)
- **Types**: PascalCase (e.g., `ProfileTypes.ts`)
- **Constants**: UPPER_SNAKE_CASE in `constants.ts` files
- **Tests**: Match source file name with `.test` or `.spec` suffix

### Directory Structure Conventions

```
src/                           # Frontend source
  components/                  # React components
    ui/                       # Reusable UI primitives (Radix wrappers)
    [feature]/                # Feature-specific components
  hooks/                      # Custom React hooks
  services/                   # API and business logic services
  contexts/                   # React context providers
  types/                      # TypeScript type definitions
  utils/                      # Utility functions
  pages/                      # Route pages

puppeteer-backend/            # Local Node.js server
  src/
    controllers/              # Request handlers
    services/                 # Business logic
    routes/                   # Express routes
    utils/                    # Helper functions
    config/                   # Configuration management

lambda-processing/            # AWS Lambda functions
  [function-name]/            # One directory per Lambda
    lambda_function.py        # Python Lambda handler
    index.js                  # Node.js Lambda handler
    requirements.txt          # Python dependencies
```

### Code Style Conventions

**TypeScript/JavaScript**:
- Use ES6+ features (arrow functions, destructuring, async/await)
- Prefer `const` over `let`; never use `var`
- Use functional components for React (no class components)
- Use async/await instead of `.then()` chains
- 2-space indentation (enforced by ESLint)
- Single quotes for strings (enforced by ESLint)

**Python**:
- Follow PEP 8 style guide
- Use type hints for function signatures
- 4-space indentation
- Snake_case for functions and variables
- PascalCase for classes

**Naming Patterns**:
- Boolean variables: `is*`, `has*`, `should*` (e.g., `isLoading`, `hasError`)
- Event handlers: `handle*`, `on*` (e.g., `handleClick`, `onSubmit`)
- Async functions: descriptive verbs (e.g., `fetchProfiles`, `sendMessage`)

### Import Organization

**Frontend** (TypeScript):
```typescript
// 1. External libraries
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Internal modules (absolute imports)
import { ProfileService } from '@/services/profileService';
import { useAuth } from '@/hooks/useAuth';

// 3. Types
import type { Profile } from '@/types/profile';

// 4. Styles (if applicable)
import './styles.css';
```

**Backend** (Node.js ESM):
```javascript
// 1. External libraries
import express from 'express';
import axios from 'axios';

// 2. Internal modules (relative imports)
import { linkedinService } from '../services/linkedinService.js';
import { config } from '../config/index.js';

// 3. Constants
import { API_ENDPOINTS } from '../constants.js';
```

**Lambda** (Python):
```python
# 1. Standard library
import json
import os
from typing import Dict, Any

# 2. Third-party libraries
import boto3
from botocore.exceptions import ClientError

# 3. Local modules
from utils.response_builder import build_response
from config import DYNAMODB_TABLE
```

## Common Pitfalls to Avoid

### 1. Over-Mocking
❌ **Don't**: Mock every single function, even simple utilities
✅ **Do**: Only mock external dependencies (APIs, file system, databases)

### 2. Testing Implementation Details
❌ **Don't**: Test internal state or private methods
✅ **Do**: Test public APIs and observable behavior

### 3. Fragile Tests
❌ **Don't**: Use hardcoded IDs, specific CSS selectors, or brittle queries
✅ **Do**: Use accessible queries (getByRole, getByLabelText) and test IDs

### 4. Shared Test State
❌ **Don't**: Reuse variables across tests or rely on test execution order
✅ **Do**: Use `beforeEach` to reset state for each test

### 5. Async Test Issues
❌ **Don't**: Forget to await async operations or use arbitrary timeouts
✅ **Do**: Use proper async/await and waitFor utilities

### 6. Removing "Unused" Code Too Aggressively
❌ **Don't**: Delete code just because it's not imported (might be WIP or future use)
✅ **Do**: Verify code is truly unused across all layers before removal

### 7. Breaking Functional Behavior
❌ **Don't**: Refactor without tests or change logic while refactoring
✅ **Do**: Refactor only AFTER tests are passing, preserve behavior

### 8. Inconsistent Naming After Refactor
❌ **Don't**: Rename files without updating all imports
✅ **Do**: Use IDE refactoring tools or global find-replace with verification

## Success Criteria by Phase

### Phase 1 Success (Comprehensive Tests)
- ✅ 60-70% overall code coverage
- ✅ All critical business logic has 80%+ coverage
- ✅ Test suite completes in under 60 seconds
- ✅ Zero failing tests
- ✅ All mocks properly isolated (no real external calls)

### Phase 2 Success (Dead Code Removal)
- ✅ Zero unused imports across all files
- ✅ Zero unused variables or functions
- ✅ No commented-out code blocks
- ✅ All tests still passing after removal
- ✅ Build completes with no warnings

### Phase 3 Success (Code Organization)
- ✅ Consistent directory structure
- ✅ Logical file grouping by feature or layer
- ✅ Clear separation of concerns
- ✅ All imports updated to new paths
- ✅ All tests still passing after reorganization

### Phase 4 Success (Duplication, Patterns, Naming)
- ✅ No code duplication exceeding 5 lines
- ✅ Modern ES6+ patterns throughout
- ✅ Consistent naming conventions
- ✅ All async code uses async/await
- ✅ Functional React components only
- ✅ All tests still passing

## Tools and Resources

### Testing Tools
- **Vitest**: [https://vitest.dev/](https://vitest.dev/)
- **Testing Library**: [https://testing-library.com/](https://testing-library.com/)
- **pytest**: [https://docs.pytest.org/](https://docs.pytest.org/)
- **moto**: [https://docs.getmoto.org/](https://docs.getmoto.org/)

### Code Quality Tools
- **ESLint**: [https://eslint.org/](https://eslint.org/)
- **TypeScript**: [https://www.typescriptlang.org/](https://www.typescriptlang.org/)

### AWS Testing
- **boto3**: [https://boto3.amazonaws.com/v1/documentation/api/latest/index.html](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)
- **AWS SDK Mock (JS)**: [https://github.com/m-radzikowski/aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock)

### Reference Documentation
- **React Testing Guide**: [https://react.dev/learn/testing](https://react.dev/learn/testing)
- **Node.js Testing Best Practices**: [https://github.com/goldbergyoni/nodebestpractices#testing](https://github.com/goldbergyoni/nodebestpractices#testing)
- **Conventional Commits**: [https://www.conventionalcommits.org/](https://www.conventionalcommits.org/)

---

**Next Steps**: Proceed to [Phase 1: Comprehensive Test Suite](./Phase-1.md)
