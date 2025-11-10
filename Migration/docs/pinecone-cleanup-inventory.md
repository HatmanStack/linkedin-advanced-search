# Pinecone Cleanup Inventory

**Date:** 2025-11-09
**Total Pinecone References Found:** 231

## Summary

This document inventories all Pinecone-related code, infrastructure, tests, and documentation that will be removed as part of Phase 1 of the refactor.

---

## 1. Lambda Functions (DELETE - Complete Directories)

### λ linkedin-advanced-search-pinecone-indexer-prod/
**Location:** `lambda-processing/linkedin-advanced-search-pinecone-indexer-prod/`
**Action:** DELETE entire directory
**Purpose:** Processes DynamoDB Stream events to maintain Pinecone vector index
**Files:**
- `lambda_function.py` - Main indexer logic
- `requirements.txt` - Python dependencies including pinecone>=5.0.0
- `README.md` - Documentation

**Dependencies:**
- Uses OpenAI for embeddings
- Connects to Pinecone for vector storage
- Triggered by DynamoDB streams

---

### λ linkedin-advanced-search-pinecone-search-prod/
**Location:** `lambda-processing/linkedin-advanced-search-pinecone-search-prod/`
**Action:** DELETE entire directory
**Purpose:** Semantic search across LinkedIn profiles in Pinecone
**Files:**
- `index.js` - Main search logic
- `package.json` - Dependencies including @pinecone-database/pinecone
- `README.md` - Documentation

**Dependencies:**
- Uses Pinecone client for vector search
- Filters by user connections
- API Gateway integration

---

## 2. Test Files (DELETE)

### Python Tests
1. **test-pinecone-connectivity.py**
   - Location: `tests/test-pinecone-connectivity.py`
   - Action: DELETE
   - Purpose: Basic Pinecone connectivity tests

2. **test-pinecone-integration.py**
   - Location: `tests/test-pinecone-integration.py`
   - Action: DELETE
   - Purpose: Full integration tests for Pinecone indexing and search
   - References: 48+ occurrences of "pinecone"

### JavaScript Tests
3. **run-pinecone-search-tests.js**
   - Location: `tests/run-pinecone-search-tests.js`
   - Action: DELETE
   - Purpose: Test runner for Pinecone search functionality

### Test Documentation
4. **README-pinecone-search-tests.md**
   - Location: `tests/README-pinecone-search-tests.md`
   - Action: DELETE
   - Purpose: Documentation for Pinecone search tests

### Mixed Lambda Tests (REVIEW)
5. **test-lambda-unit.py**
   - Location: `tests/test-lambda-unit.py`
   - Action: REVIEW (may test multiple Lambdas)
   - Note: Need to check if exclusively Pinecone or mixed

---

## 3. Dependencies (MODIFY)

### Root package.json
**Location:** `package.json`
**Action:** REMOVE dependency line
**Dependency to remove:**
```json
"@pinecone-database/pinecone": "^6.1.1"
```
**Location in file:** devDependencies section

**Post-action:** Regenerate `package-lock.json` with `npm install`

---

## 4. Environment Variables (MODIFY)

### .env.example
**Location:** `.env.example`
**Action:** REMOVE lines (approximately lines 139-142)
**Variables to remove:**
```bash
# PINECONE_API_KEY=
# PINECONE_HOST=
# PINECONE_INDEX_NAME=
```

**Variable to KEEP:**
```bash
# OPENAI_API_KEY=  # Still used by LLM Lambda
```

---

## 5. CloudFormation Infrastructure (MODIFY)

### Templates to Update

1. **RAG-CloudStack/templates/lambdas.yaml**
   - Remove Pinecone indexer Lambda definition
   - Remove Pinecone search Lambda definition
   - Remove Pinecone parameters (PineconeApiKey, PineconeHost, PineconeIndexName)
   - Remove environment variables for Pinecone

2. **RAG-CloudStack/templates/apigw-http.yaml**
   - Remove `/pinecone-search` route
   - Remove Pinecone API Gateway integrations
   - Update CORS if needed

3. **RAG-CloudStack/deploy.sh**
   - Remove PINECONE_API_KEY parameter
   - Remove PINECONE_HOST parameter
   - Remove PINECONE_INDEX_NAME parameter
   - Remove NODE_ROUTE_PATH=/pinecone-search or update

4. **RAG-CloudStack/README.md**
   - Remove Pinecone section (~lines 63-74)
   - Remove Pinecone environment variables from examples
   - Remove MCP quickstart for Pinecone
   - Update API documentation to remove /pinecone-search route

---

## 6. Documentation (MODIFY)

