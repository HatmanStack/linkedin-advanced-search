# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose & Ethics

**This tool is NOT for spam, mass outreach, or scraping LinkedIn.**

LinkedIn Advanced Search helps users build more authentic professional relationships by:

- **Surfacing buried interactions** - LinkedIn's algorithm often swallows engagement into a black hole. This tool helps users see who's actually active and engaging with their content.
- **Identifying active connections** - Find people in your network who are genuinely engaged, helping users grow their network through interaction.
- **Enabling thoughtful outreach** - AI-assisted messaging helps craft personalized, relevant messages rather than generic templates.
- **Providing network insight** - Understand your professional network better through activity analysis and relationship mapping.

The goal is to make LinkedIn more useful for genuine professional networking, not to automate spam or bypass LinkedIn's intended use. All automation respects rate limits and mimics human interaction patterns.

## Project Overview

LinkedIn Advanced Search is a monorepo with three main components:
- **frontend/**: React 18 + TypeScript + Vite application
- **puppeteer/**: Node.js Express backend with Puppeteer for LinkedIn automation
- **backend/**: AWS SAM serverless stack (Python Lambdas + DynamoDB + Cognito)

## Build & Development Commands

```bash
# Root-level commands (from repo root)
npm run dev              # Start frontend (Vite)
npm run dev:puppeteer    # Start puppeteer backend
npm run build            # Build frontend
npm run lint             # Lint all (frontend + puppeteer + backend)
npm run test             # Run all tests (frontend + backend)
npm run check            # lint + test

# Frontend (frontend/)
npm run dev              # Vite dev server at localhost:5173
npm run test             # Vitest
npm run test:watch       # Vitest in watch mode
npm run lint             # ESLint with --max-warnings 0

# Puppeteer backend (puppeteer/)
npm start                # Start server at localhost:3001
npm run dev              # Start with nodemon
npm run test             # Vitest
npm run lint             # ESLint

# Backend Python tests (tests/backend/)
cd tests/backend && . .venv/bin/activate && python -m pytest unit/ -v --tb=short

# Backend Lambda linting
cd backend && uvx ruff check lambdas --exclude .aws-sam

# AWS SAM deployment (backend/)
cd backend && sam build && sam deploy
```

## Architecture

### Frontend (`frontend/src/`)
Feature-based organization with barrel exports:
- `features/auth/` - Cognito authentication
- `features/connections/` - LinkedIn connection management
- `features/messages/` - Messaging system
- `features/posts/` - Post creation with AI
- `features/profile/` - User profile management
- `features/search/` - LinkedIn search
- `features/workflow/` - Automation workflows
- `shared/` - Reusable components, hooks, services, utils, types

Path aliases configured in `vitest.config.ts`:
- `@/components` → `src/shared/components`
- `@/hooks` → `src/shared/hooks`
- `@/services` → `src/shared/services`
- `@/utils` → `src/shared/utils`
- `@` → `src`

### Puppeteer Backend (`puppeteer/src/`)
Domain-driven architecture:
- `domains/` - Business logic organized by domain
- `shared/` - Shared utilities
- `server.js` - Express server entry point

Queue-based LinkedIn interaction processing with session preservation and heal/restore capabilities.

### AWS Backend (`backend/`)
SAM template (`template.yaml`) defines:
- **ProfilesTable**: DynamoDB single-table design with GSI1
- **Lambda Functions**: Python 3.13 runtime
  - `edge-processing/` - Edge data processing + RAGStack search/ingest (handles `/edges` and `/ragstack` routes)
  - `dynamodb-api/` - User settings/profile CRUD (handles `/dynamodb` and `/profiles` routes)
  - `llm/` - OpenAI/Bedrock LLM operations
  - `profile-processing/` - SQS-triggered profile processing from S3 uploads with auto-RAGStack ingestion
  - `webhook-handler/` - OpenAI webhooks
- **Cognito**: User pool with email-based auth
- **S3**: Screenshot storage with SQS notification to profile-processing
- **HttpApi**: API Gateway with Cognito JWT authorizer

### RAGStack-Lambda (separate stack)
Deployed separately from [RAGStack-Lambda](https://github.com/HatmanStack/RAGStack-Lambda):
- Vector embeddings + semantic search via Bedrock Knowledge Base
- Connected via `RAGSTACK_GRAPHQL_ENDPOINT` and `RAGSTACK_API_KEY` env vars
- Used by edge-processing (search/ingest) and profile-processing (auto-ingest)

Lambdas share code via `lambdas/shared/python/`:
- `utils/response_builder.py` - Standardized response building
- `config/aws_config.py` - AWS resource names

### Test Structure
- `frontend/src/**/*.test.{ts,tsx}` - Frontend unit tests (Vitest + Testing Library)
- `puppeteer/src/**/*.test.js` - Puppeteer backend tests (Vitest)
- `tests/backend/unit/` - Lambda unit tests (pytest with moto)
- `tests/backend/integration/` - Lambda integration tests
- `tests/fixtures/` - Shared test fixtures

## Key Technical Details

- **Authentication**: AWS Cognito with JWT tokens, credentials encrypted with libsodium (Sealbox)
- **State Management**: React Query (`@tanstack/react-query`)
- **UI Components**: Radix UI primitives with Tailwind CSS
- **Logging**: Winston (puppeteer), Python logging (lambdas)
- **AI Integration**: OpenAI API + AWS Bedrock (configurable model ID). No Google Gemini.

## Environment Setup

Required `.env` variables (see `.env.example`):
- `VITE_API_URL`, `VITE_COGNITO_*` - Frontend config
- `OPENAI_API_KEY`, `BEDROCK_MODEL_ID` - AI config
- AWS credentials for SAM deployment

## SAM Deployment Notes

Deploy with guided prompts for first-time setup:
```bash
cd backend
sam build
sam deploy --guided
```

Stack outputs provide values needed for `.env`. Use `get-env-vars.sh` script to auto-populate.
