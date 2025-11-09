# Rollback Procedures

**Purpose:** Step-by-step instructions for rolling back changes if issues occur during the refactor.

**Last Updated:** 2025-11-09

---

## Overview

This document provides rollback procedures for each phase of the refactor. Use these procedures if:
- Critical bugs are discovered after implementation
- Testing reveals the refactor breaks core functionality
- Decision is made to revert to Pinecone-based architecture
- Need to return to a stable state for any reason

**General Principle:** Each phase should be committed separately, allowing granular rollback.

---

## Git Rollback Procedures

### Rollback Last Commit
```bash
# View last commit
git log -1

# Soft rollback (keeps changes in working directory)
git reset --soft HEAD~1

# Hard rollback (discards all changes - USE WITH CAUTION)
git reset --hard HEAD~1
```

### Rollback to Specific Commit
```bash
# Find commit hash
git log --oneline | grep "Phase"

# Rollback to commit (keeps changes)
git reset --soft <commit-hash>

# Rollback to commit (discards changes)
git reset --hard <commit-hash>
```

### Rollback Pushed Changes
```bash
# Create revert commit (safe for shared branches)
git revert <commit-hash>
git push origin <branch-name>

# Force push (ONLY if no one else is using branch)
git reset --hard <commit-hash>
git push --force origin <branch-name>
```

---

## Phase-Specific Rollback Procedures

### Phase 0.5: Codebase Exploration

**What was done:**
- Created documentation files only (no code changes)

**Rollback:**
```bash
# No rollback needed - documentation only
# If needed, delete documentation:
rm Migration/docs/codebase-map.md
rm Migration/docs/prerequisite-validation.md
rm Migration/docs/linkedin-html-snapshot.html
rm Migration/docs/linkedin-selectors.md
```

**Impact:** None - no code changes

---

### Phase 1: Code Cleanup & Dead Code Removal

**What was done:**
- Deleted Pinecone Lambda functions
- Deleted Pinecone test files
- Removed `@pinecone-database/pinecone` dependency
- Updated CloudFormation templates
- Removed Pinecone environment variables
- Updated README.md

**Rollback Procedure:**

1. **Restore deleted files from git:**
   ```bash
   # Get commit hash before Phase 1
   git log --oneline | grep "before Phase 1"

   # Restore specific directories
   git checkout <commit-hash> -- lambda-processing/linkedin-advanced-search-pinecone-indexer-prod
   git checkout <commit-hash> -- lambda-processing/linkedin-advanced-search-pinecone-search-prod
   git checkout <commit-hash> -- tests/test-pinecone-connectivity.py
   git checkout <commit-hash> -- tests/test-pinecone-integration.py
   git checkout <commit-hash> -- tests/run-pinecone-search-tests.js
   git checkout <commit-hash> -- tests/README-pinecone-search-tests.md
   ```

2. **Restore package.json:**
   ```bash
   git checkout <commit-hash> -- package.json package-lock.json
   npm install
   ```

3. **Restore CloudFormation templates:**
   ```bash
   git checkout <commit-hash> -- RAG-CloudStack/templates/lambdas.yaml
   git checkout <commit-hash> -- RAG-CloudStack/templates/apigw-http.yaml
   git checkout <commit-hash> -- RAG-CloudStack/deploy.sh
   git checkout <commit-hash> -- RAG-CloudStack/README.md
   ```

4. **Restore environment variables:**
   ```bash
   git checkout <commit-hash> -- .env.example
   ```

5. **Restore README.md:**
   ```bash
   git checkout <commit-hash> -- README.md
   ```

6. **Redeploy CloudFormation stack:**
   ```bash
   cd RAG-CloudStack
   # Re-package Pinecone Lambdas
   cd ../lambda-processing/linkedin-advanced-search-pinecone-indexer-prod
   zip -r pinecone-indexer.zip .
   aws s3 cp pinecone-indexer.zip s3://artifacts-bucket/lambdas/

   cd ../linkedin-advanced-search-pinecone-search-prod
   zip -r pinecone-search.zip .
   aws s3 cp pinecone-search.zip s3://artifacts-bucket/lambdas/

   cd ../../RAG-CloudStack
   bash deploy.sh # With original parameters including Pinecone config
   ```

**Impact:** Pinecone functionality restored, but any data ingested during refactor will be lost

---

### Phase 2: Puppeteer Refactor for Text Extraction

**What was done:**
- Created TextExtractionService
- Added profile field extractors
- Integrated with LinkedInContactService
- Added text formatting utilities
- Added extraction configuration

**Rollback Procedure:**

