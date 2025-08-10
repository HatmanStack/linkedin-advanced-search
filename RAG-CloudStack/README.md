# RAG-CloudStack

Minimal, reusable CloudFormation stack:
- S3 artifacts bucket (lambdas/ prefix)
- DynamoDB table (PAY_PER_REQUEST, PK/SK)
- Two Lambdas (Python LTS, Node.js LTS)
- API Gateway v2 HTTP with two POST routes (CORS, Cognito JWT)
- Cognito User Pool (optional Google IdP)
- Default CloudWatch logging only

## Files
- templates/s3-artifacts.yaml
- templates/dynamodb.yaml
- templates/lambdas.yaml
- templates/apigw-http.yaml
- templates/cognito.yaml
- deploy.sh

## Deploy
1) Package zips:
   - Python: lambda_function.py → handler lambda_function.handler → zip
   - Node: index.js → handler index.handler → zip
2) Run:
```
cd RAG-CloudStack
bash deploy.sh \
  STACK_PREFIX=my-stack \
  PROJECT_NAME=my-project \
  AWS_REGION=us-west-2 \
  ARTIFACTS_BUCKET=my-unique-artifacts \
  TABLE_NAME=my-project-table \
  API_NAME=my-project-api \
  STAGE_NAME=prod \
  PYTHON_ZIP_PATH=./lambda-src/python/lambda_function.zip \
  NODE_ZIP_PATH=./lambda-src/node/index.zip \
   PYTHON_ROUTE_PATH=/process \
   NODE_ROUTE_PATH=/pinecone-search \
  COGNITO_DOMAIN=my-project-auth \
  GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com \
  GOOGLE_CLIENT_SECRET=yyyyy \
  CALLBACK_URLS=http://localhost:5173 \
   LOGOUT_URLS=http://localhost:5173 \
   PINECONE_API_KEY=pcn-... \
   PINECONE_HOST=profiles-xxxx.svc.us-east-1-aws.pinecone.io \
   PINECONE_INDEX_NAME=profiles
```
3) Outputs: API base URL, Lambda ARNs, Cognito IDs.

## API
- POST {BaseUrl}/process → Python Lambda
- POST {BaseUrl}/pinecone-search → Node Lambda
- CORS: POST, OPTIONS; Auth: Cognito JWT

## Cognito + Google
- Google Cloud steps (minimal):
  - Create a project → Configure OAuth consent screen (External)
  - Create OAuth client credentials (Web)
  - Add redirect URI: `https://{CognitoDomain}.auth.{region}.amazoncognito.com/oauth2/idpresponse`
  - Copy Client ID/Secret into deploy vars `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  - Enable APIs: Google People API (optional if you later fetch profile details)
  - In Cognito, attribute mapping: `email`, `given_name`, `family_name`, `name`; scopes: `openid email profile`

## Pinecone
- No resources created by this stack.
- Node Lambda expects environment variables when using Pinecone:
  - `PINECONE_API_KEY`, `PINECONE_HOST`, `PINECONE_INDEX_NAME`
- You can set these via `templates/lambdas.yaml` parameters `PineconeApiKey`, `PineconeHost`, `PineconeIndexName` or manage via Secrets Manager and fetch at runtime.

### MCP quickstart for Pinecone
- Use your MCP Pinecone server to create or inspect indexes. Example prompts:
  - "Create a Pinecone index named `profiles` with `llama-text-embed-v2` embeddings"
  - "Show connection info and host URL for the `profiles` index"
  - "Insert a sample vector and run a similarity search"
  - Then set `PINECONE_API_KEY` and `PINECONE_HOST` on the Lambda via parameters or environment.

## Conventions
- Only POST routes; HTTP API v2; minimal logs; no versioning/alarms.
