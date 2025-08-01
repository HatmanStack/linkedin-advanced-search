# Profile Initialization Tests

This directory contains comprehensive unit and integration tests for the LinkedIn Profile Database Initialization feature. The tests validate all requirements and ensure the heal-and-restore mechanism works correctly.

## Test Structure

### Unit Tests

#### `test-profile-init-controller-unit.js`
Tests the ProfileInitController class functionality:
- **Request Validation**: JWT token validation, required field checking
- **State Management**: Initial state building, healing state handling
- **Service Integration**: Service initialization, auth token setting
- **Error Handling**: Error categorization, recovery determination
- **Heal-and-Restore**: Healing triggers, state creation, HealingManager integration
- **Response Building**: Success/error response formatting
- **Monitoring Integration**: Request tracking, success/failure recording

**Requirements Covered**: 1.1-1.4, 2.1-2.4, 3.1-3.5, 6.1-6.5, 7.1-7.6

#### `test-profile-init-service-unit.js`
Tests the ProfileInitService class functionality:
- **Service Initialization**: Dependency injection, configuration
- **Profile Initialization**: LinkedIn login, connection processing
- **Connection List Processing**: Batch creation, master index management
- **Batch Processing**: File management, connection handling, error recovery
- **Edge Existence Checking**: Database integration, error handling
- **Error Categorization**: Connection-level vs. serious errors
- **Random Delays**: Rate limiting compliance

**Requirements Covered**: 4.1-4.6, 5.1-5.5, 4.4

### Integration Tests

#### `test-profile-init-integration.js`
Tests end-to-end functionality:
- **API Endpoint Integration**: Request handling, response formatting
- **Database Integration**: Auth token setting, edge operations
- **Heal-and-Restore Integration**: Healing triggers, state preservation
- **Batch Processing Integration**: Large connection lists, resumption
- **Error Recovery Integration**: Network failures, rate limiting
- **Performance and Monitoring**: Timing, concurrent requests, error details

**Requirements Covered**: 3.1, 5.1-5.2, 5.4-5.5, 6.3, 6.6, 7.1-7.2

#### `test-profile-init-heal-restore.js`
Tests heal-and-restore mechanism:
- **Healing Trigger Detection**: Recoverable vs. non-recoverable errors
- **Healing State Creation**: State preservation, recursion handling
- **HealingManager Integration**: Parameter passing, error handling
- **Recovery Scenarios**: Authentication, network, rate limiting failures
- **Batch Processing Recovery**: Resume from specific batch/index
- **State Validation**: Healing state structure, batch state validation
- **Monitoring During Recovery**: Progress tracking, event recording

**Requirements Covered**: 5.4, 6.1-6.6

## Running Tests

### Prerequisites

1. **Install Jest** (if not already installed):
   ```bash
   npm install --save-dev jest
   ```

2. **Ensure source files exist**:
   - `backend/controllers/profileInitController.js`
   - `backend/services/profileInitService.js`
   - `backend/utils/profileInitStateManager.js`
   - `backend/utils/profileInitMonitor.js`

### Run All Tests

```bash
# Run the comprehensive test suite
node tests/run-profile-init-tests.js
```

### Run Individual Test Files

```bash
# Controller unit tests
npx jest tests/test-profile-init-controller-unit.js --verbose

# Service unit tests
npx jest tests/test-profile-init-service-unit.js --verbose

# Integration tests
npx jest tests/test-profile-init-integration.js --verbose

# Heal-and-restore tests
npx jest tests/test-profile-init-heal-restore.js --verbose
```

### Run with Coverage

```bash
# Generate coverage report
npx jest tests/test-profile-init-*.js --coverage
```

## Test Categories

### 1. Request Validation Tests
- JWT token extraction and validation
- Required field checking (searchName, searchPassword)
- Malformed request handling
- Authorization header validation

### 2. State Management Tests
- Initial state building with correct parameters
- Healing state creation with preserved context
- State validation during processing
- Batch progress tracking and resumption

