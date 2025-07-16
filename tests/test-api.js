// Simple test script to verify API Gateway is working
const API_URL = 'https://2c6mr2rri0.execute-api.us-west-2.amazonaws.com/prod';

async function testAPI() {
  try {
    console.log('Testing API Gateway endpoints...');
    
    // Test profile endpoint
    console.log('\n1. Testing GET /profile (should return 401 without auth)');
    const profileResponse = await fetch(`${API_URL}/profile`);
    console.log('Status:', profileResponse.status);
    const profileData = await profileResponse.text();
    console.log('Response:', profileData);
    
    // Test connections endpoint
    console.log('\n2. Testing GET /connections (should return 401 without auth)');
    const connectionsResponse = await fetch(`${API_URL}/connections`);
    console.log('Status:', connectionsResponse.status);
    const connectionsData = await connectionsResponse.text();
    console.log('Response:', connectionsData);
    
    console.log('\n✅ API Gateway is responding correctly!');
    console.log('Next steps:');
    console.log('1. Configure Cognito authentication in your frontend');
    console.log('2. Test with valid JWT tokens');
    console.log('3. Create user profiles and connections');
    
  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

testAPI();
