# Phase 1: Cleanup Script Development + Analysis

**Estimated Tokens:** ~18,000

## Phase Goal

Enhance the existing cleanup bash script (`scripts/cleanup/code-cleanup.sh`) to perform comprehensive AST-based dead code analysis, automated sanitization, and generate a structured audit report. Execute the script to produce the baseline audit that guides Phase 2 manual cleanup.

### Success Criteria
- `scripts/cleanup/code-cleanup.sh` enhanced and executes without errors
- Audit report generated at `reports/audit-report.json`
- Human-readable summary at `reports/audit-report.md`
- All automated fixes (unused imports, console.log removal) applied
- Existing test suite still passes after automated fixes

---

## Prerequisites

- [x] Phase 0 read and understood
- [x] Node.js 24 LTS active (`nvm use 24`)
- [x] Python 3.13 available (`python3 --version`)
- [x] Project dependencies installed in all components
- [x] Clean git working tree (`git status` shows no uncommitted changes)

---

## Tasks

### Task 1: Enhance Existing Cleanup Script Structure

**Goal:** Enhance the existing `scripts/cleanup/code-cleanup.sh` with modular lib functions for comprehensive cleanup capabilities.

**Existing Script:** `scripts/cleanup/code-cleanup.sh` already provides:
- knip integration for JS/TS dead code detection
- vulture integration for Python dead code detection
- ruff linting integration
- Report output to `reports/` directory
- Modes: js, py, all, audit

**Files to Create:**
- `scripts/cleanup/lib/analyze-js.sh` - Enhanced JavaScript/TypeScript analysis functions
- `scripts/cleanup/lib/analyze-py.sh` - Enhanced Python analysis functions
- `scripts/cleanup/lib/sanitize.sh` - Automated sanitization functions
- `scripts/cleanup/lib/report.sh` - Structured report generation functions

**Files to Modify:**
- `scripts/cleanup/code-cleanup.sh` - Add lib sourcing and enhanced modes

**Prerequisites:**
- None (first task)

**Implementation Steps:**
1. Create the `scripts/cleanup/lib` subdirectory for modular functions
2. Modify `code-cleanup.sh` to:
   - Add `set -euo pipefail` for strict error handling (upgrade from `set -e`)
   - Add source statements for lib scripts
   - Add new modes: `sanitize`, `full` (analysis + sanitize + report)
3. Create stub lib scripts that will be implemented in subsequent tasks
4. Ensure `reports/` directory is gitignored (check `.gitignore`)

**Verification Checklist:**
- [x] `scripts/cleanup/code-cleanup.sh` still runs existing modes (js, py, all, audit)
- [x] `scripts/cleanup/lib/` directory exists with stub scripts
- [x] Running `./scripts/cleanup/code-cleanup.sh all` works as before

**Testing Instructions:**
- No unit tests for bash scripts in this project
- Verification is manual execution and output inspection
- Run `./scripts/cleanup/code-cleanup.sh audit` to verify existing functionality

**Commit Message Template:**
```
chore(scripts): add modular lib structure to cleanup script

- Add lib/ directory with stub modules
- Prepare code-cleanup.sh for enhanced functionality
```

---

### Task 2: Implement JavaScript/TypeScript Analysis Module

**Goal:** Create the analysis module that runs knip on frontend and puppeteer components, capturing dead code findings.

**Files to Modify/Create:**
- `scripts/cleanup/lib/analyze-js.sh` - Full implementation
- `frontend/knip.config.ts` - Knip configuration for frontend
- `puppeteer/knip.config.js` - Knip configuration for puppeteer

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**
1. Research knip configuration options for monorepo usage
2. Create `frontend/knip.config.ts`:
   - Set entry points to `src/main.tsx` and `src/pages/**/*.tsx`
   - Configure project files pattern for `src/**/*.{ts,tsx}`
   - Exclude test files from dead code detection
   - Ignore Vite/Tailwind config files
3. Create `puppeteer/knip.config.js`:
   - Set entry point to `src/server.js`
   - Configure project files for `src/**/*.js`
   - Exclude test files and config files
4. Implement `analyze-js.sh` functions:
   - `analyze_frontend()` - Run `npx knip` in frontend directory, capture JSON output
   - `analyze_puppeteer()` - Run `npx knip` in puppeteer directory, capture JSON output
   - `get_js_dead_code()` - Combine results into unified format
5. Handle knip exit codes (non-zero when issues found is expected)
6. Transform knip JSON output to match audit report schema

