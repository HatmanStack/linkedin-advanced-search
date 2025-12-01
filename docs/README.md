# LinkedIn Advanced Search - Documentation

[![License](https://img.shields.io/badge/license-Apache2.0-blue)](https://www.apache.org/licenses/LICENSE-2.0.html)
[![Node](https://img.shields.io/badge/Node-22+-green)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org/)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com/)

AI-powered LinkedIn networking platform with intelligent automation, secure credential management, and cloud-native infrastructure.

## Features

- **LinkedIn Automation** - Queue-based interaction system with session preservation
- **AI Content Generation** - OpenAI integration for personalized messaging and posts
- **Secure Credentials** - Sealbox encryption with device-specific key management
- **Heal & Restore** - Checkpoint-based recovery for interrupted processes
- **Connection Management** - Search, filter, and manage LinkedIn connections
- **Post Composer** - AI-assisted LinkedIn post creation with research and style options

## Technologies

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, Puppeteer |
| Cloud | AWS Lambda, DynamoDB, API Gateway, Cognito, S3 |
| AI | OpenAI GPT models, AWS Bedrock |

## Project Structure

```
linkedin-advanced-search/
├── frontend/           # React/Vite frontend application
├── puppeteer/          # Node.js automation backend
├── backend/            # AWS SAM serverless infrastructure
│   ├── lambdas/        # Lambda function code
│   └── template.yaml   # SAM template
└── docs/               # Documentation
```

## Installation

### Prerequisites

- Node.js 22+
- Python 3.11+
- AWS CLI configured
- SAM CLI installed
- Docker (for local Lambda testing)

### Setup

```bash
# Clone repository
git clone <repo-url>
cd linkedin-advanced-search

# Install dependencies
npm install
cd puppeteer && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your API keys and AWS settings

# Generate encryption keys
cd puppeteer && node scripts/generate-device-keypair.js && cd ..

# Deploy AWS infrastructure
cd backend && sam build && sam deploy --guided && cd ..
```

## Usage

### Development

```bash
# Start frontend (port 5173)
npm run dev

# Start puppeteer backend (port 3001)
cd puppeteer && npm start

# Run lints
npm run lint

# Build for production
npm run build
```

### API Endpoints

**Puppeteer Backend (localhost:3001)**
- `POST /search` - Execute LinkedIn search
- `POST /profile-init` - Initialize user profile
- `POST /linkedin-interactions` - Queue LinkedIn actions
- `GET /heal-restore` - Check recovery status
- `GET /health` - System health check

**AWS API Gateway**
- `POST /edge` - Connection management operations
- `POST /profiles` - User profile operations
- `POST /llm` - AI content generation
- `POST /search` - Semantic search

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  Puppeteer  │────▶│  LinkedIn   │
│   (React)   │     │  (Node.js)  │     │             │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ API Gateway │────▶│   Lambda    │────▶│  DynamoDB   │
│             │     │  Functions  │     │     S3      │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   OpenAI    │
                    │   Bedrock   │
                    └─────────────┘
```

## Security

- **Authentication**: AWS Cognito with JWT tokens
- **Encryption**: Sealbox device-specific credential encryption
- **Data Isolation**: Row-level security by Cognito user ID
- **Transport**: HTTPS for all communications

## Environment Variables

See `.env.example` for full documentation. Key variables:

| Variable | Description |
|----------|-------------|
| `VITE_API_GATEWAY_URL` | AWS API Gateway endpoint |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID` | Cognito App Client ID |
| `VITE_PUPPETEER_BACKEND_URL` | Puppeteer backend URL |

## Testing

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && pytest

# Puppeteer tests
cd puppeteer && npm test
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions.

## License

Apache 2.0 - see [LICENSE](https://www.apache.org/licenses/LICENSE-2.0.html)
