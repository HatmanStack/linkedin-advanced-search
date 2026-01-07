# Phase 0: Foundation

## Phase Goal

Establish architectural decisions, deployment automation, and testing strategy that govern all subsequent phases. This phase produces no runtime code but creates the infrastructure scaffolding and documentation that implementation phases inherit.

**Success Criteria:**
- ADRs documented for key technical decisions
- Deployment script specifications defined
- Testing strategy established with mocking approach
- Shared patterns and conventions documented

**Estimated Tokens:** ~15,000

---

## Architecture Decision Records (ADRs)

### ADR-001: Dedicated RAGStack Instance

**Context:** Need to choose between shared RAGStack deployment, dedicated instance, or direct Bedrock KB integration.

**Decision:** Deploy a dedicated RAGStack-Lambda stack (`linkedin-profiles-kb`) for this project.

**Rationale:**
- Isolation: Profile data stays separate from other knowledge bases
- Simplicity: No multi-tenant complexity
- Control: Independent scaling, updates, and lifecycle management
- Cost transparency: Clear attribution of Bedrock/S3 costs

**Consequences:**
- Additional CloudFormation stack to manage
- Separate deployment pipeline
- Own API endpoint and API key

---

### ADR-002: Text Ingestion Without OCR

**Context:** LinkedIn profiles can be captured as screenshots (requiring OCR) or extracted as structured text via DOM scraping.

**Decision:** Use existing `TextExtractionService` to generate markdown documents for ingestion. No OCR.

**Rationale:**
- Cost: Textract OCR costs ~$0.15/page; text extraction is free
- Quality: Direct DOM extraction is more accurate than OCR
- Speed: No image processing latency
- Existing code: `TextExtractionService` already extracts name, headline, experience, education, skills, about

**Consequences:**
- Must generate well-structured markdown from JSON profile data
- Dependent on LinkedIn DOM selectors (existing maintenance burden)
- Lose visual layout information (acceptable for search)

---

### ADR-003: Ingestion Triggers

**Context:** Need to determine when profiles enter the knowledge base.

**Decision:** Ingest profiles only when a relationship is established:
1. After `sendConnectionRequest()` succeeds
2. After `followProfile()` succeeds (new feature)
3. During profile-init for existing connections

**Rationale:**
- Data relevance: Only ingest profiles you have a relationship with
- Cost control: Don't ingest "possible" contacts that may never be pursued
- Privacy: Limit stored data to actual network
- Future flexibility: Contact processing rework planned for separate PR

**Consequences:**
- "Possible" contacts from search are NOT searchable until acted upon
- Need to track ingestion status per profile
- Follow functionality must be implemented

---

### ADR-004: Search Architecture

**Context:** Choose between text search, chat interface, or hybrid.

**Decision:** Text search only via RAGStack's `searchKnowledgeBase` query.

**Rationale:**
- Simplicity: Text search covers 90%+ of use cases
- Cost: No LLM inference cost per search (embeddings only)
- Performance: Direct vector search is faster than RAG chat
- Extensibility: Chat can be added later on same KB

**Consequences:**
- No conversational refinement
- No synthesis/aggregation queries
- Users get profile matches, not natural language answers

---

### ADR-005: Security Model

**Context:** RAGStack API contains sensitive LinkedIn profile data.

**Decision:** Keep RAGStack API private with API key auth. All requests proxied through linkedin-advanced-search backend.

**Rationale:**
- Data protection: Profile PII not exposed to browser
- Cost protection: Prevent unauthorized query costs
- Audit trail: All access logged through our API
- Consistency: Matches existing auth pattern (Cognito → Backend → Lambda)

**Architecture:**
```
Browser → linkedin-advanced-search API (Cognito JWT)
       → Backend Lambda (has RAGStack API key)
       → RAGStack GraphQL (API key auth)
```

**Consequences:**
- Additional Lambda for proxying
- API key must be stored securely (Secrets Manager or SSM)
- Slight latency increase from proxy hop

---

### ADR-006: Result Hydration Pattern

**Context:** RAGStack returns document IDs/sources. UI needs full profile cards.

**Decision:** RAGStack returns profile IDs → fetch full profile cards from DynamoDB → display with existing components.

**Rationale:**
- Single source of truth: DynamoDB has authoritative profile data
- UI consistency: Reuse existing `ConnectionCard` components
- Flexibility: Can add/change displayed fields without re-ingesting

