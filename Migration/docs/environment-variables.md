# Environment Variables Reference

## Overview

This document provides a consolidated reference for all environment variables used in the LinkedIn Advanced Search application, including changes made during the refactor.

**Last Updated:** 2025-11-09 (Refactor Plan)

---

## Environment Variables by Category

### AWS Configuration

#### Existing (No Changes)
```bash
# AWS Region
AWS_REGION=us-west-2

# S3 Screenshot Storage (existing functionality)
S3_SCREENSHOT_BUCKET_NAME=your-screenshot-bucket-name
CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
```

#### New (Added in Phase 3)
```bash
# S3 Profile Text Storage
# Used for storing extracted profile text as JSON files
# Default: Uses same bucket as screenshots if not specified
S3_PROFILE_TEXT_BUCKET_NAME=your-bucket-name
S3_PROFILE_TEXT_PREFIX=profiles/
S3_PROFILE_TEXT_REGION=us-west-2

# Example values:
# S3_PROFILE_TEXT_BUCKET_NAME=linkedin-advanced-search-data
# S3_PROFILE_TEXT_PREFIX=profiles/
# S3_PROFILE_TEXT_REGION=us-west-2
```

#### Removed (Phase 1)
```bash
# REMOVED: Pinecone configuration (no longer used)
# PINECONE_API_KEY=pcn-xxx
# PINECONE_HOST=profiles-xxxx.svc.us-east-1-aws.pinecone.io
# PINECONE_INDEX_NAME=profiles
```

---

### Frontend (Vite) Configuration

#### Existing (No Changes)
```bash
# Local Puppeteer Backend URL
VITE_PUPPETEER_BACKEND_URL=http://localhost:3001

# AWS Cognito Configuration
VITE_AWS_REGION=us-west-2
VITE_COGNITO_USER_POOL_ID=us-west-2_xxxxx
VITE_COGNITO_USER_POOL_WEB_CLIENT_ID=xxxxxxxxxxxxx
VITE_COGNITO_IDENTITY_POOL_ID=us-west-2:xxxxx-xxxxx

# Feature Flags
VITE_MOCK_MODE=false

# Device-specific encryption public key
VITE_CRED_SEALBOX_PUBLIC_KEY_B64=base64-encoded-public-key
```

#### Modified (Phase 5)
```bash
# API Gateway Base URL
# NOW REQUIRED: Must point to API Gateway with new /search endpoint
VITE_API_GATEWAY_URL=https://abc123.execute-api.us-west-2.amazonaws.com/prod

# Before refactor: Optional (only if using Pinecone)
# After refactor: Required (for placeholder search API)
```

---

### Text Extraction Configuration

#### New (Added in Phase 2)
```bash
# Text Extraction Timeouts (optional, defaults provided)
EXTRACTION_ELEMENT_WAIT=10000        # Wait for element to appear (ms)
EXTRACTION_SECTION_LOAD=5000         # Wait for section to load (ms)
EXTRACTION_PAGE_NAVIGATION=30000     # Wait for page navigation (ms)
EXTRACTION_SCROLL_DELAY=1000         # Delay between scrolls (ms)

# Text Extraction Limits (optional)
EXTRACTION_MAX_EXPERIENCES=20        # Max experience entries to extract
EXTRACTION_MAX_EDUCATION=10          # Max education entries to extract
EXTRACTION_MAX_SKILLS=50             # Max skills to extract
EXTRACTION_MAX_ABOUT_LENGTH=5000     # Max length of about section

# Example values (defaults):
# EXTRACTION_ELEMENT_WAIT=10000
# EXTRACTION_MAX_EXPERIENCES=20
```

---

### LinkedIn Automation (Existing)

