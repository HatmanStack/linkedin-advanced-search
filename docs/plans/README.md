# LinkedIn Advanced Search - Codebase Refactoring Plan

## Feature Overview

This refactoring initiative aims to modernize and optimize the LinkedIn Advanced Search codebase through comprehensive test coverage and systematic code quality improvements. The project is a sophisticated LinkedIn automation platform consisting of a React frontend, local Puppeteer-based automation backend, and AWS Lambda serverless infrastructure.

Since the application has no production users yet, we have complete freedom to refactor without backward compatibility constraints. This plan follows a test-driven approach: writing comprehensive unit tests first, then systematically improving code quality through dead code removal, organizational restructuring, and modern pattern adoption.

The refactoring prioritizes (1) eliminating unused code, (2) improving code organization, (3) removing duplication, and (4) adopting modern patterns and naming conventions. All changes will be validated through automated tests targeting 60-70% code coverage across all layers: React components, Node.js services, and Python/Node.js Lambda functions.

## Prerequisites

### Development Environment
- **Node.js**: v18+ (LTS recommended)
- **Python**: v3.13+ (for Lambda functions)
- **npm**: v9+ or compatible package manager
- **Git**: For version control and commits

### Testing Tools
- **Frontend**: Vitest, @testing-library/react, jsdom
- **Backend (Node.js)**: Vitest or Jest
- **Lambda (Python)**: pytest, moto (AWS mocking)
- **Lambda (Node.js)**: Vitest or Jest

### AWS Tools (for Lambda testing)
- **boto3**: Python AWS SDK
- **moto**: Mock AWS services for testing
- **AWS SAM CLI**: Optional, for local Lambda testing

### Code Quality Tools
- **ESLint**: v9+ with TypeScript support (already configured)
- **TypeScript**: v5.5+ (already configured)
- **Prettier**: Optional, for code formatting consistency

### Installation
```bash
# Install frontend and backend dependencies
npm install

# Install Python dependencies for Lambda testing
cd lambda-processing
pip install -r requirements-test.txt  # Will be created in Phase 1
```

## Phase Summary

| Phase | Goal | Est. Tokens | Status |
|-------|------|-------------|--------|
| [Phase 0](./Phase-0.md) | Foundation: Architecture decisions, testing strategy, shared conventions | N/A | 📋 Reference |
| [Phase 1](./Phase-1.md) | Write comprehensive unit test suite (frontend, backend, all Lambdas) | ~100,000 | ⏳ Pending |
| [Phase 2](./Phase-2.md) | Remove all dead and unused code | ~35,000 | ⏳ Pending |
| [Phase 3](./Phase-3.md) | Restructure code organization and improve file/directory layout | ~45,000 | ⏳ Pending |
| [Phase 4](./Phase-4.md) | Eliminate duplication, adopt modern patterns, improve naming conventions | ~55,000 | ⏳ Pending |

**Total Estimated Tokens**: ~235,000 across 4 implementation phases

## Navigation

- **[Phase 0: Foundation](./Phase-0.md)** - Architecture decisions and testing strategy (read first)
- **[Phase 1: Comprehensive Test Suite](./Phase-1.md)** - Unit tests for all layers
- **[Phase 2: Dead Code Removal](./Phase-2.md)** - Eliminate unused code
- **[Phase 3: Code Organization](./Phase-3.md)** - Restructure directories and files
- **[Phase 4: Duplication, Patterns & Naming](./Phase-4.md)** - Final code quality improvements

## Development Principles

This refactoring follows these core principles:

1. **Test-Driven Development (TDD)**: Write tests before making any code changes
2. **Don't Repeat Yourself (DRY)**: Eliminate code duplication systematically
3. **You Aren't Gonna Need It (YAGNI)**: Remove speculative or unused code
4. **Atomic Commits**: Small, focused commits with conventional commit format
5. **No Breaking Changes**: While we have freedom to refactor, preserve functional behavior

## Commit Message Format

All commits should follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): brief description

- Detailed change 1
- Detailed change 2
- Detailed change 3
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `perf`

**Examples**:
- `test(frontend): add unit tests for ConnectionList component`
- `refactor(backend): remove unused LinkedIn profile parsing utilities`
- `chore(lambda): reorganize DynamoDB API Lambda structure`

## Getting Started

1. **Read Phase 0** to understand architecture decisions and testing strategy
2. **Start with Phase 1** to build the comprehensive test suite
3. **Proceed sequentially** through Phases 2-4
4. **Verify each phase** before moving to the next
5. **Commit frequently** with clear, descriptive messages

## Notes for Implementation Engineer

- **Zero Context Assumption**: Each phase is written for engineers unfamiliar with this codebase
- **Guidance, Not Commands**: Tasks provide architectural guidance; you determine specific implementation
- **Verification-Driven**: Each task includes testable verification criteria
- **Tool Freedom**: Use your preferred approaches within the architectural guidelines
- **Ask Questions**: If requirements are unclear, seek clarification before proceeding

## Success Criteria

This refactoring is complete when:

- ✅ 60-70% unit test coverage across all layers (frontend, backend, Lambdas)
- ✅ Zero unused imports, variables, functions, or files
- ✅ Clear, logical code organization with consistent structure
- ✅ No code duplication exceeding 5 lines
- ✅ Modern patterns adopted (ES6+, async/await, functional components)
- ✅ Consistent naming conventions throughout codebase
- ✅ All tests passing with no warnings or errors
- ✅ Build completes successfully with clean output

---

**Last Updated**: 2025-11-18
**Current Branch**: `claude/refactor-codebase-01EpkokvaUcysygZRmQvQ78V`
