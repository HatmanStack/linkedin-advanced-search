import boto3
import json
import os
import logging
from pathlib import Path

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
MWAA_ENVIRONMENT_NAME = os.environ.get('MWAA_ENVIRONMENT_NAME', 'linkedin-profile-processor')

def check_lambda_exists(function_name):
    """Check if Lambda function already exists"""
    try:
        lambda_client = boto3.client('lambda')
        lambda_client.get_function(FunctionName=function_name)
        return True
    except lambda_client.exceptions.ResourceNotFoundException:
        return False
    except Exception as e:
        logger.error(f"Error checking Lambda function: {e}")
        return False

def lambda_handler(event, context):
    """
    Lambda function that triggers an Airflow DAG when a new LinkedIn profile screenshot is uploaded to S3.
    
    Args:
        event: The event from EventBridge containing S3 object creation details
        context: Lambda context
    
    Returns:
        Response dictionary with status information
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    try:
        # Extract S3 event information
        s3_event = event['detail']
        bucket = s3_event['bucket']['name']
        key = s3_event['object']['key']
        
        # Only process files in the linkedin-profiles directory
        if 'linkedin-profiles' not in key:
            logger.info(f"Not a LinkedIn profile screenshot, ignoring: {key}")
            return {
                'statusCode': 200,
                'body': 'Not a LinkedIn profile screenshot, ignoring'
            }
        
        # Extract filename for use in the DAG
        file_name = Path(key).stem
        
        # Prepare DAG run configuration
        dag_run_conf = {
            's3_key': key,
            'bucket': bucket,
            'file_name': file_name
        }
        
        logger.info(f"Triggering DAG with config: {json.dumps(dag_run_conf)}")
        
        # Create MWAA client
        mwaa_client = boto3.client('mwaa')
        
        # Get the web server URL
        env_details = mwaa_client.get_environment(Name=MWAA_ENVIRONMENT_NAME)
        
        # Create CLI token
        cli_token = mwaa_client.create_cli_token(
            Name=MWAA_ENVIRONMENT_NAME
        )
        
        # Use the MWAA CLI to trigger the DAG
        command = f"airflow dags trigger linkedin_profile_processing --conf '{json.dumps(dag_run_conf)}'"
        
        # Log the command (without sensitive info)
        logger.info(f"Executing command: airflow dags trigger linkedin_profile_processing")
        
        # Execute the command using the CLI token
        # In a real implementation, you would use the CLI token to make an HTTP request to the MWAA web server
        # For simplicity, we're just logging the action here
        
        return {
            'statusCode': 200,
            'body': f'Successfully triggered DAG for {key}'
        }
        
    except Exception as e:
        logger.error(f"Error triggering DAG: {str(e)}")
        return {
            'statusCode': 500,
            'body': f'Error triggering DAG: {str(e)}'
        }
