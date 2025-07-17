# Pinecone Search Lambda Function Tests

This directory contains comprehensive tests for the Pinecone Search Lambda function located in `lambda-processing/pinecone-search/`.

## Test Files

### `pinecone-search-lambda.test.js`
The main test file containing comprehensive Jest-based tests covering:

- **CORS Preflight Handling**: Tests OPTIONS request handling
- **JWT Token Validation**: Tests authentication and user extraction
- **Request Validation**: Tests input validation and error handling
- **User Connection Filtering**: Tests DynamoDB integration for user connections
- **Query Optimization**: Tests AWS Nova integration for query enhancement
- **Pinecone Search Integration**: Tests vector search functionality
- **Response Formatting**: Tests API response structure
- **Advanced Filtering**: Tests metadata filtering capabilities
- **Edge Cases and Error Handling**: Tests error scenarios and edge cases

### `run-pinecone-search-tests.js`
A simplified test runner that can execute basic validation tests without requiring Jest installation.

## Running the Tests

### Option 1: Full Test Suite with Jest (Recommended)

1. **Install Jest** (if not already installed):
   ```bash
   npm install --save-dev jest
   ```

2. **Run the comprehensive test suite**:
   ```bash
   npx jest tests/pinecone-search-lambda.test.js
   ```

3. **Run with coverage**:
   ```bash
   npx jest tests/pinecone-search-lambda.test.js --coverage
   ```

4. **Run in watch mode** (for development):
   ```bash
   npx jest tests/pinecone-search-lambda.test.js --watch
   ```

### Option 2: Basic Test Runner (No Dependencies)

1. **Run the basic test runner**:
   ```bash
   node tests/run-pinecone-search-tests.js
   ```

This provides basic validation without requiring Jest installation.

## Test Coverage

The test suite covers the following aspects of the Lambda function:

### 🔐 Authentication & Authorization
- JWT token validation and parsing
- User ID extraction from Cognito tokens
- Authorization header handling (case-insensitive)
- Error handling for invalid/missing tokens

### 📝 Request Processing
- JSON body parsing and validation
- Query parameter validation
- Limit validation and enforcement
- Filter parameter processing

### 🔍 Search Functionality
- Query preprocessing and normalization
- AWS Nova query optimization integration
- Pinecone vector search execution
- Search result reranking
- Metadata filtering (company, location, skills, title)

### 👥 User Connection Management
- DynamoDB integration for user connections
- Profile filtering based on user relationships
- Empty connection handling
- Connection query error handling

### 📊 Response Handling
- Response formatting and structure
- CORS header configuration
- Error response formatting
- Query timing measurement

### 🚨 Error Scenarios
- Network failures (DynamoDB, Pinecone, Bedrock)
- Invalid input data
- Empty search results
- Service unavailability
- Malformed responses

## Mock Strategy

The tests use comprehensive mocking to isolate the Lambda function logic:

### AWS Services
- **DynamoDB**: Mocked to return predefined user connections
- **Bedrock**: Mocked to return optimized queries
- **Cognito**: JWT validation is mocked for testing

### External Services
- **Pinecone**: Complete mock of search and rerank operations
- **OpenAI**: Not directly used but prepared for future integration

### Environment Variables
All required environment variables are mocked for testing:
- `PINECONE_INDEX_NAME`
- `PINECONE_HOST`
- `PINECONE_API_KEY`
- `DYNAMODB_TABLE`
- `AWS_REGION`
- `COGNITO_USER_POOL_ID`

## Test Data

The tests use realistic mock data that represents:

### User Profiles
```javascript
{
  profile_id: 'john-doe-123',
  name: 'John Doe',
  title: 'Senior Software Engineer',
  company: 'TechCorp',
  location: 'San Francisco, CA',
  summary: 'Experienced software engineer...',
  skills: ['JavaScript', 'Python', 'AWS'],
  headline: 'Senior Software Engineer at TechCorp'
}
```

### User Connections
```javascript
[
  { SK: 'PROFILE#john-doe-123' },
  { SK: 'PROFILE#jane-smith-456' },
  { SK: 'PROFILE#bob-johnson-789' }
]
```

### Search Queries
- Basic text queries: "software engineer"
- Filtered queries with company, location, skills
- Edge cases: empty queries, special characters

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Test Pinecone Search Lambda
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npx jest tests/pinecone-search-lambda.test.js
```

### Local Development
```bash
# Run tests before committing
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch
```

## Debugging Tests

### Enable Verbose Output
```bash
npx jest tests/pinecone-search-lambda.test.js --verbose
```

### Debug Specific Test
```bash
npx jest tests/pinecone-search-lambda.test.js -t "should handle JWT token validation"
```

### Debug with Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest tests/pinecone-search-lambda.test.js --runInBand
```

## Test Maintenance

### Adding New Tests
1. Follow the existing test structure and naming conventions
2. Use descriptive test names that explain the expected behavior
3. Include both positive and negative test cases
4. Mock external dependencies appropriately
5. Update this README when adding new test categories

### Updating Mocks
When the Lambda function changes:
1. Update mock implementations to match new interfaces
2. Add new environment variables to the test setup
3. Update test data to reflect new data structures
4. Ensure error scenarios are still covered

### Performance Considerations
- Tests should run quickly (< 5 seconds total)
- Use mocks instead of real API calls
- Avoid unnecessary async operations in tests
- Group related tests in describe blocks

## Troubleshooting

### Common Issues

**Jest not found**:
```bash
npm install --save-dev jest
```

**Module import errors**:
- Ensure all dependencies are mocked before importing the Lambda function
- Check that environment variables are set before importing

**Test timeouts**:
- Increase Jest timeout for async operations
- Check that all promises are properly resolved/rejected in mocks

**Mock not working**:
- Ensure mocks are cleared between tests with `jest.clearAllMocks()`
- Verify mock implementations match the expected interface

### Getting Help
- Check the Jest documentation for advanced testing patterns
- Review existing test files in the project for patterns
- Ensure the Lambda function code is working correctly before testing

## Future Enhancements

### Planned Test Additions
- Performance benchmarking tests
- Load testing with multiple concurrent requests
- Integration tests with real AWS services (optional)
- End-to-end tests with sample data

### Test Infrastructure Improvements
- Automated test data generation
- Test result reporting and metrics
- Integration with code coverage tools
- Automated test execution on code changes

---

This comprehensive test suite ensures the Pinecone Search Lambda function works correctly across all scenarios and provides confidence for production deployment.