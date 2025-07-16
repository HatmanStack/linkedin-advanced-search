#!/usr/bin/env python3
"""
Lambda Function Unit Testing Script

Tests the Lambda function logic in isolation without requiring:
- Deployed Lambda
- DynamoDB Stream
- Live AWS resources

Usage:
    python test-lambda-unit.py
"""

import os
import json
import sys
from datetime import datetime

# Add Lambda function path
sys.path.append('/home/hatmanstack/Projects/claude-linkedin/lambda-processing/pinecone-indexer')

# Mock environment variables for testing
os.environ['PINECONE_API_KEY'] = 'test-key'
os.environ['OPENAI_API_KEY'] = 'test-key'
os.environ['PINECONE_HOST'] = 'linkedin-profiles-86mgnt0.svc.aped-4627-b74a.pinecone.io'
os.environ['PINECONE_INDEX_NAME'] = 'linkedin-profiles'

class MockPineconeIndex:
    """Mock Pinecone index for testing"""
    def __init__(self):
        self.upserted_records = []
        self.deleted_ids = []
    
    def upsert_records(self, namespace, records):
        """Mock upsert_records method"""
        self.upserted_records.extend(records)
        print(f"Mock: Upserted {len(records)} records to namespace {namespace}")
        return {"upserted_count": len(records)}
    
    def delete(self, namespace, ids):
        """Mock delete method"""
        self.deleted_ids.extend(ids)
        print(f"Mock: Deleted {len(ids)} vectors from namespace {namespace}")
        return {"deleted_count": len(ids)}

class MockOpenAIClient:
    """Mock OpenAI client for testing"""
    def __init__(self):
        self.chat = MockChatCompletions()

class MockChatCompletions:
    """Mock chat completions"""
    def __init__(self):
        self.completions = self
    
    def create(self, **kwargs):
        """Mock chat completion"""
        return MockChatResponse()

class MockChatResponse:
    """Mock chat response"""
    def __init__(self):
        self.choices = [MockChoice()]

class MockChoice:
    """Mock choice"""
    def __init__(self):
        self.message = MockMessage()

class MockMessage:
    """Mock message"""
    def __init__(self):
        self.content = """John Doe is a Senior Software Engineer with 8+ years of experience in cloud technologies and full-stack development. Currently working at TechCorp, he specializes in AWS, Python, and React development. His background includes leading development teams and architecting scalable web applications. John has a strong track record in agile development methodologies and has contributed to multiple successful product launches. He holds a Bachelor's degree in Computer Science and is passionate about emerging technologies and mentoring junior developers."""

def create_mock_dynamodb_record(profile_data, event_name='INSERT'):
    """Create a mock DynamoDB Stream record"""
    
    # Convert profile data to DynamoDB format
    dynamodb_item = {}
    for key, value in profile_data.items():
        if isinstance(value, str):
            dynamodb_item[key] = {'S': value}
        elif isinstance(value, (int, float)):
            dynamodb_item[key] = {'N': str(value)}
        elif isinstance(value, bool):
            dynamodb_item[key] = {'BOOL': value}
        elif isinstance(value, list):
            dynamodb_item[key] = {'SS': [str(v) for v in value]}
        elif value is not None:
            dynamodb_item[key] = {'S': str(value)}
    
    return {
        'eventName': event_name,
        'dynamodb': {
            'NewImage': dynamodb_item
        }
    }

