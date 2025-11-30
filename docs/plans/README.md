# LinkedIn Advanced Search - Monorepo Refactor Plan

## Overview

This plan restructures an existing LinkedIn automation and search application from a loosely organized codebase into a clean, standardized monorepo architecture. The refactor consolidates scattered code, enforces consistent patterns, standardizes CI/CD pipelines, and eliminates technical debt through aggressive sanitization.

The current codebase consists of a React/Vite frontend (`src/`), a Puppeteer-based Node.js automation server (`puppeteer-backend/`), Python AWS Lambda functions (`lambda-processing/`), and scattered infrastructure definitions (`RAG-CloudStack/`). These will be reorganized into a cohesive structure with clear deployment boundaries, unified testing, and automated deployment scripts following established patterns.

The refactor prioritizes ruthless cleanup: dead code deletion, comment stripping, console.log removal, and consolidation of fragmented utilities. Historical migration documents will be deleted (they exist in git history), with only relevant information extracted into new streamlined documentation.

## Target Structure

```
linkedin-advanced-search/
├── frontend/              # Vite + React client
│   ├── src/
│   │   ├── features/
│   │   ├── pages/
│   │   └── shared/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── backend/               # AWS Lambda (Python) + SAM
│   ├── lambdas/
│   │   ├── edge-processing/
│   │   ├── dynamodb-api/
│   │   ├── placeholder-search/
│   │   ├── profile-api/
│   │   ├── profile-processing/
│   │   ├── llm/
│   │   ├── webhook-handler/
│   │   └── shared/
│   ├── scripts/
│   │   └── deploy.js
│   ├── template.yaml
│   ├── samconfig.toml
│   └── package.json
├── puppeteer/             # Local Node.js automation server
│   ├── src/
│   │   ├── domains/
│   │   └── shared/
│   ├── routes/
│   ├── package.json
│   └── .eslintrc.js
├── docs/                  # Consolidated documentation
│   ├── README.md
│   └── DEPLOYMENT.md
├── tests/                 # Centralized test suites
│   ├── frontend/
│   │   ├── unit/
│   │   └── integration/
│   ├── backend/
│   │   ├── unit/
│   │   └── integration/
│   ├── puppeteer/
│   │   └── unit/
│   ├── e2e/
│   └── fixtures/
├── scripts/               # Consolidated utility scripts
│   ├── deploy/
│   ├── dev-tools/
│   └── benchmarks/
├── .github/
│   └── workflows/
│       └── ci.yml
├── package.json           # Orchestration-only (cd into subdirs)
└── README.md              # Concise quickstart
```

## Prerequisites

### Required Tools
- **Node.js** v24 LTS (via nvm)
- **Python** 3.13 (via uv)
- **AWS CLI** configured with credentials
- **AWS SAM CLI** v1.100+
- **Docker** (for SAM local builds)

### Environment Setup
```bash
# Verify Node.js
node --version  # Should be v24.x

# Verify Python
python3 --version  # Should be 3.13.x

# Verify AWS
aws sts get-caller-identity
sam --version
```

### Existing Resources
- AWS Cognito User Pool (will be preserved)
- DynamoDB table with existing data (will be preserved)
- S3 bucket for screenshots (will be preserved)

## Phase Summary

| Phase | Goal | Estimated Tokens |
|-------|------|------------------|
| [Phase 0](Phase-0.md) | Foundation - ADRs, deployment scripts, testing strategy, shared patterns | ~15,000 |
| [Phase 1](Phase-1.md) | Structure Migration - Move files, update imports, reorganize tests | ~45,000 |
| [Phase 2](Phase-2.md) | Backend Consolidation - SAM template, deploy script, Lambda restructure | ~30,000 |
| [Phase 3](Phase-3.md) | Sanitization & Docs - Dead code removal, comment stripping, documentation | ~25,000 |

**Total Estimated Tokens:** ~115,000 (fits within 2 context windows with buffer)

## Key Decisions

1. **Orchestration-only root** - Root `package.json` delegates to subdirectories via `cd` commands
2. **Python Lambdas preserved** - No runtime migration; restructure into `backend/lambdas/`
3. **Tests by deployment target** - `tests/frontend/`, `tests/backend/`, `tests/puppeteer/`, `tests/e2e/`
4. **Full sanitization** - Strip all console.log, comments, docstrings, dead code
5. **react-stocks deployment pattern** - Interactive `deploy.js` script with `.deploy-config.json` persistence

## Navigation

- [Phase 0: Foundation](Phase-0.md) - Start here
- [Phase 1: Structure Migration](Phase-1.md)
- [Phase 2: Backend Consolidation](Phase-2.md)
- [Phase 3: Sanitization & Docs](Phase-3.md)
