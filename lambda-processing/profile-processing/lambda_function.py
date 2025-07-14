"""
LinkedIn Profile Processing Lambda Function

This Lambda function processes LinkedIn profile screenshots uploaded to S3:
1. Triggered by S3 upload events
2. Extracts text using Amazon Textract
3. Parses the text using Claude to extract structured profile data
4. Creates Profile Metadata Item in DynamoDB following the new schema
5. Generates markdown files and stores them in S3

Updated for new DynamoDB schema:
- Profile Metadata Item: PK: PROFILE#<profile_id>, SK: #METADATA
- All required attributes as per schema specification
"""

import json
import boto3
import logging
import uuid
from datetime import datetime
from pathlib import Path
import re
import base64

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
CLAUDE_MODEL_ID = "us.anthropic.claude-sonnet-4-20250514-v1:0"
AWS_REGION = "us-west-2"
DYNAMODB_TABLE_NAME = "linkedin-advanced-search"

# Initialize AWS clients
s3_client = boto3.client('s3', region_name=AWS_REGION)
bedrock_client = boto3.client('bedrock-runtime', region_name=AWS_REGION)
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(DYNAMODB_TABLE_NAME)

def find_latest_profile_file_in_directory(bucket, profile_directory):
    """Find the most recent Profile file in the specified directory"""
    try:
        # Ensure directory ends with /
        if not profile_directory.endswith('/'):
            profile_directory += '/'
            
        logger.info(f"Searching for Profile files in directory: {profile_directory}")
        
        # List all files in the specified directory
        response = s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=profile_directory
        )
        
        if 'Contents' not in response:
            logger.warning(f"No files found in directory: {profile_directory}")
            return None
        
        logger.info(f"Found {len(response['Contents'])} total files in directory")
        
        # Filter for Profile files
        profile_files = []
        for obj in response['Contents']:
            key = obj['Key']
            filename = key.split('/')[-1]  # Get just the filename
            
            logger.info(f"Checking file: {key}, filename: {filename}")
            
            # Skip directories and non-Profile files
            if key.endswith('/'):
                logger.info(f"Skipping directory: {key}")
                continue
                
            if 'Profile' not in filename:
                logger.info(f"Skipping non-Profile file: {filename}")
                continue
            
            # Only process image files
            if not (key.lower().endswith('.png') or key.lower().endswith('.jpg') or key.lower().endswith('.jpeg')):
                logger.info(f"Skipping non-image file: {filename}")
                continue
            
            logger.info(f"Found Profile file: {key}")
            profile_files.append({
                'key': key,
                'last_modified': obj['LastModified']
            })
        
        if not profile_files:
            logger.warning(f"No Profile files found in directory: {profile_directory}")
            return None
        
        # Sort by last_modified, most recent first
        profile_files.sort(key=lambda x: x['last_modified'], reverse=True)
        latest_file = profile_files[0]
        
        logger.info(f"Found {len(profile_files)} Profile files, using latest: {latest_file['key']}")
        return latest_file['key']
        
    except Exception as e:
        logger.error(f"Error finding latest Profile file: {str(e)}")
        return None