### 3. Service Integration Tests
- Service initialization and cleanup
- DynamoDB auth token setting
- LinkedIn service login integration
- Screenshot capture service integration

### 4. Error Handling Tests
- Error categorization (authentication, network, LinkedIn, database)
- Recoverable vs. non-recoverable error detection
- Error context preservation
- User-friendly error messages

### 5. Heal-and-Restore Tests
- Healing trigger detection for various error types
- State preservation during healing
- HealingManager parameter passing
- Recovery from authentication failures
- Recovery from network timeouts
- Recovery from LinkedIn rate limiting
- Multiple healing attempt handling

### 6. Batch Processing Tests
- Master index file creation and management
- Batch file creation with correct structure
- Connection processing with edge existence checking
- Batch resumption from specific index
- Completed batch skipping
- Progress tracking across batches

### 7. Database Integration Tests
- Edge existence checking
- Database entry creation
- Error handling for database operations
- Auth token validation

### 8. API Endpoint Tests
- HTTP request/response handling
- Status code validation
- Response structure verification
- Concurrent request handling
- Error response formatting

## Mock Strategy

The tests use comprehensive mocking to isolate units under test:

- **External Services**: PuppeteerService, LinkedInService, DynamoDBService
- **Utilities**: Logger, RandomHelpers, File system operations
- **State Management**: ProfileInitStateManager, HealingManager
- **Monitoring**: profileInitMonitor

This approach ensures:
- Fast test execution
- Reliable test results
- Isolation of functionality
- Predictable test behavior

## Requirements Coverage

The tests validate all requirements from the specification:

| Requirement | Description | Test Coverage |
|-------------|-------------|---------------|
| 1.1-1.4 | User interface and button functionality | Controller unit tests |
| 2.1-2.4 | Consistent styling and placement | Controller unit tests |
| 3.1-3.5 | Backend controller implementation | Controller unit tests, Integration tests |
| 4.1-4.6 | Service implementation and batch processing | Service unit tests |
| 5.1-5.5 | Authentication and state management | Service unit tests, Integration tests |
| 6.1-6.6 | Heal-and-restore mechanism | All test files |
| 7.1-7.6 | Frontend API integration | Controller unit tests, Integration tests |

## Test Data

Tests use realistic but anonymized test data:
- Email addresses: `test@example.com`
- Profile IDs: `profile123`, `user456`
- Request IDs: Generated with `profile-init-` prefix
- JWT tokens: `valid-jwt-token`, `test-jwt-token`

## Continuous Integration

The test suite is designed for CI/CD integration:
- Exit codes: 0 for success, 1 for failure
- Structured output with clear pass/fail indicators
- Coverage reporting
- Requirements validation
- Performance metrics

## Troubleshooting

### Common Issues

1. **Jest not found**:
   ```bash
   npm install --save-dev jest
   ```

2. **Source files missing**:
   Ensure all ProfileInit* files are implemented in the backend

3. **Mock import errors**:
   Check that all mocked modules exist and have correct exports

4. **Test timeouts**:
   Increase Jest timeout if needed:
   ```javascript
   jest.setTimeout(30000);
   ```

### Debug Mode

Run tests with additional debugging:
```bash
# Verbose output
npx jest tests/test-profile-init-*.js --verbose --no-cache

# Debug specific test
npx jest tests/test-profile-init-controller-unit.js --testNamePattern="should handle successful" --verbose
```

## Contributing

When adding new tests:

1. Follow the existing naming convention
2. Include comprehensive error scenarios
3. Mock external dependencies
4. Add requirements coverage comments
5. Update this README if adding new test categories

## Performance Considerations

The test suite is optimized for:
- **Speed**: Mocked dependencies, no real network calls
- **Reliability**: Deterministic behavior, no external dependencies
- **Maintainability**: Clear structure, comprehensive coverage
- **Debugging**: Detailed error messages, verbose output options

Total test execution time should be under 30 seconds for the full suite.