#### No Changes
```bash
# Puppeteer/Browser Settings
HEADLESS=true
SLOW_MO=50
VIEWPORT_WIDTH=1200
VIEWPORT_HEIGHT=1200

# Timeouts
DEFAULT_TIMEOUT=30000
NAVIGATION_TIMEOUT=50000
LOGIN_SECURITY_TIMEOUT=0

# LinkedIn Interaction Settings
LINKEDIN_SESSION_TIMEOUT=3600000
SESSION_HEALTH_CHECK_INTERVAL=300000
MAX_SESSION_ERRORS=5
SESSION_RECOVERY_TIMEOUT=60000
MAX_CONCURRENT_INTERACTIONS=3
MAX_CONCURRENT_SESSIONS=1
INTERACTION_QUEUE_SIZE=50
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10
DAILY_INTERACTION_LIMIT=500
HOURLY_INTERACTION_LIMIT=100

# Human Behavior Simulation
HUMAN_DELAY_MIN=1000
HUMAN_DELAY_MAX=3000
ACTIONS_PER_MINUTE=8
ACTIONS_PER_HOUR=100
TYPING_SPEED_MIN=80
TYPING_SPEED_MAX=150
TYPING_PAUSE_CHANCE=0.1
TYPING_PAUSE_MIN=500
TYPING_PAUSE_MAX=2000
MOUSE_MOVEMENT_STEPS=5
MOUSE_MOVEMENT_DELAY=100
SCROLL_STEP_SIZE=120
SCROLL_DELAY=200

# Interaction Retry Settings
INTERACTION_RETRY_ATTEMPTS=3
INTERACTION_RETRY_BASE_DELAY=1000
INTERACTION_RETRY_MAX_DELAY=300000
RETRY_JITTER_FACTOR=0.1

# Safety & Monitoring
SUSPICIOUS_ACTIVITY_THRESHOLD=3
SUSPICIOUS_ACTIVITY_WINDOW=300000
COOLDOWN_MIN_DURATION=30000
COOLDOWN_MAX_DURATION=300000
MAX_CONSECUTIVE_ERRORS=5
ERROR_COOLDOWN_DURATION=60000

# Feature Flags
ENABLE_MESSAGE_SENDING=true
ENABLE_CONNECTION_REQUESTS=true
ENABLE_POST_CREATION=true
ENABLE_HUMAN_BEHAVIOR=true
ENABLE_SUSPICIOUS_ACTIVITY_DETECTION=true

# Logging & Debugging
LINKEDIN_DEBUG_MODE=false
SCREENSHOT_ON_ERROR=false
SAVE_PAGE_SOURCE_ON_ERROR=false
VERBOSE_LOGGING=false
PERFORMANCE_LOGGING_ENABLED=false
AUDIT_LOGGING_ENABLED=true
METRICS_COLLECTION_INTERVAL=60000

# Timeouts (LinkedIn-specific)
LINKEDIN_NAVIGATION_TIMEOUT=30000
ELEMENT_WAIT_TIMEOUT=10000
MESSAGE_COMPOSE_TIMEOUT=15000
POST_CREATION_TIMEOUT=20000
CONNECTION_REQUEST_TIMEOUT=15000
BROWSER_LAUNCH_TIMEOUT=30000
PAGE_LOAD_TIMEOUT=30000
BROWSER_IDLE_TIMEOUT=1800000

# Character Limits
MAX_MESSAGE_LENGTH=8000
MAX_POST_LENGTH=3000
MAX_CONNECTION_MESSAGE_LENGTH=300
```

---

### Backend Configuration (Existing)

#### No Changes
```bash
# Server Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URLS=http://localhost:5173,http://localhost:3000

# Application Paths
APP_NAME=linkedin-advanced-search
SCREENSHOTS_DIR=./screenshots
LINKS_FILE=./data/possible-links.json
GOOD_CONNECTIONS_FILE=./data/good-connections-links.json

# Activity Thresholds
RECENCY_HOURS=6
RECENCY_DAYS=5
RECENCY_WEEKS=3
HISTORY_TO_CHECK=4
THRESHOLD=8
PAGE_NUMBER_START=17
PAGE_NUMBER_END=17

# Encryption (Device-specific)
CRED_SEALBOX_PRIVATE_KEY_PATH=./.keys/device-private.key
```

---

## Environment Variables by Phase

### Phase 0: Foundation
**No new variables** - Review existing configuration

### Phase 0.5: Codebase Exploration
**No new variables** - Use existing setup

### Phase 1: Code Cleanup
**Remove:**
- `PINECONE_API_KEY`
- `PINECONE_HOST`
- `PINECONE_INDEX_NAME`

### Phase 2: Text Extraction
**Add (optional):**
- `EXTRACTION_ELEMENT_WAIT`
- `EXTRACTION_SECTION_LOAD`
- `EXTRACTION_PAGE_NAVIGATION`
- `EXTRACTION_SCROLL_DELAY`
- `EXTRACTION_MAX_EXPERIENCES`
- `EXTRACTION_MAX_EDUCATION`
- `EXTRACTION_MAX_SKILLS`
- `EXTRACTION_MAX_ABOUT_LENGTH`