def lambda_handler(event, context):
    """Main Lambda handler for SQS trigger events"""
    try:
        logger.info(f"Processing event: {json.dumps(event)}")
        
        # Parse SQS event
        for record in event['Records']:
            if record['eventSource'] == 'aws:sqs':
                # Parse SQS message body
                message_body = json.loads(record['body'])
                
                bucket = message_body.get('bucket')
                profile_directory = message_body.get('profile_directory')
                
                if not bucket or not profile_directory:
                    logger.error(f"Invalid SQS message: missing bucket or profile_directory")
                    continue
                
                logger.info(f"Processing profile directory: s3://{bucket}/{profile_directory}")
                
                # Find the most recent Profile file in the specified directory
                profile_key = find_latest_profile_file_in_directory(bucket, profile_directory)
                
                if not profile_key:
                    logger.warning(f"No Profile file found in directory: {profile_directory}")
                    continue
                
                logger.info(f"Processing Profile file: s3://{bucket}/{profile_key}")
                
                # Process the profile
                result = process_profile(bucket, profile_key)
                logger.info(f"Successfully processed profile: {result['profile_id']}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Profile processing completed successfully',
                'processed_count': len(event['Records'])
            })
        }
        
    except Exception as e:
        logger.error(f"Lambda execution failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }

def process_profile(bucket, profile_key):
    """Process a single LinkedIn profile screenshot"""
    try:
        # Step 1: Extract text using Claude Vision
        logger.info("Step 1: Extracting text with Claude Vision")
        textract_response = extract_text_from_s3(bucket, profile_key)
        
        # Step 2: Get S3 metadata
        logger.info("Step 2: Getting S3 metadata")
        s3_metadata = get_s3_metadata(bucket, profile_key)
        
        # Step 3: Parse with Claude
        logger.info("Step 3: Parsing with Claude")
        parsed_data = parse_with_claude(textract_response, s3_metadata)
        
        # Step 4: Create Profile Metadata Item
        logger.info("Step 4: Creating Profile Metadata Item")
        profile_id = create_profile_metadata_item(parsed_data, s3_metadata)
        
        # Step 5: Generate and save markdown
        logger.info("Step 5: Generating markdown")
        markdown_content = generate_markdown(parsed_data, textract_response)
        save_markdown_to_s3(bucket, markdown_content, parsed_data, profile_id, profile_key)
        
        return {
            'profile_id': profile_id,
            'status': 'success'
        }
        
    except Exception as e:
        logger.error(f"Profile processing failed: {str(e)}")
        raise

def extract_text_from_s3(bucket, key):
    """Extract text from S3 image using Claude 3.5 Sonnet vision"""
    try:
        # Get image from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        image_data = response['Body'].read()
        image_base64 = base64.b64encode(image_data).decode()
        
        # Determine media type
        media_type = "image/png"
        if key.lower().endswith('.jpg') or key.lower().endswith('.jpeg'):
            media_type = "image/jpeg"
        
        # Use Claude vision for OCR
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_base64
                            }
                        },
                        {
                            "type": "text",
                            "text": "Extract all text from this LinkedIn profile screenshot. Return only the text content, preserving line breaks and structure."
                        }
                    ]
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
        extracted_text = response_body['content'][0]['text']
        
        # Convert to Textract-like format for compatibility
        mock_response = {
            'Blocks': [
                {
                    'BlockType': 'LINE',
                    'Text': line.strip()
                }
                for line in extracted_text.split('\n') 
                if line.strip()
            ]
        }
        
        logger.info(f"Claude vision extracted {len(mock_response['Blocks'])} text lines")
        return mock_response
        
    except Exception as e:
        logger.error(f"Text extraction with Claude vision failed: {str(e)}")
        raise

def get_s3_metadata(bucket, key):
    """Get metadata from S3 object including upload date and path structure"""
    try:
        response = s3_client.head_object(Bucket=bucket, Key=key)
        
        # Extract the LinkedIn URL from the directory structure
        path_parts = Path(key).parts
        linkedin_url = None
        if len(path_parts) > 1:
            linkedin_url = path_parts[-2]  # Get the subdirectory name
        
        metadata = {
            'date_added': response['LastModified'].strftime('%Y-%m-%d'),
            'linkedin_url': linkedin_url or 'unknown',
            'original_key': key
        }
        
        logger.info(f"S3 metadata extracted: {metadata}")
        return metadata
        
    except Exception as e:
        logger.error(f"S3 metadata extraction failed: {str(e)}")
        raise

