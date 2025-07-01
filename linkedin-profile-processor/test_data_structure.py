#!/usr/bin/env python3
"""
Test script to demonstrate the DynamoDB data structure for LinkedIn profiles
"""

import uuid
import json
from datetime import datetime

def generate_sample_profile():
    """Generate a sample profile data structure"""
    
    # Generate a random UUID for the profile
    profile_id = str(uuid.uuid4())
    
    # Sample profile data
    profile_data = {
        # Primary Keys (for DynamoDB)
        'PK': profile_id,           # Partition Key: Random UUID
        'SK': 'PENDING',            # Sort Key: Status (default)
        
        # Profile attributes
        'first_name': 'John',
        'last_name': 'Doe',
        'position': 'Senior Software Engineer',
        'company': 'Tech Corp',
        'location': 'San Francisco, CA',
        'headline': 'Building scalable systems and leading engineering teams',
        'messages': 0,
        'date_added': datetime.now().strftime('%Y-%m-%d'),
        'linkedin_url': 'john-doe-engineer',
        'tags': ['software-engineering', 'cloud-architecture', 'team-leadership', 'python', 'aws'],
        'status': 'PENDING'
    }
    
    return profile_data

def demonstrate_queries():
    """Demonstrate different query patterns"""
    
    sample_profile = generate_sample_profile()
    
    print("=== Sample LinkedIn Profile Data Structure ===")
    print(json.dumps(sample_profile, indent=2))
    
    print("\n=== Query Examples ===")
    
    print("\n1. Get profile by ID and Status:")
    print(f"""
    dynamodb.get_item(
        TableName='linkedin-advanced-search',
        Key={{
            'PK': {{'S': '{sample_profile['PK']}'}},
            'SK': {{'S': '{sample_profile['SK']}'}}
        }}
    )
    """)
    
    print("\n2. Query by LinkedIn URL:")
    print(f"""
    dynamodb.query(
        TableName='linkedin-advanced-search',
        IndexName='LinkedInUrlIndex',
        KeyConditionExpression='linkedin_url = :url',
        ExpressionAttributeValues={{
            ':url': {{'S': '{sample_profile['linkedin_url']}'}}
        }}
    )
    """)
    
    print("\n3. Update profile status:")
    print(f"""
    dynamodb.update_item(
        TableName='linkedin-advanced-search',
        Key={{
            'PK': {{'S': '{sample_profile['PK']}'}},
            'SK': {{'S': 'PENDING'}}
        }},
        UpdateExpression='SET SK = :new_status, #status = :new_status',
        ExpressionAttributeNames={{
            '#status': 'status'
        }},
        ExpressionAttributeValues={{
            ':new_status': {{'S': 'CONTACTED'}}
        }}
    )
    """)

if __name__ == "__main__":
    demonstrate_queries()