**Verification Checklist:**
- [x] `npx knip` runs successfully in `frontend/` directory
- [x] `npx knip` runs successfully in `puppeteer/` directory
- [x] `analyze_frontend` function returns JSON with dead code findings
- [x] `analyze_puppeteer` function returns JSON with dead code findings
- [x] Knip configs exclude test files from analysis

**Testing Instructions:**
- Run `cd frontend && npx knip --reporter json` and verify output
- Run `cd puppeteer && npx knip --reporter json` and verify output
- Source lib script and call functions to verify they work

**Commit Message Template:**
```
chore(scripts): implement JS/TS dead code analysis

- Add knip configuration for frontend component
- Add knip configuration for puppeteer component
- Implement analyze-js.sh with knip integration
```

---

### Task 3: Implement Python Analysis Module

**Goal:** Create the analysis module that runs vulture on backend Python lambdas, capturing dead code findings.

**Files to Modify/Create:**
- `scripts/cleanup/lib/analyze-py.sh` - Full implementation
- `backend/.vulture-whitelist.py` - Vulture whitelist for false positives

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**
1. Research vulture configuration and whitelist syntax
2. Create `backend/.vulture-whitelist.py`:
   - Whitelist Lambda handler function names (`lambda_handler`, `handler`)
   - Whitelist pytest fixtures if they appear as unused
   - Whitelist any `__all__` exports
3. Implement `analyze-py.sh` functions:
   - `analyze_backend()` - Run `uvx vulture` on backend/lambdas directory
   - `get_py_dead_code()` - Parse vulture output into JSON format
4. Handle vulture output format (plain text, needs parsing)
5. Exclude `.aws-sam/` directory from analysis
6. Exclude test files from dead code detection

**Verification Checklist:**
- [x] `uvx vulture backend/lambdas --exclude .aws-sam` runs without errors
- [x] Whitelist prevents false positives on Lambda handlers
- [x] `analyze_backend` function returns JSON with dead code findings
- [x] Output excludes `.aws-sam/build/` artifacts

**Testing Instructions:**
- Run `uvx vulture backend/lambdas --exclude .aws-sam` manually
- Verify Lambda handlers are not flagged (if they are, update whitelist)
- Source lib script and verify function output

**Commit Message Template:**
```
chore(scripts): implement Python dead code analysis

- Add vulture whitelist for Lambda handlers
- Implement analyze-py.sh with vulture integration
- Exclude .aws-sam build artifacts from analysis
```

---

### Task 4: Implement Secrets Detection Module

**Goal:** Integrate detect-secrets to scan for hardcoded high-entropy strings across all components.

**Files to Modify/Create:**
- `scripts/cleanup/lib/analyze-js.sh` - Add secrets scanning function
- `scripts/cleanup/lib/analyze-py.sh` - Add secrets scanning function
- `.secrets.baseline` - Baseline file for detect-secrets (gitignored)

**Prerequisites:**
- Tasks 2 and 3 complete

**Implementation Steps:**
1. Research detect-secrets configuration and baseline workflow
2. Add secrets scanning to analyze-js.sh:
   - `scan_js_secrets()` - Run detect-secrets on frontend and puppeteer
   - Exclude node_modules, dist, coverage directories
   - Exclude `.env*` files (already environment variables)
3. Add secrets scanning to analyze-py.sh:
   - `scan_py_secrets()` - Run detect-secrets on backend/lambdas
   - Exclude `.aws-sam/`, `__pycache__/`, `.venv/`
4. Configure detect-secrets to reduce false positives:
   - Disable base64 detector (too many false positives with encoded assets)
   - Keep high-entropy string detector active
   - Keep AWS key patterns active
5. Generate baseline file that can be updated as secrets are remediated

**Verification Checklist:**
- [x] `uvx detect-secrets scan frontend/src` runs without errors
- [x] `uvx detect-secrets scan puppeteer/src` runs without errors
- [x] `uvx detect-secrets scan backend/lambdas` runs without errors
- [x] Output identifies high-entropy strings with file:line references
- [x] False positive rate is acceptable (review output manually)

**Testing Instructions:**
- Run detect-secrets manually on each component
- Review findings for false positives
- Adjust plugin configuration if too noisy

**Commit Message Template:**
```
chore(scripts): implement secrets detection scanning

- Integrate detect-secrets for high-entropy string detection
- Configure plugins to reduce false positives
- Add scanning functions for all components
```

---

### Task 5: Implement Automated Sanitization Module

**Goal:** Create functions that automatically remove console.log, print statements, debugger statements, and commented-out code.

