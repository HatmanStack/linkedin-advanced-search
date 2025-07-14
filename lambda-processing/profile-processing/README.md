# LinkedIn Profile Processing Lambda

This Lambda function processes LinkedIn profile screenshots uploaded to S3 and creates Profile Metadata Items in DynamoDB following the new schema.

## Architecture

```
S3 Upload → Lambda Trigger → Textract → Claude → DynamoDB Profile Metadata Item
```

## Features

- **S3 Event Trigger**: Automatically processes new uploads
- **Text Extraction**: Uses Amazon Textract for OCR
- **AI Parsing**: Claude via Bedrock extracts structured data
- **New Schema**: Creates Profile Metadata Items with all required attributes
- **Markdown Generation**: Creates readable profile summaries

## Profile Metadata Item Schema

```
PK: PROFILE#<base64_encoded_url>
SK: #METADATA

Attributes:
- name, headline, summary, profilePictureUrl, originalUrl
- currentCompany, currentTitle, currentLocation, employmentType
- workExperience[], education[], skills[]
- createdAt, updatedAt, fulltext
```

## Deployment

1. **Package the Lambda**:
   ```bash
   cd lambda-processing/profile-processing
   pip install -r requirements.txt -t .
   zip -r profile-processing.zip .
   ```

2. **Create Lambda Function**:
   - Runtime: Python 3.9+
   - Handler: `lambda_function.lambda_handler`
   - Timeout: 5 minutes
   - Memory: 1024 MB

3. **Set Environment Variables**:
   - `AWS_REGION`: us-west-2
   - `DYNAMODB_TABLE_NAME`: linkedin-advanced-search

4. **Configure S3 Trigger**:
   - Event type: `s3:ObjectCreated:*`
   - Prefix: `linkedin-profiles/`
   - Suffix: `.png` or `.jpg`

## IAM Permissions

The Lambda execution role needs:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "textract:DetectDocumentText",
                "bedrock:InvokeModel",
                "s3:GetObject",
                "s3:PutObject",
                "s3:HeadObject",
                "dynamodb:PutItem",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        }
    ]
}
```

## Configuration

Update these constants in `lambda_function.py`:
- `CLAUDE_MODEL_ID`: Claude model to use
- `AWS_REGION`: AWS region
- `DYNAMODB_TABLE_NAME`: DynamoDB table name

## Processing Flow

1. **S3 Event**: Lambda triggered by new file upload
2. **Text Extraction**: Textract extracts text from image
3. **Metadata Extraction**: Gets LinkedIn URL from S3 path
4. **AI Parsing**: Claude extracts structured profile data
5. **Profile Creation**: Creates Profile Metadata Item in DynamoDB
6. **Markdown Generation**: Creates readable summary in S3

## Output

- **DynamoDB**: Profile Metadata Item with all required attributes
- **S3**: Markdown file with formatted profile summary
- **Logs**: CloudWatch logs for monitoring and debugging
