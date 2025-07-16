"""
LinkedIn Profile Processing DAG - Updated for Airflow 2.10.3

This DAG processes LinkedIn profile screenshots uploaded to S3:
1. Extracts text using Amazon Textract (via direct boto3 calls)
2. Parses the text using Claude (model to be specified) to extract structured profile data
3. Generates markdown files and stores them in S3
4. Updates DynamoDB with the extracted profile data

Updated for:
- Airflow 2.10.3 with boto3 1.35.36
- Claude model via Bedrock (model ID to be configured)
- Direct boto3 calls instead of problematic operators
- Enhanced DynamoDB permissions
"""

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models.param import Param
from datetime import datetime, timedelta
import boto3
import json
import os
import uuid
import logging
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)

# Configuration - UPDATE THESE VALUES
CLAUDE_MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"  # TODO: Set your preferred Claude model ID (e.g., "anthropic.claude-3-opus-20240229-v1:0")
AWS_REGION = "us-west-2"
DYNAMODB_TABLE_NAME = "linkedin-advanced-search"  # Update if using different table
S3_BUCKET_NAME = "linkedin-advanced-search-screenshots-2024"  # Update if using different bucket

default_args = {
    'owner': 'linkedin-processor',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
    'start_date': datetime(2025, 7, 2),
}

def check_environment(**context):
    """Check boto3 version and Bedrock availability"""
    try:
        logger.info(f"boto3 version: {boto3.__version__}")
        
        # Validate configuration
        if not CLAUDE_MODEL_ID:
            raise ValueError("CLAUDE_MODEL_ID must be configured in the DAG file")
        
        # Test Bedrock access
        bedrock_client = boto3.client('bedrock-runtime', region_name=AWS_REGION)
        logger.info("✅ Bedrock Runtime client initialized successfully")
        
        # List available models to verify access
        bedrock_models_client = boto3.client('bedrock', region_name=AWS_REGION)
        models = bedrock_models_client.list_foundation_models()
        claude_models = [m for m in models.get('modelSummaries', []) if 'claude' in m.get('modelId', '').lower()]
        logger.info(f"✅ Found {len(claude_models)} Claude models available")
        
        # Test DynamoDB access
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        table.load()
        logger.info(f"✅ DynamoDB table '{DYNAMODB_TABLE_NAME}' accessible")
        
        return True
        
    except Exception as e:
        logger.error(f"Environment check failed: {str(e)}")
        raise

def extract_text_from_s3(**context):
    """Extract text from S3 document using Amazon Textract"""
    try:
        bucket = context.get('params', {}).get('bucket') or context['dag_run'].conf.get('bucket', S3_BUCKET_NAME)
        key = context.get('params', {}).get('s3_key') or context['dag_run'].conf['s3_key']
        
        logger.info(f"Processing document: s3://{bucket}/{key}")
        
        # Initialize Textract client
        textract_client = boto3.client('textract', region_name=AWS_REGION)
        
        # Call Textract to detect document text
        response = textract_client.detect_document_text(
            Document={
                'S3Object': {
                    'Bucket': bucket,
                    'Name': key
                }
            }
        )
        
        logger.info(f"✅ Textract processed {len(response.get('Blocks', []))} blocks")
        return response
        
    except Exception as e:
        logger.error(f"Text extraction failed: {str(e)}")
        raise

def get_s3_metadata(**context):
    """Get metadata from S3 object including upload date and path structure"""
    try:
        s3_client = boto3.client('s3', region_name=AWS_REGION)
        bucket = context.get('params', {}).get('bucket') or context['dag_run'].conf.get('bucket', S3_BUCKET_NAME)
        key = context.get('params', {}).get('s3_key') or context['dag_run'].conf['s3_key']
        
        response = s3_client.head_object(Bucket=bucket, Key=key)
        
        # Extract the LinkedIn URL from the directory structure
        path_parts = Path(key).parts
        linkedin_url = None
        if len(path_parts) > 1:
            linkedin_url = path_parts[-2]  # Get the subdirectory name
        
        metadata = {
            'date_added': response['LastModified'].strftime('%Y-%m-%d'),
            'linkedin_url': linkedin_url or 'unknown'
        }
        
        logger.info(f"✅ S3 metadata extracted: {metadata}")
        return metadata
        
    except Exception as e:
        logger.error(f"S3 metadata extraction failed: {str(e)}")
        raise

