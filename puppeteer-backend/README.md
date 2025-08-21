<div align="center">
<h1>LinkedIn Advanced Search - Backend</h1>
</div>

<div align="center">
Node.js automation backend for LinkedIn interactions with queue-based processing

 >⚠️ **Active Development Notice**: This backend service is under active development and subject to frequent changes.
</div>

## Features

- **LinkedIn Automation**: Queue-based LinkedIn search, messaging, and connection management
- **Session Management**: Long-lived browser sessions with heal & restore capabilities
- **AWS Integration**: DynamoDB and S3 storage with encrypted credential management
- **Secure Processing**: Sealbox encryption and user data isolation
- **Error Recovery**: Checkpoint-based recovery for interrupted processes

## Quick Start

### Prerequisites
- Node.js 22+
- AWS credentials configured
- Chrome/Chromium browser

### Installation
```bash
cd puppeteer-backend
npm install
cp .env.example .env
```

### Start Server
```bash
npm run dev    # Development
npm start      # Production
```

Server runs at `http://localhost:3001`

## API Endpoints

### Core Operations
- `POST /search` - Execute LinkedIn search with company/role filters
- `POST /profile-init` - Initialize user profile and extract connections
- `POST /linkedin-interactions` - Queue LinkedIn messages, connections, posts
- `GET /heal-restore` - Check automation recovery status
- `POST /heal-restore` - Authorize session recovery
- `GET /health` - System health and queue status

All endpoints require JWT authentication and encrypted credentials.

## How It Works

1. **Authentication**: Secure credential decryption with Sealbox encryption
2. **Queue Processing**: FIFO queue serializes LinkedIn interactions
3. **Session Management**: Long-lived browser sessions minimize logins
4. **Data Capture**: Multi-page screenshots stored in S3 with DynamoDB metadata
5. **Recovery System**: Checkpoint-based recovery for interrupted processes
6. **AWS Integration**: Direct DynamoDB and S3 operations for data persistence

## Security

- **Sealbox Encryption**: Device-specific credential encryption
- **Session Management**: Long-lived sessions with automatic cleanup
- **User Data Isolation**: All data isolated by Cognito user ID
- **Audit Logging**: Comprehensive logging without sensitive data
- **AWS Integration**: IAM roles and encrypted storage

### Troubleshooting
- **Login Issues**: LinkedIn may require 2FA or CAPTCHA
- **Browser Crashes**: Monitor memory usage and restart if needed
- **Queue Stalls**: Check processing delays and job limits
- **AWS Permissions**: Verify IAM roles for DynamoDB and S3

## License

Apache 2.0 - see the [LICENSE](https://www.apache.org/licenses/LICENSE-2.0.html) file for details.

---

## Work in Progress / To Do

### Core Development Tasks
- [ ] **Profile Init Logic** - Complete user personal database initialization system
- [ ] **Multi-Message Architecture** - Implement comprehensive message handling system
- [ ] **Message Retrieval Logic** - Build efficient message retrieval 
- [ ] **Encrypt/Decrypt Optimization** - Enhance Sealbox encryption performance
- [ ] **Code Refactor** - Reduce AI-generated code inefficiencies
- [ ] **Performance Optimization** - Optimize API calls and database queries