def parse_with_claude(textract_response, s3_metadata):
    """Use Claude to parse the OCR text and extract structured information"""
    try:
        # Combine all text blocks from Textract
        text_blocks = []
        for block in textract_response['Blocks']:
            if block['BlockType'] == 'LINE':
                text_blocks.append(block['Text'])
        
        ocr_text = "\n".join(text_blocks)
        logger.info(f"Processing {len(text_blocks)} text lines with Claude")
        
        # Prepare the prompt for Claude
        prompt = f"""
        Analyze this LinkedIn profile text and extract structured information for a professional profile database.
        
        LinkedIn Profile Text:
        {ocr_text}
        
        Extract the following information and return as a JSON object with these exact fields:
        {{
            "name": "Full name of the person",
            "headline": "Current title or professional headline",
            "summary": "Professional summary or about section (2-3 sentences)",
            "currentCompany": "Current company name",
            "currentTitle": "Specific job title",
            "currentLocation": "City/region of residence",
            "employmentType": "Employment type (Full-time, Contract, Part-time, etc.)",
            "workExperience": [
                {{
                    "company": "Company name",
                    "title": "Job title",
                    "startDate": "YYYY-MM-DD or YYYY-MM or YYYY",
                    "endDate": "YYYY-MM-DD or YYYY-MM or YYYY or Present"
                }}
            ],
            "education": [
                {{
                    "school": "School name",
                    "degree": "Degree type and field",
                    "gradYear": "YYYY"
                }}
            ],
            "skills": ["List of professional skills mentioned"],
            "industry": "Primary industry/sector",
            "experience_years": "Estimated total years of experience (number)"
        }}
        
        Guidelines:
        - Extract only information clearly present in the text
        - Use "Not specified" for missing information
        - For dates, use the most specific format available
        - Focus on current role and key qualifications
        - Include all work experience and education found
        - Be precise and professional
        
        Return ONLY the JSON object, no additional text.
        """
        
        # Prepare request body for Claude
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 3000,
            "temperature": 0.1,
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
            json_match = re.search(r'\{.*\}', analysis_text, re.DOTALL)
            if json_match:
                parsed_data = json.loads(json_match.group())
            else:
                raise ValueError("Could not parse JSON from Claude response")
        
        logger.info(f"Successfully parsed profile: {parsed_data.get('name', 'Unknown')}")
        return parsed_data
        
    except Exception as e:
        logger.error(f"Claude parsing failed: {str(e)}")
        raise

def create_profile_metadata_item(parsed_data, s3_metadata):
    """Create Profile Metadata Item in DynamoDB following new schema"""
    try:
        # Generate profile ID from LinkedIn URL (Base64 encoded)
        linkedin_url = s3_metadata.get('linkedin_url', 'unknown')
        profile_id_b64 = base64.b64encode(linkedin_url.encode()).decode()
        profile_id = f"PROFILE#{profile_id_b64}"
        
        # Create fulltext content
        fulltext_parts = [
            parsed_data.get('name', ''),
            parsed_data.get('headline', ''),
            parsed_data.get('summary', ''),
            parsed_data.get('currentCompany', ''),
            parsed_data.get('currentTitle', ''),
            parsed_data.get('currentLocation', ''),
            ' '.join(parsed_data.get('skills', [])),
            parsed_data.get('industry', '')
        ]
        fulltext = ' '.join(filter(None, fulltext_parts))
        
        # Prepare the Profile Metadata Item
        current_time = datetime.utcnow().isoformat() + 'Z'
        
        item = {
            'PK': profile_id,
            'SK': '#METADATA',
            
            # Identification & Summary
            'name': parsed_data.get('name', 'Not specified'),
            'headline': parsed_data.get('headline', 'Not specified'),
            'summary': parsed_data.get('summary', 'Not specified'),
            'profilePictureUrl': '',  # Not available from screenshot
            'originalUrl': linkedin_url,
            
            # Current Role
            'currentCompany': parsed_data.get('currentCompany', 'Not specified'),
            'currentTitle': parsed_data.get('currentTitle', 'Not specified'),
            'currentLocation': parsed_data.get('currentLocation', 'Not specified'),
            'employmentType': parsed_data.get('employmentType', 'Not specified'),
            
            # Professional History
            'workExperience': parsed_data.get('workExperience', []),
            'education': parsed_data.get('education', []),
            
            # Skills
            'skills': parsed_data.get('skills', []),
            
            # System Metadata
            'createdAt': current_time,
            'updatedAt': current_time,
            
            # FullText
            'fulltext': fulltext
        }
        
        # Add optional fields if they exist
        if parsed_data.get('industry'):
            item['industry'] = parsed_data['industry']
        if parsed_data.get('experience_years'):
            item['experience_years'] = int(parsed_data['experience_years'])
        
        # Put item in DynamoDB
        table.put_item(Item=item)
        
        logger.info(f"Profile Metadata Item created: {profile_id}")
        return profile_id
        
    except Exception as e:
        logger.error(f"DynamoDB Profile Metadata Item creation failed: {str(e)}")
        raise

