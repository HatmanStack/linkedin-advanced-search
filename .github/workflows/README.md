# GitHub Actions Workflows

## Claude Code Action

This repository uses the official [Anthropic Claude Code GitHub Action](https://github.com/anthropics/claude-code-action) for AI-powered code assistance.

### How to Use

Simply mention `@claude` in:
- **Issue comments**
- **Pull request comments**
- **Pull request reviews**
- **New issues** (in title or body)

Claude will respond with code analysis, suggestions, fixes, or implement features based on your request.

### Examples

**In a PR comment:**
```
@claude Review this code for security issues
```

**In an issue:**
```
@claude Implement user authentication using OAuth
```

**In a PR review:**
```
@claude Refactor this function to improve performance
```

### Setup

The workflow requires the `CLAUDE_CODE_OAUTH_TOKEN` secret to be configured in your repository.

If you have Claude Code installed locally, run:
```bash
claude
/install-github-app
```

This will guide you through:
1. Installing the Claude GitHub app
2. Configuring required secrets
3. Setting up repository permissions

### Permissions

The action has the following permissions:
- **Read**: contents, pull-requests, issues, actions (to read CI results)
- **Write**: contents, pull-requests, issues (to respond and make changes)
- **ID token**: For OAuth authentication

### Customization

To customize Claude's behavior, uncomment and modify the optional parameters in `claude.yml`:

```yaml
# Custom prompt (overrides @claude comment)
prompt: 'Review for performance issues'

# Additional configuration
claude_args: '--allowed-tools Bash(gh pr:*)'
```

For more options, see:
- [Usage Documentation](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)
- [CLI Reference](https://docs.claude.com/en/docs/claude-code/cli-reference)

### Workflow Triggers

The action runs when:
- ✅ Issue comments containing `@claude` are created
- ✅ PR review comments containing `@claude` are created
- ✅ PR reviews containing `@claude` are submitted
- ✅ Issues mentioning `@claude` are opened or assigned

### Troubleshooting

**Claude not responding?**
- Verify `CLAUDE_CODE_OAUTH_TOKEN` is set in repository secrets
- Check that the Claude GitHub app is installed on your repository
- Ensure workflow permissions are enabled in Settings → Actions → General

**Permission errors?**
- Go to Settings → Actions → General
- Enable "Read and write permissions"
- Allow GitHub Actions to create and approve pull requests

For more help, visit the [Claude Code documentation](https://docs.claude.com/en/docs/claude-code/github-actions).
