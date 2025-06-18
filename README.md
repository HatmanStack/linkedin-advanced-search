# LinkedIn Advanced Search

<div align="center">
  <h3>AI-powered LinkedIn networking with secure cloud backend and user authentication</h3>
  
  [![License](https://img.shields.io/badge/license-Apache2.0-blue)](https://www.apache.org/licenses/LICENSE-2.0.html)
  [![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![AWS Cognito](https://img.shields.io/badge/AWS%20Cognito-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/cognito/)
  [![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/dynamodb/)
  [![API Gateway](https://img.shields.io/badge/API%20Gateway-FF4F8B?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/api-gateway/)
  [![Lambda](https://img.shields.io/badge/Lambda-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/lambda/)
</div>

## 🚀 Features

- **Production Backend**: Fully deployed AWS serverless infrastructure
- **User Authentication**: AWS Cognito integration with JWT token validation
- **Cloud Database**: DynamoDB with single-table design and user data isolation
- **RESTful API**: API Gateway with Lambda functions for all operations
- **Enhanced Data Model**: Message tracking, tags, engagement scores, and more
- **Secure Architecture**: Row-level security with encrypted data storage
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Updates**: Live data synchronization with backend

## 🏗️ Architecture

```
Frontend (React/Vite) → API Gateway → Lambda Functions → DynamoDB
                     ↓
                 Cognito JWT Authentication
```

### Backend Infrastructure (AWS us-west-2)
- **DynamoDB**: `linkedin-advanced-search` table with GSI
- **Lambda Functions**: Profile and connections handlers
- **API Gateway**: `https://2c6mr2rri0.execute-api.us-west-2.amazonaws.com/prod`
- **Cognito**: JWT-based authentication with existing User Pool

## 🔧 Quick Start

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd linkedin-advanced-search
npm install
```

### 2. Environment Setup
The application is pre-configured with production backend:
```bash
cp .env.example .env.local
```

### 3. Start Application
```bash
npm run dev
```
Application available at `http://localhost:5173`

## 🔐 Authentication & Security

### AWS Cognito Integration
- **Production-ready authentication** with existing User Pool
- **JWT token validation** on all API requests
- **Secure session management** with automatic token refresh
- **Row-level security** with user data isolation

### Security Features
- User data isolated by Cognito user ID
- All API calls require valid JWT tokens
- HTTPS enforcement for all communications
- Encrypted data storage in DynamoDB

## 🗄️ Database Schema

### Enhanced Data Model
- **Message Count**: Track messages sent to each connection
- **Last Activity Summary**: Store interaction summaries
- **Connection Status**: Track connection states and metrics
- **Tags**: User-defined organization tags
- **Conversation Topics**: Discussion topics per connection
- **Search Metadata**: Preserve search data and results
- **Engagement Score**: Connection engagement metrics

## 🌐 API Endpoints

### Base URL
```
<api gateway url>
```

### Available Endpoints
- `GET /profile` - Get user profile
- `POST /profile` - Create user profile
- `PUT /profile` - Update user profile
- `GET /connections` - List user connections
- `POST /connections` - Create new connection

All endpoints require JWT authentication.

## 📊 Performance & Scalability

### Serverless Benefits
- **Auto-scaling**: Handles traffic spikes automatically
- **Cost-effective**: Pay only for actual usage (~$10/month)
- **High availability**: Multi-AZ deployment
- **Low latency**: Single-digit millisecond responses

## 📚 Documentation

- [Session Summary](./SUMMARY.md) - Complete implementation summary
- [Backend Implementation](./BACKEND_IMPLEMENTATION_SUMMARY.md) - Infrastructure details
- [DynamoDB Schema](./DYNAMODB_SCHEMA.md) - Database design
- [Environment Variables](./.env.example) - Configuration template

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Testing
```bash
node test-api.js     # Test API endpoints
```

## 🚀 Deployment Status

**Status**: ✅ **Production Ready**  
**Backend**: ✅ **Fully Deployed**  
**API**: `https://2c6mr2rri0.execute-api.us-west-2.amazonaws.com/prod`

## 📝 License

Apache 2.0 - see the [LICENSE](https://www.apache.org/licenses/LICENSE-2.0.html) file for details.
