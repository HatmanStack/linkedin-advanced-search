# Lambda Shared Utilities

This directory contains shared code for all Lambda functions to reduce duplication and ensure consistency.

## Structure

```
shared/
├── python/                      # Shared Python code
│   ├── utils/                   # Common utilities
│   │   ├── __init__.py
│   │   └── response_builder.py # Standardized response building
│   ├── aws_clients/            # AWS client factories
│   │   └── __init__.py
│   └── config/                  # Shared configuration
│       ├── __init__.py
│       └── aws_config.py        # AWS resource names
│
└── nodejs/                      # Shared Node.js code
    ├── utils/                   # Common utilities
    └── config/                  # Shared configuration
```

## Usage

### Python Lambda Functions

**Response Building:**
```python
from shared.python.utils.response_builder import build_success_response, build_error_response

def lambda_handler(event, context):
    try:
        # Business logic
        data = {'message': 'Success'}
        return build_success_response(data)
    except Exception as e:
        return build_error_response(str(e), status_code=500)
```

**AWS Configuration:**
```python
from shared.python.config.aws_config import CONNECTIONS_TABLE, PROFILES_TABLE

# Use in your code
table_name = CONNECTIONS_TABLE
```

## Benefits

- **Consistency**: All Lambda functions use the same response format
- **DRY**: Common code is defined once
- **Maintainability**: Changes to shared code affect all functions
- **Testing**: Easier to test with standardized interfaces