def parse_with_claude(**context):
    """Use Claude to parse the OCR text and extract structured information"""
    try:
        if not CLAUDE_MODEL_ID:
            raise ValueError("CLAUDE_MODEL_ID must be configured before running this task")
            
        textract_response = context['ti'].xcom_pull(task_ids='extract_text')
        s3_metadata = context['ti'].xcom_pull(task_ids='get_s3_metadata')
        
        # Combine all text blocks from Textract
        text_blocks = []
        for block in textract_response['Blocks']:
            if block['BlockType'] == 'LINE':
                text_blocks.append(block['Text'])
        
        ocr_text = "\n".join(text_blocks)
        logger.info(f"Processing {len(text_blocks)} text lines with Claude model: {CLAUDE_MODEL_ID}")
        
        # Initialize Bedrock client
        bedrock_client = boto3.client('bedrock-runtime', region_name=AWS_REGION)
        
        # Prepare the prompt for Claude
        prompt = f"""
        Analyze this LinkedIn profile text and extract structured information.
        
        LinkedIn Profile Text:
        {ocr_text}
        
        Extract the following information and return as a JSON object:
        {{
            "first_name": "First name of the person",
            "last_name": "Last name of the person", 
            "position": "Current job title/position",
            "company": "Current company name",
            "location": "Geographic location",
            "headline": "Professional headline (text under name)",
            "experience_years": "Estimated years of experience (number)",
            "industry": "Primary industry/sector",
            "skills": ["List of key skills mentioned"],
            "tags": ["5 professional tags based on profile"],
            "summary": "Brief professional summary (2-3 sentences)"
        }}
        
        Guidelines:
        - Extract only information clearly present in the text
        - Use "Not specified" for missing information
        - Be precise and professional
        - Focus on current role and key qualifications
        
        Return ONLY the JSON object, no additional text.
        """
        
        # Prepare request body for Claude
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,
            "temperature": 0.1,  # Low temperature for consistent extraction
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
        
        # Call Claude via Bedrock
        response = bedrock_client.invoke_model(
            modelId=CLAUDE_MODEL_ID,
            body=json.dumps(body),
            contentType="application/json"
        )
        
        # Parse the response
        response_body = json.loads(response['body'].read())
        analysis_text = response_body['content'][0]['text']
        
        # Parse the JSON from Claude's response
        try:
            parsed_data = json.loads(analysis_text)
        except json.JSONDecodeError:
            # Fallback: extract JSON from response if wrapped in text
            import re
            json_match = re.search(r'\{.*\}', analysis_text, re.DOTALL)
            if json_match:
                parsed_data = json.loads(json_match.group())
            else:
                raise ValueError("Could not parse JSON from Claude response")
        
        # Add metadata from S3
        parsed_data['date_added'] = s3_metadata['date_added']
        parsed_data['linkedin_url'] = s3_metadata['linkedin_url']
        parsed_data['messages'] = 0  # Initialize messages count
        parsed_data['id'] = str(uuid.uuid4())  # Generate unique ID
        parsed_data['processing_model'] = CLAUDE_MODEL_ID  # Track which model was used
        
        logger.info(f"✅ Successfully processed profile with Claude: {parsed_data.get('first_name', 'Unknown')} {parsed_data.get('last_name', 'Unknown')}")
        return parsed_data
        
    except Exception as e:
        logger.error(f"Claude parsing failed: {str(e)}")
        raise

def generate_markdown(**context):
    """Generate markdown from parsed data and OCR results"""
    try:
        parsed_data = context['ti'].xcom_pull(task_ids='parse_with_claude')
        textract_response = context['ti'].xcom_pull(task_ids='extract_text')
        
        # Combine all text blocks from Textract
        text_blocks = []
        for block in textract_response['Blocks']:
            if block['BlockType'] == 'LINE':
                text_blocks.append(block['Text'])
        
        ocr_text = "\n".join(text_blocks)
        
        # Create markdown content
        markdown = f"""# {parsed_data.get('first_name', 'Unknown')} {parsed_data.get('last_name', 'Unknown')}

## Profile Information
- **Position**: {parsed_data.get('position', 'Not specified')}
- **Company**: {parsed_data.get('company', 'Not specified')}
- **Location**: {parsed_data.get('location', 'Not specified')}
- **Headline**: {parsed_data.get('headline', 'Not specified')}
- **LinkedIn URL**: {parsed_data.get('linkedin_url', 'Not specified')}
- **Date Added**: {parsed_data.get('date_added', 'Unknown')}
- **Processing Model**: {parsed_data.get('processing_model', 'Unknown')}

## Professional Summary
{parsed_data.get('summary', 'No summary available')}

## Skills
{', '.join(parsed_data.get('skills', ['No skills listed']))}

## Tags
{', '.join(parsed_data.get('tags', ['No tags generated']))}

## Original OCR Text
```
{ocr_text}
```
"""
        
        logger.info("✅ Markdown generated successfully")
        return markdown
        
    except Exception as e:
        logger.error(f"Markdown generation failed: {str(e)}")
        raise

