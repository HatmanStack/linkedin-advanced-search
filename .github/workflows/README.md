# GitHub Actions Workflows

## Claude Code Review

This workflow automatically triggers a Claude-powered code review on every push and pull request.

### Features

- **Automated Code Review**: Uses Claude Sonnet 4.5 to review all code changes
- **Smart Analysis**: Identifies bugs, security issues, performance problems, and best practice violations
- **PR Comments**: Posts review feedback directly on pull requests
- **Commit Comments**: Adds review comments to commits on push events
- **Artifact Storage**: Saves review artifacts for historical reference

### Setup Instructions

#### 1. Add Anthropic API Key to GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `ANTHROPIC_API_KEY`
5. Value: Your Anthropic API key (get one at https://console.anthropic.com/)
6. Click **Add secret**

#### 2. Enable Workflow Permissions

1. Go to **Settings** → **Actions** → **General**
2. Under "Workflow permissions", ensure:
   - ✅ Read and write permissions are enabled
   - ✅ Allow GitHub Actions to create and approve pull requests

#### 3. Usage

The workflow triggers automatically on:
- **Every push** to any branch
- **Pull request** events (opened, synchronized, reopened)

No manual intervention required! Claude will review your code and post feedback.

### Review Criteria

Claude analyzes code for:

1. **Code Quality Issues**
   - Bugs and logical errors
   - Security vulnerabilities
   - Performance bottlenecks
   - Anti-patterns

2. **Best Practices**
   - Modern JavaScript/TypeScript/Python patterns
   - Code organization and structure
   - Error handling
   - Type safety

3. **Testing**
   - Missing test coverage
   - Inadequate test scenarios
   - Test quality issues

4. **Documentation**
   - Missing or outdated docs
   - Unclear code comments
   - API documentation gaps

5. **Overall Assessment**
   - Approved ✅
   - Needs Minor Changes ⚠️
   - Needs Major Changes ❌

### Limitations

- **Diff Size**: Reviews are limited to ~50KB of changes (first 50KB if larger)
- **API Costs**: Each review consumes Anthropic API credits
- **Rate Limits**: Subject to Anthropic API rate limits

### Customization

To customize the review prompt or model, edit `.github/workflows/claude-code-review.yml`:

```javascript
// Change the model
model: 'claude-sonnet-4-5-20250929'  // or 'claude-opus-4-20250514'

// Adjust max tokens
max_tokens: 4096  // increase for more detailed reviews

// Modify the prompt
const prompt = `Your custom review instructions...`;
```

### Troubleshooting

**Review not appearing?**
- Check that `ANTHROPIC_API_KEY` is correctly set in repository secrets
- Verify workflow permissions are enabled
- Check Actions tab for workflow run errors

**API key errors?**
- Ensure your API key is valid and has sufficient credits
- Check if the key has proper permissions

**Diff too large?**
- The workflow automatically truncates diffs >50KB
- Consider splitting large changes into smaller commits

### Example Review Output

```markdown
## 🤖 Claude Code Review

### Code Quality Issues
- ⚠️ Line 45: Potential null pointer exception in `processUser()`
- 🔒 Line 78: SQL injection vulnerability - use parameterized queries
- 🐛 Line 120: Race condition in concurrent access

### Best Practices
- ✅ Good use of async/await patterns
- 💡 Consider extracting magic numbers to constants
- 📝 Add JSDoc comments for public API methods

### Testing
- ❌ No tests added for new `UserService` class
- ⚠️ Existing tests don't cover error scenarios

### Overall Assessment
**Needs Minor Changes** - Address security issues and add tests

---
*Automated review by Claude Sonnet 4.5*
```

### Disabling the Workflow

To temporarily disable automatic reviews:

1. Go to **Actions** tab
2. Select "Claude Code Review" workflow
3. Click the "..." menu → **Disable workflow**

Or delete/rename the workflow file:
```bash
git mv .github/workflows/claude-code-review.yml .github/workflows/claude-code-review.yml.disabled
```
