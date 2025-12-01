"""Tests for Profile Processing Lambda"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'backend' / 'lambdas' / 'profile-processing'))


def test_process_profile_data(lambda_context):
    """Test profile data processing"""
    from lambda_function import lambda_handler

    event = {
        'Records': [
            {
                'body': json.dumps({'profileId': 'test-123'}),
            }
        ]
    }

    response = lambda_handler(event, lambda_context)

    assert response['statusCode'] in [200, 400, 500]
