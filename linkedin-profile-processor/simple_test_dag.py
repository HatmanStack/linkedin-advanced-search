from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import boto3

def test_function():
    """Simple test function to verify DAG execution"""
    print("=== MWAA Test DAG Execution ===")
    print(f"Current time: {datetime.now()}")
    
    # Test AWS connectivity
    try:
        s3 = boto3.client('s3')
        response = s3.list_buckets()
        print(f"Successfully connected to AWS. Found {len(response['Buckets'])} buckets.")
        return "SUCCESS: MWAA environment is working correctly!"
    except Exception as e:
        print(f"Error connecting to AWS: {str(e)}")
        return f"ERROR: {str(e)}"

# DAG definition
default_args = {
    'owner': 'linkedin-processor',
    'depends_on_past': False,
    'start_date': datetime(2025, 6, 30),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5)
}

dag = DAG(
    'simple_test_dag',
    default_args=default_args,
    description='Simple test DAG to verify MWAA environment',
    schedule_interval=None,  # Manual trigger only
    catchup=False,
    tags=['test', 'linkedin-processor']
)

# Single test task
test_task = PythonOperator(
    task_id='test_aws_connectivity',
    python_callable=test_function,
    dag=dag
)