def generate_markdown(parsed_data, textract_response):
    """Generate markdown from parsed data and OCR results"""
    try:
        # Combine all text blocks from Textract
        text_blocks = []
        for block in textract_response['Blocks']:
            if block['BlockType'] == 'LINE':
                text_blocks.append(block['Text'])
        
        ocr_text = "\n".join(text_blocks)
        
        # Create markdown content
        markdown = f"""# {parsed_data.get('name', 'Unknown')}

## Profile Information
- **Headline**: {parsed_data.get('headline', 'Not specified')}
- **Current Company**: {parsed_data.get('currentCompany', 'Not specified')}
- **Current Title**: {parsed_data.get('currentTitle', 'Not specified')}
- **Location**: {parsed_data.get('currentLocation', 'Not specified')}
- **Employment Type**: {parsed_data.get('employmentType', 'Not specified')}
- **Industry**: {parsed_data.get('industry', 'Not specified')}
- **Experience Years**: {parsed_data.get('experience_years', 'Not specified')}

## Professional Summary
{parsed_data.get('summary', 'No summary available')}

## Work Experience
"""
        
        for exp in parsed_data.get('workExperience', []):
            markdown += f"- **{exp.get('title', 'Unknown')}** at {exp.get('company', 'Unknown')} ({exp.get('startDate', 'Unknown')} - {exp.get('endDate', 'Unknown')})\n"
        
        markdown += "\n## Education\n"
        for edu in parsed_data.get('education', []):
            markdown += f"- **{edu.get('degree', 'Unknown')}** from {edu.get('school', 'Unknown')} ({edu.get('gradYear', 'Unknown')})\n"
        
        markdown += f"""
## Skills
{', '.join(parsed_data.get('skills', ['No skills listed']))}

## Original OCR Text
```
{ocr_text}
```
"""
        
        logger.info("Markdown generated successfully")
        return markdown
        
    except Exception as e:
        logger.error(f"Markdown generation failed: {str(e)}")
        raise

def save_markdown_to_s3(bucket, markdown_content, parsed_data, profile_id, original_profile_key):
    """Save markdown content to S3 in structured directory"""
    try:
        # Extract the original filename and create markdown equivalent
        original_filename = original_profile_key.split('/')[-1]  # Get just the filename
        
        # Replace the extension with .md
        if '.' in original_filename:
            markdown_filename = original_filename.rsplit('.', 1)[0] + '.md'
        else:
            markdown_filename = original_filename + '.md'
        
        # Extract profile directory from original key
        profile_directory = '/'.join(original_profile_key.split('/')[:-1])  # Everything except filename
        profile_name = profile_directory.split('/')[-1]  # Get the profile directory name
        
        # Create S3 key: processed-markdown/{profile-name}/{original-filename}.md
        s3_key = f"processed-markdown/{profile_name}/{markdown_filename}"
        
        s3_client.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=markdown_content,
            ContentType='text/markdown'
        )
        
        logger.info(f"Markdown saved to s3://{bucket}/{s3_key}")
        return s3_key
        
    except Exception as e:
        logger.error(f"Markdown save failed: {str(e)}")
        raise
