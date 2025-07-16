# Pinecone Indexer Lambda Function

This Lambda function processes DynamoDB Stream events to maintain a Pinecone vector index for LinkedIn profiles.

## Functionality

1. **Stream Processing**: Triggered by DynamoDB Stream events from `linkedin-advanced-search` table
2. **Profile Filtering**: Only processes Profile Metadata Items (`PK: PROFILE#*`, `SK: #METADATA`)
3. **AI Summarization**: Uses GPT-4o to create focused professional summaries from fulltext
4. **Vector Embeddings**: Generates embeddings using OpenAI's text-embedding-3-large (3072 dimensions)
5. **Metadata Storage**: Stores comprehensive profile metadata in Pinecone for filtering

## Event Handling

- **INSERT/MODIFY**: Upserts vector in Pinecone with updated embedding and metadata
- **REMOVE**: Deletes vector from Pinecone index

## Environment Variables

Required environment variables:
- `PINECONE_API_KEY`: Pinecone API key
- `OPENAI_API_KEY`: OpenAI API key
- `PINECONE_ENVIRONMENT`: Pinecone environment (default: us-west1-gcp-free)
- `PINECONE_INDEX_NAME`: Pinecone index name (default: linkedin-profiles)

## Pinecone Metadata Structure

```json
{
  "profile_id": "PROFILE#<profile_id>",
  "name": "Full Name",
  "company": "Current Company",
  "title": "Current Title",
  "location": "Current Location",
  "employment_type": "Full-time",
  "headline": "Professional Headline",
  "experience_length": 5.2,
  "skills": "Python, AWS, Machine Learning, ...",
  "education": "University Name",
  "updated_at": "2024-01-15T10:30:00Z",
  "created_at": "2024-01-15T10:30:00Z",
  "original_url": "https://linkedin.com/in/profile",
  "profile_picture_url": "https://..."
}
```

## AI Summary Generation

The function creates professional summaries optimized for:
- Professional networking and connections
- Recruitment and hiring decisions
- Business development and partnerships
- Industry expertise assessment

Summary focuses on:
1. Professional Experience & Career Progression
2. Core Skills & Technical Expertise
3. Industry Background & Notable Employers
4. Career Highlights & Achievements
5. Professional Goals & Value Proposition

## Dependencies

- boto3: AWS SDK
- pinecone-client: Pinecone vector database client
- openai: OpenAI API client for embeddings and summarization

## Trigger Configuration

Configure DynamoDB Stream on `linkedin-advanced-search` table:
- Stream view type: NEW_AND_OLD_IMAGES
- Trigger: This Lambda function
- Batch size: 10-100 records
- Maximum batching window: 5 seconds
