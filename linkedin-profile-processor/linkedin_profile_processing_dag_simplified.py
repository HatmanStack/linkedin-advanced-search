"""
LinkedIn Profile Processing DAG - Simplified Version

This DAG processes LinkedIn profile screenshots uploaded to S3:
1. Extracts text using Amazon Textract (via boto3)
2. Parses the text using Claude to extract structured profile data
3. Generates markdown files and stores them in S3
4. Updates DynamoDB with the extracted profile data
"""

from airflow import DAG
from airflow.providers.amazon.aws.operators.s3 import S3CreateObjectOperator
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import boto3
import json
import os
import uuid
from pathlib import Path

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

def get_s3_metadata(**context):
    """Get metadata from S3 object including upload date and path structure"""
    s3_client = boto3.client('s3')
    bucket = context['dag_run'].conf['bucket']
    key = context['dag_run'].conf['s3_key']
    
    response = s3_client.head_object(Bucket=bucket, Key=key)
    
    # Extract the LinkedIn URL from the directory structure
    path_parts = Path(key).parts
    linkedin_url = None
    if len(path_parts) > 1:
        linkedin_url = path_parts[-2]  # Get the subdirectory name
    
    metadata = {
        'date_added': response['LastModified'].strftime('%Y-%m-%d'),
        'linkedin_url': linkedin_url
    }
    
    return metadata

def extract_text_with_textract(**context):
    """Extract text from image using Amazon Textract"""
    textract_client = boto3.client('textract')
    bucket = context['dag_run'].conf['bucket']
    key = context['dag_run'].conf['s3_key']
    
    # Call Textract to detect text
    response = textract_client.detect_document_text(
        Document={
            'S3Object': {
                'Bucket': bucket,
                'Name': key
            }
        }
    )
    
    return response

def parse_with_claude(**context):
    """Use Claude to parse the OCR text and extract structured information"""
    textract_response = context['ti'].xcom_pull(task_ids='extract_text')
    s3_metadata = context['ti'].xcom_pull(task_ids='get_s3_metadata')
    
    # Combine all text blocks from Textract
    text_blocks = []
    for block in textract_response['Blocks']:
        if block['BlockType'] == 'LINE':
            text_blocks.append(block['Text'])
    
    ocr_text = "\n".join(text_blocks)
    
    # Call Claude via Bedrock
    bedrock_client = boto3.client('bedrock-runtime')
    
    prompt = f"""
    Extract the following information from this LinkedIn profile text:
    - First name
    - Last name
    - Current position (job title)
    - Current company
    - Location
    - Headline (the text directly under the person's name)
    - Generate up to 5 tags that represent this person's professional interests based on their profile
    
    Format the response as a JSON object with these fields:
    first_name, last_name, position, company, location, headline, tags
    
    Here is the LinkedIn profile text from OCR:
    {ocr_text}
    
    Return ONLY the JSON object, nothing else.
    """
    
    response = bedrock_client.invoke_model(
        modelId='anthropic.claude-3-sonnet-20240229-v1:0',
        contentType='application/json',
        accept='application/json',
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        })
    )
    
    response_body = json.loads(response['body'].read())
    parsed_data = json.loads(response_body['content'][0]['text'])
    
    # Add metadata from S3
    parsed_data['date_added'] = s3_metadata['date_added']
    parsed_data['linkedin_url'] = s3_metadata['linkedin_url']
    parsed_data['messages'] = 0  # Initialize messages count to 0
    
    # Generate a unique ID using UUID
    parsed_data['id'] = str(uuid.uuid4())
    
    return parsed_data

def generate_markdown(**context):
    """Generate markdown from parsed data and OCR results"""
    parsed_data = context['ti'].xcom_pull(task_ids='parse_with_claude')
    textract_response = context['ti'].xcom_pull(task_ids='extract_text')
    
    # Combine all text blocks from Textract
    text_blocks = []
    for block in textract_response['Blocks']:
        if block['BlockType'] == 'LINE':
            text_blocks.append(block['Text'])
    
    ocr_text = "\n".join(text_blocks)
    
    # Create markdown content
    markdown = f"""# {parsed_data['first_name']} {parsed_data['last_name']}

## Profile Information
- **Position**: {parsed_data['position']}
- **Company**: {parsed_data['company']}
- **Location**: {parsed_data.get('location', 'Not specified')}
- **Headline**: {parsed_data.get('headline', 'Not specified')}
- **LinkedIn URL**: {parsed_data.get('linkedin_url', 'Not specified')}
- **Date Added**: {parsed_data['date_added']}

## Tags
{', '.join(parsed_data.get('tags', ['No tags generated']))}

## Original OCR Text
```
{ocr_text}
```
"""
    
    return markdown

def update_dynamodb(**context):
    """Update DynamoDB with the parsed profile data"""
    parsed_data = context['ti'].xcom_pull(task_ids='parse_with_claude')
    
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('linkedin-advanced-search')
    
    # Prepare the item for DynamoDB using existing table structure
    # PK = unique UUID, SK = Status (to enable querying by status)
    item = {
        'PK': parsed_data['id'],      # UUID as partition key
        'SK': 'PENDING',              # Status as sort key (default value)
        'first_name': parsed_data['first_name'],
        'last_name': parsed_data['last_name'],
        'position': parsed_data['position'],
        'company': parsed_data['company'],
        'messages': 0,
        'date_added': parsed_data['date_added'],
        'linkedin_url': parsed_data.get('linkedin_url', ''),
        'status': 'PENDING'  # Default status value
    }
    
    # Add optional fields if they exist
    if 'location' in parsed_data and parsed_data['location']:
        item['location'] = parsed_data['location']
    
    if 'headline' in parsed_data and parsed_data['headline']:
        item['headline'] = parsed_data['headline']
    
    # Add tags if they exist
    if 'tags' in parsed_data and parsed_data['tags']:
        item['tags'] = parsed_data['tags']
    
    # Put item in DynamoDB
    table.put_item(Item=item)
    
    return f"Successfully added profile {parsed_data['id']} to DynamoDB"

with DAG(
    'linkedin_profile_processing',
    default_args=default_args,
    description='Process LinkedIn profile screenshots with Claude',
    schedule_interval=None,
    start_date=datetime(2025, 6, 30),
    catchup=False,
) as dag:

    get_s3_metadata = PythonOperator(
        task_id='get_s3_metadata',
        python_callable=get_s3_metadata,
        provide_context=True,
    )
    
    extract_text = PythonOperator(
        task_id='extract_text',
        python_callable=extract_text_with_textract,
        provide_context=True,
    )
    
    parse_with_claude = PythonOperator(
        task_id='parse_with_claude',
        python_callable=parse_with_claude,
        provide_context=True,
    )
    
    create_markdown = PythonOperator(
        task_id='generate_markdown',
        python_callable=generate_markdown,
        provide_context=True,
    )
    
    save_markdown = S3CreateObjectOperator(
        task_id='save_markdown',
        s3_bucket="linkedin-advanced-search-screenshots-2024",
        s3_key="processed-markdown/{{ dag_run.conf['file_name'] }}.md",
        data="{{ ti.xcom_pull(task_ids='generate_markdown') }}",
        replace=True,
    )
    
    update_db = PythonOperator(
        task_id='update_dynamodb',
        python_callable=update_dynamodb,
        provide_context=True,
    )

    # Define the workflow
    [get_s3_metadata, extract_text] >> parse_with_claude >> [create_markdown, update_db]
    create_markdown >> save_markdown
