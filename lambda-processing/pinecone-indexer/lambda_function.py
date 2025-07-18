"""
Pinecone Indexer Lambda Function

This Lambda function processes DynamoDB Stream events to maintain Pinecone vector index:
1. Triggered by DynamoDB Stream events from linkedin-advanced-search table
2. Processes Profile Metadata Items (PK: PROFILE#*, SK: #METADATA)
3. Generates AI-powered summaries from fulltext profile data
4. Uses Pincone Integrated embeddings to create embeddings
5. Stores vectors with comprehensive metadata in Pinecone
6. Handles INSERT, MODIFY, and REMOVE stream events

DynamoDB Stream Event Processing:
- INSERT/MODIFY: Upsert vector in Pinecone
- REMOVE: Delete vector from Pinecone
"""

import json
import boto3
import logging
import os
from datetime import datetime
import pinecone
from openai import OpenAI

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
PINECONE_HOST = os.environ.get('PINECONE_HOST')
SUMMARIZATION_MODEL = "gpt-4.1"

# Get API keys from environment variables
PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')


class PineconeIndexer:
    """Handles Pinecone vector indexing operations"""
    
    def __init__(self):
        self.pinecone_client = None
        self.openai_client = None
        self.index = None
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize Pinecone and OpenAI clients with API keys from environment variables"""
        try:
            if not PINECONE_API_KEY:
                raise ValueError("PINECONE_API_KEY environment variable not set")
            
            if not OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            
            # Initialize Pinecone client
            from pinecone import Pinecone
            self.pinecone_client = Pinecone(api_key=PINECONE_API_KEY)
            
            # Get index reference using host
            self.index = self.pinecone_client.Index(host=PINECONE_HOST)
            
            # Initialize OpenAI (only for summarization)
            self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
            
            logger.info("Successfully initialized Pinecone and OpenAI clients")
            
        except Exception as e:
            logger.error(f"Failed to initialize clients: {str(e)}")
            raise
    
    def process_stream_records(self, records):
        """Process DynamoDB Stream records"""
        results = {
            'processed': 0,
            'skipped': 0,
            'errors': 0,
            'details': []
        }
        
        for record in records:
            try:
                result = self._process_single_record(record)
                results['details'].append(result)
                
                if result['status'] == 'processed':
                    results['processed'] += 1
                elif result['status'] == 'skipped':
                    results['skipped'] += 1
                else:
                    results['errors'] += 1
                    
            except Exception as e:
                logger.error(f"Error processing record: {str(e)}")
                results['errors'] += 1
                results['details'].append({
                    'status': 'error',
                    'error': str(e),
                    'record_id': record.get('eventID', 'unknown')
                })
        
        return results
    
    def _process_single_record(self, record):
        """Process a single DynamoDB Stream record"""
        event_name = record['eventName']
        
        # Only process Profile Metadata Items
        if not self._is_profile_metadata_record(record):
            return {
                'status': 'skipped',
                'reason': 'Not a profile metadata record',
                'event_name': event_name
            }
        
        if event_name in ['INSERT', 'MODIFY']:
            return self._handle_upsert(record)
        elif event_name == 'REMOVE':
            return self._handle_remove(record)
        else:
            return {
                'status': 'skipped',
                'reason': f'Unsupported event: {event_name}',
                'event_name': event_name
            }
    
    def _is_profile_metadata_record(self, record):
        """Check if record is a Profile Metadata Item"""
        try:
            # Check both NEW and OLD images for the keys
            for image_key in ['NewImage', 'OldImage']:
                if image_key in record['dynamodb']:
                    image = record['dynamodb'][image_key]
                    pk = image.get('PK', {}).get('S', '')
                    sk = image.get('SK', {}).get('S', '')
                    
                    if pk.startswith('PROFILE#') and sk == '#METADATA':
                        return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking record type: {str(e)}")
            return False
    
    def _handle_upsert(self, record):
        """Handle both INSERT and MODIFY events - upsert vector"""
        try:
            new_image = record['dynamodb']['NewImage']
            profile_data = self._parse_dynamodb_item(new_image)
            
            # Generate vector ID from profile ID
            profile_id = profile_data['PK']  # PROFILE#<profile_id>
            vector_id = profile_id
            
            # Create AI-powered summary for embedding
            summary_text = self._create_embedding_summary(profile_data)
            
            # Create comprehensive metadata
            metadata = self._create_metadata(profile_data)
            
            # Create record for Pinecone integrated embedding
            record_data = {
                '_id': vector_id,
                'summary': summary_text,  # This field will be automatically embedded
                **metadata  # Include all metadata
            }
            
            # Upsert to Pinecone using integrated embedding
            self.index.upsert_records(namespace="default", records=[record_data])
            
            event_name = record['eventName']
            logger.info(f"Upserted record for profile: {vector_id} (event: {event_name})")
            
            return {
                'status': 'processed',
                'action': 'upserted',
                'vector_id': vector_id,
                'event_name': event_name
            }
            
        except Exception as e:
            logger.error(f"Error handling upsert: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'event_name': record['eventName']
            }
    
    def _handle_remove(self, record):
        """Handle REMOVE event - delete vector"""
        try:
            old_image = record['dynamodb']['OldImage']
            profile_data = self._parse_dynamodb_item(old_image)
            
            # Generate vector ID from profile ID
            profile_id = profile_data['PK']  # PROFILE#<profile_id>
            vector_id = profile_id
            
            # Delete from Pinecone
            self.index.delete(namespace="default", ids=[vector_id])
            
            logger.info(f"Deleted vector for profile: {vector_id}")
            return {
                'status': 'processed',
                'action': 'deleted',
                'vector_id': vector_id,
                'event_name': 'REMOVE'
            }
            
        except Exception as e:
            logger.error(f"Error handling REMOVE: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'event_name': 'REMOVE'
            }
    
    def _parse_dynamodb_item(self, dynamodb_item):
        """Parse DynamoDB item from stream format to regular dict"""
        parsed = {}
        
        for key, value in dynamodb_item.items():
            if 'S' in value:  # String
                parsed[key] = value['S']
            elif 'N' in value:  # Number
                parsed[key] = float(value['N']) if '.' in value['N'] else int(value['N'])
            elif 'BOOL' in value:  # Boolean
                parsed[key] = value['BOOL']
            elif 'L' in value:  # List
                parsed[key] = [self._parse_attribute_value(item) for item in value['L']]
            elif 'M' in value:  # Map
                parsed[key] = {k: self._parse_attribute_value(v) for k, v in value['M'].items()}
            elif 'SS' in value:  # String Set
                parsed[key] = value['SS']
            elif 'NS' in value:  # Number Set
                parsed[key] = [float(n) if '.' in n else int(n) for n in value['NS']]
            elif 'BS' in value:  # Binary Set
                parsed[key] = value['BS']
            elif 'NULL' in value:  # Null
                parsed[key] = None
            else:
                # Default to string representation
                parsed[key] = str(value)
        
        return parsed
    
    def _parse_attribute_value(self, attr_value):
        """Parse a single DynamoDB attribute value"""
        if 'S' in attr_value:
            return attr_value['S']
        elif 'N' in attr_value:
            return float(attr_value['N']) if '.' in attr_value['N'] else int(attr_value['N'])
        elif 'BOOL' in attr_value:
            return attr_value['BOOL']
        elif 'NULL' in attr_value:
            return None
        elif 'L' in attr_value:  # Handle nested lists
            return [self._parse_attribute_value(item) for item in attr_value['L']]
        elif 'M' in attr_value:  # Handle nested maps
            return {k: self._parse_attribute_value(v) for k, v in attr_value['M'].items()}
        elif 'SS' in attr_value:  # String Set
            return attr_value['SS']
        elif 'NS' in attr_value:  # Number Set
            return [float(n) if '.' in n else int(n) for n in attr_value['NS']]
        elif 'BS' in attr_value:  # Binary Set
            return attr_value['BS']
        else:
            # Log unknown attribute types for debugging
            logger.warning(f"Unknown DynamoDB attribute type: {attr_value}")
            return str(attr_value)
    
    def _create_embedding_summary(self, profile_data):
        """Create AI-powered summary from fulltext for embedding generation"""
        try:
            fulltext = profile_data.get('fulltext', '')
            
            if not fulltext:
                # Fallback if no fulltext
                return f"{profile_data.get('name', 'Unknown')} - {profile_data.get('headline', '')}"
            
            # Use GPT-4 to create a focused summary for networking/recruitment
            summary = self._summarize_fulltext(fulltext)
            return summary
            
        except Exception as e:
            logger.error(f"Error creating embedding summary: {str(e)}")
            # Fallback to basic info
            return f"{profile_data.get('name', 'Unknown')} - {profile_data.get('headline', '')}"
    
    def _summarize_fulltext(self, fulltext):
        """Create AI-powered summary optimized for professional networking and recruitment"""
        try:
            # Truncate if extremely long to avoid token limits
            if len(fulltext) > 12000:  # Rough character limit for GPT-4
                fulltext = fulltext[:12000] + "..."
            
            prompt = """Create a professional summary paragraph for vector search. Analyze this LinkedIn profile and write a cohesive 100-200 word paragraph that flows naturally and includes:

