#!/usr/bin/env python3
"""
Test script for edge processing Lambda function.

This script:
1. Takes a list of LinkedIn profile identifiers and a user sub
2. Creates mock API Gateway events for each profile
3. Tests the Lambda function locally
4. Reports results and any errors

Usage:
    python test_edge_processing.py --user-sub USER_SUB --profiles profile1 profile2 profile3
    python test_edge_processing.py --user-sub USER_SUB --profiles-file profiles.json
"""

import json
import sys
import argparse
from datetime import datetime
from lambda_function import lambda_handler


def create_mock_api_gateway_event(linkedin_profile, user_sub, operation="create", updates=None):
    """Create a mock API Gateway event for testing"""
    body_data = {
        "linkedinurl": linkedin_profile,
        "operation": operation
    }
    
    if updates:
        body_data["updates"] = updates
    
    return {
        "httpMethod": "POST",
        "path": "/edge-processing",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": f"Bearer mock-jwt-token"
        },
        "body": json.dumps(body_data),
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": user_sub
                }
            }
        },
        "isBase64Encoded": False
    }


def create_mock_lambda_context():
    """Create a mock Lambda context for testing"""
    class MockContext:
        def __init__(self):
            self.function_name = "edge-processing-test"
            self.function_version = "$LATEST"
            self.invoked_function_arn = "arn:aws:lambda:us-west-2:123456789012:function:edge-processing-test"
            self.memory_limit_in_mb = "512"
            self.remaining_time_in_millis = lambda: 30000
            self.log_group_name = "/aws/lambda/edge-processing-test"
            self.log_stream_name = "2024/01/01/[$LATEST]test"
            self.aws_request_id = "test-request-id"
    
    return MockContext()


def test_single_operation(linkedin_profile, user_sub, operation="create", updates=None):
    """Test processing a single LinkedIn profile with specific operation"""
    print(f"\n{'='*60}")
    print(f"Testing Profile: {linkedin_profile}")
    print(f"User Sub: {user_sub}")
    print(f"Operation: {operation}")
    if updates:
        print(f"Updates: {json.dumps(updates, indent=2)}")
    print(f"{'='*60}")
    
    try:
        # Create mock event and context
        event = create_mock_api_gateway_event(linkedin_profile, user_sub, operation, updates)
        context = create_mock_lambda_context()
        
        print("Mock API Gateway Event:")
        print(json.dumps(event, indent=2))
        print("\nCalling Lambda handler...")
        
        # Call the Lambda handler
        response = lambda_handler(event, context)
        
        print(f"\nResponse Status Code: {response['statusCode']}")
        print("Response Body:")
        print(json.dumps(json.loads(response['body']), indent=2))
        
        if response['statusCode'] == 200:
            print("✅ SUCCESS: Edge operation completed successfully")
            return True
        else:
            print("❌ FAILED: Edge operation failed")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: Exception occurred during processing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_multiple_urls(linkedin_profiles, user_sub):
    """Test processing multiple LinkedIn profiles"""
    print(f"\n{'='*80}")
    print(f"BATCH TESTING: Processing {len(linkedin_profiles)} profiles")
    print(f"User Sub: {user_sub}")
    print(f"{'='*80}")
    
    results = {
        'successful': [],
        'failed': [],
        'errors': []
    }
    
    for i, profile in enumerate(linkedin_profiles, 1):
        print(f"\n[{i}/{len(linkedin_profiles)}] Processing: {profile}")
        
        try:
            success = test_single_url(profile, user_sub)
            if success:
                results['successful'].append(profile)
            else:
                results['failed'].append(profile)
                
        except Exception as e:
            error_info = {
                'profile': profile,
                'error': str(e)
            }
            results['errors'].append(error_info)
            print(f"❌ ERROR: {str(e)}")
    
    # Print summary
    print(f"\n{'='*80}")
    print("BATCH PROCESSING SUMMARY")
    print(f"{'='*80}")
    print(f"Total profiles processed: {len(linkedin_profiles)}")
    print(f"Successful: {len(results['successful'])}")
    print(f"Failed: {len(results['failed'])}")
    print(f"Errors: {len(results['errors'])}")
    
    if results['successful']:
        print(f"\n✅ Successful profiles ({len(results['successful'])}):")
        for profile in results['successful']:
            print(f"  - {profile}")
    
    if results['failed']:
        print(f"\n❌ Failed profiles ({len(results['failed'])}):")
        for profile in results['failed']:
            print(f"  - {profile}")
    
    if results['errors']:
        print(f"\n💥 Error profiles ({len(results['errors'])}):")
        for error_info in results['errors']:
            print(f"  - {error_info['profile']}: {error_info['error']}")
    
    return results


