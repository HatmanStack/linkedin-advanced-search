const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

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
        if (event.pathParameters?.id) {
          return await getConnection(userId, event.pathParameters.id);
        } else {
          return await getConnections(userId, event.queryStringParameters || {});
        }
      case 'POST':
        return await createConnection(userId, JSON.parse(event.body || '{}'));
      case 'PUT':
        if (!event.pathParameters?.id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Connection ID required for update' })
          };
        }
        return await updateConnection(userId, event.pathParameters.id, JSON.parse(event.body || '{}'));
      case 'DELETE':
        if (!event.pathParameters?.id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Connection ID required for delete' })
          };
        }
        return await deleteConnection(userId, event.pathParameters.id);
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

async function getConnections(userId, queryParams) {
  try {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CONNECTION#'
      }
    };

    // Add filters if provided
    if (queryParams.status) {
      params.FilterExpression = 'connection_status = :status';
      params.ExpressionAttributeValues[':status'] = queryParams.status;
    }

    if (queryParams.tags) {
      const tags = queryParams.tags.split(',');
      params.FilterExpression = params.FilterExpression 
        ? `${params.FilterExpression} AND contains(tags, :tag)`
        : 'contains(tags, :tag)';
      params.ExpressionAttributeValues[':tag'] = tags[0]; // Simple implementation for first tag
    }

    if (queryParams.limit) {
      params.Limit = parseInt(queryParams.limit);
    }

    if (queryParams.lastKey) {
      params.ExclusiveStartKey = JSON.parse(decodeURIComponent(queryParams.lastKey));
    }

    const result = await dynamodb.query(params).promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          connections: result.Items || [],
          lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null
        }
      })
    };
  } catch (error) {
    console.error('Error getting connections:', error);
    throw error;
  }
}

async function getConnection(userId, connectionId) {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `CONNECTION#${connectionId}`
      }
    };

    const result = await dynamodb.get(params).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Connection not found' })
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
    console.error('Error getting connection:', error);
    throw error;
  }
}

async function createConnection(userId, connectionData) {
  try {
    const connectionId = uuidv4();
    const timestamp = new Date().toISOString();

    const item = {
      PK: `USER#${userId}`,
      SK: `CONNECTION#${connectionId}`,
      entity_type: 'CONNECTION',
      connection_id: connectionId,
      user_id: userId,
      linkedin_id: connectionData.linkedin_id || '',
      first_name: connectionData.first_name || '',
      last_name: connectionData.last_name || '',
      headline: connectionData.headline || '',
      profile_url: connectionData.profile_url || '',
      profile_picture_url: connectionData.profile_picture_url || '',
      location: connectionData.location || '',
      company: connectionData.company || '',
      position: connectionData.position || '',
      industry: connectionData.industry || '',
      common_interests: connectionData.common_interests || [],
      recent_activity: connectionData.recent_activity || '',
      connection_date: connectionData.connection_date || timestamp,
      message_count: 0,
      last_activity_summary: connectionData.last_activity_summary || '',
      connection_status: connectionData.connection_status || 'not_connected',
      tags: connectionData.tags || [],
      conversation_topics: connectionData.conversation_topics || [],
      search_metadata: connectionData.search_metadata || {},
      engagement_score: connectionData.engagement_score || 0,
      created_at: timestamp,
      updated_at: timestamp,
      
      // GSI attributes for filtering
      GSI1PK: `USER#${userId}`,
      GSI1SK: `STATUS#${connectionData.connection_status || 'not_connected'}#${timestamp}`
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
        body: JSON.stringify({ error: 'Connection already exists' })
      };
    }
    console.error('Error creating connection:', error);
    throw error;
  }
}

async function updateConnection(userId, connectionId, updates) {
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
      if (key !== 'connection_id' && key !== 'user_id' && key !== 'created_at') {
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
        SK: `CONNECTION#${connectionId}`
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
        body: JSON.stringify({ error: 'Connection not found' })
      };
    }
    console.error('Error updating connection:', error);
    throw error;
  }
}

async function deleteConnection(userId, connectionId) {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `CONNECTION#${connectionId}`
      },
      ConditionExpression: 'attribute_exists(PK)'
    };

    await dynamodb.delete(params).promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Connection deleted successfully'
      })
    };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Connection not found' })
      };
    }
    console.error('Error deleting connection:', error);
    throw error;
  }
}
