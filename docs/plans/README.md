# Technical Debt Remediation Plan

## Overview

This plan addresses five technical debt items identified in the LinkedIn Advanced Search codebase. The remediation focuses on security hardening, architectural improvements, and modernizing the frontend data layer.

The work is divided into two implementation phases following a foundation phase that establishes patterns and conventions. Phase 1 addresses critical security vulnerabilities in the puppeteer backend (JWT validation and credential encryption). Phase 2 modernizes the frontend by migrating to React Query and decomposing an oversized hook into focused, testable units.

One identified issue (skipped integration tests due to moto 5.x incompatibility) requires no action—we will wait for an upstream fix rather than compromise production code to accommodate test tooling limitations.

## Prerequisites

### Environment Requirements
- Node.js v24 LTS (via nvm)
- Python 3.13 (via uv)
- pnpm or npm for frontend dependencies
- libsodium-wrappers-sumo (already installed in puppeteer)

### Tools
- Vitest for frontend and puppeteer testing
- pytest for backend testing
- ESLint for linting

### Required Reading
- `puppeteer/src/shared/utils/crypto.js` - Existing libsodium sealbox implementation
- `frontend/src/App.tsx` - QueryClientProvider setup (already configured)
- `backend/template.yaml` - SAM template for Cognito configuration

## Phase Summary

| Phase | Goal | Token Estimate |
|-------|------|----------------|
| [Phase-0](./Phase-0.md) | Foundation: ADRs, patterns, testing strategy | ~5,000 |
| [Phase-1](./Phase-1.md) | Security: JWT validation + credential encryption | ~25,000 |
| [Phase-2](./Phase-2.md) | Frontend: React Query migration + hook decomposition | ~45,000 |

## Items NOT Addressed

### Skipped Integration Tests (moto 5.x)
Four tests in `tests/backend/integration/test_edge_service_integration.py` remain skipped due to moto 5.x incompatibility with `transact_write_items`.

**Decision:** Wait for upstream fix. Do not refactor production code to avoid DynamoDB transactions—the atomicity guarantees are more important than test coverage for this specific code path.

**Tracking:** Monitor [moto GitHub issues](https://github.com/getmoto/moto/issues) for `transact_write_items` fixes.

## Commit Message Guidelines

**Important:** Commit messages should NOT include:
- `Co-Authored-By:` lines
- `Generated with Claude Code` or similar attribution
- Any AI tool attribution

Use conventional commits format:
```
type(scope): brief description

- Detail 1
- Detail 2
```

## Navigation

1. [Phase-0: Foundation](./Phase-0.md)
2. [Phase-1: Security Hardening](./Phase-1.md)
3. [Phase-2: Frontend Modernization](./Phase-2.md)
