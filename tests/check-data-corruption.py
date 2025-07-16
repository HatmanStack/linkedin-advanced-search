#!/usr/bin/env python3
"""
Quick Data Corruption Check Script

Checks 10 random profiles from DynamoDB to identify data corruption issues
like malformed skills arrays or other JSON parsing problems.
"""

import boto3
import json
import random

# Configuration
DYNAMODB_TABLE = 'linkedin-advanced-search'
AWS_REGION = 'us-west-2'

def check_data_corruption():
    """Check random profiles for data corruption"""
    print("🔍 Checking 10 random profiles for data corruption...")
    print("=" * 60)
    
    # Initialize DynamoDB
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(DYNAMODB_TABLE)
    
    try:
        # Get all profile keys first
        response = table.scan(
            FilterExpression='begins_with(PK, :pk) AND SK = :sk',
            ExpressionAttributeValues={
                ':pk': 'PROFILE#',
                ':sk': '#METADATA'
            },
            ProjectionExpression='PK, #name',
            ExpressionAttributeNames={'#name': 'name'}
        )
        
        all_profiles = response.get('Items', [])
        print(f"📊 Total profiles found: {len(all_profiles)}")
        
        # Select 10 random profiles
        random_profiles = random.sample(all_profiles, min(10, len(all_profiles)))
        
        corruption_issues = []
        
        for i, profile_key in enumerate(random_profiles, 1):
            pk = profile_key['PK']
            name = profile_key.get('name', 'Unknown')
            
            print(f"\n{i}. Checking: {name} ({pk})")
            
            # Get full profile data
            full_response = table.get_item(Key={'PK': pk, 'SK': '#METADATA'})
            profile = full_response.get('Item', {})
            
            issues = check_profile_corruption(profile, name)
            if issues:
                corruption_issues.extend(issues)
        
        # Summary
        print("\n" + "=" * 60)
        print("📋 CORRUPTION CHECK SUMMARY")
        print("=" * 60)
        
        if corruption_issues:
            print(f"❌ Found {len(corruption_issues)} corruption issues:")
            for issue in corruption_issues:
                print(f"   • {issue}")
        else:
            print("✅ No corruption issues found in sampled profiles")
        
        return corruption_issues
        
    except Exception as e:
        print(f"❌ Error checking data corruption: {str(e)}")
        return []

def check_profile_corruption(profile, name):
    """Check a single profile for corruption issues"""
    issues = []
    
    print(f"   📄 Profile Data for {name}:")
    print(f"   {'='*50}")
    
    # Print all profile fields
    for key, value in profile.items():
        if key in ['PK', 'SK']:
            continue
        print(f"   {key}: {value}")
    
    print(f"   {'='*50}")
    
    # Check skills field
    skills = profile.get('skills', [])
    if isinstance(skills, list):
        for skill in skills:
            if isinstance(skill, str):
                # Check for malformed JSON strings
                if any(char in skill for char in ['{', '}', '"S"', '"L"', '"M"']):
                    issues.append(f"{name}: Malformed skill entry: {skill[:50]}...")
                # Check for very long skill entries (likely corruption)
                elif len(skill) > 100:
                    issues.append(f"{name}: Suspiciously long skill: {skill[:50]}...")
            else:
                issues.append(f"{name}: Non-string skill entry: {type(skill)}")
    else:
        issues.append(f"{name}: Skills field is not a list: {type(skills)}")
    
    # Check work experience
    work_exp = profile.get('workExperience', [])
    if isinstance(work_exp, list):
        for i, job in enumerate(work_exp):
            if not isinstance(job, dict):
                issues.append(f"{name}: Work experience entry {i} is not a dict: {type(job)}")
            else:
                # Check for required fields
                for field in ['company', 'title']:
                    if field not in job or not isinstance(job[field], str):
                        issues.append(f"{name}: Work experience {i} missing/invalid {field}")
    else:
        issues.append(f"{name}: Work experience is not a list: {type(work_exp)}")
    
    # Check education
    education = profile.get('education', [])
    if isinstance(education, list):
        for i, edu in enumerate(education):
            if not isinstance(edu, dict):
                issues.append(f"{name}: Education entry {i} is not a dict: {type(edu)}")
    else:
        issues.append(f"{name}: Education is not a list: {type(education)}")
    
    # Check for missing critical fields
    critical_fields = ['name', 'headline', 'currentCompany', 'currentTitle']
    for field in critical_fields:
        if field not in profile:
            issues.append(f"{name}: Missing critical field: {field}")
        elif not isinstance(profile[field], str):
            issues.append(f"{name}: Field {field} is not a string: {type(profile[field])}")
    
    # Check fulltext field
    fulltext = profile.get('fulltext', '')
    if not isinstance(fulltext, str):
        issues.append(f"{name}: Fulltext is not a string: {type(fulltext)}")
    elif len(fulltext) < 10:
        issues.append(f"{name}: Fulltext suspiciously short: {len(fulltext)} chars")
    
    return issues

if __name__ == "__main__":
    issues = check_data_corruption()
    exit(0 if not issues else 1)
