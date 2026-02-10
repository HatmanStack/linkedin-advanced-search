# LinkedIn Advanced Search

<p align="center">
<a href="https://www.apache.org/licenses/LICENSE-2.0.html"><img src="https://img.shields.io/badge/license-Apache2.0-blue" alt="Apache 2.0 License" /></a>
<a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.13-3776AB" alt="Python 3.13" /></a>
<a href="https://react.dev"><img src="https://img.shields.io/badge/React-18-61DAFB" alt="React 18" /></a>
<a href="https://aws.amazon.com/lambda/"><img src="https://img.shields.io/badge/AWS-Lambda-FF9900" alt="AWS Lambda" /></a>
</p>

LinkedIn networking tool with automation and cloud infrastructure. Built for efficiency, security, and scalability.

** THIS REPO IS IN ACTIVE DEVELOPMENT AND WILL CHANGE OFTEN **

## 📚 Documentation

-   **[Architecture](docs/ARCHITECTURE.md)**: System design and components.
-   **[Development Guide](docs/DEVELOPMENT.md)**: Setup, running, and testing instructions.
-   **[Configuration](docs/CONFIGURATION.md)**: Environment variables and settings.
-   **[Deployment](docs/DEPLOYMENT.md)**: How to deploy to AWS using SAM.
-   **[Security](docs/SECURITY.md)**: Authentication and credential management.
-   **[API Reference](docs/API_REFERENCE.md)**: Overview of available API endpoints.
-   **[Troubleshooting](docs/TROUBLESHOOTING.md)**: Solutions for common issues.

## ✨ Features

-   **LinkedIn Automation**: Queue-based interaction system with session preservation.
-   **RAGStack Integration**: Semantic search and text ingestion using AWS Bedrock and RAGStack-Lambda.
-   **Content Generation**: OpenAI integration for personalized messaging and post creation.
-   **Credential Management**: Sealbox encryption with device-specific key management.
-   **Heal & Restore**: Checkpoint-based recovery for long-running automation processes.
-   **Cloud Native**: Fully serverless backend using AWS Lambda, DynamoDB, and S3.

## 🚀 Quick Start

### Prerequisites

-   Node.js 20+ (24 LTS recommended)
-   AWS CLI configured
-   OpenAI API key

### Install & Run

```bash
# Clone and install
git clone <your-repo-url>
cd linkedin-advanced-search
npm install

# Setup env
cp .env.example .env

# Generate keys
cd puppeteer && node scripts/generate-device-keypair.js && cd ..

# Start Development
npm run dev           # Frontend: http://localhost:5173
npm run dev:puppeteer # Backend: http://localhost:3001
```

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend (Automation)** | Node.js, Express, Puppeteer |
| **Cloud (AWS)** | Lambda, DynamoDB, API Gateway, Cognito, S3 |
| **AI** | OpenAI GPT models |

## 📜 License

Apache 2.0 - see [LICENSE](LICENSE)