**Files to Modify/Create:**
- `scripts/cleanup/lib/sanitize.sh` - Full implementation

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**
1. Implement `remove_console_logs()`:
   - Use grep to find `console.log`, `console.warn`, `console.error`, `console.debug`, `console.info`
   - Preserve console statements in error handlers where they serve logging purpose
   - Use sed to remove single-line console statements
   - Handle multi-line console statements (template literals)
   - Track removed statements for audit report
2. Implement `remove_print_statements()`:
   - Find Python `print(` statements that aren't in string context
   - Exclude print statements in test files
   - Handle f-strings and multi-line prints
3. Implement `remove_debugger_statements()`:
   - Remove JavaScript `debugger;` statements
   - Remove Python `breakpoint()` and `pdb.set_trace()` calls
4. Implement `remove_commented_code()`:
   - This is complex—focus on obvious patterns:
     - Lines that are valid code syntax but commented
     - Blocks starting with `// if (`, `// function`, `// const`, etc.
     - Python `# def `, `# class `, `# if ` patterns
   - Be conservative—better to miss some than delete valid comments
5. Implement `remove_todo_comments()`:
   - Find `// TODO`, `// FIXME`, `// XXX`, `// HACK`
   - Find `# TODO`, `# FIXME`, `# XXX`, `# HACK`
   - Log findings but DO NOT auto-remove (they may be important)
   - Include in audit report for manual review

**Verification Checklist:**
- [x] `remove_console_logs` finds console.log statements from JS/TS files
- [x] `remove_print_statements` finds print() from Python files
- [x] `remove_debugger_statements` finds debugger/breakpoint calls
- [x] `find_todo_comments` logs but does not remove TODO/FIXME
- [x] No test files are modified by sanitization

**Testing Instructions:**
- Create a test file with various console.log patterns
- Run sanitization function and verify removal
- Verify original files are backed up or changes are tracked

**Commit Message Template:**
```
chore(scripts): implement automated sanitization module

- Add console.log/print/debugger removal functions
- Add commented-out code detection
- Add TODO/FIXME identification for audit
```

---

### Task 6: Implement Audit Report Generator

**Goal:** Create the report generation module that combines all analysis results into JSON and markdown formats.

**Files to Modify/Create:**
- `scripts/cleanup/lib/report.sh` - Full implementation

**Prerequisites:**
- Tasks 2, 3, 4, 5 complete

**Implementation Steps:**
1. Implement `generate_json_report()`:
   - Combine dead code findings from all analyzers
   - Include sanitization findings (console.log locations, etc.)
   - Include secrets findings
   - Add timestamp and summary statistics
   - Write to `reports/audit-report.json`
2. Implement `generate_markdown_report()`:
   - Create human-readable summary
   - Group findings by component (frontend, puppeteer, backend)
   - Group by category (dead code, sanitization, secrets)
   - Include file paths and line numbers for easy navigation
   - Write to `reports/audit-report.md`
3. Implement `print_summary()`:
   - Output key statistics to stdout
   - Total issues by category
   - Component with most issues
   - Recommended priority order for manual cleanup
4. Use `jq` for JSON manipulation (available on most systems)
   - If `jq` not available, fall back to Python json module via uvx

**Verification Checklist:**
- [x] `audit-report.json` is valid JSON (parseable by `jq`)
- [x] `audit-report.md` is valid Markdown
- [x] All analyzer outputs are included in report
- [x] Summary statistics are accurate
- [x] Report includes actionable file:line references

**Testing Instructions:**
- Run report generator with sample data
- Validate JSON with `jq . audit-report.json`
- Review markdown for formatting issues
- Verify statistics match raw data

**Commit Message Template:**
```
chore(scripts): implement audit report generator

- Add JSON report generation with full findings
- Add Markdown summary report for human review
- Add summary statistics output
```

---

### Task 7: Integrate Script Components and Run Analysis

**Goal:** Wire together all modules in the main script and execute to generate baseline audit.

**Files to Modify/Create:**
- `scripts/cleanup/code-cleanup.sh` - Full integration with lib modules

**Prerequisites:**
- Tasks 1-6 complete

**Implementation Steps:**
1. Update main script to source all lib modules
2. Implement main execution flow:
   ```
   main() {
     echo "Starting code hygiene analysis..."

     # Phase 1: Analysis
     analyze_frontend
     analyze_puppeteer
     analyze_backend
     scan_js_secrets
     scan_py_secrets

     # Phase 2: Automated fixes
     remove_console_logs
     remove_print_statements
     remove_debugger_statements

     # Phase 3: Report
     generate_json_report
     generate_markdown_report
     print_summary
   }
   ```