1. **Revert all Phase 2 commits:**
   ```bash
   # Find first Phase 2 commit
   git log --oneline | grep "Phase 2"

   # Revert range of commits
   git revert <first-phase2-commit>^..<last-phase2-commit>
   ```

2. **OR selectively remove Phase 2 changes:**
   ```bash
   # Remove new service files
   rm puppeteer-backend/services/textExtractionService.js
   rm puppeteer-backend/utils/textFormatter.js
   rm puppeteer-backend/schemas/profileTextSchema.js
   rm puppeteer-backend/config/extractionConfig.js

   # Restore LinkedInContactService
   git checkout <commit-before-phase2> -- puppeteer-backend/services/linkedinContactService.js

   # Restore config
   git checkout <commit-before-phase2> -- puppeteer-backend/config/index.js
   ```

3. **Restart Puppeteer backend:**
   ```bash
   cd puppeteer-backend
   npm start
   # Test that screenshot functionality still works
   ```

**Impact:** Text extraction disabled, but screenshots and core functionality remain

---

### Phase 3: S3 Integration & Upload

**What was done:**
- Created S3TextUploadService
- Added S3 upload to profile workflow
- Updated DynamoDB to store S3 URLs
- Added S3 utilities and metrics

**Rollback Procedure:**

1. **Revert Phase 3 commits:**
   ```bash
   git log --oneline | grep "Phase 3"
   git revert <first-phase3-commit>^..<last-phase3-commit>
   ```

2. **OR remove S3 upload integration:**
   ```bash
   # Remove new service
   rm puppeteer-backend/services/s3TextUploadService.js
   rm puppeteer-backend/utils/s3Helpers.js
   rm puppeteer-backend/utils/uploadMetrics.js

   # Restore LinkedInContactService (undo S3 upload integration)
   git checkout <commit-before-phase3> -- puppeteer-backend/services/linkedinContactService.js

   # Restore config
   git checkout <commit-before-phase3> -- puppeteer-backend/config/index.js
   git checkout <commit-before-phase3> -- .env.example
   ```

3. **Remove S3 files (optional):**
   ```bash
   # List uploaded text files
   aws s3 ls s3://bucket-name/profiles/

   # Delete if needed (CAUTION: Permanent)
   aws s3 rm s3://bucket-name/profiles/ --recursive
   ```

