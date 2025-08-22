"""
Pinecone Indexer Lambda Function

Processes DynamoDB Stream events to maintain Pinecone vector index:
- INSERT/MODIFY: Upsert vector in Pinecone
- REMOVE: Delete vector from Pinecone
"""

import json
import boto3
import logging
import os
from datetime import datetime
from openai import OpenAI

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
PINECONE_HOST = os.environ.get('PINECONE_HOST')
SUMMARIZATION_MODEL = "gpt-4.1"
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
        try:
            if not PINECONE_API_KEY:
                raise ValueError("PINECONE_API_KEY environment variable not set")
            if not OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            from pinecone import Pinecone
            self.pinecone_client = Pinecone(api_key=PINECONE_API_KEY)
            self.index = self.pinecone_client.Index(host=PINECONE_HOST)
            self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
            logger.info("Successfully initialized Pinecone and OpenAI clients")
        except Exception as e:
            logger.error(f"Failed to initialize clients: {str(e)}")
            raise
    
    def process_stream_records(self, records):
        results = {
            'processed': 0,
            'skipped': 0,
            'errors': 0,
            'details': []
        }
        for i, record in enumerate(records):
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
                logger.error(f"Error processing record {i}: {str(e)}")
                results['errors'] += 1
                results['details'].append({
                    'status': 'error',
                    'error': str(e),
                    'record_id': record.get('eventID', 'unknown')
                })
        logger.info(f"Stream processing results: {results}")
        return results
    
    def _process_single_record(self, record):
        event_name = record['eventName']
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
        try:
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
        try:
            new_image = record['dynamodb']['NewImage']
            profile_data = self._parse_dynamodb_item(new_image)
            fulltext = profile_data.get('fulltext', '')
            if not fulltext or len(fulltext) < 5:
                logger.info(f"Skipping profile {profile_data.get('PK', '')}: fulltext missing or too short.")
                return {
                    'status': 'skipped',
                    'reason': 'No fulltext present or too short',
                    'vector_id': profile_data.get('PK', ''),
                    'event_name': record['eventName']
                }
            profile_id = profile_data['PK']
            vector_id = profile_id
            summary_text = self._create_embedding_summary(profile_data)
            metadata = self._create_metadata(profile_data)
            record_data = {
                '_id': vector_id,
                'summary': summary_text,
                **metadata
            }
            self.index.upsert_records(namespace="default", records=[record_data])
            logger.info(f"Upserted record for profile: {vector_id} (event: {record['eventName']})")
            return {
                'status': 'processed',
                'action': 'upserted',
                'vector_id': vector_id,
                'event_name': record['eventName']
            }
        except Exception as e:
            logger.error(f"Error handling upsert: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'event_name': record['eventName']
            }
    
    def _handle_remove(self, record):
        try:
            old_image = record['dynamodb']['OldImage']
            profile_data = self._parse_dynamodb_item(old_image)
            profile_id = profile_data['PK']
            vector_id = profile_id
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
        parsed = {}
        for key, value in dynamodb_item.items():
            if 'S' in value:
                parsed[key] = value['S']
            elif 'N' in value:
                parsed[key] = float(value['N']) if '.' in value['N'] else int(value['N'])
            elif 'BOOL' in value:
                parsed[key] = value['BOOL']
            elif 'L' in value:
                parsed[key] = [self._parse_attribute_value(item) for item in value['L']]
            elif 'M' in value:
                parsed[key] = {k: self._parse_attribute_value(v) for k, v in value['M'].items()}
            elif 'SS' in value:
                parsed[key] = value['SS']
            elif 'NS' in value:
                parsed[key] = [float(n) if '.' in n else int(n) for n in value['NS']]
            elif 'BS' in value:
                parsed[key] = value['BS']
            elif 'NULL' in value:
                parsed[key] = None
            else:
                parsed[key] = str(value)
        return parsed
    
    def _parse_attribute_value(self, attr_value):
        if 'S' in attr_value:
            return attr_value['S']
        elif 'N' in attr_value:
            return float(attr_value['N']) if '.' in attr_value['N'] else int(attr_value['N'])
        elif 'BOOL' in attr_value:
            return attr_value['BOOL']
        elif 'NULL' in attr_value:
            return None
        elif 'L' in attr_value:
            return [self._parse_attribute_value(item) for item in attr_value['L']]
        elif 'M' in attr_value:
            return {k: self._parse_attribute_value(v) for k, v in attr_value['M'].items()}
        elif 'SS' in attr_value:
            return attr_value['SS']
        elif 'NS' in attr_value:
            return [float(n) if '.' in n else int(n) for n in attr_value['NS']]
        elif 'BS' in attr_value:
            return attr_value['BS']
        else:
            logger.warning(f"Unknown DynamoDB attribute type: {attr_value}")
            return str(attr_value)
    
    def _create_embedding_summary(self, profile_data):
        try:
            fulltext = profile_data.get('fulltext', '')
            if not fulltext:
                return f"{profile_data.get('name', 'Unknown')} - {profile_data.get('headline', '')}"
            summary = self._summarize_fulltext(fulltext)
            return summary
        except Exception as e:
            logger.error(f"Error creating embedding summary: {str(e)}")
            return f"{profile_data.get('name', 'Unknown')} - {profile_data.get('headline', '')}"
    
    def _summarize_fulltext(self, fulltext):
        try:
            if len(fulltext) > 12000:
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
                temperature=0.3
            )
            summary = response.choices[0].message.content.strip()
            logger.info(f"Generated AI summary of {len(summary)} characters")
            return summary
        except Exception as e:
            logger.error(f"Error generating AI summary: {str(e)}")
            return fulltext[:2000] + "..." if len(fulltext) > 2000 else fulltext
    
    def _create_metadata(self, profile_data):
        try:
            metadata = {
                'profile_id': profile_data.get('PK', ''),
                'name': profile_data.get('name', ''),
                'company': profile_data.get('currentCompany', ''),
                'title': profile_data.get('currentTitle', ''),
                'location': profile_data.get('currentLocation', ''),
                'employment_type': profile_data.get('employmentType', ''),
                'headline': profile_data.get('headline', ''),
                'experience_length': self._calculate_experience_years(profile_data),
                'updated_at': profile_data.get('updatedAt', ''),
                'created_at': profile_data.get('createdAt', ''),
                'original_url': profile_data.get('originalUrl', ''),
                'profile_picture_url': profile_data.get('profilePictureUrl', '')
            }
            skills = profile_data.get('skills', [])
            if skills and isinstance(skills, list):
                clean_skills = [skill.strip() for skill in skills if isinstance(skill, str) and skill.strip() and not (skill.strip().startswith('{') and '"S"' in skill)]
                if clean_skills:
                    metadata['skills'] = clean_skills
            education = profile_data.get('education', [])
            if education and isinstance(education, list) and len(education) > 0:
                latest_education = education[0] if education else {}
                if isinstance(latest_education, dict):
                    metadata['education'] = latest_education.get('school', '')
            metadata = {k: v for k, v in metadata.items() if v and v != ''}
            return metadata
        except Exception as e:
            logger.error(f"Error creating metadata: {str(e)}")
            return {
                'profile_id': profile_data.get('PK', ''),
                'name': profile_data.get('name', ''),
                'company': profile_data.get('currentCompany', ''),
                'location': profile_data.get('currentLocation', '')
            }
    
    def _calculate_experience_years(self, profile_data):
        try:
            work_experience = profile_data.get('workExperience', [])
            if not work_experience or not isinstance(work_experience, list):
                return 0
            total_years = 0
            for experience in work_experience:
                if isinstance(experience, dict):
                    duration = experience.get('duration', '')
                    if 'year' in duration.lower():
                        import re
                        years_match = re.search(r'(\d+)\s*year', duration.lower())
                        if years_match:
                            total_years += int(years_match.group(1))
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
    """
    try:
        logger.info(f"Received DynamoDB Stream event with {len(event['Records'])} records")
        indexer = PineconeIndexer()
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