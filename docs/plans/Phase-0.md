# Phase 0: Foundation

## Phase Goal

Establish the foundational decisions, patterns, and infrastructure that all subsequent phases will inherit. This phase produces no deployable code changes but creates the "law" that governs the entire refactor: architecture decision records, deployment script specifications, testing strategy, and shared conventions.

**Success Criteria:**
- All ADRs documented and approved
- Deployment script specification complete
- Testing strategy defined with mocking approach
- CI/CD workflow specification finalized
- Shared conventions documented

**Estimated Tokens:** ~15,000

## Prerequisites

- Access to the repository
- Familiarity with AWS SAM, React/Vite, and Python Lambda patterns
- Review of existing codebase structure (see README.md)

---

## Architecture Decision Records (ADRs)

### ADR-001: Monorepo Structure

**Status:** Accepted

**Context:** The codebase has grown organically with scattered directories (`src/`, `puppeteer-backend/`, `lambda-processing/`, `RAG-CloudStack/`). This makes deployment, testing, and onboarding difficult.

**Decision:** Adopt a flat monorepo structure with clear deployment boundaries:
- `frontend/` - React/Vite client (deploys to static hosting)
- `backend/` - Lambda functions + SAM (deploys to AWS)
- `puppeteer/` - Local automation server (runs locally)
- `tests/` - Centralized test suites
- `docs/` - Consolidated documentation
- `scripts/` - Utility scripts

**Consequences:**
- Clear ownership per directory
- Independent deployment pipelines
- Simplified CI/CD configuration
- Root `package.json` becomes orchestration-only

### ADR-002: Orchestration-Only Root Package.json

**Status:** Accepted

**Context:** With multiple deployment targets (frontend, backend, puppeteer), a monorepo can use npm workspaces or simple orchestration scripts.

**Decision:** Use orchestration-only approach (not npm workspaces):
```json
{
  "scripts": {
    "dev": "cd frontend && npm run dev",
    "dev:puppeteer": "cd puppeteer && npm run dev",
    "test": "npm run test:frontend && npm run test:backend && npm run test:puppeteer",
    "test:frontend": "cd frontend && npm test",
    "test:backend": "cd backend && npm run test",
    "test:puppeteer": "cd puppeteer && npm test",
    "lint": "npm run lint:frontend && npm run lint:backend && npm run lint:puppeteer",
    "lint:frontend": "cd frontend && npm run lint",
    "lint:backend": "cd backend && uvx ruff check lambdas",
    "lint:puppeteer": "cd puppeteer && npm run lint",
    "check": "npm run lint && npm run test",
    "deploy": "cd backend && npm run deploy"
  }
}
```

**Rationale:**
- Simpler than workspaces for mixed runtimes (Node.js + Python)
- Each subdirectory fully self-contained with own `node_modules`
- Explicit about what runs where
- Matches the pattern used in react-stocks

**Consequences:**
- No shared `node_modules` hoisting
- Must `cd` into directories for operations
- Each package manages its own dependencies

### ADR-003: Test Organization by Deployment Target

**Status:** Accepted

**Context:** Tests are currently scattered in `tests/` with mixed concerns. Need clear organization for CI/CD optimization.

**Decision:** Organize tests by deployment target with type subdivisions:
```
tests/
├── frontend/
│   ├── unit/          # Component, hook, utility tests
│   └── integration/   # Multi-component integration
├── backend/
│   ├── unit/          # Lambda handler unit tests
│   └── integration/   # Lambda integration with mocked AWS
├── puppeteer/
│   └── unit/          # Server route and service tests
├── e2e/               # Cross-system end-to-end tests
└── fixtures/          # Shared mock data
```

**Rationale:**
- CI can run `tests/backend/` only when `backend/` changes
- Clear ownership: test failure path indicates broken system
- `e2e/` sits at top level as it spans systems

**Consequences:**
- Tests must be migrated from current locations
- Import paths in tests must be updated
- CI workflow jobs map directly to test directories

### ADR-004: Python Lambdas Preserved

**Status:** Accepted

**Context:** Current Lambda functions are Python 3.13. Converting to Node.js TypeScript would provide uniformity but requires significant effort.

**Decision:** Keep Python Lambdas, restructure into `backend/lambdas/`:
```
backend/
├── lambdas/
│   ├── edge-processing/
│   │   ├── lambda_function.py
│   │   ├── requirements.txt
│   │   └── tests/
│   ├── dynamodb-api/
│   ├── placeholder-search/    # Already Node.js - keep as-is
│   ├── profile-api/
│   ├── profile-processing/
│   ├── llm/
│   ├── webhook-handler/
│   └── shared/
│       └── python/
│           ├── config/
│           └── utils/
├── template.yaml
└── samconfig.toml
```

