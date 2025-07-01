"""
LinkedIn Profile Processing DAG

This DAG processes LinkedIn profile screenshots uploaded to S3:
1. Extracts text using Amazon Textract
2. Parses the text using Claude 4.0 to extract structured profile data
3. Generates markdown files and stores them in S3
4. Updates DynamoDB with the extracted profile data
"""

from airflow import DAG
from airflow.providers.amazon.aws.operators.textract import TextractDetectDocumentTextOperator
from airflow.providers.amazon.aws.operators.s3 import S3CreateObjectOperator
from airflow.providers.amazon.aws.operators.dynamodb import DynamoDBOperator
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

def parse_with_claude(**context):
    """Use Claude 4.0 to parse the OCR text and extract structured information"""
    textract_response = context['ti'].xcom_pull(task_ids='extract_text')
    s3_metadata = context['ti'].xcom_pull(task_ids='get_s3_metadata')
    
    # Combine all text blocks from Textract
    text_blocks = []
    for block in textract_response['Blocks']:
        if block['BlockType'] == 'LINE':
            text_blocks.append(block['Text'])
    
    ocr_text = "\n".join(text_blocks)
    
    # Call Claude 4.0 via Bedrock
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
        modelId='anthropic.claude-3-sonnet-20240229-v1:0',  # Use Claude 4.0 when available
        contentType='application/json',
        accept='application/json',
        body=json.dumps({
            "prompt": prompt,
            "max_tokens_to_sample": 2000,
            "temperature": 0,
            "top_p": 1
        })
    )
    
    response_body = json.loads(response['body'].read())
    parsed_data = json.loads(response_body['completion'])
    
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

def prepare_dynamodb_item(**context):
    """Prepare the item for DynamoDB insertion"""
    parsed_data = context['ti'].xcom_pull(task_ids='parse_with_claude')
    
    # Format the data for DynamoDB using existing table structure
    # PK = unique UUID, SK = Status (to enable querying by status)
    dynamodb_item = {
        'Key': {
            'PK': {'S': parsed_data['id']},      # UUID as partition key
            'SK': {'S': 'PENDING'}               # Status as sort key (default value)
        },
        'UpdateExpression': 'SET first_name = :fn, last_name = :ln, position = :pos, company = :comp, messages = :msg, date_added = :da, linkedin_url = :url, #status = :status',
        'ExpressionAttributeNames': {
            '#status': 'status'  # Using expression attribute name for reserved word
        },
        'ExpressionAttributeValues': {
            ':fn': {'S': parsed_data['first_name']},
            ':ln': {'S': parsed_data['last_name']},
            ':pos': {'S': parsed_data['position']},
            ':comp': {'S': parsed_data['company']},
            ':msg': {'N': '0'},
            ':da': {'S': parsed_data['date_added']},
            ':url': {'S': parsed_data.get('linkedin_url', '')},
            ':status': {'S': 'PENDING'}  # Default status value
        }
    }
    
    # Add optional fields if they exist
    optional_fields = {
        'location': 'loc',
        'headline': 'hl'
    }
    
    for field, abbr in optional_fields.items():
        if field in parsed_data and parsed_data[field]:
            dynamodb_item['UpdateExpression'] += f', {field} = :{abbr}'
            dynamodb_item['ExpressionAttributeValues'][f':{abbr}'] = {'S': parsed_data[field]}
    
    # Add tags if they exist
    if 'tags' in parsed_data and parsed_data['tags']:
        dynamodb_item['UpdateExpression'] += ', tags = :tags'
        dynamodb_item['ExpressionAttributeValues'][':tags'] = {'SS': parsed_data['tags']}
    
    return dynamodb_item

with DAG(
    'linkedin_profile_processing',
    default_args=default_args,
    description='Process LinkedIn profile screenshots with Claude',
    schedule_interval=None,
    start_date=datetime(2025, 6, 30),
    catchup=False,
) as dag:

    extract_text = TextractDetectDocumentTextOperator(
        task_id='extract_text',
        document_s3_key="{{ dag_run.conf['s3_key'] }}",
        document_s3_bucket="linkedin-advanced-search-screenshots-2024",
    )
    
    get_s3_metadata = PythonOperator(
        task_id='get_s3_metadata',
        python_callable=get_s3_metadata,
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
    
    prepare_dynamodb_item = PythonOperator(
        task_id='prepare_dynamodb_item',
        python_callable=prepare_dynamodb_item,
        provide_context=True,
    )
    
    update_dynamodb = DynamoDBOperator(
        task_id='update_dynamodb',
        table_name='linkedin-advanced-search',
        operation='update_item',
        key="{{ ti.xcom_pull(task_ids='prepare_dynamodb_item')['Key'] }}",
        expression_attribute_values="{{ ti.xcom_pull(task_ids='prepare_dynamodb_item')['ExpressionAttributeValues'] }}",
        update_expression="{{ ti.xcom_pull(task_ids='prepare_dynamodb_item')['UpdateExpression'] }}",
    )

    # Define the workflow
    extract_text >> get_s3_metadata >> parse_with_claude >> [create_markdown, prepare_dynamodb_item]
    create_markdown >> save_markdown
    prepare_dynamodb_item >> update_dynamodb