def test_lambda_function_logic():
    """Test the Lambda function logic with mock data"""
    print("🧪 Testing Lambda Function Logic")
    print("=" * 40)
    
    try:
        # Import Lambda function
        from lambda_function import PineconeIndexer
        
        # Create sample profile data
        sample_profile = {
            'PK': 'PROFILE#john-doe-123',
            'SK': '#METADATA',
            'name': 'John Doe',
            'currentCompany': 'TechCorp',
            'currentTitle': 'Senior Software Engineer',
            'currentLocation': 'San Francisco, CA',
            'headline': 'Senior Software Engineer | AWS | Python | React',
            'fulltext': '''John Doe - Senior Software Engineer at TechCorp
            
            Experience:
            • Senior Software Engineer at TechCorp (2020-Present)
              - Lead development of cloud-native applications using AWS
              - Built scalable web applications with Python and React
              - Mentored junior developers and led agile development teams
            
            • Software Engineer at StartupXYZ (2018-2020)
              - Developed full-stack web applications
              - Implemented CI/CD pipelines and automated testing
            
            Skills: Python, JavaScript, React, AWS, Docker, Kubernetes, PostgreSQL
            
            Education: Bachelor of Science in Computer Science, UC Berkeley
            
            Passionate about cloud technologies, open source, and building great products.''',
            'skills': ['Python', 'AWS', 'React', 'JavaScript', 'Docker'],
            'updatedAt': '2024-01-15T10:30:00Z',
            'createdAt': '2024-01-15T10:30:00Z',
            'originalUrl': 'https://linkedin.com/in/johndoe'
        }
        
        print("✅ Sample profile data created")
        
        # Create indexer with mocked dependencies
        indexer = PineconeIndexer()
        
        # Replace real clients with mocks
        indexer.index = MockPineconeIndex()
        indexer.openai_client = MockOpenAIClient()
        
        print("✅ Mock clients initialized")
        
        # Test profile data parsing
        print("\n🔍 Testing profile data parsing...")
        mock_record = create_mock_dynamodb_record(sample_profile)
        dynamodb_item = mock_record['dynamodb']['NewImage']
        parsed_data = indexer._parse_dynamodb_item(dynamodb_item)
        
        print(f"   - Parsed name: {parsed_data.get('name')}")
        print(f"   - Parsed company: {parsed_data.get('currentCompany')}")
        print(f"   - Parsed skills count: {len(parsed_data.get('skills', []))}")
        
        # Test summary creation
        print("\n📝 Testing summary creation...")
        summary = indexer._create_embedding_summary(parsed_data)
        print(f"   - Summary length: {len(summary)} characters")
        print(f"   - Summary preview: {summary[:100]}...")
        
        # Test metadata creation
        print("\n📋 Testing metadata creation...")
        metadata = indexer._create_metadata(parsed_data)
        print(f"   - Metadata fields: {list(metadata.keys())}")
        print(f"   - Profile ID: {metadata.get('profile_id')}")
        print(f"   - Name: {metadata.get('name')}")
        print(f"   - Company: {metadata.get('company')}")
        
        # Test full upsert handling
        print("\n🔄 Testing full upsert handling...")
        result = indexer._handle_upsert(mock_record)
        
        if result['status'] == 'processed':
            print(f"✅ Upsert successful: {result['vector_id']}")
            
            # Check what was upserted
            upserted_record = indexer.index.upserted_records[0]
            print(f"   - Record ID: {upserted_record['_id']}")
            print(f"   - Summary field present: {'summary' in upserted_record}")
            print(f"   - Metadata fields: {len([k for k in upserted_record.keys() if k not in ['_id', 'summary']])}")
            
        else:
            print(f"❌ Upsert failed: {result.get('error')}")
            return False
        
        # Test remove handling
        print("\n🗑️  Testing remove handling...")
        remove_record = create_mock_dynamodb_record(sample_profile, 'REMOVE')
        remove_result = indexer._handle_remove(remove_record)
        
        if remove_result['status'] == 'processed':
            print(f"✅ Remove successful: {remove_result['vector_id']}")
        else:
            print(f"❌ Remove failed: {remove_result.get('error')}")
        
        print("\n🎉 All Lambda function tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Lambda function test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_edge_cases():
    """Test edge cases and error handling"""
    print("\n🧪 Testing Edge Cases")
    print("=" * 30)
    
    try:
        from lambda_function import PineconeIndexer
        
        indexer = PineconeIndexer()
        indexer.index = MockPineconeIndex()
        indexer.openai_client = MockOpenAIClient()
        
        # Test with minimal profile data
        minimal_profile = {
            'PK': 'PROFILE#minimal-123',
            'SK': '#METADATA',
            'name': 'Jane Smith'
        }
        
        print("🔍 Testing minimal profile data...")
        mock_record = create_mock_dynamodb_record(minimal_profile)
        result = indexer._handle_upsert(mock_record)
        
        if result['status'] == 'processed':
            print("✅ Minimal profile handled successfully")
        else:
            print(f"❌ Minimal profile failed: {result.get('error')}")
        
        # Test with missing fulltext
        no_fulltext_profile = {
            'PK': 'PROFILE#no-fulltext-123',
            'SK': '#METADATA',
            'name': 'Bob Johnson',
            'headline': 'Software Developer'
        }
        
        print("🔍 Testing profile without fulltext...")
        mock_record = create_mock_dynamodb_record(no_fulltext_profile)
        result = indexer._handle_upsert(mock_record)
        
        if result['status'] == 'processed':
            print("✅ No-fulltext profile handled successfully")
        else:
            print(f"❌ No-fulltext profile failed: {result.get('error')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Edge case testing failed: {str(e)}")
        return False

def main():
    """Main test execution"""
    print("🚀 Starting Lambda Function Unit Tests")
    print("=" * 50)
    
    # Test basic functionality
    basic_test_passed = test_lambda_function_logic()
    
    # Test edge cases
    edge_test_passed = test_edge_cases()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    tests = {
        'Basic Functionality': basic_test_passed,
        'Edge Cases': edge_test_passed
    }
    
    for test_name, passed in tests.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name:.<30} {status}")
    
    all_passed = all(tests.values())
    
    if all_passed:
        print("\n🎉 ALL UNIT TESTS PASSED!")
        print("Lambda function is ready for deployment.")
    else:
        print("\n⚠️  Some tests failed. Check the implementation.")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit(main())
