### LLM Endpoint (Python 3.12)

Mimics the `edge-endpoint` JWT/authorizer handling. You can implement core LLM logic in `lambda_function.py`.

- Runtime: Python 3.12
- Entry: `lambda_function.lambda_handler`
- Deps: see `requirements.txt`

#### Event contract
- Expects API Gateway proxy event
- Extracts user id from `requestContext.authorizer.claims.sub`
- Falls back to `'test-user-id'` when an `Authorization` header is present (for local testing)

#### Response
- JSON with standard API headers and CORS

#### Next steps
- Implement your LLM logic where indicated in `lambda_function.py`.