### Phase 3: S3 Integration
**Add (required):**
- `S3_PROFILE_TEXT_BUCKET_NAME` (or use `S3_SCREENSHOT_BUCKET_NAME`)
- `S3_PROFILE_TEXT_PREFIX` (default: `profiles/`)
- `S3_PROFILE_TEXT_REGION` (default: matches `AWS_REGION`)

### Phase 4: Placeholder Search API
**No new variables** - Uses existing `VITE_API_GATEWAY_URL`

### Phase 5: Frontend Integration
**Modify (ensure configured):**
- `VITE_API_GATEWAY_URL` - Now required for search endpoint

---

## Required vs. Optional Variables

### Absolutely Required
```bash
# AWS (for DynamoDB, S3, Cognito)
AWS_REGION=us-west-2
S3_SCREENSHOT_BUCKET_NAME=your-bucket

# Frontend
VITE_API_GATEWAY_URL=https://your-api-gateway-url.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=us-west-2_xxxxx
VITE_COGNITO_USER_POOL_WEB_CLIENT_ID=xxxxx

# Backend
PORT=3001
NODE_ENV=development

# Encryption
CRED_SEALBOX_PRIVATE_KEY_PATH=./.keys/device-private.key
VITE_CRED_SEALBOX_PUBLIC_KEY_B64=xxxxx
```

### Required for Text Extraction (Phase 3)
```bash
# S3 Profile Text Storage
# If not set, falls back to S3_SCREENSHOT_BUCKET_NAME
S3_PROFILE_TEXT_BUCKET_NAME=your-bucket-name
```

### Optional (Have Sensible Defaults)
```bash
# All text extraction timeouts and limits
# All LinkedIn interaction settings
# All human behavior settings
# All logging and debugging flags
```

---

## Setup Instructions

### Development (.env file)
```bash
# 1. Copy .env.example to .env
cp .env.example .env

# 2. Required: Configure AWS
AWS_REGION=us-west-2
S3_SCREENSHOT_BUCKET_NAME=linkedin-advanced-search-dev
S3_PROFILE_TEXT_BUCKET_NAME=linkedin-advanced-search-dev

# 3. Required: Configure Frontend
VITE_API_GATEWAY_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=us-west-2_xxxxxxxxx
VITE_COGNITO_USER_POOL_WEB_CLIENT_ID=xxxxxxxxxxxxxxxxx

# 4. Required: Generate encryption keys (run once)
cd puppeteer-backend
node scripts/generate-device-keypair.js

# 5. Optional: Customize extraction settings
EXTRACTION_MAX_EXPERIENCES=30
EXTRACTION_MAX_SKILLS=100
```

### Production
- Use AWS Systems Manager Parameter Store or Secrets Manager for sensitive values
- Never commit `.env` files to git
- Use environment-specific values (dev, staging, prod)

---

## Troubleshooting

### Missing S3_PROFILE_TEXT_BUCKET_NAME
**Error:** "S3 bucket not configured for profile text"

**Solution:** Add to `.env`:
```bash
S3_PROFILE_TEXT_BUCKET_NAME=your-bucket-name
```
Or let it default to screenshot bucket.

### Missing VITE_API_GATEWAY_URL
**Error:** "API Gateway URL not configured"

**Solution:** Get from CloudFormation outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name linkedin-advanced-search-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiBaseUrl`].OutputValue' \
  --output text
```
Add to `.env`:
```bash
VITE_API_GATEWAY_URL=https://abc123.execute-api.us-west-2.amazonaws.com/prod
```

### Pinecone Variables Still Present
**Error:** Variables still in `.env` after Phase 1

**Solution:** Remove these lines from `.env`:
```bash
# DELETE THESE:
PINECONE_API_KEY=...
PINECONE_HOST=...
PINECONE_INDEX_NAME=...
```

---

## Validation Checklist

Before starting implementation, verify:
- [ ] `.env.example` updated with new variables
- [ ] Pinecone variables removed from `.env.example`
- [ ] `S3_PROFILE_TEXT_*` variables documented
- [ ] `VITE_API_GATEWAY_URL` marked as required
- [ ] All extraction config variables documented
- [ ] Example values provided for all new variables
- [ ] Troubleshooting section complete

---

**Related Documents:**
- [Phase 0: Foundation & Architecture](./plans/Phase-0.md)
- [Phase 1: Code Cleanup](./plans/Phase-1.md)
- [Phase 3: S3 Integration](./plans/Phase-3.md)
- [Codebase Map](./codebase-map.md)
