#!/usr/bin/env python3
"""
Test script to process existing files in S3 bucket using the Lambda function locally with SQS events.

This script:
1. Lists existing Profile files in the S3 bucket (most recent per directory)
2. Creates mock SQS events with profile directory paths
3. Tests processing one file first
4. If successful, processes all remaining files
5. Reports results and any errors

Usage:
    python test_existing_files.py [--bucket BUCKET_NAME] [--prefix PREFIX]
"""

import boto3
import json
import sys
import argparse
from datetime import datetime
from lambda_function import lambda_handler

# Configuration
DEFAULT_BUCKET = "linkedin-advanced-search-screenshots-2024"
DEFAULT_PREFIX = "linkedin-profiles/"
AWS_REGION = "us-west-2"

FAILED_DIRECTORIES = [
    "linkedin-profiles/aden-abiye-cpa-26663635",
    "linkedin-profiles/agajula97",
    "linkedin-profiles/allenchan",
    "linkedin-profiles/amanimansour92",
    "linkedin-profiles/annthurium",
    "linkedin-profiles/antonio-guzman",
    "linkedin-profiles/anuraagkonda",
    "linkedin-profiles/anusha-t-b777a9148",
    "linkedin-profiles/aparna-venkataraman-30b13621",
    "linkedin-profiles/azmath-begum-55429b291",
    "linkedin-profiles/bhupindersidana",
    "linkedin-profiles/brian-angulo-63308a16b",
    "linkedin-profiles/chandragudimetla",
    "linkedin-profiles/danielopincariu",
    "linkedin-profiles/daveklein19",
    "linkedin-profiles/david-poliakoff-86663223",
    "linkedin-profiles/dileeshk",
    "linkedin-profiles/dimitrikourouniotis",
    "linkedin-profiles/dotnetgirl",
    "linkedin-profiles/elias-scarborough-0261a7b0",
    "linkedin-profiles/eliott-nicholson-35739630",
    "linkedin-profiles/faria-khalid-68b7a858",
    "linkedin-profiles/gilliankbruce",
    "linkedin-profiles/gregvanpelt",
    "linkedin-profiles/gunnargissel",
    "linkedin-profiles/haakonhestness",
    "linkedin-profiles/hanna-koh",
    "linkedin-profiles/haringummidi",
    "linkedin-profiles/hitesh-j-b976106",
    "linkedin-profiles/holly-schilling-aabb4272",
    "linkedin-profiles/jaepaek",
    "linkedin-profiles/jamielangskov",
    "linkedin-profiles/jani-syed-18sy",
    "linkedin-profiles/jcolemorrison",
    "linkedin-profiles/jeff-miller-a4538",
    "linkedin-profiles/johnathan-guzman",
    "linkedin-profiles/josiaho",
    "linkedin-profiles/judithyeo",
    "linkedin-profiles/justincastilla",
    "linkedin-profiles/karthikkonagani",
    "linkedin-profiles/kelly-p-rankin",
    "linkedin-profiles/kinga-kimbrel",
    "linkedin-profiles/kosinova",
    "linkedin-profiles/krishnamitta",
    "linkedin-profiles/krunal-shah-5108331710",
    "linkedin-profiles/kushalhshah1",
    "linkedin-profiles/laxmi-harika-bibireddy-95496a1a0",
    "linkedin-profiles/mangalampallykireeti",
    "linkedin-profiles/matthew-powers-cfa",
    "linkedin-profiles/micah-h-11333b56",
    "linkedin-profiles/mkfahaduddin",
    "linkedin-profiles/mollahosseini",
    "linkedin-profiles/mrinal-ranjan",
    "linkedin-profiles/nagarjuna-reddy-5019071a8",
    "linkedin-profiles/namrathagangaraju17",
    "linkedin-profiles/naveed-akhtar-26ba15",
    "linkedin-profiles/navya-bonthu-a569781a3",
    "linkedin-profiles/nikita-zamwar",
    "linkedin-profiles/nithin-thampi-81443434",
    "linkedin-profiles/p-bharath-562248bb",
    "linkedin-profiles/paultikhomirov",
    "linkedin-profiles/pavan-kumar-komaravolu-01786b29",
    "linkedin-profiles/praveena-i-722954bb",
    "linkedin-profiles/rag28",
    "linkedin-profiles/rajagopal-kathem",
    "linkedin-profiles/rajensanjanwala",
    "linkedin-profiles/rajesh-badugula-4ab24a196",
    "linkedin-profiles/ramanshakya",
    "linkedin-profiles/reddy5679",
    "linkedin-profiles/reneemacdonald",
    "linkedin-profiles/rob-driskill-2580356",
    "linkedin-profiles/romilgadia",
    "linkedin-profiles/sabbirmanandhar",
    "linkedin-profiles/sai-prakash-reddy-0a7143136",
    "linkedin-profiles/saideepraomarru",
    "linkedin-profiles/sanjanaagarw",
    "linkedin-profiles/sanket-m-salunke",
    "linkedin-profiles/sarimzaidis",
    "linkedin-profiles/sergeyvystoropskyi",
    "linkedin-profiles/shachikshah",
    "linkedin-profiles/shahaayush24",
    "linkedin-profiles/shahkaushalb",
    "linkedin-profiles/sidd-j",
    "linkedin-profiles/sirivallimeenakshi",
    "linkedin-profiles/skilbeck",
    "linkedin-profiles/songtao-steven-leng",
    "linkedin-profiles/sophiamyang",
    "linkedin-profiles/sri-charani-gali-16b6827b",
    "linkedin-profiles/srilakshmi-m-6b9a698b",
    "linkedin-profiles/sujatha-s-43bb5221",
    "linkedin-profiles/sumanth-moturi-1a875a192",
    "linkedin-profiles/suresh-murakonda",
    "linkedin-profiles/swarajranga",
    "linkedin-profiles/synedra",
    "linkedin-profiles/szaske",
    "linkedin-profiles/tanya-romankova-2a59803",
    "linkedin-profiles/taylor-krusen",
    "linkedin-profiles/ted-dooley-3594a1a",
    "linkedin-profiles/thirupathi-pattipaka-b04a4a31",
    "linkedin-profiles/thomas-lomas-05630133",
    "linkedin-profiles/timothyjreynolds",
    "linkedin-profiles/tom-crebs-9313b02",
    "linkedin-profiles/vamshi-gunti-357551122",
    "linkedin-profiles/vardhan-d-a578892b4",
    "linkedin-profiles/viganosimone",
    "linkedin-profiles/wangrachelr",
    "linkedin-profiles/yamini-gade-162a70281",
]

