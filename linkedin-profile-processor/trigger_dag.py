#!/usr/bin/env python3
"""
Script to trigger MWAA DAG using proper authentication
"""
import boto3
import requests
import json
import sys
from datetime import datetime

def trigger_dag():
    """Trigger the LinkedIn profile processing DAG"""
    
    # MWAA environment name
    environment_name = "linkedin-profile-processor"
    
    try:
        # Create MWAA client
        mwaa_client = boto3.client('mwaa', region_name='us-west-2')
        
        # Get CLI token
        print("Getting MWAA CLI token...")
        token_response = mwaa_client.create_cli_token(Name=environment_name)
        cli_token = token_response['CliToken']
        webserver_hostname = token_response['WebServerHostname']
        
        print(f"Webserver: {webserver_hostname}")
        
        # DAG configuration
        dag_config = {
            "s3_key": "linkedin-profiles/harini-parthasarathy-9037212/2025-06-20T22-41-18_171Z-part-0-7d332d01-faf7-4c70-8c92-1de8b93c80c2.png",
            "bucket": "linkedin-advanced-search-screenshots-2024",
            "file_name": "harini-parthasarathy-test"
        }
        
        # Create DAG run payload
        dag_run_id = f"test_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        payload = {
            "conf": dag_config,
            "dag_run_id": dag_run_id
        }
        
        # Make API request
        url = f"https://{webserver_hostname}/api/v1/dags/linkedin_profile_processing/dagRuns"
        headers = {
            "Authorization": f"Bearer {cli_token}",
            "Content-Type": "application/json"
        }
        
        print(f"Triggering DAG with run ID: {dag_run_id}")
        print(f"URL: {url}")
        
        response = requests.post(url, headers=headers, json=payload)
        
        print(f"Response status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ DAG triggered successfully!")
            return True
        else:
            print(f"❌ Failed to trigger DAG: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def check_dag_status():
    """Check if DAGs are visible in MWAA"""
    
    environment_name = "linkedin-profile-processor"
    
    try:
        # Create MWAA client
        mwaa_client = boto3.client('mwaa', region_name='us-west-2')
        
        # Get CLI token
        token_response = mwaa_client.create_cli_token(Name=environment_name)
        cli_token = token_response['CliToken']
        webserver_hostname = token_response['WebServerHostname']
        
        # Check DAGs
        url = f"https://{webserver_hostname}/api/v1/dags"
        headers = {
            "Authorization": f"Bearer {cli_token}",
            "Content-Type": "application/json"
        }
        
        print(f"Checking DAGs at: {url}")
        response = requests.get(url, headers=headers)
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            dags_data = response.json()
            print(f"Found {len(dags_data.get('dags', []))} DAGs")
            
            # Look for our DAGs
            our_dags = [dag for dag in dags_data.get('dags', []) 
                       if 'linkedin' in dag.get('dag_id', '').lower()]
            
            if our_dags:
                print("✅ Found LinkedIn DAGs:")
                for dag in our_dags:
                    print(f"  - {dag['dag_id']}: {dag.get('is_active', 'unknown')}")
            else:
                print("❌ No LinkedIn DAGs found")
                
        else:
            print(f"❌ Failed to get DAGs: {response.text}")
            
    except Exception as e:
        print(f"❌ Error checking DAGs: {str(e)}")

if __name__ == "__main__":
    print("=== MWAA DAG Management ===")
    
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        check_dag_status()
    else:
        # First check DAGs
        print("1. Checking DAG status...")
        check_dag_status()
        
        print("\n2. Triggering DAG...")
        trigger_dag()
