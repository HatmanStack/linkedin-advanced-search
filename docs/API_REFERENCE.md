# API Reference

This document provides an overview of the API endpoints available in the LinkedIn Advanced Search platform. The system consists of two primary API layers: the **Puppeteer Backend** (browser automation) and the **AWS Cloud API** (data storage and AI services).

## Puppeteer Backend (Internal/Automation)

The Puppeteer backend runs locally or on a specialized server to handle direct LinkedIn interactions.

### Search & Discovery
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search` | `POST` | Execute a LinkedIn search with specific keywords and filters. |
| `/search/results` | `GET` | Retrieve stored search results. |
| `/search/health` | `GET` | Health check specifically for search routes. |

### LinkedIn Interactions
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/linkedin-interactions/send-message` | `POST` | Send a direct message to a LinkedIn connection. |
| `/linkedin-interactions/add-connection` | `POST` | Send a connection request with an optional personalized message. |
| `/linkedin-interactions/create-post` | `POST` | Create and publish a new post on the user's feed. |
| `/linkedin-interactions/generate-personalized-message` | `POST` | Use AI to generate a personalized message based on a profile. |
| `/linkedin-interactions/follow-profile` | `POST` | Follow a LinkedIn profile. |
| `/linkedin-interactions/session-status` | `GET` | Get the current state of the LinkedIn browser session. |

### System & Recovery
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/profile-init` | `POST` | Initialize the local profile database. |
| `/heal-restore/status` | `GET` | Check the status of the automated recovery system. |
| `/heal-restore/authorize` | `POST` | Provide authorization/manual intervention for session recovery. |
| `/heal-restore/cancel` | `POST` | Cancel the current healing process. |
| `/health` | `GET` | Comprehensive system health and configuration report. |
| `/config/status` | `GET` | Detailed report on environment and feature configuration. |

---

## AWS Cloud API (Public/Data)

The Cloud API provides secure data storage, user management, and AI orchestration. All requests (except OPTIONS) require a valid Cognito JWT in the `Authorization` header.

### Profile & Settings (DynamoDB API)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dynamodb` | `GET`/`POST` | CRUD operations for general application state and settings. |
| `/profiles` | `GET`/`POST` | Manage LinkedIn profile data extracted from automation. |

### AI & Processing
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/llm` | `POST` | Orchestrate LLM tasks using OpenAI or AWS Bedrock. |
| `/edges` | `POST` | Process relationship "edges" between connections. |
| `/ragstack` | `POST` | Query or ingest data into the RAGStack knowledge base. |

## Request/Response Format

Most endpoints expect and return JSON.

### Standard Error Response
```json
{
  "error": "Error message description",
  "timestamp": "2024-01-26T12:00:00.000Z",
  "path": "/requested/endpoint"
}
```

## Authentication

-   **Cloud API**: Uses AWS Cognito. Include the JWT token: `Authorization: Bearer <token>`.
-   **Puppeteer Backend**: Typically accessed via the local frontend or authorized proxy. In development, it validates origins based on `FRONTEND_URLS`.
