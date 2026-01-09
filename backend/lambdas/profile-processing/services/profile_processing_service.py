"""ProfileProcessingService - Business logic for profile screenshot processing."""
import base64
import importlib.util
import json
import logging
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from botocore.exceptions import ClientError

# Set up shared path for imports
_shared_path = Path(__file__).parent.parent.parent / 'shared' / 'python'
if str(_shared_path) not in sys.path:
    sys.path.insert(0, str(_shared_path))

from errors.exceptions import (  # noqa: E402
    ExternalServiceError,
    NotFoundError,
    ValidationError,
)


# Import BaseService directly from file to avoid package collision
def _load_base_service():
    """Load BaseService from shared path directly."""
    base_service_path = _shared_path / 'services' / 'base_service.py'
    spec = importlib.util.spec_from_file_location('shared_base_service', base_service_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.BaseService


BaseService = _load_base_service()

logger = logging.getLogger(__name__)


class ProfileProcessingService(BaseService):
    """
    Service class for processing LinkedIn profile screenshots.

    Handles S3 image download, AI text extraction, profile parsing,
    and DynamoDB storage with injected AWS clients for testability.
    """

    def __init__(
        self,
        s3_client,
        bedrock_client,
        table,
        ai_model_id: str = 'us.meta.llama3-2-90b-instruct-v1:0'
    ):
        """
        Initialize ProfileProcessingService with injected dependencies.

        Args:
            s3_client: S3 client for image download
            bedrock_client: Bedrock client for AI vision/parsing
            table: DynamoDB Table resource for profile storage
            ai_model_id: Bedrock model ID for AI operations
        """
        super().__init__()
        self.s3_client = s3_client
        self.bedrock_client = bedrock_client
        self.table = table
        self.ai_model_id = ai_model_id

    def health_check(self) -> dict[str, Any]:
        """Check service health by verifying clients are configured."""
        try:
            # Verify clients are available (don't make actual calls to avoid hardcoded bucket names)
            clients_configured = (
                self.s3_client is not None and
                self.bedrock_client is not None and
                self.table is not None
            )
            return {
                'healthy': clients_configured,
                'details': {
                    's3_client': self.s3_client is not None,
                    'bedrock_client': self.bedrock_client is not None,
                    'table': self.table is not None
                }
            }
        except Exception as e:
            return {'healthy': False, 'details': {'error': str(e)}}

    def process(self, bucket: str, key: str) -> dict[str, Any]:
        """
        Process a LinkedIn profile screenshot end-to-end.

        Args:
            bucket: S3 bucket containing the image
            key: S3 object key for the image

        Returns:
            dict with success status and profile_id

        Raises:
            ExternalServiceError: On AWS service failures
        """
        try:
            logger.info(f"Processing profile: s3://{bucket}/{key}")

            # Step 1: Download image
            image_data = self.download_image(bucket, key)

            # Step 2: Get S3 metadata
            s3_metadata = self.get_s3_metadata(bucket, key)

            # Step 3: Extract text with AI vision
            media_type = 'image/jpeg' if key.lower().endswith(('.jpg', '.jpeg')) else 'image/png'
            ocr_response = self.extract_text(image_data, media_type)

            # Step 4: Parse profile with AI
            text_blocks = [b['Text'] for b in ocr_response.get('Blocks', []) if b.get('BlockType') == 'LINE']
            ocr_text = '\n'.join(text_blocks)
            parsed_data = self.parse_profile(ocr_text, s3_metadata)

            # Step 5: Store in DynamoDB
            profile_id = self.store_profile(parsed_data, s3_metadata)

            # Step 6: Generate and save markdown
            markdown = self.generate_markdown(parsed_data, ocr_response)
            self.save_markdown(bucket, markdown, key, profile_id)

            return {
                'success': True,
                'profile_id': profile_id,
                'status': 'processed'
            }

        except (NotFoundError, ValidationError):
            raise
        except ClientError as e:
            logger.error(f"AWS error processing profile: {e}")
            raise ExternalServiceError(
                message='Failed to process profile',
                service='AWS',
                original_error=str(e)
            ) from e
        except Exception as e:
            logger.error(f"Error processing profile: {e}")
            raise ExternalServiceError(
                message='Profile processing failed',
                service='ProfileProcessing',
                original_error=str(e)
            ) from e

    def download_image(self, bucket: str, key: str) -> bytes:
        """
        Download image from S3.

        Args:
            bucket: S3 bucket name
            key: S3 object key

        Returns:
            Image bytes

        Raises:
            NotFoundError: If image doesn't exist
            ExternalServiceError: On S3 failures
        """
        try:
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response['Body'].read()
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code in ('NoSuchKey', '404', 'NotFound'):
                raise NotFoundError(
                    message=f'Image not found: {key}',
                    resource_type='S3Object',
                    resource_id=key
                ) from e
            raise ExternalServiceError(
                message='Failed to download image',
                service='S3',
                original_error=str(e)
            ) from e

    def get_s3_metadata(self, bucket: str, key: str) -> dict:
        """Get metadata from S3 object."""
        try:
            response = self.s3_client.head_object(Bucket=bucket, Key=key)
            path_parts = Path(key).parts
            linkedin_url = path_parts[-2] if len(path_parts) > 1 else 'unknown'

            return {
                'date_added': response['LastModified'].strftime('%Y-%m-%d'),
                'linkedin_url': linkedin_url,
                'original_key': key
            }
        except Exception as e:
            logger.warning(f"Failed to get S3 metadata: {e}")
            return {'linkedin_url': 'unknown', 'date_added': datetime.now(UTC).strftime('%Y-%m-%d')}

    def extract_text(self, image_data: bytes, media_type: str = 'image/png') -> dict:
        """
        Extract text from image using AI vision.

        Args:
            image_data: Raw image bytes
            media_type: MIME type of image

        Returns:
            Textract-like response with text blocks

        Raises:
            ValidationError: If image is empty/invalid
            ExternalServiceError: On AI service failures
        """
        if not image_data or len(image_data) < 100:
            raise ValidationError('Image data is empty or too small', field='image')

        try:
            conversation = [
                {
                    "role": "user",
                    "content": [
                        {"text": "Extract all text from this LinkedIn profile screenshot. Return only the text content, preserving line breaks and structure."},
                        {
                            "image": {
                                "format": "jpeg" if 'jpeg' in media_type else "png",
                                "source": {"bytes": image_data}
                            }
                        }
                    ]
                }
            ]

            response = self.bedrock_client.converse(
                modelId=self.ai_model_id,
                messages=conversation,
                inferenceConfig={"maxTokens": 2000, "temperature": 0.1}
            )

            extracted_text = response["output"]["message"]["content"][0]["text"]
            text_lines = [line.strip() for line in extracted_text.split('\n') if line.strip()]

            return {
                'Blocks': [
                    {'BlockType': 'LINE', 'Text': line}
                    for line in text_lines
                ]
            }

        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            raise ExternalServiceError(
                message='Failed to extract text from image',
                service='Bedrock',
                original_error=str(e)
            ) from e

    def parse_profile(self, ocr_text: str, s3_metadata: dict) -> dict:
        """
        Parse OCR text into structured profile data using AI.

        Args:
            ocr_text: Extracted text from image
            s3_metadata: S3 object metadata

        Returns:
            Parsed profile data dict
        """
        prompt = self._build_parse_prompt(ocr_text)

        try:
            conversation = [{"role": "user", "content": [{"text": prompt}]}]
            response = self.bedrock_client.converse(
                modelId=self.ai_model_id,
                messages=conversation,
                inferenceConfig={"maxTokens": 3000, "temperature": 0.1}
            )

            response_text = response["output"]["message"]["content"][0]["text"]
            parsed_data = self._parse_json_response(response_text)

            # Clean up skills field
            if 'skills' in parsed_data:
                parsed_data['skills'] = self._normalize_skills(parsed_data['skills'])

            return parsed_data

        except Exception as e:
            logger.error(f"Profile parsing failed: {e}")
            return {
                'name': 'Unknown',
                'headline': 'Not specified',
                'summary': 'Not specified'
            }

    def store_profile(self, profile_data: dict, s3_metadata: dict) -> str:
        """
        Store profile in DynamoDB.

        Args:
            profile_data: Parsed profile data
            s3_metadata: S3 metadata

        Returns:
            Profile ID (PK)
        """
        linkedin_url = s3_metadata.get('linkedin_url', 'unknown')
        profile_id_b64 = base64.b64encode(linkedin_url.encode()).decode()
        profile_id = f"PROFILE#{profile_id_b64}"

        current_time = datetime.now(UTC).isoformat() + 'Z'

        # Build fulltext for search
        fulltext_parts = [
            profile_data.get('name', ''),
            profile_data.get('headline', ''),
            profile_data.get('summary', ''),
            profile_data.get('currentCompany', ''),
            ' '.join(profile_data.get('skills', []))
        ]
        fulltext = ' '.join(filter(None, fulltext_parts))

        item = {
            'PK': profile_id,
            'SK': '#METADATA',
            'name': profile_data.get('name', 'Not specified'),
            'headline': profile_data.get('headline', 'Not specified'),
            'summary': profile_data.get('summary', 'Not specified'),
            'originalUrl': linkedin_url,
            'currentCompany': profile_data.get('currentCompany', 'Not specified'),
            'currentTitle': profile_data.get('currentTitle', 'Not specified'),
            'currentLocation': profile_data.get('currentLocation', 'Not specified'),
            'employmentType': profile_data.get('employmentType', 'Not specified'),
            'workExperience': profile_data.get('workExperience', []),
            'education': profile_data.get('education', []),
            'skills': profile_data.get('skills', []),
            'createdAt': current_time,
            'updatedAt': current_time,
            'fulltext': fulltext
        }

        self.table.put_item(Item=item)
        logger.info(f"Profile stored: {profile_id}")

        return profile_id

    def generate_markdown(self, profile_data: dict, ocr_response: dict) -> str:
        """Generate markdown content from profile data."""
        text_blocks = [b['Text'] for b in ocr_response.get('Blocks', []) if b.get('BlockType') == 'LINE']
        ocr_text = '\n'.join(text_blocks)

        markdown = f"""# {profile_data.get('name', 'Unknown')}

## Profile Information
- **Headline**: {profile_data.get('headline', 'Not specified')}
- **Current Company**: {profile_data.get('currentCompany', 'Not specified')}
- **Current Title**: {profile_data.get('currentTitle', 'Not specified')}
- **Location**: {profile_data.get('currentLocation', 'Not specified')}

## Professional Summary
{profile_data.get('summary', 'No summary available')}

## Work Experience
"""
        for exp in profile_data.get('workExperience', []):
            markdown += f"- **{exp.get('title', 'Unknown')}** at {exp.get('company', 'Unknown')}\n"

        markdown += f"""
## Skills
{', '.join(profile_data.get('skills', ['No skills listed']))}

## Original OCR Text
```
{ocr_text}
```
"""
        return markdown

    def save_markdown(self, bucket: str, content: str, original_key: str, profile_id: str) -> str:
        """Save markdown to S3."""
        try:
            filename = original_key.split('/')[-1]
            md_filename = filename.rsplit('.', 1)[0] + '.md' if '.' in filename else filename + '.md'
            profile_name = original_key.split('/')[-2] if '/' in original_key else 'unknown'
            s3_key = f"processed-markdown/{profile_name}/{md_filename}"

            self.s3_client.put_object(
                Bucket=bucket,
                Key=s3_key,
                Body=content,
                ContentType='text/markdown'
            )

            logger.info(f"Markdown saved: s3://{bucket}/{s3_key}")
            return s3_key

        except Exception as e:
            logger.warning(f"Failed to save markdown: {e}")
            return ''

    # Private helpers

    def _build_parse_prompt(self, ocr_text: str) -> str:
        """Build the AI parsing prompt."""
        return f"""
Analyze this LinkedIn profile text and extract structured information.

LinkedIn Profile Text:
{ocr_text}

Extract the following and return as JSON:
{{
    "name": "Full name",
    "headline": "Professional headline",
    "summary": "2-3 sentence professional summary",
    "currentCompany": "Current company name",
    "currentTitle": "Current job title",
    "currentLocation": "City/region",
    "employmentType": "Full-time/Part-time/Contract",
    "workExperience": [{{"company": "", "title": "", "startDate": "", "endDate": ""}}],
    "education": [{{"school": "", "degree": "", "gradYear": ""}}],
    "skills": ["skill1", "skill2"]
}}

Return ONLY the JSON object, no additional text.
"""

    def _parse_json_response(self, response_text: str) -> dict:
        """Parse JSON from AI response with fallbacks."""
        # Try direct parse
        try:
            return json.loads(response_text.strip())
        except json.JSONDecodeError:
            pass

        # Try extracting JSON block
        patterns = [
            r'```json\s*(\{.*?\})\s*```',
            r'```\s*(\{.*?\})\s*```',
            r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})'
        ]

        for pattern in patterns:
            match = re.search(pattern, response_text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    continue

        logger.warning("Could not parse JSON from AI response")
        return {}

    def _normalize_skills(self, skills) -> list:
        """Normalize skills to list of strings."""
        if isinstance(skills, str):
            if skills.startswith('['):
                try:
                    return json.loads(skills)
                except Exception:
                    pass
            return [s.strip() for s in skills.split(',') if s.strip()]
        if isinstance(skills, list):
            return [str(s).strip() for s in skills if s and not str(s).startswith('{')]
        return []