**Flow:**
```
Search query → RAGStack → profile IDs (100 max)
            → DynamoDB batch get → full profiles
            → existing filtering → display cards
```

**Consequences:**
- Two-step data fetch (RAGStack + DynamoDB)
- Must maintain profile ID consistency between systems
- Existing client-side filtering still works on results

---

## Tech Stack

### RAGStack Instance
- **Stack Name:** `linkedin-profiles-kb`
- **Region:** Same as linkedin-advanced-search (us-west-2 or configured)
- **Embedding Model:** Amazon Nova Multimodal Embeddings v1
- **Storage:** S3 Vectors (not OpenSearch)
- **API:** AppSync GraphQL with API key auth

### New Components in linkedin-advanced-search
| Component | Technology | Location |
|-----------|------------|----------|
| RAGStack Proxy Lambda | Python 3.13 | `backend/lambdas/ragstack-proxy/` |
| Ingestion Trigger | Python (in edge-processing) | `backend/lambdas/edge-processing/` |
| Profile Markdown Generator | JavaScript | `puppeteer/src/domains/profile/utils/` |
| Search Service | TypeScript | `frontend/src/shared/services/` |
| Search Hook | TypeScript | `frontend/src/features/connections/hooks/` |

### Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `gql` | ^3.x | GraphQL client for RAGStack API |
| `graphql-request` | ^6.x | Lightweight GraphQL HTTP client |

---

## Deployment Script Specification

### Script: `npm run deploy:ragstack`

**Location:** `scripts/deploy-ragstack.js`

**Behavior:**

1. **Check Local Config**
   - Look for `.ragstack-config.json` (git-ignored)
   - If missing, prompt for required values

2. **Required Configuration:**
   ```json
   {
     "stackName": "linkedin-profiles-kb",
     "region": "us-west-2",
     "ragstackPath": "~/war/RAGStack-Lambda",
     "s3Bucket": "linkedin-profiles-kb-{accountId}",
     "bedrockModelAccess": true
   }
   ```

3. **Generate samconfig.toml**
   - Build from local config values
   - DO NOT use `sam deploy --guided`
   - Write to RAGStack-Lambda directory

4. **Execute Deployment**
   ```bash
   cd {ragstackPath}
   sam build
   sam deploy --config-file samconfig.toml
   ```

5. **Capture Outputs**
   - GraphQL endpoint URL
   - API key ID
   - Knowledge base ID
   - Data source IDs

6. **Update Environment**
   - Write to `.env.ragstack` (git-ignored)
   - Format:
     ```
     RAGSTACK_GRAPHQL_ENDPOINT=https://xxx.appsync-api.region.amazonaws.com/graphql
     RAGSTACK_API_KEY=da2-xxxxxxxxxxxx
     RAGSTACK_KB_ID=XXXXXXXXXX
     ```

### Script: `npm run deploy` (existing, enhanced)

**Modifications:**
- Add step to check for `.env.ragstack`
- If present, inject RAGStack env vars into SAM parameters
- Pass to backend Lambdas that need RAGStack access

---

## Testing Strategy

### Unit Tests
- **Location:** `tests/` directories in each package
- **Framework:**
  - Frontend: Vitest + React Testing Library (existing)
  - Backend: pytest + pytest-mock (existing)
  - Puppeteer: Vitest (must be set up in Phase 1, Task 1)
- **Coverage Target:** 80% for new code

**Note:** Puppeteer currently has no test infrastructure. Phase 1 Task 1 must establish Vitest before any puppeteer tests can be written.

### Mocking Approach

**RAGStack API Mocks:**
```python
# Mock GraphQL responses
@pytest.fixture
def mock_ragstack_client():
    return Mock(
        search=Mock(return_value={
            "results": [
                {"content": "...", "source": "profile_abc123", "score": 0.95}
            ]
        }),
        ingest=Mock(return_value={"status": "success", "documentId": "..."})
    )
```

**DynamoDB Mocks:**
```python
# Use moto for DynamoDB mocking
@pytest.fixture
def dynamodb_table():
    with mock_aws():
        dynamodb = boto3.resource('dynamodb', region_name='us-west-2')
        table = dynamodb.create_table(...)
        yield table
```

