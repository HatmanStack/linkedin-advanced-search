# Phase 0: Foundation

**Estimated Tokens:** ~8,000

This phase establishes the architectural decisions, patterns, and strategies that apply to all subsequent phases. Engineers should read this entire document before beginning any implementation work.

---

## Architecture Decision Records (ADRs)

### ADR-001: AST Tools via npx/uvx (No Permanent Dependencies)

**Context:** Dead code detection requires AST-aware tools. Options include adding them as devDependencies or running them ephemerally.

**Decision:** Use `npx` for JavaScript/TypeScript tools (knip) and `uvx` for Python tools (vulture, detect-secrets). No permanent additions to package.json or pyproject.toml.

**Rationale:**
- Cleanup is a one-time operation, not ongoing development workflow
- Avoids bloating devDependencies with single-use tools
- npx/uvx cache tools locally for fast subsequent runs
- No version conflicts with existing dependencies

**Consequences:**
- First run downloads tools (one-time ~30s delay)
- No IDE integration for these tools
- Must specify versions explicitly for reproducibility

---

### ADR-002: Comment Removal Strategy

**Context:** Original spec requested removing ALL comments. Refined requirement: remove dead/obvious comments only.

**Decision:** Remove the following categories:
1. **TODO/FIXME comments** - Stale action items
2. **Commented-out code blocks** - Dead code masquerading as comments
3. **Obvious/redundant comments** - Comments that restate what code does

**Preserve:**
1. **JSDoc/docstrings** for public APIs
2. **Suppression flags** (`@ts-ignore`, `# noqa`, `eslint-disable`)
3. **License headers** if present
4. **Complex algorithm explanations** that add value

**Detection Approach:**
- Regex for TODO/FIXME patterns
- AST analysis for commented-out code (syntactically valid code in comments)
- Manual review for redundant comments during optimization pass

---

### ADR-003: Aggressive Performance Optimization Scope

**Context:** Requirement specifies "prefer performance over readability" with aggressive optimization.

**Decision:** Apply the following optimization patterns:

**JavaScript/TypeScript:**
- Replace `.forEach()` with `for` loops where iteration count is known
- Replace `.map().filter()` chains with single-pass loops
- Use `for...of` over `for...in` for array iteration
- Inline small utility functions called in hot paths
- Replace spread operators with direct mutation where safe
- Use `Object.assign` over spread for object merging in loops

**Python:**
- Replace list comprehensions with generator expressions for large datasets
- Use `dict.get()` over `try/except KeyError`
- Replace multiple `if/elif` with dictionary dispatch tables
- Use `itertools` for complex iterations
- Inline small lambdas used once

**Boundaries:**
- Do NOT optimize code that isn't on a hot path
- Do NOT break existing public APIs
- Do NOT sacrifice type safety for performance
- All optimizations must maintain test parity

---

### ADR-004: Secrets Handling

**Context:** Hardcoded high-entropy strings may contain secrets. Requirement: auto-replace with environment variables.

**Decision:**
1. Use `detect-secrets` to scan for high-entropy strings
2. For confirmed secrets, replace with:
   - JavaScript/TypeScript: `process.env.VAR_NAME`
   - Python: `os.environ.get('VAR_NAME')`
3. Add discovered variables to `.env.example` with placeholder values
4. Document new environment variables in README

**False Positive Handling:**
- Base64-encoded static assets → ignore
- UUIDs used as test fixtures → ignore
- Hash constants (SHA patterns) → review case-by-case
- API version strings → ignore

---

### ADR-005: Utility Consolidation Boundaries

**Context:** Redundant utility functions exist. Requirement: merge within components only.

**Decision:** Consolidation scope is strictly per-component:
- `frontend/` utilities merge within frontend only
- `puppeteer/` utilities merge within puppeteer only
- `backend/` utilities merge within backend only

**NO cross-component consolidation.** Even if identical functions exist in frontend and puppeteer, they remain separate.

**Consolidation Target Files:**
- Frontend: `frontend/src/shared/lib/utils.ts`
- Puppeteer: `puppeteer/src/shared/utils/` (7 existing util files) + `puppeteer/utils/uploadMetrics.js`
- Backend: `backend/lambdas/shared/` (per existing structure)

---

### ADR-006: Test Update Strategy

**Context:** Aggressive optimization will change implementation details. Tests must pass.

**Decision:**
1. Run full test suite before any changes (baseline)
2. After each optimization, run affected component's tests
3. Update test assertions that depend on implementation details
4. Delete tests for deleted code
5. Add tests for any new utility consolidations
6. Final full test suite run before phase completion

**Test Files Never Deleted Without Corresponding Code Deletion:**
- If code is removed, its tests are removed
- If code is optimized, tests are updated to match new behavior
- No orphan test files

---

## Cleanup Script Architecture

