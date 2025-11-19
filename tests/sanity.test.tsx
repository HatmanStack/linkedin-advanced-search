import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from './utils/testHelpers';
import mockProfiles from './fixtures/mockProfiles.json';
import mockDynamoDBResponses from './fixtures/mockDynamoDBResponses.json';
import mockS3Responses from './fixtures/mockS3Responses.json';

describe('Test Infrastructure Sanity Check', () => {
  it('should load test fixtures correctly', () => {
    expect(mockProfiles).toBeDefined();
    expect(mockProfiles).toHaveLength(5);
    expect(mockProfiles[0].name).toBe('John Doe');

    expect(mockDynamoDBResponses).toBeDefined();
    expect(mockDynamoDBResponses.getProfileSuccess).toBeDefined();

    expect(mockS3Responses).toBeDefined();
    expect(mockS3Responses.uploadSuccess).toBeDefined();
  });

  it('should render a simple component with providers', () => {
    const TestComponent = () => <div>Test Component</div>;

    renderWithProviders(<TestComponent />);

    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });

  it('should have access to test utilities', () => {
    expect(renderWithProviders).toBeDefined();
    expect(screen).toBeDefined();
  });
});
