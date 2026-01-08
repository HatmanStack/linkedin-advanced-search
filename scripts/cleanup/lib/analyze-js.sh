#!/bin/bash
# JavaScript/TypeScript Analysis Module
# Uses knip for dead code detection

# Analyze frontend component with knip
analyze_frontend() {
    echo "  → Analyzing frontend with knip..."

    local output_file="$REPORT_DIR/knip-frontend-$TIMESTAMP.json"

    if ! check_tool "npx" "npm install -g npm"; then
        echo "    ⚠ npx not found, skipping frontend analysis"
        FRONTEND_DEAD_CODE="{}"
        return 1
    fi

    cd "$REPO_ROOT/frontend"

    # Run knip with JSON reporter, capture output
    if npx knip --reporter json > "$output_file" 2>/dev/null; then
        echo "    ✓ No dead code found in frontend"
    else
        # knip exits non-zero when issues found - that's expected
        echo "    ✓ Knip analysis complete (issues found)"
    fi

    # Store for report generation
    if [[ -f "$output_file" ]]; then
        FRONTEND_DEAD_CODE=$(cat "$output_file")
        echo "    Report saved: $output_file"
    else
        FRONTEND_DEAD_CODE="{}"
    fi

    cd "$REPO_ROOT"
}

# Analyze puppeteer component with knip
analyze_puppeteer() {
    echo "  → Analyzing puppeteer with knip..."

    local output_file="$REPORT_DIR/knip-puppeteer-$TIMESTAMP.json"

    if ! check_tool "npx" "npm install -g npm"; then
        echo "    ⚠ npx not found, skipping puppeteer analysis"
        PUPPETEER_DEAD_CODE="{}"
        return 1
    fi

    cd "$REPO_ROOT/puppeteer"

    # Run knip with JSON reporter, capture output
    if npx knip --reporter json > "$output_file" 2>/dev/null; then
        echo "    ✓ No dead code found in puppeteer"
    else
        # knip exits non-zero when issues found - that's expected
        echo "    ✓ Knip analysis complete (issues found)"
    fi

    # Store for report generation
    if [[ -f "$output_file" ]]; then
        PUPPETEER_DEAD_CODE=$(cat "$output_file")
        echo "    Report saved: $output_file"
    else
        PUPPETEER_DEAD_CODE="{}"
    fi

    cd "$REPO_ROOT"
}

# Get combined JS/TS dead code findings
get_js_dead_code() {
    # Return combined JSON structure
    cat <<EOF
{
    "frontend": $FRONTEND_DEAD_CODE,
    "puppeteer": $PUPPETEER_DEAD_CODE
}
EOF
}

# Count dead code issues from knip JSON output
count_js_issues() {
    local json="$1"
    local files_count=0
    local issues_count=0

    if command -v jq &> /dev/null && [[ -n "$json" ]] && [[ "$json" != "{}" ]]; then
        files_count=$(echo "$json" | jq -r '.files | length // 0' 2>/dev/null || echo "0")
        issues_count=$(echo "$json" | jq -r '.issues | length // 0' 2>/dev/null || echo "0")
    fi

    echo "$files_count files, $issues_count issues"
}

# Scan JS/TS for high-entropy strings (secrets)
# Implementation in Task 4
scan_js_secrets() {
    echo "  → Scanning JS/TS for secrets..."
    JS_SECRETS="{}"
}
