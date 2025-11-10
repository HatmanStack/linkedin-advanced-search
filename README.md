<div align="center">
<h1>LinkedIn Advanced Search</h1>
</div>


<div align="center">  
  <h3>AI-powered LinkedIn networking with intelligent automation and secure cloud infrastructure</h3>
  
  [![License](https://img.shields.io/badge/license-Apache2.0-blue)](https://www.apache.org/licenses/LICENSE-2.0.html)
  [![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![AWS Cognito](https://img.shields.io/badge/AWS%20Cognito-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/cognito/)
  [![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/dynamodb/)
  [![OpenAI](https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white)](https://openai.com/)
</div>

> ⚠️ **Active Development Notice**: This project is under active development and subject to frequent changes. Features and APIs may change without notice.

## 🚀 Features

### Core Capabilities
- **Intelligent LinkedIn Automation**: Queue-based interaction system with session preservation
- **AI-Powered Content Generation**: OpenAI integration for personalized messaging and post creation
- **Secure Credential Management**: Sealbox encryption with device-specific key management
- **Heal & Restore System**: Checkpoint-based recovery for long-running automation processes

### Application Architecture
- **Frontend**: React 18 + TypeScript + Vite with Tailwind CSS
- **Backend**: Node.js Express server with Puppeteer automation
- **Cloud Infrastructure**: AWS serverless stack (Lambda, DynamoDB, API Gateway, Cognito)
- **AI Services**: OpenAI GPT models, OCR processing
- **Deployment**: Node Executable for streamlined deployment

### User Interface
- **Connections Tab**: Manage existing LinkedIn connections with semantic search and bulk operations
- **New Connections Tab**: Discover and connect with potential contacts through automated search
- **New Post Tab**: AI-assisted LinkedIn post creation with research and style customization
- **Profile Management**: Secure LinkedIn credential storage and user profile configuration

## 🏗️ System Architecture

```
Frontend (React/Vite) ←→ Puppeteer Backend (Node.js/Express) ←→ LinkedIn
         ↓
    API Gateway ←→ Lambda Functions ←→ DynamoDB/S3
         ↓
    AI Services (OpenAI)
```

### Infrastructure Components
- **Authentication**: AWS Cognito with JWT token validation
- **Database**: DynamoDB with single-table design and GSI patterns
- **Storage**: S3 for screenshots and media with CloudFront CDN
- **Queue System**: In-memory FIFO queue for LinkedIn interaction serialization
- **Session Management**: Long-lived browser sessions to minimize login frequency

## 🔧 Quick Start

### Prerequisites
- Node.js 22+ installed
- AWS account with configured credentials
- OpenAI API key

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd linkedin-advanced-search
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Configure your API keys and AWS settings in .env
```

### 3. Start Development Environment
```bash
# Start the frontend
npm run dev

# Start the Puppeteer backend (in separate terminal)
cd puppeteer-backend
npm start
```

### 4. Deployment
The application is deployed as a Node Executable:
```bash
npm run build
# Follow deployment instructions for your target environment
```

## 🔐 Security & Authentication

### Multi-Layer Security
- **AWS Cognito**: Production-ready user authentication with JWT tokens
- **Sealbox Encryption**: Device-specific credential encryption for LinkedIn accounts
- **Row-Level Security**: User data isolation in DynamoDB
- **HTTPS Enforcement**: All communications encrypted in transit
- **Just-in-Time Decryption**: Credentials decrypted only when needed

### Data Protection
- LinkedIn credentials encrypted with device-specific keys
- Message content encrypted before storage
- User data isolated by Cognito user ID
- Automatic session cleanup and resource management

## 🤖 AI Integration

### OpenAI Services
- **Content Generation**: Personalized LinkedIn messages and posts
- **Research Assistant**: Topic research and content synthesis
- **Style Customization**: Keyword-based writing style modification **Anthropic**
- **OCR Processing**: Profile screenshot text extraction **Meta**

## 🔄 Automation Features

### Queue-Based Processing
- **FIFO Queue**: Serialized LinkedIn interactions to prevent session conflicts
- **Session Preservation**: Long-lived browser sessions minimize login requirements
- **Heal & Restore**: Checkpoint-based recovery for interrupted processes
- **User Authorization**: Manual approval required for session recovery operations

### LinkedIn Automation
- **Profile Discovery**: Automated search with activity level qualification
- **Connection Requests**: Personalized connection requests with custom messages
- **Message Sending**: AI-generated personalized messages to connections
- **Post Creation**: Automated LinkedIn post publishing with content optimization

## 📊 Performance & Scalability

### Optimization Features
- **Virtual Scrolling**: Efficient rendering of large connection lists
- **Component Pooling**: Optimized React component reuse patterns
- **Lazy Loading**: On-demand data loading for improved performance
- **Caching Strategy**: Multi-level caching for API responses and user data

### Serverless Benefits
- **Auto-scaling**: Automatic scaling based on demand
- **Cost Optimization**: Pay-per-use pricing model
- **High Availability**: Multi-region deployment capability
- **Resource Management**: Automatic cleanup and optimization

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run test suite
```

### Backend Development
```bash
cd puppeteer-backend
npm run dev          # Start backend with hot reload
npm run test         # Run backend tests
```

## 🚀 Deployment Status

**Status**: 🚧 **Active Development**  
**Deployment**: Node Executable  
**Backend**: AWS Serverless Infrastructure  
**Frontend**: Vite Production Build

## 📝 License

Apache 2.0 - see the [LICENSE](https://www.apache.org/licenses/LICENSE-2.0.html) file for details.