def save_markdown_to_s3(**context):
    """Save markdown content to S3"""
    try:
        markdown_content = context['ti'].xcom_pull(task_ids='generate_markdown')
        parsed_data = context['ti'].xcom_pull(task_ids='parse_with_claude')
        
        bucket = context.get('params', {}).get('bucket') or context['dag_run'].conf.get('bucket', S3_BUCKET_NAME)
        file_name = context.get('params', {}).get('file_name') or context['dag_run'].conf.get('file_name', f"profile_{parsed_data['id']}")
        s3_key = f"processed-markdown/{file_name}.md"
        
        s3_client = boto3.client('s3', region_name=AWS_REGION)
        
        s3_client.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=markdown_content,
            ContentType='text/markdown'
        )
        
        logger.info(f"✅ Markdown saved to s3://{bucket}/{s3_key}")
        return s3_key
        
    except Exception as e:
        logger.error(f"Markdown save failed: {str(e)}")
        raise

def update_dynamodb(**context):
    """Update DynamoDB with the extracted profile data"""
    try:
        parsed_data = context['ti'].xcom_pull(task_ids='parse_with_claude')
        
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        
        # Prepare the item for DynamoDB
        item = {
            'PK': parsed_data['id'],  # UUID as partition key
            'SK': 'PENDING',  # Status as sort key
            'first_name': parsed_data.get('first_name', 'Unknown'),
            'last_name': parsed_data.get('last_name', 'Unknown'),
            'position': parsed_data.get('position', 'Not specified'),
            'company': parsed_data.get('company', 'Not specified'),
            'location': parsed_data.get('location', 'Not specified'),
            'headline': parsed_data.get('headline', 'Not specified'),
            'linkedin_url': parsed_data.get('linkedin_url', ''),
            'date_added': parsed_data.get('date_added', ''),
            'messages': 0,
            'status': 'PENDING',
            'processing_model': parsed_data.get('processing_model', CLAUDE_MODEL_ID)
        }
        
        # Add optional fields if they exist
        if parsed_data.get('industry'):
            item['industry'] = parsed_data['industry']
        if parsed_data.get('experience_years'):
            item['experience_years'] = parsed_data['experience_years']
        if parsed_data.get('summary'):
            item['summary'] = parsed_data['summary']
        if parsed_data.get('skills'):
            item['skills'] = parsed_data['skills']
        if parsed_data.get('tags'):
            item['tags'] = parsed_data['tags']
        
        # Put item in DynamoDB
        table.put_item(Item=item)
        
        logger.info(f"✅ Profile data saved to DynamoDB: {item['first_name']} {item['last_name']}")
        return item['PK']
        
    except Exception as e:
        logger.error(f"DynamoDB update failed: {str(e)}")
        raise

# Create the DAG
with DAG(
    'linkedin_profile_processing',
    default_args=default_args,
    description='Process LinkedIn profile screenshots with Claude via Bedrock',
    schedule_interval=None,  # Triggered manually or by external events
    start_date=datetime(2025, 7, 2),
    catchup=False,
    tags=['linkedin', 'bedrock', 'claude', 'textract', 'dynamodb'],
    params={
        "s3_key": Param("screenshots/example.png", type="string", description="S3 key path to the LinkedIn screenshot"),
        "bucket": Param("linkedin-advanced-search-screenshots-2024", type="string", description="S3 bucket name"),
        "file_name": Param("profile", type="string", description="Output file name (without extension)")
    },
) as dag:

    # Task 1: Check environment and configuration
    check_env_task = PythonOperator(
        task_id='check_environment',
        python_callable=check_environment,
        provide_context=True,
    )
    
    # Task 2: Extract text from S3 document using Textract
    extract_text_task = PythonOperator(
        task_id='extract_text',
        python_callable=extract_text_from_s3,
        provide_context=True,
    )
    
    # Task 3: Get S3 metadata
    get_metadata_task = PythonOperator(
        task_id='get_s3_metadata',
        python_callable=get_s3_metadata,
        provide_context=True,
    )
    
    # Task 4: Parse with Claude
    parse_claude_task = PythonOperator(
        task_id='parse_with_claude',
        python_callable=parse_with_claude,
        provide_context=True,
    )
    
    # Task 5: Generate markdown
    generate_md_task = PythonOperator(
        task_id='generate_markdown',
        python_callable=generate_markdown,
        provide_context=True,
    )
    
    # Task 6: Save markdown to S3
    save_md_task = PythonOperator(
        task_id='save_markdown',
        python_callable=save_markdown_to_s3,
        provide_context=True,
    )
    
    # Task 7: Update DynamoDB
    update_db_task = PythonOperator(
        task_id='update_dynamodb',
        python_callable=update_dynamodb,
        provide_context=True,
    )

    # Define the workflow
    check_env_task >> [extract_text_task, get_metadata_task]
    [extract_text_task, get_metadata_task] >> parse_claude_task
    parse_claude_task >> [generate_md_task, update_db_task]
    generate_md_task >> save_md_task
