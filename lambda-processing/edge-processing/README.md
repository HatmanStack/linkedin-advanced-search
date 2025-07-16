# Edge Processing Lambda Function

This Lambda function handles the creation of bidirectional edges between users and LinkedIn profiles in DynamoDB.

## Functionality

1. **API Gateway Integration**: Receives POST requests with `linkedinurl` parameter
2. **Profile Validation**: Waits 30 seconds then checks if profile exists and was recently updated
3. **Edge Creation**: Creates bidirectional edges between user and profile if they don't exist
4. **Error Handling**: Returns appropriate HTTP status codes and error messages

## DynamoDB Schema

### User-to-Profile Edge
- **PK**: `USER#<user_id>`
- **SK**: `PROFILE#<profile_id_b64>`
- **GSI1PK**: `USER#<user_id>`
- **GSI1SK**: `STATUS#possible#PROFILE#<profile_id_b64>`
- **status**: `possible`
- **addedAt**: ISO timestamp
- **messages**: Empty array (initialized)

### Profile-to-User Edge
- **PK**: `PROFILE#<profile_id_b64>`
- **SK**: `USER#<user_id>`
- **status**: `possible`
- **addedAt**: ISO timestamp
- **attempts**: 0 (initialized)
- **lastFailedAttempt**: null (initialized)

## API Gateway Event Format

```json
{
  "body": "{\"linkedinurl\": \"https://linkedin.com/in/example\"}"
}
```

## Response Format

### Success (200)
```json
{
  "message": "Edges processed successfully",
  "linkedinUrl": "https://linkedin.com/in/example",
  "userId": "user-id"
}
```

### Error (400/401/500)
```json
{
  "error": "Error description"
}
```

## Environment Variables

- `AWS_REGION`: us-west-2
- `DYNAMODB_TABLE_NAME`: linkedin-advanced-search

## Dependencies

- boto3>=1.35.36
- botocore>=1.35.36