def list_profile_directories(bucket_name, prefix=""):
    """List directories that contain Profile files"""
    try:
        s3_client = boto3.client('s3', region_name=AWS_REGION)
        
        paginator = s3_client.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(
            Bucket=bucket_name,
            Prefix=prefix
        )
        
        # Group files by directory
        directories = {}
        
        for page in page_iterator:
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    
                    # Skip directories and non-image files
                    if key.endswith('/'):
                        continue
                    
                    # Only process files with "Profile" in the name
                    filename = key.split('/')[-1]
                    if 'Profile' not in filename:
                        continue
                        
                    # Only process image files
                    if not (key.lower().endswith('.png') or key.lower().endswith('.jpg') or key.lower().endswith('.jpeg')):
                        continue
                    
                    # Extract directory (person's folder)
                    parts = key.split('/')
                    if len(parts) >= 2:
                        directory = '/'.join(parts[:-1])  # Everything except filename
                        
                        if directory not in directories:
                            directories[directory] = []
                        
                        directories[directory].append({
                            'key': key,
                            'size': obj['Size'],
                            'last_modified': obj['LastModified']
                        })
        
        # For each directory, find the most recent Profile file
        directory_info = []
        for directory, files in directories.items():
            if files:
                # Sort by last_modified, most recent first
                files.sort(key=lambda x: x['last_modified'], reverse=True)
                latest_file = files[0]
                
                directory_info.append({
                    'directory': directory,
                    'latest_file': latest_file['key'],
                    'file_count': len(files),
                    'last_modified': latest_file['last_modified'],
                    'size': latest_file['size']
                })
        
        # Sort by directory name for consistent ordering
        directory_info.sort(key=lambda x: x['directory'])
        
        return directory_info
        
    except Exception as e:
        print(f"Error listing S3 directories: {str(e)}")
        return []

def create_mock_sqs_event(bucket_name, profile_directory):
    """Create a mock SQS event for testing the Lambda function"""
    message_body = {
        "bucket": bucket_name,
        "profile_directory": profile_directory
    }
    
    return {
        "Records": [
            {
                "messageId": "test-message-id",
                "receiptHandle": "test-receipt-handle",
                "body": json.dumps(message_body),
                "attributes": {
                    "ApproximateReceiveCount": "1",
                    "SentTimestamp": str(int(datetime.utcnow().timestamp() * 1000)),
                    "SenderId": "test-sender",
                    "ApproximateFirstReceiveTimestamp": str(int(datetime.utcnow().timestamp() * 1000))
                },
                "messageAttributes": {},
                "md5OfBody": "test-md5",
                "eventSource": "aws:sqs",
                "eventSourceARN": "arn:aws:sqs:us-west-2:123456789012:test-queue",
                "awsRegion": AWS_REGION
            }
        ]
    }