**Frontend Service Mocks:**
```typescript
// Mock search service
vi.mock('@/services/ragstackSearchService', () => ({
  searchProfiles: vi.fn().mockResolvedValue({
    profileIds: ['abc123', 'def456'],
    totalResults: 2
  })
}));
```

### Integration Tests (Mocked)

All integration tests run against mocked services to ensure CI compatibility:
- Mock RAGStack GraphQL endpoint responses
- Mock DynamoDB with moto
- Mock S3 operations with moto
- No live AWS calls in CI

### CI Pipeline Configuration

**GitHub Actions:** `.github/workflows/ci.yml`

```yaml
# Tests run without AWS credentials
# All external services mocked
# RAGStack tests use recorded GraphQL responses
```

---

## Shared Patterns and Conventions

### Profile ID Consistency

Profile IDs use base64-encoded LinkedIn URLs throughout:
```
LinkedIn URL: https://www.linkedin.com/in/johndoe
Profile ID: aHR0cHM6Ly93d3cubGlua2VkaW4uY29tL2luL2pvaG5kb2U=
```

Both DynamoDB and RAGStack use this same ID for correlation.

### Markdown Profile Format

Standard markdown structure for ingestion:
```markdown
# {name}

**Headline:** {headline}
**Location:** {location}
**Profile ID:** {profile_id}

## About
{about_text}

## Current Position
- **Title:** {current_title}
- **Company:** {current_company}
- **Duration:** {start_date} - Present

## Experience
### {company_1}
**{title_1}** | {dates_1}
{description_1}

### {company_2}
...

## Education
### {school_1}
{degree_1} in {field_1} | {dates_1}

## Skills
{skill_1}, {skill_2}, {skill_3}, ...
```

### Error Handling Pattern

```typescript
// Frontend: Wrap service calls
try {
  const results = await ragstackSearchService.searchProfiles(query);
  return results;
} catch (error) {
  logger.error('RAGStack search failed', { error: error.message, query });
  throw new SearchError('Profile search unavailable', { cause: error });
}
```

```python
# Backend: Return structured errors
try:
    response = ragstack_client.search(query)
    return {"statusCode": 200, "body": json.dumps(response)}
except RAGStackError as e:
    logger.error(f"RAGStack error: {e}")
    return {"statusCode": 502, "body": json.dumps({"error": "Search service unavailable"})}
```

### Logging Convention

All RAGStack operations logged with:
- Operation type (search, ingest)
- Profile ID (if applicable)
- User ID (from JWT)
- Duration
- Result count or error

---

## File Structure Overview

```
linkedin-advanced-search/
├── backend/
│   ├── lambdas/
│   │   ├── ragstack-proxy/          # NEW: Proxy Lambda
│   │   │   ├── index.py
│   │   │   ├── ragstack_client.py
│   │   │   └── requirements.txt
│   │   └── edge-processing/         # MODIFY: Add ingestion trigger
│   │       └── lambda_function.py
│   └── template.yaml                # MODIFY: Add new Lambda
├── puppeteer/
│   └── src/domains/profile/
│       └── utils/
│           └── profileMarkdownGenerator.js  # NEW
├── frontend/
│   └── src/
│       ├── features/connections/
│       │   ├── components/
│       │   │   └── ConnectionSearchBar.tsx  # NEW
│       │   └── hooks/
│       │       └── useProfileSearch.ts      # NEW
│       └── shared/services/
│           └── ragstackSearchService.ts     # NEW
├── scripts/
│   └── deploy/
│       └── deploy-ragstack.js       # NEW
├── .ragstack-config.json            # NEW (git-ignored)
├── .env.ragstack                    # NEW (git-ignored)
└── docs/plans/
    ├── README.md
    ├── Phase-0.md
    ├── Phase-1.md
    └── Phase-2.md
```

---

## Phase Verification

This phase is complete when:
- [ ] All ADRs reviewed and agreed upon
- [ ] Deployment script specification approved
- [ ] Testing strategy understood
- [ ] File structure clear
- [ ] No implementation code written (documentation only)

---

## Known Limitations

1. **Follow functionality does not exist** - Must be implemented in Phase 1
2. **No chat interface** - Text search only (can add later)
3. **100 result limit** - RAGStack maxResults capped
4. **Single-user scope** - No multi-tenant considerations yet
5. **LinkedIn selector fragility** - Existing maintenance burden
