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

import base64
import json
import logging
import os
import re
import time
from datetime import datetime
from pathlib import Path

import boto3

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration

AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
AI_MODEL_ID = os.environ.get('AI_MODEL_ID', 'us.meta.llama3-2-90b-instruct-v1:0')
DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'linkedin-advanced-search')

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

                # Handle S3 event notification format
                if 'Records' in message_body:
                    # This is an S3 event notification
                    for s3_record in message_body['Records']:
                        if s3_record.get('eventSource') == 'aws:s3':
                            bucket = s3_record['s3']['bucket']['name']
                            object_key = s3_record['s3']['object']['key']

                            logger.info(f"Processing S3 event: s3://{bucket}/{object_key}")

                            # Extract profile directory from the object key
                            # Key format: linkedin-profiles/jonathanking10/jonathanking10-Profile-2025-07-28T17-05-46_271Z.png
                            path_parts = object_key.split('/')
                            if len(path_parts) >= 2:
                                profile_directory = '/'.join(path_parts[:-1])  # Everything except the filename
                            else:
                                logger.error(f"Invalid S3 object key format: {object_key}")
                                continue

                            logger.info(f"Extracted profile directory: {profile_directory}")

                            # Process the specific file directly since we have the exact key
                            if 'Profile' in object_key and (object_key.lower().endswith('.png') or
                                                          object_key.lower().endswith('.jpg') or
                                                          object_key.lower().endswith('.jpeg')):
                                logger.info(f"Processing Profile file: s3://{bucket}/{object_key}")
                                result = process_profile(bucket, object_key)
                                logger.info(f"Successfully processed profile: {result['profile_id']}")
                            else:
                                logger.info(f"Skipping non-Profile file: {object_key}")
                                continue

                else:
                    # Handle legacy format (direct bucket/profile_directory)
                    bucket = message_body.get('bucket')
                    profile_directory = message_body.get('profile_directory')

                    if not bucket or not profile_directory:
                        logger.error("Invalid SQS message: missing bucket or profile_directory")
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
        # Step 1: Extract text using AI Vision
        logger.info("Step 1: Extracting text with AI Vision")
        ai_vision_response = extract_text_with_ai_vision(bucket, profile_key)

        # Step 2: Get S3 metadata
        logger.info("Step 2: Getting S3 metadata")
        s3_metadata = get_s3_metadata(bucket, profile_key)

        # Step 3: Parse with AI
        logger.info("Step 3: Parsing with AI")
        parsed_data = parse_with_ai_retry_logic(ai_vision_response, s3_metadata, bucket, profile_key)

        # Step 4: Create Profile Metadata Item
        logger.info("Step 4: Creating Profile Metadata Item")
        profile_id = create_profile_metadata_item(parsed_data, s3_metadata)

        # Step 5: Generate and save markdown
        logger.info("Step 5: Generating markdown")
        markdown_content = generate_markdown(parsed_data, ai_vision_response)
        save_markdown_to_s3(bucket, markdown_content, parsed_data, profile_id, profile_key)

        return {
            'profile_id': profile_id,
            'status': 'success'
        }

    except Exception as e:
        logger.error(f"Profile processing failed: {str(e)}")
        raise

def validate_image(image_data):
    """Validate image size and format"""
    try:
        # Check file size (20MB limit)
        if len(image_data) > 20 * 1024 * 1024:
            raise ValueError(f"Image too large: {len(image_data)} bytes")

        # Check minimum size
        if len(image_data) < 1024:
            raise ValueError(f"Image too small: {len(image_data)} bytes")

        logger.info(f"Image validation passed: {len(image_data)} bytes")
        return True

    except Exception as e:
        logger.error(f"Image validation failed: {str(e)}")
        raise

def extract_text_with_ai_vision(bucket, key):
    """Extract text from S3 image using AI vision model"""
    start_time = time.time()

    try:
        logger.info(f"Starting OCR extraction for s3://{bucket}/{key}")

        # Get image from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        image_data = response['Body'].read()

        # Validate image
        validate_image(image_data)

        # Encode image
        base64.b64encode(image_data).decode()

        # Determine media type
        media_type = "image/png"
        if key.lower().endswith('.jpg') or key.lower().endswith('.jpeg'):
            media_type = "image/jpeg"

        logger.info(f"Processing image: size={len(image_data)} bytes, type={media_type}")

        # Use Llama Maverick vision for OCR
        conversation = [
            {
                "role": "user",
                "content": [
                    {"text": "Extract all text from this LinkedIn profile screenshot. Return only the text content, preserving line breaks and structure."},
                    {
                        "image": {
                            "format": "png" if media_type == "image/png" else "jpeg",
                            "source": {"bytes": image_data}
                        }
                    }
                ]
            }
        ]

        # Call Llama via Bedrock using converse API
        response = bedrock_client.converse(
            modelId=AI_MODEL_ID,
            messages=conversation,
            inferenceConfig={"maxTokens": 2000, "temperature": 0.1}
        )

        # Parse the response
        extracted_text = response["output"]["message"]["content"][0]["text"]

        # Convert to Textract-like format for compatibility
        text_lines = [line.strip() for line in extracted_text.split('\n') if line.strip()]

        mock_response = {
            'Blocks': [
                {
                    'BlockType': 'LINE',
                    'Text': line
                }
                for line in text_lines
            ]
        }

        processing_time = time.time() - start_time
        logger.info(f"OCR completed successfully: {len(mock_response['Blocks'])} text lines in {processing_time:.2f}s")

        return mock_response

    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(f"Text extraction with AI vision failed after {processing_time:.2f}s: {str(e)}")
        raise