def load_urls_from_file(file_path):
    """Load LinkedIn profile identifiers from a JSON file"""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            
        # Handle different JSON structures
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and 'profiles' in data:
            return data['profiles']
        elif isinstance(data, dict) and 'urls' in data:
            return data['urls']
        else:
            print(f"❌ ERROR: Invalid JSON structure in {file_path}")
            print("Expected: ['profile1', 'profile2', ...] or {'profiles': ['profile1', 'profile2', ...]} or {'urls': ['profile1', 'profile2', ...]}")
            return []
            
    except FileNotFoundError:
        print(f"❌ ERROR: File not found: {file_path}")
        return []
    except json.JSONDecodeError as e:
        print(f"❌ ERROR: Invalid JSON in {file_path}: {str(e)}")
        return []


def main():
    parser = argparse.ArgumentParser(description='Test edge processing Lambda function')
    parser.add_argument('--user-sub', required=True, help='User sub (Cognito user ID)')
    
    # URL input options
    url_group = parser.add_mutually_exclusive_group(required=True)
    url_group.add_argument('--profiles', nargs='+', help='List of LinkedIn profile identifiers to process')
    url_group.add_argument('--profiles-file', help='JSON file containing LinkedIn profile identifiers')
    
    # Processing options
    parser.add_argument('--test-first', action='store_true', 
                       help='Test only the first profile before processing all')
    
    args = parser.parse_args()
    
    # Load profiles
    if args.profiles:
        linkedin_profiles = args.profiles
    else:
        linkedin_profiles = load_urls_from_file(args.profiles_file)
        if not linkedin_profiles:
            sys.exit(1)
    
    print(f"Loaded {len(linkedin_profiles)} LinkedIn profiles for processing")
    print(f"User Sub: {args.user_sub}")
    
    # Validate profiles (basic validation - just check they're not empty)
    valid_profiles = []
    for profile in linkedin_profiles:
        if profile and profile.strip():
            valid_profiles.append(profile.strip())
        else:
            print(f"⚠️  WARNING: Skipping empty profile identifier")
    
    if not valid_profiles:
        print("❌ ERROR: No valid LinkedIn profile identifiers found")
        sys.exit(1)
    
    linkedin_profiles = valid_profiles
    print(f"Processing {len(linkedin_profiles)} valid LinkedIn profiles")
    
    # Test processing
    if args.test_first and len(linkedin_profiles) > 1:
        print("\n🧪 Testing first profile before batch processing...")
        success = test_single_operation(linkedin_profiles[0], args.user_sub)
        
        if not success:
            print("\n❌ First profile test failed. Stopping batch processing.")
            sys.exit(1)
        
        print("\n✅ First profile test successful. Proceeding with remaining profiles...")
        remaining_profiles = linkedin_profiles[1:]
        if remaining_profiles:
            for profile in remaining_profiles:
                test_single_operation(profile, args.user_sub)
    else:
        # Process all profiles
        if len(linkedin_profiles) == 1:
            test_single_operation(linkedin_profiles[0], args.user_sub)
        else:
            for profile in linkedin_profiles:
                test_single_operation(profile, args.user_sub)


if __name__ == "__main__":
    main()
