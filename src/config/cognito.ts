// AWS Cognito Configuration
export const cognitoConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  userPoolWebClientId: import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID || '',
  identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || '',
};

// Validate configuration
export const validateCognitoConfig = () => {
  const requiredFields = [
    'userPoolId',
    'userPoolWebClientId',
  ];

  const missingFields = requiredFields.filter(field => !cognitoConfig[field as keyof typeof cognitoConfig]);
  
  if (missingFields.length > 0) {
    console.warn('Missing Cognito configuration fields:', missingFields);
    console.warn('Using mock authentication. Please configure AWS Cognito environment variables.');
    return false;
  }
  
  return true;
};

export const isCognitoConfigured = validateCognitoConfig();
