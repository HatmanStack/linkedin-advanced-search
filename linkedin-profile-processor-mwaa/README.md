# LinkedIn Profile Processor - MWAA Deployment

## Purpose

This deployment creates an Amazon MWAA (Managed Workflows for Apache Airflow) environment that processes LinkedIn profile screenshots using:

- **Amazon Textract** - Extract text from screenshots
- **Amazon Bedrock** - Parse profiles using Claude AI models
- **Amazon DynamoDB** - Store structured profile data
- **Amazon S3** - Store screenshots and generated markdown files

## Architecture

- **Airflow 2.10.3** with boto3 1.35.36 (Bedrock compatible)
- **Enhanced IAM permissions** for DynamoDB, Bedrock, Textract, and S3
- **VPC-based deployment** with public/private subnets
- **Configurable security** with restricted access options

## Prerequisites

- AWS CLI configured with appropriate permissions
- S3 bucket for MWAA artifacts (created automatically)
- DynamoDB table: `linkedin-advanced-search`
- S3 bucket for screenshots: `linkedin-advanced-search-screenshots-2024`

## Deployment

### 1. Deploy Environment

```bash
./deploy.sh
```

This will:
- Create VPC, subnets, and security groups
- Deploy MWAA environment with Airflow 2.10.3
- Configure IAM roles with required permissions
- Upload DAGs and requirements to S3

### 2. Configure Claude Model

Edit the DAG file and set your preferred model:

```python
# In dags/linkedin_profile_processing_dag.py
CLAUDE_MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
```

Available models:
- `us.anthropic.claude-3-5-sonnet-20241022-v2:0` (recommended)
- `us.anthropic.claude-3-5-haiku-20241022-v1:0` (faster/cheaper)
- `anthropic.claude-3-5-sonnet-20240620-v1:0` (fallback)

### 3. Upload Updated DAG

```bash
aws s3 cp dags/linkedin_profile_processing_dag.py \
    s3://linkedin-profile-processor-631094035453-us-west-2/dags/
```

## Security Configuration

### Restrict Airflow UI Access

By default, the Airflow UI is accessible from the internet. To restrict access:

#### Option 1: Restrict by IP Address

Get the security group ID:
```bash
aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=*linkedin-profile-processor*" \
    --query 'SecurityGroups[0].GroupId' --output text
```

Remove public access:
```bash
aws ec2 revoke-security-group-ingress \
    --group-id sg-YOUR-SECURITY-GROUP-ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0
```

Add your IP address:
```bash
aws ec2 authorize-security-group-ingress \
    --group-id sg-YOUR-SECURITY-GROUP-ID \
    --protocol tcp \
    --port 443 \
    --cidr YOUR.IP.ADDRESS/32
```

#### Option 2: Make Private Only

Update the environment to private access:
```bash
aws mwaa update-environment \
    --name linkedin-profile-processor \
    --webserver-access-mode PRIVATE_ONLY \
    --region us-west-2
```

**Note**: With PRIVATE_ONLY, you'll need VPN or bastion host access.

## Usage

### Trigger DAG via UI

1. Access Airflow UI using the URL from deployment output
2. Find `linkedin_profile_processing` DAG
3. Click "Trigger DAG" 
4. Fill in the form:
   - **s3_key**: Path to screenshot (e.g., `screenshots/profile.png`)
   - **bucket**: S3 bucket name (default: `linkedin-advanced-search-screenshots-2024`)
   - **file_name**: Output name (e.g., `john-doe-profile`)

### Trigger DAG via CLI

```bash
# Get CLI token
aws mwaa create-cli-token --name linkedin-profile-processor --region us-west-2

# Trigger with config
aws mwaa create-web-login-token --name linkedin-profile-processor --region us-west-2
```

## Monitoring

### CloudWatch Logs

Monitor DAG execution in CloudWatch log groups:
- `airflow-linkedin-profile-processor-DAGProcessing`
- `airflow-linkedin-profile-processor-Task`
- `airflow-linkedin-profile-processor-Worker`

### DynamoDB

Check processed profiles in the `linkedin-advanced-search` table:
```bash
aws dynamodb scan --table-name linkedin-advanced-search --limit 10
```

## Troubleshooting

### Common Issues

1. **Model not found**: Verify Claude model ID is correct
2. **Permission denied**: Check IAM role has required permissions
3. **S3 access denied**: Verify bucket exists and permissions are correct
4. **Textract failed**: Check S3 object exists and is accessible

### Debug Commands

Check environment status:
```bash
aws mwaa get-environment --name linkedin-profile-processor --region us-west-2
```

List S3 objects:
```bash
aws s3 ls s3://linkedin-profile-processor-631094035453-us-west-2/ --recursive
```

Check IAM role policies:
```bash
aws iam list-role-policies --role-name linkedin-profile-processor-simple-MWAAExecutionRole-*
```

## Cleanup

### Delete Environment

```bash
aws cloudformation delete-stack \
    --stack-name linkedin-profile-processor-mwaa \
    --region us-west-2
```

### Delete S3 Objects (Optional)

```bash
aws s3 rm s3://linkedin-profile-processor-631094035453-us-west-2/ --recursive
```

**Warning**: This will delete all DAGs, the processed files will remain in the screenshots bucket

## Cost Optimization

- **MWAA Environment**: ~$13-15/day (continuous)
- **Claude 3.5 Sonnet**: ~$3 per 1M tokens
- **Claude 3.5 Haiku**: ~$0.25 per 1M tokens
- **Textract**: ~$1.50 per 1K pages

To minimize costs:
1. Use Claude 3.5 Haiku for basic processing
2. Delete environment when not in use
3. Monitor CloudWatch costs for log retention

## Files

- `deploy.sh` - Main deployment script
- `mwaa-complete-template-v2.yaml` - CloudFormation template
- `requirements.txt` - Python dependencies for Airflow 2.10.3
- `dags/linkedin_profile_processing_dag.py` - Main processing DAG
- `lambda_trigger.py` - Optional Lambda trigger (not deployed by default)
- `trigger_dag.py` - Manual DAG trigger script
