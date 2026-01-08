#!/bin/bash
# Python Analysis Module
# Uses vulture for dead code detection

# Analyze backend lambdas with vulture
analyze_backend() {
    echo "  → Analyzing backend with vulture..."

    local output_file="$REPORT_DIR/vulture-backend-$TIMESTAMP.txt"
    local json_file="$REPORT_DIR/vulture-backend-$TIMESTAMP.json"
    local whitelist="$REPO_ROOT/backend/.vulture-whitelist.py"

    if ! check_tool "uvx" "pip install uv"; then
        echo "    ⚠ uvx not found, skipping backend analysis"
        BACKEND_DEAD_CODE="{}"
        return 1
    fi

    # Run vulture with whitelist if it exists
    local vulture_args=(
        "$REPO_ROOT/backend/lambdas"
        "--exclude" "$REPO_ROOT/backend/.aws-sam,__pycache__"
        "--min-confidence" "80"
    )

    if [[ -f "$whitelist" ]]; then
        vulture_args+=("$whitelist")
    fi

    # Capture vulture output (plain text)
    if uvx vulture "${vulture_args[@]}" > "$output_file" 2>&1; then
        echo "    ✓ No dead code found in backend"
        BACKEND_DEAD_CODE='{"files": [], "issues": []}'
    else
        echo "    ✓ Vulture analysis complete (issues may have been found)"
    fi

    # Parse vulture output to JSON format
    if [[ -f "$output_file" ]] && [[ -s "$output_file" ]]; then
        parse_vulture_to_json "$output_file" "$json_file"
        if [[ -f "$json_file" ]]; then
            BACKEND_DEAD_CODE=$(cat "$json_file")
        else
            BACKEND_DEAD_CODE='{"files": [], "issues": []}'
        fi
        echo "    Report saved: $output_file"
    else
        BACKEND_DEAD_CODE='{"files": [], "issues": []}'
    fi
}

# Parse vulture text output to JSON format
parse_vulture_to_json() {
    local input_file="$1"
    local output_file="$2"

    # Vulture output format: filename:line: message (confidence% confidence)
    # Example: backend/lambdas/foo.py:42: unused variable 'x' (100% confidence)

    local files=()
    local issues=()

    while IFS= read -r line; do
        if [[ -z "$line" ]]; then
            continue
        fi

        # Parse the line
        local file_path line_num message confidence
        if [[ "$line" =~ ^([^:]+):([0-9]+):\ (.+)\ \(([0-9]+)%\ confidence\)$ ]]; then
            file_path="${BASH_REMATCH[1]}"
            line_num="${BASH_REMATCH[2]}"
            message="${BASH_REMATCH[3]}"
            confidence="${BASH_REMATCH[4]}"

            # Add to files array if not already present
            local found=0
            for f in "${files[@]}"; do
                if [[ "$f" == "$file_path" ]]; then
                    found=1
                    break
                fi
            done
            if [[ $found -eq 0 ]]; then
                files+=("$file_path")
            fi

            # Add issue as JSON object
            issues+=("{\"file\": \"$file_path\", \"line\": $line_num, \"message\": \"$message\", \"confidence\": $confidence}")
        fi
    done < "$input_file"

    # Build JSON output
    local files_json="["
    local first=1
    for f in "${files[@]}"; do
        if [[ $first -eq 0 ]]; then
            files_json+=", "
        fi
        files_json+="\"$f\""
        first=0
    done
    files_json+="]"

    local issues_json="["
    first=1
    for i in "${issues[@]}"; do
        if [[ $first -eq 0 ]]; then
            issues_json+=", "
        fi
        issues_json+="$i"
        first=0
    done
    issues_json+="]"

    cat > "$output_file" <<EOF
{
    "files": $files_json,
    "issues": $issues_json
}
EOF
}

# Get Python dead code findings
get_py_dead_code() {
    echo "$BACKEND_DEAD_CODE"
}

# Count dead code issues from vulture JSON
count_py_issues() {
    local json="$1"
    local issues_count=0

    if command -v jq &> /dev/null && [[ -n "$json" ]] && [[ "$json" != "{}" ]]; then
        issues_count=$(echo "$json" | jq -r '.issues | length // 0' 2>/dev/null || echo "0")
    fi

    echo "$issues_count issues"
}

# Scan Python for high-entropy strings (secrets)
scan_py_secrets() {
    echo "  → Scanning Python for secrets..."

    local output_file="$REPORT_DIR/secrets-py-$TIMESTAMP.json"

    if ! check_tool "uvx" "pip install uv"; then
        echo "    ⚠ uvx not found, skipping secrets scan"
        PY_SECRETS="{}"
        return 1
    fi

    # Scan backend lambdas with detect-secrets
    # Disable Base64HighEntropyString to reduce false positives
    local results
    results=$(uvx detect-secrets scan "$REPO_ROOT/backend/lambdas" \
        --disable-plugin Base64HighEntropyString \
        --exclude-files '\.aws-sam/.*' \
        --exclude-files '__pycache__/.*' \
        --exclude-files '.*_test\.py$' \
        --exclude-files 'test_.*\.py$' \
        2>/dev/null) || true

    # Extract results
    local secrets_results
    secrets_results=$(echo "$results" | jq -r '.results // {}' 2>/dev/null || echo "{}")

    # Create output
    cat > "$output_file" <<EOF
{
    "backend": $secrets_results
}
EOF

    if [[ -f "$output_file" ]]; then
        PY_SECRETS=$(cat "$output_file")
        echo "    Report saved: $output_file"
    else
        PY_SECRETS="{}"
    fi

    # Count findings
    local total_secrets=0
    if command -v jq &> /dev/null; then
        total_secrets=$(echo "$secrets_results" | jq 'keys | length' 2>/dev/null || echo "0")
    fi

    if [[ $total_secrets -gt 0 ]]; then
        echo "    ⚠ Found $total_secrets files with potential secrets"
    else
        echo "    ✓ No secrets detected"
    fi
}