3. Add new execution mode `full`:
   - Existing `audit` mode: Skip automated fixes, only generate report
   - New `sanitize` mode: Apply sanitization fixes only
   - New `full` mode: analysis + sanitization + report generation
   - Default (`all`): Keep existing behavior for backward compatibility
4. Add timing output for each phase
5. Exit with code 1 if issues found (for CI integration potential)
6. Run full script execution and review output

**Verification Checklist:**
- [x] `./scripts/cleanup/code-cleanup.sh full` executes without errors
- [x] `reports/audit-report.json` generated with findings
- [x] `reports/audit-report.md` generated with summary
- [x] Sanitization findings generated for manual review
- [x] `npm run test` passes after automated fixes
- [x] Script completes in reasonable time (<5 minutes)

**Testing Instructions:**
- Run full script: `./scripts/cleanup/code-cleanup.sh full`
- Run analysis only: `./scripts/cleanup/code-cleanup.sh audit`
- Review generated reports in `reports/`
- Run test suite to verify no breakage

**Commit Message Template:**
```
chore(scripts): integrate cleanup script and run baseline analysis

- Wire together all analysis and sanitization modules
- Add command-line flags for execution modes
- Generate initial audit report baseline
```

---

### Task 8: Apply Automated Fixes and Verify Tests

**Goal:** Run the full cleanup script, apply all automated fixes, and ensure the test suite passes.

**Files to Modify/Create:**
- Various source files (automated modifications)
- `reports/audit-report.json` - Generated
- `reports/audit-report.md` - Generated

**Prerequisites:**
- Task 7 complete

**Implementation Steps:**
1. Ensure git working tree is clean (commit or stash any changes)
2. Run the cleanup script: `./scripts/cleanup/code-cleanup.sh full`
3. Review automated changes via `git diff`
4. Run full test suite: `npm run test`
5. If tests fail:
   - Identify which automated fix caused the failure
   - Adjust sanitization logic to be more conservative
   - Re-run cleanup and tests
6. If tests pass:
   - Review audit report for manual cleanup items
   - Commit automated fixes

**Verification Checklist:**
- [x] Sanitization findings generated for manual review
- [x] `npm run test:frontend` passes (66 tests)
- [x] `npm run test:backend` passes (78 tests, 2 skipped)
- [x] `cd puppeteer && npm run test` passes (38 tests)
- [x] Audit report exists and contains findings
- [x] No unintended file modifications

**Testing Instructions:**
- Run each component's test suite independently
- If failures occur, check if related to removed console statements
- Verify test assertions don't depend on console output

**Commit Message Template:**
```
chore: apply automated code sanitization

- Remove console.log/print/debugger statements
- Remove unused imports via knip --fix
- Generate baseline audit report for Phase 2
```

---

## Phase Verification

### Phase Complete When:
1. `scripts/cleanup/code-cleanup.sh full` executes successfully
2. `reports/audit-report.json` exists and contains valid data
3. `reports/audit-report.md` provides readable summary
4. All automated fixes have been applied
5. Full test suite passes: `npm run test`
6. All commits made with proper format

### Audit Report Contains:
- Dead code findings for frontend (from knip)
- Dead code findings for puppeteer (from knip)
- Dead code findings for backend (from vulture)
- Secrets/high-entropy string findings
- TODO/FIXME comment locations
- Summary statistics

### Integration Points Verified:
- [x] knip integrates with existing ESLint config
- [x] vulture integrates with existing Ruff config
- [x] Cleanup script respects .gitignore patterns
- [x] No modifications to node_modules, .aws-sam, or other artifacts

### Known Limitations:
- Knip may have false positives for dynamically imported modules
- Vulture may flag pytest fixtures as unused (whitelist needed)
- Commented-out code detection is heuristic, not AST-based
- Secrets detection may have false positives (manual review required)

### Technical Debt Introduced:
- None—this phase is foundational tooling

---

## Handoff to Phase 2

The audit report generated in this phase (`reports/audit-report.json`) is the primary input for Phases 2 and 3. Key sections:

1. **Dead Code** - Files and exports to delete
2. **Impactless Code** - Functions to trace and potentially delete
3. **Secrets** - Hardcoded strings to extract to environment variables
4. **TODO/FIXME** - Comments to review and remove
5. **Utility Duplicates** - Functions to consolidate (if detected)

Phase 2 focuses on **frontend cleanup** using this report. Phase 3 handles **puppeteer and backend cleanup**.
