#!/bin/bash
# Code Cleanup Script for linkedin-advanced-search
# Uses AST-aware tools: knip (JS/TS), vulture (Python), ruff (Python)
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REPORT_DIR="$REPO_ROOT/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== Code Cleanup Script ==="
echo "Repository: $REPO_ROOT"
echo "Timestamp: $TIMESTAMP"
echo ""

# Check for required tools
check_tool() {
    if ! command -v "$1" &> /dev/null; then
        echo "WARNING: $1 not found. Install with: $2"
        return 1
    fi
    return 0
}

# --- JavaScript/TypeScript Cleanup ---
js_cleanup() {
    echo "=== JavaScript/TypeScript Cleanup ==="

    # Run knip for unused exports/dependencies detection
    if check_tool "npx" "npm install -g npm"; then
        echo "Running knip for dead code detection..."
        cd "$REPO_ROOT"
        npx knip --reporter json > "$REPORT_DIR/knip-report-$TIMESTAMP.json" 2>/dev/null || true
        echo "Knip report saved to: $REPORT_DIR/knip-report-$TIMESTAMP.json"
    fi

    # Lint check with strict mode
    echo "Running ESLint (strict)..."
    cd "$REPO_ROOT/frontend"
    npm run lint 2>&1 || echo "ESLint found issues (expected during cleanup)"

    cd "$REPO_ROOT/puppeteer"
    npm run lint 2>&1 || echo "ESLint found issues (expected during cleanup)"
}

# --- Python Cleanup ---
py_cleanup() {
    echo ""
    echo "=== Python Cleanup ==="

    # Run vulture for dead code detection
    if check_tool "uvx" "pip install uv"; then
        echo "Running vulture for dead code detection..."
        uvx vulture "$REPO_ROOT/backend/lambdas" \
            --exclude "$REPO_ROOT/backend/.aws-sam" \
            --min-confidence 80 \
            > "$REPORT_DIR/vulture-report-$TIMESTAMP.txt" 2>&1 || true
        echo "Vulture report saved to: $REPORT_DIR/vulture-report-$TIMESTAMP.txt"
    fi

    # Run ruff with T20 (print) and ERA (commented code) rules
    echo "Running Ruff linting..."
    cd "$REPO_ROOT/backend"
    uvx ruff check lambdas --exclude .aws-sam 2>&1 || echo "Ruff found issues (expected during cleanup)"
}

# --- Generate Summary ---
generate_summary() {
    echo ""
    echo "=== Cleanup Summary ==="
    echo "Reports generated in: $REPORT_DIR"
    echo ""
    echo "Files checked:"
    find "$REPO_ROOT/frontend/src" -name "*.ts" -o -name "*.tsx" | wc -l | xargs echo "  - TypeScript files:"
    find "$REPO_ROOT/puppeteer/src" -name "*.js" | wc -l | xargs echo "  - Puppeteer JS files:"
    find "$REPO_ROOT/backend/lambdas" -name "*.py" ! -path "*/.aws-sam/*" | wc -l | xargs echo "  - Python Lambda files:"
    echo ""
    echo "To view reports:"
    echo "  cat $REPORT_DIR/knip-report-$TIMESTAMP.json"
    echo "  cat $REPORT_DIR/vulture-report-$TIMESTAMP.txt"
}

# --- Main ---
main() {
    mkdir -p "$REPORT_DIR"

    case "${1:-all}" in
        js)
            js_cleanup
            ;;
        py)
            py_cleanup
            ;;
        all)
            js_cleanup
            py_cleanup
            generate_summary
            ;;
        audit)
            echo "Audit-only mode: generating reports without modifications"
            js_cleanup
            py_cleanup
            generate_summary
            ;;
        *)
            echo "Usage: $0 [js|py|all|audit]"
            exit 1
            ;;
    esac
}

main "$@"
