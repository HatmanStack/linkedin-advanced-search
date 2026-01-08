# Code Hygiene Cleanup - Implementation Plan

## Feature Overview

This plan implements a comprehensive code hygiene cleanup across the entire monorepo (frontend, puppeteer, backend). The cleanup focuses on removing dead code, eliminating technical debt, enforcing performance standards, and standardizing development patterns—all while maintaining existing test coverage.

The implementation delivers two primary artifacts: (1) an audit report identifying all impactless code, commented-out blocks, potential secrets, and optimization opportunities, and (2) a one-shot bash cleanup script that programmatically executes AST-based analysis and applies automated fixes. Manual intervention handles aggressive performance optimizations and utility consolidation that require human judgment.

The cleanup enforces strict test-passing requirements—all existing tests must pass after modifications, with test updates made as needed to reflect optimized implementations.

## Prerequisites

### Tools Required
- **Node.js 24 LTS** (managed via nvm)
- **Python 3.13** (managed via uv)
- **npm** (comes with Node.js)
- **uvx** (Python tool runner via uv)
- **npx** (Node.js tool runner via npm)
- **git** (version control)

### AST Analysis Tools (run via npx/uvx - not installed permanently)
- **knip** - Dead code detection for JavaScript/TypeScript
- **vulture** - Dead code detection for Python
- **detect-secrets** - High-entropy string detection

### Environment Setup
1. Ensure Node.js 24 LTS is active: `nvm use 24`
2. Ensure Python 3.13 is available: `python3 --version`
3. Install project dependencies in each component:
   - `cd frontend && npm ci`
   - `cd puppeteer && npm ci`
   - `cd tests/backend && pip install -r requirements-test.txt`

## Phase Summary

| Phase | Goal | Est. Tokens |
|-------|------|-------------|
| **0** | Foundation: ADRs, script architecture, testing strategy, patterns | ~8,000 |
| **1** | Cleanup Script Development + Analysis & Audit Report Generation | ~20,000 |
| **2** | Frontend Cleanup (dead code, optimization, secrets, utils, comments, tests) | ~25,000 |
| **3** | Puppeteer + Backend Cleanup + CI Tweaks + Final Verification | ~30,000 |

**Total Estimated Tokens:** ~83,000 (fits in 3 context windows after Phase-0)

## Navigation

- [Phase-0.md](./Phase-0.md) - Foundation (applies to all phases)
- [Phase-1.md](./Phase-1.md) - Script Development + Analysis
- [Phase-2.md](./Phase-2.md) - Frontend Cleanup
- [Phase-3.md](./Phase-3.md) - Puppeteer + Backend + CI

## Commit Message Convention

**Important**: Do NOT include Co-Authored-By, Generated-By, or similar attribution lines in commit messages.

```text
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

type(scope): brief description

Detail 1
Detail 2
```

### Commit Types
- `chore`: Maintenance, cleanup, tooling
- `refactor`: Code restructuring without behavior change
- `perf`: Performance improvements
- `fix`: Bug fixes
- `test`: Test additions/modifications
- `ci`: CI/CD configuration changes

### Scopes
- `frontend`: React/TypeScript frontend
- `puppeteer`: Node.js/Puppeteer backend
- `backend`: Python Lambda functions
- `scripts`: Cleanup scripts and tooling
- `ci`: GitHub Actions workflows
