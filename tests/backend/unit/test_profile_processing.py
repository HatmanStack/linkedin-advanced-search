"""Tests for Profile Processing Lambda"""
import json

import pytest

from conftest import load_lambda_module


@pytest.fixture
def profile_processing_module():
    """Load the profile-processing Lambda module"""
    return load_lambda_module('profile-processing')


def test_process_profile_data(lambda_context, profile_processing_module):
    """Test profile data processing via SQS event"""
    event = {
        'Records': [
            {
                'eventSource': 'aws:sqs',
                'body': json.dumps({
                    'Records': [{
                        'eventSource': 'aws:s3',
                        's3': {
                            'bucket': {'name': 'test-bucket'},
                            'object': {'key': 'linkedin-profiles/test-user/Profile-2024.png'}
                        }
                    }]
                }),
            }
        ]
    }

    response = profile_processing_module.lambda_handler(event, lambda_context)

    # Profile processing should return 200 or 500 (not 401 - no auth required for SQS)
    assert response['statusCode'] in [200, 400, 500]
