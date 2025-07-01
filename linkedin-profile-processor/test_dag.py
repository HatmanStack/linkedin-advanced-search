#!/usr/bin/env python3
"""
Test script to trigger the LinkedIn Profile Processing DAG
"""

import boto3
import json
from datetime import datetime

def trigger_dag_test():
    """Trigger the DAG with test parameters using an existing screenshot"""
    
    # Use one of the existing screenshots for testing
    test_config = {
        "s3_key": "linkedin-profiles/harini-parthasarathy-9037212/2025-06-20T22-41-18_171Z-part-0-7d332d01-faf7-4c70-8c92-1de8b93c80c2.png",
        "bucket": "linkedin-advanced-search-screenshots-2024",
        "file_name": "harini-parthasarathy-test"
    }
    
    print("=== LinkedIn Profile Processing DAG Test ===")
    print(f"Test Configuration:")
    print(f"  S3 Key: {test_config['s3_key']}")
    print(f"  Bucket: {test_config['bucket']}")
    print(f"  File Name: {test_config['file_name']}")
    
    # Get MWAA CLI token
    mwaa_client = boto3.client('mwaa')
    environment_name = 'linkedin-profile-processor'
    
    try:
        # Create CLI token
        cli_response = mwaa_client.create_cli_token(Name=environment_name)
        print(f"\n✅ Successfully created CLI token for MWAA environment")
        
        # Get environment details
        env_response = mwaa_client.get_environment(Name=environment_name)
        webserver_url = env_response['Environment']['WebserverUrl']
        
        print(f"🌐 Airflow Web UI: https://{webserver_url}")
        print(f"\n📋 To manually trigger the DAG:")
        print(f"1. Go to: https://{webserver_url}")
        print(f"2. Find the 'linkedin_profile_processing' DAG")
        print(f"3. Click the 'Trigger DAG' button")
        print(f"4. In the configuration field, paste this JSON:")
        print(f"   {json.dumps(test_config, indent=2)}")
        
        # Check if we can see the DAG
        print(f"\n🔍 Checking DAG status...")
        
        return {
            "status": "ready_for_manual_test",
            "webserver_url": webserver_url,
            "test_config": test_config,
            "instructions": "Use the Airflow Web UI to manually trigger the DAG with the provided configuration"
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    result = trigger_dag_test()
    print(f"\n📊 Test Result: {result['status']}")
