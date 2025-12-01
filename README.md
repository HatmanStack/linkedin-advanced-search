<div align="center">
<h1>LinkedIn Advanced Search</h1>

<h4 align="center">
<a href="https://www.apache.org/licenses/LICENSE-2.0.html"><img src="https://img.shields.io/badge/license-Apache2.0-blue" alt="Apache 2.0 License" /></a>
<a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18+-61DAFB" alt="React 18+" /></a>
<a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5+-3178C6" alt="TypeScript" /></a>
<a href="https://aws.amazon.com/"><img src="https://img.shields.io/badge/AWS-Serverless-FF9900" alt="AWS Serverless" /></a>
<a href="https://openai.com/"><img src="https://img.shields.io/badge/OpenAI-GPT-412991" alt="OpenAI" /></a>
</h4>

<p>AI-powered LinkedIn networking with intelligent automation, secure credential management, and cloud-native infrastructure.</p>
</div>

## Structure

```text
├── frontend/   # React/Vite client application
├── puppeteer/  # Node.js automation backend
├── backend/    # AWS SAM serverless infrastructure
└── docs/       # Documentation
```

## Prerequisites

- **Node.js** v22+ (LTS recommended)
- **Python** 3.11+ (for Lambda functions)
- **AWS CLI** configured with credentials
- **SAM CLI** for serverless deployment

## Quick Start

```bash
npm install                    # Install dependencies
cd puppeteer && npm install    # Install puppeteer deps
cp .env.example .env           # Configure environment
npm run dev                    # Start frontend (port 5173)
cd puppeteer && npm start      # Start backend (port 3001)
```

## Deployment

```bash
cd backend && sam build && sam deploy --guided
```

The deploy creates:
- Lambda functions for API operations
- DynamoDB table for data storage
- API Gateway for REST endpoints
- Cognito for authentication

| Output | Description |
|--------|-------------|
| ApiUrl | API Gateway endpoint URL |
| UserPoolId | Cognito User Pool ID |
| UserPoolClientId | Cognito App Client ID |

Update `.env` with these values after deployment.

See [docs/README.md](docs/README.md) for full documentation.