### README.md (root)
**Location:** `README.md`
**Action:** MODIFY - Remove Pinecone references

**Sections to update:**
1. **Line 15:** Remove Pinecone badge
   ```markdown
   [![Pinecone](https://img.shields.io/badge/Pinecone-000000?logo=pinecone&logoColor=white)](https://www.pinecone.io/)
   ```

2. **Line 26:** Remove feature description
   ```markdown
   - **Semantic Profile Search**: Pinecone vector database for intelligent connection discovery
   ```

3. **Line 34:** Update Application Architecture
   - Remove "Pinecone vector search"

4. **Lines 43-51:** Update System Architecture diagram
   - Remove Pinecone references

5. **Line 57:** Remove Infrastructure component
   ```markdown
   - **Vector Search**: Pinecone for semantic profile matching
   ```

6. **Line 67:** Remove from prerequisites
   ```markdown
   - Pinecone API key
   ```

7. **Lines 122-125:** Delete Pinecone Vector Search subsection

8. **Lines 186-213:** DELETE entire "Work in Progress / To Do" section
   - This section includes stale Pinecone tasks
   - Must be completely removed

---

## 7. Other Code References (REVIEW/MODIFY)

### λ linkedin-advanced-search-profile-processing-dev/
**Location:** `lambda-processing/linkedin-advanced-search-profile-processing-dev/lambda_function.py`
**Action:** REVIEW - Check if Pinecone-related
**References found:**
- Line: `PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')`
- Line: `if not PINECONE_API_KEY: raise ValueError(...)`

**Decision needed:** Is this Lambda exclusively for Pinecone or does it have other purposes?

---

## 8. Search Results Summary

### Grep Results
```bash
# Total "pinecone" matches (case-insensitive): 231
grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration .

# "vector search" matches: ~10
grep -ri "vector.*search" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration .
```

### Files by Category

**Complete Deletion (19 files minimum):**
- 2 Lambda function directories (6+ files total)
- 4 test files
- Potentially 1 additional Lambda directory

**Modification (7+ files):**
- package.json
- package-lock.json (regenerated)
- .env.example
- README.md
- RAG-CloudStack/templates/lambdas.yaml
- RAG-CloudStack/templates/apigw-http.yaml
- RAG-CloudStack/deploy.sh
- RAG-CloudStack/README.md

---

## 9. Deletion Checklist

### Phase 1, Task 2: Delete Lambda Functions
- [ ] Delete `lambda-processing/linkedin-advanced-search-pinecone-indexer-prod/`
- [ ] Delete `lambda-processing/linkedin-advanced-search-pinecone-search-prod/`
- [ ] Review `lambda-processing/linkedin-advanced-search-profile-processing-dev/` (PINECONE_API_KEY references)

### Phase 1, Task 3: Delete Test Files
- [ ] Delete `tests/test-pinecone-connectivity.py`
- [ ] Delete `tests/test-pinecone-integration.py`
- [ ] Delete `tests/run-pinecone-search-tests.js`
- [ ] Delete `tests/README-pinecone-search-tests.md`
- [ ] Review `tests/test-lambda-unit.py` (check if Pinecone-only)

### Phase 1, Task 4: Update CloudFormation
- [ ] Modify `RAG-CloudStack/templates/lambdas.yaml`
- [ ] Modify `RAG-CloudStack/templates/apigw-http.yaml`
- [ ] Modify `RAG-CloudStack/deploy.sh`
- [ ] Modify `RAG-CloudStack/README.md`

### Phase 1, Task 5: Remove Dependencies
- [ ] Modify `package.json` (remove @pinecone-database/pinecone)
- [ ] Regenerate `package-lock.json`

### Phase 1, Task 6: Remove Environment Variables
- [ ] Modify `.env.example` (remove PINECONE_*)

### Phase 1, Task 7: Update Main README
- [ ] Modify `README.md` (remove all Pinecone references)
- [ ] Delete stale TODO section (lines 186-213)

---

## 10. Potential Broken Imports

After deletion, verify no broken imports remain:
- Frontend code calling `/pinecone-search` API endpoint
- CloudFormation referencing deleted Lambdas
- Test runners referencing deleted tests

---

## 11. No Hidden Dependencies Found

**Verified:**
- ✓ No Pinecone references in Lambda layers
- ✓ No additional environment files with Pinecone vars
- ✓ package-lock.json will be cleaned during Task 5

---

## Completion Criteria

**Phase 1 is complete when:**
```bash
# This command returns ZERO results:
grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration .

# Application builds:
npm run build

# Tests pass:
npm run test
```

---

**Inventory Complete**
**Ready for Phase 1, Task 2: Delete Pinecone Lambda Functions**