4. **Update DynamoDB schema (if needed):**
   - Manually remove `text_s3_key` and `text_s3_url` fields from existing records
   - Or leave fields (they won't break anything if unused)

**Impact:** S3 text upload disabled, text extraction may still run but won't upload

---

### Phase 4: Placeholder Search API Implementation

**What was done:**
- Created placeholder search Lambda
- Updated CloudFormation templates
- Deployed new API Gateway route (/search)

**Rollback Procedure:**

1. **Remove Lambda and CloudFormation changes:**
   ```bash
   git checkout <commit-before-phase4> -- lambda-processing/linkedin-advanced-search-placeholder-search-prod
   git checkout <commit-before-phase4> -- RAG-CloudStack/templates/lambdas.yaml
   git checkout <commit-before-phase4> -- RAG-CloudStack/templates/apigw-http.yaml
   git checkout <commit-before-phase4> -- RAG-CloudStack/deploy.sh
   ```

2. **Redeploy CloudFormation stack (without placeholder search):**
   ```bash
   cd RAG-CloudStack
   bash deploy.sh # Will remove placeholder search Lambda and route
   ```

3. **Delete placeholder search Lambda manually (if needed):**
   ```bash
   aws lambda delete-function --function-name linkedin-advanced-search-placeholder-search
   ```

**Impact:** Search API endpoint returns 404; frontend search will fail

---

### Phase 5: Frontend Integration & Testing

**What was done:**
- Updated lambdaApiService with searchProfiles method
- Updated useSearchResults hook
- Modified search UI components
- Updated environment variables

**Rollback Procedure:**

1. **Revert frontend changes:**
   ```bash
   git checkout <commit-before-phase5> -- src/services/lambdaApiService.ts
   git checkout <commit-before-phase5> -- src/hooks/useSearchResults.ts
   git checkout <commit-before-phase5> -- src/components/
   git checkout <commit-before-phase5> -- .env.example
   ```

2. **Rebuild frontend:**
   ```bash
   npm install
   npm run build
   ```

3. **Test frontend:**
   ```bash
   npm run dev
   # Verify search functionality (may not work if Pinecone is removed)
   ```

**Impact:** Frontend search reverted; if Pinecone removed, search won't work

---

## CloudFormation Stack Rollback

### View Stack History
```bash
aws cloudformation describe-stack-events \
  --stack-name linkedin-advanced-search-stack \
  --max-items 50 \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]' \
  --output table
```

### Rollback to Previous Stack Version
```bash
# CloudFormation doesn't support "rollback to previous version" directly
# Must redeploy with previous template

# 1. Retrieve previous template from git
git checkout <commit-hash> -- RAG-CloudStack/templates/

# 2. Redeploy stack
cd RAG-CloudStack
bash deploy.sh
```

### Delete Stack and Recreate
```bash
# WARNING: This deletes all resources (DynamoDB, Lambdas, etc.)
# Only use if complete reset needed

# 1. Delete stack
aws cloudformation delete-stack --stack-name linkedin-advanced-search-stack

# 2. Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name linkedin-advanced-search-stack

# 3. Recreate from previous template
git checkout <commit-hash> -- RAG-CloudStack/
cd RAG-CloudStack
bash deploy.sh
```

---

## Database Rollback

### DynamoDB Considerations

**WARNING:** DynamoDB does not support "rollback" - data changes are permanent.

**Options:**

1. **Point-in-Time Recovery (if enabled):**
   ```bash
   # Check if PITR enabled
   aws dynamodb describe-continuous-backups \
     --table-name linkedin-advanced-search

   # Restore to timestamp
   aws dynamodb restore-table-to-point-in-time \
     --source-table-name linkedin-advanced-search \
     --target-table-name linkedin-advanced-search-restored \
     --restore-date-time 2025-11-09T12:00:00Z
   ```

2. **Remove new fields manually:**
   - New fields added in refactor: `text_s3_key`, `text_s3_url`, `fulltext`, etc.
   - Leaving these fields is harmless if code doesn't use them
   - To remove: Write script to scan and update items

3. **Restore from backup (if exists):**
   ```bash
   # List backups
   aws dynamodb list-backups --table-name linkedin-advanced-search

   # Restore from backup
   aws dynamodb restore-table-from-backup \
     --target-table-name linkedin-advanced-search \
     --backup-arn <backup-arn>
   ```

---

## S3 Rollback

### Remove Profile Text Files
```bash
# List files
aws s3 ls s3://bucket-name/profiles/

# Delete all (CAUTION: Permanent)
aws s3 rm s3://bucket-name/profiles/ --recursive

# Or delete specific files
aws s3 rm s3://bucket-name/profiles/profile-id.json
```

### Restore Previous S3 Bucket Policy
```bash
# If bucket policy was modified, restore from git
git checkout <commit-hash> -- scripts/s3-bucket-policy.json

# Apply previous policy
aws s3api put-bucket-policy \
  --bucket bucket-name \
  --policy file://scripts/s3-bucket-policy.json
```

---

## Testing After Rollback

### Verification Checklist

After any rollback, verify:

- [ ] Application builds: `npm run build`
- [ ] Tests pass: `npm run test`
- [ ] Puppeteer backend starts: `cd puppeteer-backend && npm start`
- [ ] Frontend loads: `npm run dev`
- [ ] Core features work:
  - [ ] LinkedIn login
  - [ ] Profile scraping
  - [ ] Screenshot capture
  - [ ] Connection management
  - [ ] Messaging (if implemented)
  - [ ] Posting (if implemented)
- [ ] CloudFormation stack healthy:
  ```bash
  aws cloudformation describe-stacks --stack-name linkedin-advanced-search-stack
  ```
- [ ] Lambda functions healthy:
  ```bash
  aws lambda list-functions --query 'Functions[*].FunctionName'
  ```
- [ ] No errors in CloudWatch logs

---

## Emergency Contacts & Resources

### Documentation
- [Phase 0: Foundation](./plans/Phase-0.md)
- [Codebase Map](./codebase-map.md)
- [Environment Variables](./environment-variables.md)

### AWS Resources
- CloudFormation Console: https://console.aws.amazon.com/cloudformation
- Lambda Console: https://console.aws.amazon.com/lambda
- DynamoDB Console: https://console.aws.amazon.com/dynamodb
- CloudWatch Logs: https://console.aws.amazon.com/cloudwatch

### Git Resources
```bash
# View all commits
git log --oneline --graph

# Find when file was changed
git log --follow <file-path>

# Compare branches
git diff <branch1>..<branch2>
```

---

## Prevention Best Practices

To minimize need for rollbacks:

1. **Commit frequently** - Atomic commits per task
2. **Test before committing** - Run tests after each change
3. **Branch strategy** - Use feature branches, merge after testing
4. **Backup before Phase 1** - Take snapshot before deleting code
5. **CloudFormation changesets** - Review changes before applying
6. **Staging environment** - Test in staging before production
7. **Feature flags** - Use flags to enable/disable new features

---

**Last Updated:** 2025-11-09
**Status:** Ready for use during refactor
