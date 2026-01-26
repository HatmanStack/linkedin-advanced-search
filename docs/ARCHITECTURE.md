# Architecture

This project follows a microservices-oriented architecture with a clear separation of concerns between the frontend, backend, and cloud infrastructure.

## Frontend

-   **Framework**: React 18
-   **Build Tool**: Vite
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS
-   **State Management**: (Implicitly managed via React hooks and context, specific libraries not detailed in README)
-   **Purpose**: Provides a user interface for managing LinkedIn automation tasks, configuring settings, and viewing results. It communicates with the backend via API Gateway.

## Backend

-   **Framework**: Node.js with Express.js
-   **Automation Engine**: Puppeteer
-   **Language**: JavaScript/TypeScript
-   **Purpose**: Orchestrates LinkedIn interactions using Puppeteer. It handles browser automation, session management, content generation (via OpenAI), and security features like credential encryption. It also acts as a proxy to the cloud backend API.
-   **Key Components**:
    -   **Puppeteer Service**: Manages browser instances, navigates LinkedIn, performs actions.
    -   **Content Generation Service**: Integrates with OpenAI API for personalized messages and posts.
    -   **Credential Management**: Uses Sealbox encryption for secure storage and retrieval of sensitive credentials.
    -   **Session Management**: Tracks and restores LinkedIn sessions to maintain automation continuity.
    -   **API Proxy**: Routes requests to AWS Lambda functions via API Gateway.

## Cloud Infrastructure (AWS)

-   **Compute**: AWS Lambda functions for backend processing and API endpoints.
-   **API Gateway**: Manages incoming API requests from the frontend and routes them to the appropriate Lambda functions.
-   **Database**: AWS DynamoDB for storing profile data, automation queues, and session information.
-   **RAGStack**: A dedicated infrastructure stack (deployed via `deploy-ragstack.js`) that handles vector embeddings and semantic search using AWS Bedrock.
-   **Storage**: AWS S3 for storing profile text data and artifacts.
-   **Authentication**: AWS Cognito for user authentication and authorization.
-   **Deployment**: AWS SAM (Serverless Application Model) for defining and deploying serverless infrastructure.

## AI Services

-   **RAGStack & AWS Bedrock**: The core engine for text ingestion and semantic search. It uses Amazon Nova multimodal embeddings to vectorize profile data, enabling advanced search capabilities.
-   **OpenAI API**: Used for generating personalized messages and post content.

## Data Flow

1.  **User Interaction**: The Frontend UI allows users to configure tasks, view progress, and manage settings.
2.  **Backend Request**: Frontend sends requests to API Gateway.
3.  **API Gateway**: Routes requests to appropriate Lambda functions.
4.  **Lambda Functions**:
    *   **Edge Processing**: Handles data ingestion directly into RAGStack (`/ragstack` endpoint).
    *   **DynamoDB API**: Manages CRUD operations for profile metadata.
    *   **LLM Service**: Orchestrates content generation.
5.  **Puppeteer Backend**:
    *   Orchestrates LinkedIn interactions.
    *   Extracts text and data from LinkedIn profiles.
    *   Sends processed text/markdown to the **Edge Processing Lambda** for ingestion into RAGStack.
    *   (Legacy) May optionally capture screenshots for debugging, but primary data flow is text-based.
6.  **LinkedIn**: The target platform for automated interactions.

This layered approach ensures scalability, maintainability, and security for the LinkedIn automation platform.
