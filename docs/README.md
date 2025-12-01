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

## Features

- **LinkedIn Automation**: Queue-based interaction system with session preservation and rate limiting
- **AI Content Generation**: OpenAI integration for personalized messaging and LinkedIn posts
- **Secure Credentials**: Sealbox encryption with device-specific key management
- **Heal & Restore**: Checkpoint-based recovery for interrupted automation processes
- **Connection Management**: Search, filter, and bulk-manage LinkedIn connections
- **Post Composer**: AI-assisted LinkedIn post creation with research and style customization

## Technologies Used

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, Puppeteer for browser automation
- **Cloud**: AWS Lambda, DynamoDB, API Gateway, Cognito, S3
- **AI**: OpenAI GPT models for content generation, AWS Bedrock for style transfer

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd linkedin-advanced-search
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd puppeteer && npm install && cd ..
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and AWS settings
   ```

4. **Generate encryption keys** (for credential storage):
   ```bash
   cd puppeteer && node scripts/generate-device-keypair.js && cd ..
   ```

5. **Deploy backend** (creates Lambda, DynamoDB, API Gateway, Cognito):
   ```bash
   cd backend && sam build && sam deploy --guided && cd ..
   ```

   See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed configuration options.

6. **Start development servers**:
   ```bash
   npm run dev                    # Frontend (port 5173)
   cd puppeteer && npm start      # Backend (port 3001)
   ```

## Usage

### Managing Connections

1. Navigate to **Connections** tab to view existing LinkedIn connections
2. Use status filters (Incoming, Outgoing, Ally) to organize contacts
3. Click tags to filter by interests or skills
4. Select multiple connections for bulk message generation

### Discovering New Connections

1. Navigate to **New Connections** tab
2. Review AI-qualified potential contacts with activity scores
3. Click to view LinkedIn profile
4. Use bulk actions to send connection requests

### Creating Posts

1. Navigate to **New Post** tab
2. Enter topic or let AI generate ideas based on your profile
3. Select research depth and style preferences
4. Review and edit AI-generated content
5. Publish directly to LinkedIn

### Automation Queue

The puppeteer backend uses a FIFO queue for LinkedIn interactions:
- Actions are serialized to prevent session conflicts
- Long-lived browser sessions minimize login frequency
- Heal & Restore checkpoints enable recovery from interruptions

## Architecture

**Frontend**: React/Vite app with TypeScript
- Context-based state management
- Virtual scrolling for large connection lists
- Real-time updates via polling

**Backend**: Node.js Express with Puppeteer
- Browser automation for LinkedIn interactions
- Queue-based action processing
- Session persistence with cookie storage

**Cloud**: AWS Serverless
- Lambda functions for API operations
- DynamoDB single-table design
- Cognito for authentication
- S3 for media storage

**Data Flow**:
```
Frontend → Puppeteer Backend → LinkedIn
    ↓
API Gateway → Lambda → DynamoDB/S3
    ↓
OpenAI/Bedrock (AI Services)
```

## Testing

```bash
npm run lint             # Frontend ESLint + TypeScript
npm run build            # Verify production build
cd backend && pytest     # Backend Lambda tests
cd puppeteer && npm test # Puppeteer backend tests
```

## Security

- **Authentication**: AWS Cognito with JWT token validation
- **Encryption**: Sealbox device-specific credential encryption
- **Data Isolation**: Row-level security by Cognito user ID
- **Transport**: HTTPS for all API communications
- **Secrets**: API keys stored in AWS Secrets Manager

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_GATEWAY_URL` | AWS API Gateway endpoint |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID` | Cognito App Client ID |
| `VITE_PUPPETEER_BACKEND_URL` | Puppeteer backend URL (default: localhost:3001) |
| `OPENAI_API_KEY` | OpenAI API key for content generation |

See `.env.example` for complete variable documentation.

## License

This project is licensed under the Apache License 2.0 - see the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) for details.
