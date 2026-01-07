# RAGStack Integration for LinkedIn Profile Search

## Feature Overview

This implementation integrates RAGStack-Lambda as a dedicated knowledge base for LinkedIn profiles, enabling semantic search across your professional network. The hybrid architecture continues using Puppeteer for LinkedIn discovery and automation while leveraging RAGStack's vector search capabilities for the Connections tab.

Profiles are ingested into RAGStack when a meaningful relationship is established: after sending a connection request, following a profile, or during initial database setup for existing contacts. The frontend Connections tab gains a semantic search box that queries RAGStack, returning profile IDs that are then enriched with existing DynamoDB profile cards. Existing client-side filtering remains intact for post-search refinement.

Security is paramount: the RAGStack API stays private behind API key authentication, with all requests proxied through the linkedin-advanced-search backend. This prevents direct browser access to the knowledge base while maintaining user-scoped data isolation.

## Prerequisites

### Tools Required
- Node.js v24 LTS (via nvm)
- Python 3.13 (via uv)
- AWS CLI v2 configured with appropriate credentials
- AWS SAM CLI
- Git

### AWS Services
- AWS Bedrock (Nova Multimodal Embeddings access enabled)
- AWS Lambda
- Amazon S3
- Amazon DynamoDB
- Amazon API Gateway
- AWS Cognito (existing user pool)

### Environment Setup
- Clone RAGStack-Lambda repository to `~/war/RAGStack-Lambda/`
- Existing linkedin-advanced-search deployment functional
- Valid AWS credentials with permissions for Bedrock, Lambda, S3, DynamoDB, API Gateway

## Phase Summary

| Phase | Goal | Est. Tokens |
|-------|------|-------------|
| 0 | Foundation: Architecture, ADRs, Deploy Scripts, Testing Strategy | ~15k |
| 1 | RAGStack Deployment & Ingestion Pipeline | ~45k |
| 2 | Frontend Search Integration | ~35k |

## Navigation

- [Phase 0: Foundation](./Phase-0.md) - Architecture decisions, deployment scripts, testing strategy
- [Phase 1: RAGStack & Ingestion](./Phase-1.md) - Deploy RAGStack, build ingestion triggers (9 tasks)
- [Phase 2: Frontend Search](./Phase-2.md) - Search UI, API proxy, integration

## Commit Guidelines

**Important**: Do NOT include Co-Authored-By, Generated-By, or similar attribution lines in commit messages.

**Commit Format:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

type(scope): brief description

- Detail 1
- Detail 2
```

**Types**: feat, fix, refactor, test, docs, chore
**Scopes**: backend, frontend, puppeteer, infra, ragstack