def test_lambda_on_directory(bucket_name, profile_directory):
    """Test the Lambda function on a specific profile directory"""
    try:
        print(f"\n{'='*80}")
        print(f"Processing directory: s3://{bucket_name}/{profile_directory}")
        print(f"{'='*80}")
        
        # Configure logging to show Lambda logs in test
        import logging
        logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
        
        # Create mock SQS event
        event = create_mock_sqs_event(bucket_name, profile_directory)
        context = {}  # Mock context
        
        # Call the Lambda function
        result = lambda_handler(event, context)
        
        if result['statusCode'] == 200:
            print("✅ SUCCESS")
            print(f"Response: {result['body']}")
        else:
            print("❌ FAILED")
            print(f"Error: {result['body']}")
            
        return result['statusCode'] == 200
        
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function"""
    parser = argparse.ArgumentParser(description='Test Lambda function on existing Profile directories')
    parser.add_argument('--bucket', default=DEFAULT_BUCKET, help='S3 bucket name')
    parser.add_argument('--prefix', default=DEFAULT_PREFIX, help='S3 prefix to filter files')
    parser.add_argument('--directory', help='Process a specific profile directory')
    parser.add_argument('--dry-run', action='store_true', help='List directories without processing')
    
    args = parser.parse_args()
    
    print(f"LinkedIn Profile Processing Test (SQS Mode)")
    print(f"Bucket: {args.bucket}")
    print(f"Prefix: {args.prefix}")
    print(f"Region: {AWS_REGION}")
    print(f"Filter: Directories with Profile files (most recent per directory)")
    
    if args.directory:
        # Process single directory
        print(f"\nProcessing single directory: {args.directory}")
        success = test_lambda_on_directory(args.bucket, args.directory)
        sys.exit(0 if success else 1)
    
   # Use the static list of failed directories
    directories = [{'directory': d} for d in FAILED_DIRECTORIES]

    if not directories:
        print("No failed directories found to process.")
        return

    print(f"\nFound {len(directories)} failed directories to process")
    
    if args.dry_run:
        print("Dry run complete. Use --directory <path> to process a specific directory.")
        return
    
    if not directories:
        print("No directories to process.")
        return
    
    # Test with first directory
    print(f"🧪 TESTING WITH FIRST DIRECTORY")
    print(f"Testing with: {directories[0]['directory']}")
    
    first_success = test_lambda_on_directory(args.bucket, directories[0]['directory'])
    
    if not first_success:
        print(f"\n❌ First directory test failed. Stopping here.")
        print(f"Fix the issues and try again.")
        sys.exit(1)
    
    print(f"\n✅ First directory test successful!")
    
    if len(directories) == 1:
        print("Only one directory to process. Test complete!")
        return
    
    # Confirm processing remaining directories
    remaining_count = len(directories) - 1
    response = input(f"\nProcess remaining {remaining_count} directories? (y/N): ")
    if response.lower() != 'y':
        print("Cancelled. First directory was processed successfully.")
        return
    
    # Process remaining directories
    print(f"\nProcessing remaining {remaining_count} directories...")
    results = {
        'success': 1,  # First directory already succeeded
        'failed': 0,
        'errors': []
    }
    
    for i, dir_info in enumerate(directories[1:], 2):  # Start from second directory
        print(f"\n[{i}/{len(directories)}] Processing {dir_info['directory']}")
        
        try:
            success = test_lambda_on_directory(args.bucket, dir_info['directory'])
            if success:
                results['success'] += 1
            else:
                results['failed'] += 1
                results['errors'].append(dir_info['directory'])
        except KeyboardInterrupt:
            print("\n\nProcessing interrupted by user.")
            break
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            results['failed'] += 1
            results['errors'].append(f"{dir_info['directory']}: {str(e)}")
    
    # Print summary
    print(f"\n{'='*80}")
    print(f"PROCESSING SUMMARY")
    print(f"{'='*80}")
    print(f"Total directories: {len(directories)}")
    print(f"Successful: {results['success']}")
    print(f"Failed: {results['failed']}")
    
    if results['errors']:
        print(f"\nFailed directories:")
        for error in results['errors']:
            print(f"  - {error}")

if __name__ == "__main__":
    main()
