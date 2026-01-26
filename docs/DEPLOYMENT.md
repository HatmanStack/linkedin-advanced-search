# Deployment Guide

This application is deployed using the AWS Serverless Application Model (SAM). The infrastructure includes Lambda functions, API Gateway, DynamoDB, Cognito, and S3.

## Prerequisites

-   **AWS CLI**: Installed and configured with administrator permissions.
-   **AWS SAM CLI**: Installed (version 1.50+ recommended).
-   **Node.js**: Installed to run deployment scripts.

## RAGStack Deployment (Required for Search)

This application relies on a separate "RAGStack" infrastructure for text ingestion and vector search. This must be deployed *before* or alongside the main backend.

1.  **Run the RAGStack Deployment Script**:
    ```bash
    node scripts/deploy/deploy-ragstack.js
    ```
    This interactive script will:
    -   Clone the `RAGStack-Lambda` repository (if not found).
    -   Configure the stack (Stack Name, Region).
    -   Generate a `samconfig.toml`.
    -   Build and deploy the RAGStack infrastructure using SAM.
    -   **Important**: It saves key outputs (GraphQL Endpoint, API Key) to `.env.ragstack`.

2.  **Source the Environment**:
    After deployment, load the generated variables so they are available for the main backend deployment.
    ```bash
    source .env.ragstack
    ```

## Backend Deployment

1.  **Navigate to the backend directory**:
    ```bash
    cd backend
    ```

2.  **Build the SAM application**:
    ```bash
    sam build
    ```

3.  **Deploy**:
    For the first deployment, use the `--guided` flag to save your configuration options.
    ```bash
    sam deploy --guided
    ```
    Follow the prompts:
    -   **Stack Name**: e.g., `linkedin-search-prod`
    -   **AWS Region**: e.g., `us-west-2`
    -   **Confirm changes before deploy**: `y`
    -   **Allow SAM CLI IAM role creation**: `y`
    -   **Save arguments to configuration file**: `y`

4.  **Post-Deployment Configuration**:
    After a successful deployment, update your local environment variables with the outputs from the CloudFormation stack.
    ```bash
    ./get-env-vars.sh <stack-name> --update-env
    ```

## Frontend Deployment

1.  **Build the Frontend**:
    Ensure your `.env` file is populated with the correct API Gateway URL and Cognito details (from the previous step).
    ```bash
    cd frontend
    npm run build
    ```

2.  **Deploy Static Assets**:
    You can deploy the contents of `frontend/dist/` to an S3 bucket configured for static website hosting or use AWS CloudFront (recommended).
    *Note: Automated frontend deployment scripts are currently under development.*

## Infrastructure Overview

-   **Lambda Functions**:
    -   `profile-processing`: Handles profile data extraction and parsing.
    -   `dynamodb-api`: CRUD operations for profile data.
    -   `llm`: Integration with AI models.
    -   `edge-processing`: Handles specific edge cases in data processing.
-   **DynamoDB**: Stores user profiles and application state.
-   **API Gateway**: Provides the REST API interface.
-   **S3**:
    -   Screenshots bucket: Stores capture of LinkedIn interactions.
    -   Profile text bucket: Stores raw text data.

## Deployment Scripts

-   `scripts/deploy/deploy-sam.js`: Node.js wrapper for SAM deployment.
-   `backend/get-env-vars.sh`: Helper script to fetch stack outputs.