**Rationale:**
- Fastest path to target structure
- No functional changes to working code
- SAM handles mixed runtimes well

**Consequences:**
- Mixed runtimes in `backend/` (Python + one Node.js Lambda)
- Testing requires both pytest and jest/vitest

### ADR-005: Full Code Sanitization

**Status:** Accepted

**Context:** Codebase has accumulated debug statements, commented-out code, verbose docstrings, and dead code.

**Decision:** Aggressive sanitization:
1. **Remove all `console.log`/`print()`** - Keep only structured error logging via Winston/Python logging
2. **Strip all comments and docstrings** - Code should be self-documenting
3. **Delete commented-out code blocks** - Git history preserves old code
4. **Remove dead code** - Unused imports, functions, files
5. **Delete debugger statements** - No `debugger;` or `breakpoint()`

**Exceptions:**
- `console.error`/`console.warn` for error boundaries may remain if using structured format
- Type annotations are preserved (they're not comments)
- TODO comments linked to GitHub issues may remain temporarily

**Consequences:**
- Significant code reduction
- Potential for accidental removal of necessary code (mitigated by tests)
- Must verify test coverage before sanitization

### ADR-006: Deployment Script Pattern (react-stocks)

**Status:** Accepted

**Context:** Need standardized deployment that doesn't rely on `sam deploy --guided` and persists configuration.

**Decision:** Adopt react-stocks deployment pattern:
1. **Interactive prompts** for missing configuration
2. **Persist to `.deploy-config.json`** (git-ignored)
3. **Generate `samconfig.toml`** programmatically
4. **Execute `sam build && sam deploy`**
5. **Update `.env`** with stack outputs post-deployment

**Script Location:** `backend/scripts/deploy.js`

**Consequences:**
- Consistent deployment experience
- No manual samconfig.toml editing
- Secrets prompted at deploy time, not stored in config

---

## Deployment Script Specification

### Overview

The deployment script (`backend/scripts/deploy.js`) handles AWS infrastructure deployment using SAM CLI. It follows an interactive pattern that persists non-sensitive configuration.

### Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     npm run deploy                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. CHECK PREREQUISITES                                          │
│     - AWS CLI configured (aws sts get-caller-identity)          │
│     - SAM CLI installed (sam --version)                          │
│     - Docker running (for Python Lambda builds)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. LOAD OR PROMPT CONFIG                                        │
│     - Check for .deploy-config.json                              │
│     - If exists: load and validate                               │
│     - If missing fields: prompt user                             │
│     - Save updated config to .deploy-config.json                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. GENERATE SAMCONFIG.TOML                                      │
│     - Build parameter_overrides from config                      │
│     - Write samconfig.toml with stack_name, region, capabilities │
│     - Do NOT include secrets in samconfig.toml                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. BUILD AND DEPLOY                                             │
│     - sam build (uses Docker for Python)                         │
│     - sam deploy --no-confirm-changeset                          │
│     - Stream output to console                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. UPDATE ENVIRONMENT                                           │
│     - Fetch CloudFormation stack outputs                         │
│     - Update root .env with:                                     │
│       - VITE_API_GATEWAY_URL                                     │
│       - VITE_COGNITO_USER_POOL_ID                                │
│       - VITE_COGNITO_USER_POOL_WEB_CLIENT_ID                     │
│       - VITE_S3_BUCKET                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration Schema

**`.deploy-config.json`** (git-ignored):
```json
{
  "region": "us-west-2",
  "stackName": "linkedin-advanced-search",
  "includeDevOrigins": true,
  "productionOrigins": "https://myapp.example.com"
}
```

**Prompted Values (not persisted):**
- Secrets are prompted each deployment and passed via `--parameter-overrides`
- This project currently has no Lambda-level secrets (Cognito handles auth)

### samconfig.toml Generation

```toml
version = 0.1
[default.deploy.parameters]
stack_name = "linkedin-advanced-search"
region = "us-west-2"
capabilities = "CAPABILITY_IAM"
resolve_s3 = true
```

### Error Handling

1. **Missing prerequisites** - Exit with clear error message
2. **Invalid config** - Prompt user to fix or delete `.deploy-config.json`
3. **Build failure** - Exit with SAM error output
4. **Deploy failure** - Exit with CloudFormation error, suggest stack deletion
5. **Output fetch failure** - Warn but don't fail (deployment succeeded)

---

## Testing Strategy

### Principles

1. **Unit tests are primary** - Fast, isolated, no external dependencies
2. **Integration tests use mocks** - AWS SDK mocked, no live resources
3. **E2E tests are optional** - Run locally, not in CI
4. **CI runs tests in isolation** - No network calls, no AWS credentials needed

### Framework Mapping

| Target | Framework | Location |
|--------|-----------|----------|
| Frontend | Vitest + React Testing Library | `tests/frontend/` |
| Backend (Python) | pytest + moto + pytest-mock | `tests/backend/` |
| Backend (Node.js Lambda) | Vitest | `tests/backend/` |
| Puppeteer | Vitest | `tests/puppeteer/` |
| E2E | Playwright (future) | `tests/e2e/` |

### Mocking Approach

**Frontend:**
- Mock `@aws-sdk/*` using Vitest mocks
- Mock API calls using MSW or manual mocks
- Mock Cognito auth context

**Backend (Python):**
- Use `moto` for DynamoDB, S3, Cognito mocking
- Use `pytest-mock` for external service calls
- Environment variables set in conftest.py

**Backend (Node.js Lambda):**
- Mock AWS SDK v3 using Vitest
- Mock external APIs using `nock` or manual mocks

**Puppeteer Server:**
- Mock Puppeteer browser instance
- Mock AWS SDK calls
- Mock external LinkedIn responses

### Test File Naming

- Unit tests: `*.test.ts`, `*.test.tsx`, `test_*.py`
- Integration tests: `*.integration.test.ts`, `*_integration_test.py`
- E2E tests: `*.e2e.test.ts`

### Coverage Requirements

- **Unit tests:** 80% line coverage minimum
- **Integration tests:** Critical paths covered
- **No coverage requirement for E2E** (optional)

---

## CI/CD Workflow Specification

### Workflow File: `.github/workflows/ci.yml`

**Triggers:**
- `push` to `main`, `develop`
- `pull_request` to `main`, `develop`

**Jobs:**

```yaml
jobs:
  frontend-lint:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node.js 24
      - Install deps (cd frontend && npm ci)
      - Run lint (npm run lint)
      - Run TypeScript check (npx tsc --noEmit)

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node.js 24
      - Install deps
      - Run tests (npm test -- --ci)

  backend-lint:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Python 3.13
      - Install uv
      - Run ruff (uvx ruff check backend/lambdas)

  backend-tests:
    runs-on: ubuntu-latest
    env:
      AWS_DEFAULT_REGION: us-east-1
      DYNAMODB_TABLE: test-table
      PYTHONPATH: ${{ github.workspace }}/backend/lambdas
    steps:
      - Checkout
      - Setup Python 3.13
      - Install test deps (uv pip install pytest pytest-mock moto requests-mock)
      - Run pytest (pytest tests/backend -v --tb=short)

  puppeteer-lint:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node.js 24
      - Install deps (cd puppeteer && npm ci)
      - Run lint (npm run lint)

  puppeteer-tests:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node.js 24
      - Install deps
      - Run tests (npm test -- --ci)

  status-check:
    needs: [frontend-lint, frontend-tests, backend-lint, backend-tests, puppeteer-lint, puppeteer-tests]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - Check all jobs passed
      - Fail if any dependency failed
```

**Key Constraints:**
- No deployment in CI
- No AWS credentials in CI
- All tests must pass with mocks only
- Node.js 24 and Python 3.13 enforced

---

## Shared Conventions

### Commit Message Format

```
type(scope): brief description

- Detail 1
- Detail 2

Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`

**Scopes:** `frontend`, `backend`, `puppeteer`, `tests`, `scripts`, `ci`

### File Naming

- **TypeScript/JavaScript:** `camelCase.ts`, `PascalCase.tsx` (components)
- **Python:** `snake_case.py`
- **Tests:** `{name}.test.ts`, `test_{name}.py`
- **Config:** `lowercase.config.ts`

### Import Order

**TypeScript:**
1. Node built-ins
2. External packages
3. Internal aliases (`@/`)
4. Relative imports

**Python:**
1. Standard library
2. Third-party packages
3. Local imports

### Error Handling

- **Frontend:** Error boundaries + toast notifications
- **Backend Lambda:** Structured JSON responses with status codes
- **Puppeteer:** Winston logger with error levels

### Environment Variables

**Frontend (VITE_*):**
- `VITE_API_GATEWAY_URL`
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID`
- `VITE_PUPPETEER_BACKEND_URL`

**Backend Lambda:**
- `DYNAMODB_TABLE`
- `AWS_REGION`
- `LOG_LEVEL`

**Puppeteer:**
- `PORT`
- `NODE_ENV`
- `FRONTEND_URLS`
- `HEADLESS`

---

## Phase Verification

This phase is complete when:

- [ ] All ADRs reviewed and understood
- [ ] Deployment script specification reviewed
- [ ] Testing strategy reviewed
- [ ] CI/CD workflow specification reviewed
- [ ] Shared conventions reviewed

**Note:** Phase 0 produces no code changes. It establishes the rules for Phases 1-3.

---

## Next Phase

Proceed to [Phase 1: Structure Migration](Phase-1.md) to begin moving files and updating imports.
