# LinkedIn Advanced Search

LinkedIn networking tool with automation and cloud infrastructure.

[![License](https://img.shields.io/badge/license-Apache2.0-blue)](https://www.apache.org/licenses/LICENSE-2.0.html)

> **Active Development**: This project is under active development. Features and APIs may change without notice.

## Features

- **LinkedIn Automation**: Queue-based interaction system with session preservation
- **Content Generation**: OpenAI integration for personalized messaging and post creation
- **Credential Management**: Sealbox encryption with device-specific key management
- **Heal & Restore**: Checkpoint-based recovery for long-running automation processes

## Architecture

```
Frontend (React/Vite) <-> Puppeteer Backend (Node.js/Express) <-> LinkedIn
         |
    API Gateway <-> Lambda Functions <-> DynamoDB/S3
         |
    AI Services (OpenAI)
```

### Components

| Layer | Stack |
|-------|-------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js Express, Puppeteer |
| Cloud | AWS Lambda, DynamoDB, API Gateway, Cognito, S3 |
| AI | OpenAI GPT models |

## Quick Start

### Prerequisites

- Node.js 24+
- AWS account with configured credentials
- OpenAI API key

### Install

```bash
git clone <your-repo-url>
cd linkedin-advanced-search
npm install
cp .env.example .env
# Configure API keys and AWS settings in .env
```

### Development

```bash
# Terminal 1: Frontend
npm run dev
# Opens at http://localhost:5173

# Terminal 2: Backend
cd puppeteer
npm install
npm start
# Runs at http://localhost:3001
```

### Deploy

```bash
cd backend
sam build
sam deploy --guided
```

## Security

- **AWS Cognito**: JWT-based authentication
- **Sealbox Encryption**: Device-specific credential encryption
- **Row-Level Security**: User data isolation in DynamoDB
- **Just-in-Time Decryption**: Credentials decrypted only when needed

## Scripts

```bash
npm run dev          # Start frontend dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run test suite
```

## License

Apache 2.0 - see [LICENSE](https://www.apache.org/licenses/LICENSE-2.0.html)
