# Vulture whitelist for Lambda functions
# These are false positives that should be ignored

# Lambda handler signatures require 'context' parameter even when unused
# See: https://docs.aws.amazon.com/lambda/latest/dg/python-handler.html
context  # noqa: F821

# Lambda handler function names (entry points)
lambda_handler  # noqa: F821
handler  # noqa: F821

# pytest fixtures (if using pytest)
# Add any fixture names here that appear as unused