### Script Location
`scripts/cleanup/code-cleanup.sh` (existing script - will be enhanced)

**Note:** An existing cleanup script already provides knip, vulture, and ruff integration. Phase 1 enhances this script rather than creating a new one.

### Script Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                  code-cleanup.sh                            │
├─────────────────────────────────────────────────────────────┤
│  1. ANALYSIS PHASE                                          │
│     ├── Run knip on frontend/                               │
│     ├── Run knip on puppeteer/                              │
│     ├── Run vulture on backend/lambdas/                     │
│     ├── Run detect-secrets scan                             │
│     └── Generate audit-report.json                          │
├─────────────────────────────────────────────────────────────┤
│  2. AUTOMATED FIXES                                         │
│     ├── Remove unused imports (knip --fix)                  │
│     ├── Remove console.log/print statements (sed/grep)      │
│     ├── Remove debugger statements                          │
│     └── Flag secrets for manual env var extraction          │
├─────────────────────────────────────────────────────────────┤
│  3. REPORT GENERATION                                       │
│     ├── audit-report.json (machine-readable)                │
│     ├── audit-report.md (human-readable summary)            │
│     └── Exit code: 0=clean, 1=issues found                  │
└─────────────────────────────────────────────────────────────┘
```

### Audit Report Schema

```json
{
  "timestamp": "ISO-8601",
  "components": {
    "frontend": {
      "deadCode": {
        "unusedExports": ["path:export"],
        "unusedFiles": ["path"],
        "unreachableFunctions": ["path:function"]
      },
      "sanitization": {
        "consoleLogs": ["path:line"],
        "commentedCode": ["path:line"],
        "todoComments": ["path:line"]
      },
      "secrets": {
        "highEntropyStrings": ["path:line:preview"]
      }
    },
    "puppeteer": { /* same structure */ },
    "backend": { /* same structure */ }
  },
  "summary": {
    "totalIssues": 0,
    "byCategory": {}
  }
}
```

### Script Execution Model

**One-shot execution** - no prompts, applies fixes automatically:
1. Script runs all analysis tools
2. Applies safe automated fixes (unused imports, console.log)
3. Generates comprehensive audit report
4. Manual optimization work uses audit report as input

---

## Testing Strategy

### Test Requirements
- **All existing tests must pass** after cleanup
- Tests for deleted code are deleted
- Tests for optimized code are updated

### Test Execution Order
1. **Pre-cleanup baseline:** `npm run test` (all components)
2. **Per-task verification:** Component-specific tests after each change
3. **Phase completion:** Full test suite

### CI Pipeline Compatibility
All tests must run without live AWS resources:
- Frontend: Vitest with React Testing Library (no AWS)
- Puppeteer: Vitest with mocked dependencies
- Backend: pytest with moto (AWS mocking)

### Test Commands
```bash
# Full suite
npm run test

# Component-specific
npm run test:frontend
npm run test:backend
npm run test:puppeteer  # or: cd puppeteer && npm run test
```

---

## Shared Patterns & Conventions

### Dead Code Identification Criteria

Code is considered "dead" if ANY of these apply:
1. **Unreachable:** No execution path leads to it from entry points
2. **Unused export:** Exported but never imported elsewhere
3. **Orphaned file:** File has no imports from live code
4. **Impactless:** Code runs but output never reaches a sink (I/O, state mutation, network)

### Entry Points (Sinks originate from these)

**Frontend:**
- `frontend/src/main.tsx` (React app entry)
- `frontend/src/pages/*.tsx` (Route components)

**Puppeteer:**
- `puppeteer/src/server.js` (Express entry)
- `puppeteer/routes/*.js` (API handlers - NOT under src/)

**Backend:**
- `backend/lambdas/*/lambda_function.py` or `index.py` (Lambda handlers)
- Functions named `lambda_handler` or `handler`

### File Modification Tracking

Track all modifications in commit messages:
- List files modified
- Categorize changes (dead code, optimization, sanitization)
- Reference audit report findings where applicable

### Rollback Safety

Before starting cleanup:
1. Ensure working tree is clean (`git status`)
2. Create checkpoint: `git stash` or commit WIP
3. Each phase can be reverted independently via git

---

## Environment Configuration

### Required Environment Variables (Existing)
Review `.env.example` for current requirements. New variables discovered during secrets extraction will be added here.

### Local Development After Cleanup
No changes to local development workflow. Same commands:
```bash
cd frontend && npm run dev
cd puppeteer && npm start
cd backend && npm run deploy  # SAM deployment
```

---

## Verification Checklist (Phase 0)

This phase has no implementation tasks—it establishes patterns. Verification:

- [ ] Engineer has read and understood all ADRs
- [ ] Engineer understands cleanup script architecture
- [ ] Engineer can run test suites for all components
- [ ] Engineer has clean git working tree before proceeding