- Full name and current role/company
- Other roles/companies in the Profile's history
- Years of experience or career level
- Key technical skills and expertise areas
- Industry background and specializations
- Notable career achievements or focus areas
- Current location if mentioned

Write as a single, well-structured paragraph that reads smoothly. Focus on searchable professional details that would be valuable for networking and recruitment.

LinkedIn Profile:
{fulltext}

Professional Summary:"""

            response = self.openai_client.chat.completions.create(
                model=SUMMARIZATION_MODEL,
                messages=[{
                    "role": "user", 
                    "content": prompt.format(fulltext=fulltext)
                }],
                max_tokens=200,
                temperature=0.3  # Lower temperature for more consistent summaries
            )
            
            summary = response.choices[0].message.content.strip()
            logger.info(f"Generated AI summary of {len(summary)} characters")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating AI summary: {str(e)}")
            # Fallback to simple truncation
            return fulltext[:2000] + "..." if len(fulltext) > 2000 else fulltext
    
    def _create_metadata(self, profile_data):
        """Create comprehensive Pinecone metadata from profile data"""
        try:
            metadata = {
                # Core identification
                'profile_id': profile_data.get('PK', ''),
                'name': profile_data.get('name', ''),
                
                # Current position
                'company': profile_data.get('currentCompany', ''),
                'title': profile_data.get('currentTitle', ''),
                'location': profile_data.get('currentLocation', ''),
                'employment_type': profile_data.get('employmentType', ''),
                
                # Professional summary
                'headline': profile_data.get('headline', ''),
                
                # Experience calculation
                'experience_length': self._calculate_experience_years(profile_data),
                
                # System metadata
                'updated_at': profile_data.get('updatedAt', ''),
                'created_at': profile_data.get('createdAt', ''),
                
                # Profile source
                'original_url': profile_data.get('originalUrl', ''),
                'profile_picture_url': profile_data.get('profilePictureUrl', '')
            }
            
            # Add skills as an array for filtering
            skills = profile_data.get('skills', [])
            logger.info(f"Skills debug - raw skills: {skills}, type: {type(skills)}")
            
            if skills:
                if isinstance(skills, list):
                    logger.info(f"Skills is list with {len(skills)} items")
                    # Clean and validate skills
                    clean_skills = []
                    for i, skill in enumerate(skills):
                        logger.info(f"Skill {i}: {skill}, type: {type(skill)}")
                        if isinstance(skill, str) and skill.strip():
                            skill_clean = skill.strip()
                            # Skip obvious corruption but allow normal skills
                            if not (skill_clean.startswith('{') and '"S"' in skill_clean):
                                clean_skills.append(skill_clean)
                            else:
                                logger.warning(f"Skipping corrupted skill: {skill_clean}")
                        else:
                            logger.warning(f"Skipping non-string skill: {skill} (type: {type(skill)})")
                    
                    logger.info(f"Clean skills: {clean_skills}")
                    if clean_skills:
                        metadata['skills'] = clean_skills  # Keep as array
                        logger.info(f"Added skills to metadata: {clean_skills}")
                    else:
                        logger.warning("No clean skills found")
                else:
                    logger.warning(f"Skills is not a list, it's: {type(skills)}")
            else:
                logger.info("No skills found in profile_data")
            
            # Add education summary
            education = profile_data.get('education', [])
            if education and isinstance(education, list) and len(education) > 0:
                # Get the most recent/relevant education
                latest_education = education[0] if education else {}
                if isinstance(latest_education, dict):
                    metadata['education'] = latest_education.get('school', '')
            
            # Remove empty values to save space and avoid Pinecone issues
            metadata = {k: v for k, v in metadata.items() if v and v != ''}
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error creating metadata: {str(e)}")
            # Return minimal metadata on error
            return {
                'profile_id': profile_data.get('PK', ''),
                'name': profile_data.get('name', ''),
                'company': profile_data.get('currentCompany', ''),
                'location': profile_data.get('currentLocation', '')
            }
    
    def _calculate_experience_years(self, profile_data):
        """Calculate total years of experience from work history"""
        try:
            work_experience = profile_data.get('workExperience', [])
            if not work_experience or not isinstance(work_experience, list):
                return 0
            
            total_years = 0
            for experience in work_experience:
                if isinstance(experience, dict):
                    # Look for duration information
                    duration = experience.get('duration', '')
                    if 'year' in duration.lower():
                        # Extract years from duration string
                        import re
                        years_match = re.search(r'(\d+)\s*year', duration.lower())
                        if years_match:
                            total_years += int(years_match.group(1))
                        
                        # Also look for months and convert
                        months_match = re.search(r'(\d+)\s*month', duration.lower())
                        if months_match:
                            total_years += int(months_match.group(1)) / 12
            
            return round(total_years, 1)
            
        except Exception as e:
            logger.error(f"Error calculating experience years: {str(e)}")
            return 0


def lambda_handler(event, context):
    """
    AWS Lambda handler for Pinecone indexing
    
    Args:
        event: DynamoDB Stream event
        context: Lambda context object
        
    Returns:
        dict: Processing results
    """
    try:
        logger.info(f"Received DynamoDB Stream event with {len(event['Records'])} records")
        
        # Initialize indexer
        indexer = PineconeIndexer()
        
        # Process stream records
        results = indexer.process_stream_records(event['Records'])
        
        logger.info(f"Processing complete: {results['processed']} processed, {results['skipped']} skipped, {results['errors']} errors")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Stream processing completed',
                'results': results
            })
        }
        
    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
