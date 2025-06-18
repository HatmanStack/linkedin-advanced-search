const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'linkedin-advanced-search';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    // Extract user ID from Cognito JWT
    const userId = event.requestContext?.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized - No user ID found' })
      };
    }

    console.log('User ID:', userId);

    switch (event.httpMethod) {
      case 'GET':
        return await getProfile(userId);
      case 'POST':
        return await createProfile(userId, JSON.parse(event.body || '{}'));
      case 'PUT':
        return await updateProfile(userId, JSON.parse(event.body || '{}'));
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

async function getProfile(userId) {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    };

    const result = await dynamodb.get(params).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Profile not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result.Item
      })
    };
  } catch (error) {
    console.error('Error getting profile:', error);
    throw error;
  }
}

async function createProfile(userId, profileData) {
  try {
    const timestamp = new Date().toISOString();

    const item = {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      entity_type: 'PROFILE',
      user_id: userId,
      linkedin_id: profileData.linkedin_id || '',
      first_name: profileData.first_name || '',
      last_name: profileData.last_name || '',
      email: profileData.email || '',
      headline: profileData.headline || '',
      profile_url: profileData.profile_url || '',
      profile_picture_url: profileData.profile_picture_url || '',
      location: profileData.location || '',
      summary: profileData.summary || '',
      industry: profileData.industry || '',
      current_position: profileData.current_position || '',
      company: profileData.company || '',
      interests: profileData.interests || [],
      linkedin_credentials: profileData.linkedin_credentials || '',
      preferences: profileData.preferences || {},
      created_at: timestamp,
      updated_at: timestamp
    };

    const params = {
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)'
    };

    await dynamodb.put(params).promise();

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        data: item
      })
    };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Profile already exists' })
      };
    }
    console.error('Error creating profile:', error);
    throw error;
  }
}

async function updateProfile(userId, updates) {
  try {
    const timestamp = new Date().toISOString();
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    // Add updated_at
    updateExpressions.push('#updated_at = :updated_at');
    expressionAttributeNames['#updated_at'] = 'updated_at';
    expressionAttributeValues[':updated_at'] = timestamp;

    // Add other fields
    Object.keys(updates).forEach((key, index) => {
      if (key !== 'user_id' && key !== 'created_at') {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = updates[key];
      }
    });

    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: result.Attributes
      })
    };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Profile not found' })
      };
    }
    console.error('Error updating profile:', error);
    throw error;
  }
}
