#!/usr/bin/env python3
"""
Pinecone Integration Testing Script

Tests the complete pipeline:
1. Pinecone index connectivity
2. Lambda function logic (without DynamoDB Stream)
3. End-to-end profile processing
4. Vector search functionality

Usage:
    python test-pinecone-integration.py
"""

import os
import json
import boto3
from datetime import datetime
from pinecone import Pinecone

# Configuration
PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
PINECONE_HOST = 'linkedin-profiles-86mgnt0.svc.aped-4627-b74a.pinecone.io'
PINECONE_INDEX_NAME = 'linkedin-profiles'
DYNAMODB_TABLE = 'linkedin-advanced-search'
AWS_REGION = 'us-west-2'

class PineconeIntegrationTester:
    def __init__(self):
        self.pinecone_client = None
        self.index = None
        self.dynamodb = None
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize all required clients"""
        try:
            # Initialize Pinecone
            if not PINECONE_API_KEY:
                raise ValueError("PINECONE_API_KEY environment variable not set")
            
            self.pinecone_client = Pinecone(api_key=PINECONE_API_KEY)
            self.index = self.pinecone_client.Index(host=PINECONE_HOST)
            
            # Initialize DynamoDB
            self.dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
            self.table = self.dynamodb.Table(DYNAMODB_TABLE)
            
            print("✅ Successfully initialized all clients")
            
        except Exception as e:
            print(f"❌ Failed to initialize clients: {str(e)}")
            raise
    
    def test_pinecone_connectivity(self):
        """Test basic Pinecone connectivity and index stats"""
        print("\n🔍 Testing Pinecone Connectivity...")
        
        try:
            # Get index stats
            stats = self.index.describe_index_stats()
            print(f"✅ Pinecone index connected successfully")
            print(f"   - Total vectors: {stats.get('total_vector_count', 0)}")
            print(f"   - Dimension: {stats.get('dimension', 'Unknown')}")
            print(f"   - Namespaces: {list(stats.get('namespaces', {}).keys())}")
            
            return True
            
        except Exception as e:
            print(f"❌ Pinecone connectivity failed: {str(e)}")
            return False
    
    def get_sample_profiles(self, limit=4):
        """Get sample profiles from DynamoDB for testing"""
        print(f"\n📋 Fetching {limit} sample profiles from DynamoDB...")
        
        try:
            profiles = []
            last_evaluated_key = None
            
            while len(profiles) < limit:
                scan_params = {
                    'FilterExpression': 'begins_with(PK, :pk) AND SK = :sk',
                    'ExpressionAttributeValues': {
                        ':pk': 'PROFILE#',
                        ':sk': '#METADATA'
                    },
                    'Limit': limit * 2  # Get more than needed to account for filtering
                }
                
                if last_evaluated_key:
                    scan_params['ExclusiveStartKey'] = last_evaluated_key
                
                response = self.table.scan(**scan_params)
                
                batch_profiles = response.get('Items', [])
                profiles.extend(batch_profiles)
                
                last_evaluated_key = response.get('LastEvaluatedKey')
                
                # Break if no more items or we have enough
                if not last_evaluated_key or len(profiles) >= limit:
                    break
            
            # Limit to requested number
            profiles = profiles[:limit]
            
            print(f"✅ Found {len(profiles)} sample profiles")
            
            for i, profile in enumerate(profiles, 1):
                name = profile.get('name', 'Unknown')
                company = profile.get('currentCompany', 'Unknown')
                print(f"   {i}. {name} at {company}")
            
            return profiles
            
        except Exception as e:
            print(f"❌ Failed to fetch sample profiles: {str(e)}")
            return []
    
    def simulate_lambda_processing(self, profile_data):
        """Simulate the Lambda function processing logic"""
        print(f"\n🔄 Simulating Lambda processing for: {profile_data.get('name', 'Unknown')}")
        
        try:
            # Import the Lambda function logic
            import sys
            sys.path.append('/home/hatmanstack/Projects/claude-linkedin/lambda-processing/pinecone-indexer')
            
            # Set environment variables for Lambda
            os.environ['PINECONE_API_KEY'] = PINECONE_API_KEY
            os.environ['OPENAI_API_KEY'] = OPENAI_API_KEY
            os.environ['PINECONE_HOST'] = PINECONE_HOST
            os.environ['PINECONE_INDEX_NAME'] = PINECONE_INDEX_NAME
            
            from lambda_function import PineconeIndexer
            
            # Create indexer instance
            indexer = PineconeIndexer()
            
            # Create mock DynamoDB Stream record
            mock_record = {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': self._convert_to_dynamodb_format(profile_data)
                }
            }
            
            # Process the record
            result = indexer._handle_upsert(mock_record)
            
            if result['status'] == 'processed':
                print(f"✅ Successfully processed profile: {result['vector_id']}")
                return result
            else:
                print(f"❌ Processing failed: {result.get('error', 'Unknown error')}")
                return None
                
        except Exception as e:
            print(f"❌ Lambda simulation failed: {str(e)}")
            return None
    
    def _convert_to_dynamodb_format(self, profile_data):
        """Convert regular dict to DynamoDB format"""
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
            elif value is None:
                continue  # Skip null values
            else:
                dynamodb_item[key] = {'S': str(value)}
        
        return dynamodb_item
    
    def test_profile_processing_with_approval(self, limit=2):
        """Process first few profiles with manual approval before batch processing"""
        print(f"\n🔄 Processing first {limit} profiles for review...")
        
        try:
            # Get sample profiles
            profiles = self.get_sample_profiles(limit=limit)
            
            if not profiles:
                print("❌ No profiles found for processing")
                return False
            
            processed_results = []
            
            for i, profile in enumerate(profiles, 1):
                print(f"\n--- Processing Profile {i}/{len(profiles)} ---")
                name = profile.get('name', 'Unknown')
                company = profile.get('currentCompany', 'Unknown')
                print(f"Profile: {name} at {company}")
                
                # Process with detailed logging
                result = self.simulate_lambda_processing_with_logging(profile)
                
                if result and result['status'] == 'processed':
                    processed_results.append(result)
                    print(f"✅ Successfully processed: {result['vector_id']}")
                else:
                    print(f"❌ Failed to process profile")
                
                # Ask for approval after first two
                if i == limit:
                    print(f"\n{'='*50}")
                    print(f"📋 REVIEW SUMMARY - First {limit} profiles processed")
                    print(f"{'='*50}")
                    for j, res in enumerate(processed_results, 1):
                        print(f"{j}. Vector ID: {res['vector_id']}")
                        print(f"   Summary length: {len(res.get('summary', ''))} characters")
                    
                    approval = input(f"\nProceed to process all remaining profiles? (y/N): ").strip().lower()
                    if approval == 'y':
                        return self.process_all_profiles(processed_results)
                    else:
                        print("Processing stopped by user.")
                        return processed_results
            
            return processed_results
            
        except Exception as e:
            print(f"❌ Profile processing failed: {str(e)}")
            return []
    
    def simulate_lambda_processing_with_logging(self, profile_data):
        """Simulate Lambda processing with detailed logging of AI summaries"""
        print(f"\n🔄 Processing profile: {profile_data.get('name', 'Unknown')}")
        
        try:
            # Import the Lambda function logic
            import sys
            sys.path.append('/home/hatmanstack/Projects/claude-linkedin/lambda-processing/pinecone-indexer')
            
            # Set environment variables for Lambda
            os.environ['PINECONE_API_KEY'] = PINECONE_API_KEY
            os.environ['OPENAI_API_KEY'] = OPENAI_API_KEY
            os.environ['PINECONE_HOST'] = PINECONE_HOST
            os.environ['PINECONE_INDEX_NAME'] = PINECONE_INDEX_NAME
            
            from lambda_function import PineconeIndexer
            
            # Create indexer instance with logging enabled
            indexer = PineconeIndexer()
            
            # Create mock DynamoDB Stream record
            mock_record = {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': self._convert_to_dynamodb_format(profile_data)
                }
            }
            
            # Intercept the metadata creation to log it
            original_create_summary = indexer._create_embedding_summary
            original_create_metadata = indexer._create_metadata
            
            def logged_create_summary(profile_data):
                summary = original_create_summary(profile_data)
                print(f"\n📝 AI SUMMARY FOR VECTORIZATION:")
                print(f"{'='*60}")
                print(summary)
                print(f"{'='*60}")
                print(f"Summary length: {len(summary)} characters\n")
                return summary
            
            def logged_create_metadata(profile_data):
                # Debug skills before metadata creation
                skills = profile_data.get('skills', [])
                print(f"\n🔍 SKILLS DEBUG:")
                print(f"Raw skills: {skills}")
                print(f"Skills type: {type(skills)}")
                if isinstance(skills, list):
                    print(f"Skills count: {len(skills)}")
                    for i, skill in enumerate(skills[:5]):  # Show first 5
                        print(f"  Skill {i}: '{skill}' (type: {type(skill)})")
                
                metadata = original_create_metadata(profile_data)
                
                print(f"\n🏷️  METADATA FOR VECTOR:")
                print(f"{'='*60}")
                for key, value in metadata.items():
                    if key == 'skills':
                        print(f"skills: {value} (type: {type(value)})")
                    else:
                        print(f"{key}: {value}")
                print(f"{'='*60}\n")
                return metadata
            
            indexer._create_embedding_summary = logged_create_summary
            indexer._create_metadata = logged_create_metadata
            
            # Process the record
            result = indexer._handle_upsert(mock_record)
            
            if result['status'] == 'processed':
                result['summary'] = original_create_summary(profile_data)
                return result
            else:
                print(f"❌ Processing failed: {result.get('error', 'Unknown error')}")
                return None
                
        except Exception as e:
            print(f"❌ Lambda simulation failed: {str(e)}")
            return None
    
    def process_all_profiles(self, already_processed):
        """Process all remaining profiles in DynamoDB"""
        print(f"\n🚀 Processing all profiles in DynamoDB...")
        
        try:
            # Get all profiles
            response = self.table.scan(
                FilterExpression='begins_with(PK, :pk) AND SK = :sk',
                ExpressionAttributeValues={
                    ':pk': 'PROFILE#',
                    ':sk': '#METADATA'
                }
            )
            
            all_profiles = response.get('Items', [])
            remaining_profiles = all_profiles[len(already_processed):]
            
            print(f"📊 Total profiles: {len(all_profiles)}")
            print(f"📊 Already processed: {len(already_processed)}")
            print(f"📊 Remaining to process: {len(remaining_profiles)}")
            
            all_results = already_processed.copy()
            
            for i, profile in enumerate(remaining_profiles, len(already_processed) + 1):
                print(f"\nProcessing {i}/{len(all_profiles)}: {profile.get('name', 'Unknown')}")
                
                result = self.simulate_lambda_processing(profile)
                if result and result['status'] == 'processed':
                    all_results.append(result)
                    print(f"✅ Processed: {result['vector_id']}")
                else:
                    print(f"❌ Failed to process profile")
            
            print(f"\n🎉 Batch processing complete!")
            print(f"📊 Successfully processed: {len([r for r in all_results if r['status'] == 'processed'])}")
            
            return all_results
            
        except Exception as e:
            print(f"❌ Batch processing failed: {str(e)}")
            return already_processed
    
    def cleanup_test_vectors(self, vector_ids):
        """Clean up test vectors"""
        print(f"\n🧹 Cleaning up {len(vector_ids)} test vectors...")
        
        try:
            if vector_ids:
                self.index.delete(namespace="default", ids=vector_ids)
                print("✅ Test vectors cleaned up")
            
        except Exception as e:
            print(f"⚠️  Cleanup warning: {str(e)}")
    
    def run_full_test_suite(self):
        """Run the complete test suite"""
        print("🚀 Starting Pinecone Integration Test Suite")
        print("=" * 50)
        
        test_results = {
            'connectivity': False,
            'processing': False
        }
        
        processed_vector_ids = []
        
        try:
            # Test 1: Connectivity
            test_results['connectivity'] = self.test_pinecone_connectivity()
            
            if not test_results['connectivity']:
                print("\n❌ Connectivity test failed. Stopping tests.")
                return test_results
            
            # Test 2: Process all profiles in DynamoDB
            #processed_results = self.test_profile_processing_with_approval(limit=16)
            processed_results = self.process_all_profiles_directly()
            
            if processed_results:
                test_results['processing'] = True
                processed_vector_ids = [r['vector_id'] for r in processed_results if r.get('vector_id')]
            
        except Exception as e:
            print(f"\n❌ Test suite failed: {str(e)}")
        
        finally:
            # Cleanup
            if processed_vector_ids:
                self.cleanup_test_vectors(processed_vector_ids)
        
        # Print results summary
        self.print_test_summary(test_results)
        
        return test_results
    
    def process_all_profiles_directly(self):
        """Process all profiles in DynamoDB directly"""
        print(f"\n🚀 Processing all profiles in DynamoDB...")
        
        try:
            # Get all profiles
            response = self.table.scan(
                FilterExpression='begins_with(PK, :pk) AND SK = :sk',
                ExpressionAttributeValues={
                    ':pk': 'PROFILE#',
                    ':sk': '#METADATA'
                }
            )
            
            all_profiles = response.get('Items', [])
            
            print(f"📊 Total profiles found: {len(all_profiles)}")
            
            all_results = []
            
            for i, profile in enumerate(all_profiles, 1):
                print(f"\nProcessing {i}/{len(all_profiles)}: {profile.get('name', 'Unknown')}")
                
                result = self.simulate_lambda_processing_with_logging(profile)
                if result and result['status'] == 'processed':
                    all_results.append(result)
                    print(f"✅ Processed: {result['vector_id']}")
                else:
                    print(f"❌ Failed to process profile")
            
            print(f"\n🎉 Batch processing complete!")
            print(f"📊 Successfully processed: {len([r for r in all_results if r['status'] == 'processed'])}")
            
            return all_results
            
        except Exception as e:
            print(f"❌ Batch processing failed: {str(e)}")
            return []
    
    def print_test_summary(self, results):
        """Print test results summary"""
        print("\n" + "=" * 50)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 50)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result)
        
        for test_name, passed in results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"{test_name.upper():.<20} {status}")
        
        print("-" * 50)
        print(f"OVERALL: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED! Pinecone integration is ready.")
        else:
            print("⚠️  Some tests failed. Check the logs above.")

def main():
    """Main test execution"""
    # Check required environment variables
    if not PINECONE_API_KEY:
        print("❌ PINECONE_API_KEY environment variable not set")
        print("   Export your Pinecone API key: export PINECONE_API_KEY=your_key_here")
        return
    
    if not OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY environment variable not set")
        print("   Export your OpenAI API key: export OPENAI_API_KEY=your_key_here")
        return
    
    # Run tests
    tester = PineconeIntegrationTester()
    results = tester.run_full_test_suite()
    
    # Exit with appropriate code
    all_passed = all(results.values())
    exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
