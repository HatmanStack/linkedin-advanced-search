# Technical Debt Remediation Plan

## Overview

This plan addresses the technical debt identified during the codebase audit to improve the overall code quality score from the current B+ (7-8/10 across pillars) to A+ (9+/10). The remediation focuses on five key areas:

1. **Monolithic Lambda Handlers** - Split 700+ line Lambda functions into handler/service/error layers
2. **Type Safety Gap** - Wire existing validators into `useConnections.ts` hook to eliminate `any` types
3. **Brittle Inter-Lambda Coupling** - Replace environment variable coupling with dependency injection
4. **Testing Coverage Gap** - Add comprehensive unit and integration tests with mocked AWS services
5. **Over-Engineered Scoring** - Simplify conversion likelihood from weighted percentages to enum

The plan follows TDD principles, with tests written before implementation. Each phase builds incrementally, allowing for atomic commits and easy rollback if needed. Breaking changes are acceptable as this is pre-production.

## Prerequisites

### Tools Required
- Node.js v24 LTS (via nvm)
- Python 3.13 (via uv)
- AWS CLI v2 configured with deployment credentials
- AWS SAM CLI

### Environment Setup
```bash
# Frontend dependencies
cd frontend && npm ci

# Backend test dependencies
cd tests/backend
uv venv && source .venv/bin/activate
uv pip install -r requirements-test.txt

# Verify AWS credentials
aws sts get-caller-identity
```

### Pre-Remediation Checklist
- [ ] All CI checks passing (`npm run check`)
- [ ] Local `.env` file configured with valid AWS resource IDs
- [ ] SAM CLI installed and configured

## Phase Summary

| Phase | Goal | Estimated Tokens |
|-------|------|------------------|
| [Phase-0](./Phase-0.md) | Foundation - ADRs, deployment script, testing strategy | ~15,000 |
| [Phase-1](./Phase-1.md) | Lambda Refactoring - Split monolithic handlers into layered architecture | ~40,000 |
| [Phase-2](./Phase-2.md) | Type Safety & Testing - Fix type gaps, comprehensive test coverage | ~35,000 |

## Navigation

- [Phase-0: Foundation](./Phase-0.md) - Start here
- [Phase-1: Lambda Refactoring](./Phase-1.md)
- [Phase-2: Type Safety & Testing](./Phase-2.md)

## Commit Message Guidelines

All commits must follow conventional commit format:

```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

type(scope): brief description

- Detail 1
- Detail 2
```

**Important**: Do NOT include `Co-Authored-By`, `Generated-By`, or similar attribution lines in commit messages.

### Commit Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring without behavior change
- `test`: Adding or updating tests
- `chore`: Build, config, tooling changes
- `docs`: Documentation only

### Scopes
- `backend`: Lambda function changes
- `frontend`: React/TypeScript changes
- `deploy`: Deployment infrastructure
- `ci`: CI/CD pipeline changes

## Success Criteria

Upon completion of all phases:

| Metric | Current | Target |
|--------|---------|--------|
| Problem Fit | 8/10 | 9/10 |
| Architecture | 7/10 | 9/10 |
| Code Quality | 8/10 | 9/10 |
| Creativity | 7/10 | 9/10 |

## Risk Mitigation

- **Rollback Strategy**: Each task produces atomic commits; revert to previous commit if issues arise
- **Testing Gate**: No phase is complete until all tests pass in CI
- **Breaking Changes**: Acceptable; coordinate with frontend if API contracts change
