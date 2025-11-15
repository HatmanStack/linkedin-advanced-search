# LinkedIn Advanced Search - Quick Start

Complete setup from scratch in 5 steps.

## Prerequisites

- ✅ AWS CLI configured (`aws configure`)
- ✅ AWS SAM CLI installed (`sam --version`)
- ✅ Node.js 20+ (`node --version`)
- ✅ Python 3.13+ (`python3 --version`)

---

## Setup Steps

### 1️⃣ Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Generate encryption keys
cd puppeteer-backend
node scripts/generate-device-keypair.js
cd ..

# Install dependencies
npm install
cd puppeteer-backend && npm install && cd ..
```

### 2️⃣ Deploy AWS Infrastructure

```bash
cd RAG-CloudStack

# Build and deploy
sam build
sam deploy --guided

# Answer prompts:
# - Stack Name: linkedin-advanced-search
# - AWS Region: us-west-2
# - Confirm changes: Y
# - Allow IAM role creation: Y
# - Save config: Y
```

### 3️⃣ Update .env with AWS Outputs

```bash
# Auto-populate AWS values in .env
./get-env-vars.sh linkedin-advanced-search --update-env

# Verify
cd ..
./check-env.sh
```

### 4️⃣ Start Development Servers

```bash
# Frontend (terminal 1)
npm run dev
# Opens at http://localhost:5173

# Backend (terminal 2)
cd puppeteer-backend
npm start
# Runs at http://localhost:3001
```

### 5️⃣ Create Cognito User

```bash
# Get User Pool ID from .env
USER_POOL_ID=$(grep VITE_COGNITO_USER_POOL_ID .env | cut -d'=' -f2)

# Create test user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --temporary-password "TempPass123!" \
  --user-attributes Name=email,Value=testuser@example.com \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --password "MySecurePass123!" \
  --permanent
```

---

## ✅ You're Done!

Visit http://localhost:5173 and login with:
- **Email:** testuser@example.com
- **Password:** MySecurePass123!

---

## Common Issues

### "Missing Cognito configuration fields"

```bash
# Check .env has values
./check-env.sh

# If missing, re-run:
cd RAG-CloudStack
./get-env-vars.sh linkedin-advanced-search --update-env
cd ..

# RESTART dev server (important!)
npm run dev
```

### CORS Errors

```bash
# Check FRONTEND_URLS in .env includes your origin
grep FRONTEND_URLS .env

# Should include: http://localhost:5173
# Restart backend after changes
```

### Lambda Deployment Fails

```bash
# Check AWS credentials
aws sts get-caller-identity

# Clear cache and rebuild
cd RAG-CloudStack
rm -rf .aws-sam/
sam build
sam deploy
```

---

## Update After Code Changes

### Lambda Code Changes

```bash
cd RAG-CloudStack
sam build
sam deploy
```

### Frontend Changes

Just save - Vite hot-reloads automatically!

### Backend Changes

Restart the backend server (Ctrl+C, then `npm start`)

---

## Cleanup

### Delete Everything

```bash
cd RAG-CloudStack

# Empty S3 bucket first
BUCKET=$(./get-env-vars.sh linkedin-advanced-search | grep S3_SCREENSHOT_BUCKET_NAME | cut -d'=' -f2)
aws s3 rm s3://$BUCKET --recursive

# Delete stack
sam delete --stack-name linkedin-advanced-search
```

---

## Quick Reference

| Task | Command |
|------|---------|
| **Start frontend** | `npm run dev` |
| **Start backend** | `cd puppeteer-backend && npm start` |
| **Deploy changes** | `cd RAG-CloudStack && sam build && sam deploy` |
| **Update .env** | `cd RAG-CloudStack && ./get-env-vars.sh <stack> --update-env` |
| **Check .env** | `./check-env.sh` |
| **View logs** | `cd RAG-CloudStack && sam logs -n EdgeProcessingFunction --tail` |
| **Local test** | `cd RAG-CloudStack && sam local start-api` |

---

## Next Steps

- 📚 Read `RAG-CloudStack/README.md` for detailed deployment docs
- 🔐 Configure LinkedIn credentials in the app
- 🧪 Run tests: `npm test`
- 📊 Check CloudWatch logs in AWS Console

---

## Support

- **Check .env:** `./check-env.sh`
- **View stack events:** `aws cloudformation describe-stack-events --stack-name linkedin-advanced-search`
- **Lambda logs:** `sam logs -n <FunctionName> --tail`