def extract_text_with_retry(bucket, key, max_retries=3):
    """Extract text with retry logic and exponential backoff"""
    for attempt in range(max_retries):
        try:
            return extract_text_with_ai_vision(bucket, key)
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"OCR failed after {max_retries} attempts: {str(e)}")
                raise

            wait_time = 2 ** attempt
            logger.warning(f"OCR attempt {attempt + 1} failed, retrying in {wait_time}s: {str(e)}")
            time.sleep(wait_time)

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

def parse_ai_json_response(response_text):
    """Parse JSON from AI response with multiple fallback strategies"""
    # Strategy 1: Direct JSON parsing
    try:
        return json.loads(response_text.strip())
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract JSON block
    json_patterns = [
        r'```json\s*(\{.*?\})\s*```',
        r'```\s*(\{.*?\})\s*```',
        r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})'
    ]

    for pattern in json_patterns:
        match = re.search(pattern, response_text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                continue

    # Strategy 3: Try to fix common JSON issues
    cleaned = response_text.strip()
    if cleaned.startswith('{') and cleaned.endswith('}'):
        try:
            # Fix common issues like trailing commas
            cleaned = re.sub(r',\s*}', '}', cleaned)
            cleaned = re.sub(r',\s*]', ']', cleaned)
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from AI response: {response_text[:500]}...")

def extract_text_blocks_from_textract(ai_vision_response):
    """Extract text blocks from Textract response"""
    text_blocks = []
    for block in ai_vision_response['Blocks']:
        if block['BlockType'] == 'LINE':
            text_blocks.append(block['Text'])
    return text_blocks

def parse_profile_with_ai(ocr_text, s3_metadata):
    """Use AI to parse the OCR text and extract structured information"""
    try:
        logger.info(f"Processing {len(ocr_text.split())} words with AI")

        # Prepare the prompt for AI
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
            "experience_years": "Total years of professional experience as a number"
        }}

        Guidelines:
        - Extract only information clearly present in the text
        - Use "Not specified" for missing information
        - For dates, use the most specific format available
        - For CURRENT COMPANY & TITLE: Look for the work experience entry with "Present" as the end date. That company and title are the current ones. If NO job has "Present" as end date, set both currentCompany and currentTitle to "Available"
        - For INDUSTRY: Look for explicit industry mentions first, then infer from job titles and companies (e.g., "Software Engineer" = "Technology", "Marketing Manager" = "Marketing", "Financial Analyst" = "Finance")
        - For EXPERIENCE_YEARS: Calculate from work experience dates OR look for explicit mentions like "20+ years of experience". Return only the number (e.g., 20, not "20 years")
        - If experience calculation is unclear, look for phrases like "X years of experience" in the summary/about section
        - Focus on current role and key qualifications
        - Include all work experience and education found
        - Be precise and professional

        Return ONLY the JSON object, no additional text.
        """

        return call_ai_model(prompt)

    except Exception as e:
        logger.error(f"AI parsing failed: {str(e)}")
        raise

def call_ai_model(prompt):
    """Make API call to AI model and return parsed response"""
    # Prepare conversation for AI model
    conversation = [
        {
            "role": "user",
            "content": [{"text": prompt}]
        }
    ]

    # Call AI via Bedrock using converse API
    response = bedrock_client.converse(
        modelId=AI_MODEL_ID,
        messages=conversation,
        inferenceConfig={"maxTokens": 3000, "temperature": 0.1}
    )

    # Parse the response
    analysis_text = response["output"]["message"]["content"][0]["text"]

    logger.info(f"AI parsing response length: {len(analysis_text)} characters")

    # Parse the JSON from AI response using robust parsing
    try:
        parsed_data = parse_ai_json_response(analysis_text)

        # Validate and clean skills array
        if 'skills' in parsed_data:
            skills = parsed_data['skills']
            if isinstance(skills, str):
                # If skills is a string, try to parse it as a list
                try:
                    if skills.startswith('[') and skills.endswith(']'):
                        parsed_data['skills'] = json.loads(skills)
                    else:
                        # Split by comma if it's a comma-separated string
                        parsed_data['skills'] = [s.strip() for s in skills.split(',') if s.strip()]
                except Exception:
                    parsed_data['skills'] = ["Not specified"]
            elif not isinstance(skills, list):
                parsed_data['skills'] = ["Not specified"]
            else:
                # Clean up any malformed entries in the list
                cleaned_skills = []
                for skill in skills:
                    if isinstance(skill, str) and len(skill.strip()) > 0 and not skill.strip().startswith('{'):
                        cleaned_skills.append(skill.strip())
                parsed_data['skills'] = cleaned_skills if cleaned_skills else ["Not specified"]

        return parsed_data

    except Exception as e:
        logger.error(f"JSON parsing failed: {str(e)}")
        logger.error(f"AI response: {analysis_text[:1000]}...")
        raise ValueError(f"Could not parse JSON from AI response: {str(e)}") from e

def check_missing_dates(parsed_data):
    """Check if there are too many missing dates in work experience"""
    work_experience = parsed_data.get('workExperience', [])
    missing_dates_count = 0
    for job in work_experience:
        if job.get('startDate') == 'Not specified':
            missing_dates_count += 1
        if job.get('endDate') == 'Not specified':
            missing_dates_count += 1

    return missing_dates_count > 3

def parse_with_ai_retry_logic(ai_vision_response, s3_metadata, bucket, profile_key):
    """Parse profile with AI and retry OCR if too many dates are missing"""
    # Extract text blocks from initial Textract response
    text_blocks = extract_text_blocks_from_textract(ai_vision_response)
    ocr_text = "\n".join(text_blocks)

    # First attempt at parsing
    parsed_data = parse_profile_with_ai(ocr_text, s3_metadata)

    # Check if we need to retry due to missing dates
    if check_missing_dates(parsed_data):
        logger.warning("Too many missing dates detected, retrying with fresh OCR")

        # Re-extract text using OCR
        fresh_ai_vision_response = extract_text_with_ai_vision(bucket, profile_key)
        fresh_text_blocks = extract_text_blocks_from_textract(fresh_ai_vision_response)
        fresh_ocr_text = "\n".join(fresh_text_blocks)

        # Retry parsing with fresh OCR
        parsed_data = parse_profile_with_ai(fresh_ocr_text, s3_metadata)
        logger.info("Completed retry parsing with fresh OCR")

    logger.info(f"Successfully parsed profile: {parsed_data.get('name', 'Unknown')}")
    return parsed_data

def get_existing_profile(profile_id):
    """Get existing profile from DynamoDB if it exists"""
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(DYNAMODB_TABLE_NAME)

        response = table.get_item(
            Key={
                'PK': profile_id,
                'SK': '#METADATA'
            }
        )
        return response.get('Item')
    except Exception as e:
        logger.warning(f"Error checking for existing profile: {str(e)}")
        return None

def create_profile_metadata_item(parsed_data, s3_metadata):
    """Create Profile Metadata Item in DynamoDB following new schema"""
    try:
        # Generate profile ID from LinkedIn URL (Base64 encoded)
        linkedin_url = s3_metadata.get('linkedin_url', 'unknown')
        profile_id_b64 = base64.b64encode(linkedin_url.encode()).decode()
        profile_id = f"PROFILE#{profile_id_b64}"

        # Check for existing profile
        existing_profile = get_existing_profile(profile_id)

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

        # Use existing createdAt if profile exists, otherwise use current time
        current_time = datetime.utcnow().isoformat() + 'Z'
        created_at = existing_profile['createdAt'] if existing_profile else current_time

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
            'createdAt': created_at,
            'updatedAt': current_time,

            # FullText
            'fulltext': fulltext
        }

        # Add optional fields if they exist
        if parsed_data.get('industry'):
            item['industry'] = parsed_data['industry']
        if parsed_data.get('experience_years') and parsed_data['experience_years'] != 'Not specified':
            try:
                item['experience_years'] = int(parsed_data['experience_years'])
            except (ValueError, TypeError):
                logger.warning(f"Could not convert experience_years to int: {parsed_data['experience_years']}")
                # Skip adding this field if conversion fails

        # Put item in DynamoDB
        table.put_item(Item=item)

        logger.info(f"Profile Metadata Item created: {profile_id}")
        return profile_id

    except Exception as e:
        logger.error(f"DynamoDB Profile Metadata Item creation failed: {str(e)}")
        raise

def generate_markdown(parsed_data, ai_vision_response):
    """Generate markdown from parsed data and OCR results"""
    try:
        # Combine all text blocks from Textract
        text_blocks = []
        for block in ai_vision_response['Blocks']:
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
