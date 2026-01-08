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
scan_js_secrets() {
    echo "  → Scanning JS/TS for secrets..."

    local output_file="$REPORT_DIR/secrets-js-$TIMESTAMP.json"

    if ! check_tool "uvx" "pip install uv"; then
        echo "    ⚠ uvx not found, skipping secrets scan"
        JS_SECRETS="{}"
        return 1
    fi

    # Scan frontend and puppeteer with detect-secrets
    # Disable Base64HighEntropyString to reduce false positives
    local exclude_patterns=(
        '.*\.test\.(ts|tsx|js)$'
        'node_modules/.*'
        'dist/.*'
        'coverage/.*'
        '.*\.d\.ts$'
    )

    local exclude_args=""
    for pattern in "${exclude_patterns[@]}"; do
        exclude_args+=" --exclude-files '$pattern'"
    done

    # Scan frontend
    local frontend_results
    frontend_results=$(uvx detect-secrets scan "$REPO_ROOT/frontend/src" \
        --disable-plugin Base64HighEntropyString \
        --exclude-files '.*\.test\.(ts|tsx)$' \
        --exclude-files 'node_modules/.*' \
        --exclude-files '.*\.d\.ts$' \
        2>/dev/null) || true

    # Scan puppeteer
    local puppeteer_results
    puppeteer_results=$(uvx detect-secrets scan "$REPO_ROOT/puppeteer/src" \
        --disable-plugin Base64HighEntropyString \
        --exclude-files '.*\.test\.js$' \
        --exclude-files 'node_modules/.*' \
        2>/dev/null) || true

    # Combine results
    local frontend_secrets puppeteer_secrets
    frontend_secrets=$(echo "$frontend_results" | jq -r '.results // {}' 2>/dev/null || echo "{}")
    puppeteer_secrets=$(echo "$puppeteer_results" | jq -r '.results // {}' 2>/dev/null || echo "{}")

    # Create combined output
    cat > "$output_file" <<EOF
{
    "frontend": $frontend_secrets,
    "puppeteer": $puppeteer_secrets
}
EOF

    if [[ -f "$output_file" ]]; then
        JS_SECRETS=$(cat "$output_file")
        echo "    Report saved: $output_file"
    else
        JS_SECRETS="{}"
    fi

    # Count findings
    local total_secrets=0
    if command -v jq &> /dev/null; then
        local frontend_count puppeteer_count
        frontend_count=$(echo "$frontend_secrets" | jq 'keys | length' 2>/dev/null || echo "0")
        puppeteer_count=$(echo "$puppeteer_secrets" | jq 'keys | length' 2>/dev/null || echo "0")
        total_secrets=$((frontend_count + puppeteer_count))
    fi

    if [[ $total_secrets -gt 0 ]]; then
        echo "    ⚠ Found $total_secrets files with potential secrets"
    else
        echo "    ✓ No secrets detected"
    fi
}
