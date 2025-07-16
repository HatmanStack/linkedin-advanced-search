/**
 * Pinecone Search Lambda Function
 * 
 * Provides semantic search across LinkedIn profiles with user-profile relationship filtering.
 * Only returns profiles that the authenticated user has connections to.
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

// Configuration
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'linkedin-profiles';
const PINECONE_HOST = process.env.PINECONE_HOST;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'linkedin-advanced-search';
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

// Initialize AWS clients
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION });
const bedrock = new AWS.BedrockRuntime({ region: AWS_REGION });

// Initialize Pinecone client
let pineconeClient;
let pineconeIndex;

async function initializePinecone() {
    if (!pineconeClient) {
        pineconeClient = new Pinecone({ apiKey: PINECONE_API_KEY });
        pineconeIndex = pineconeClient.Index(PINECONE_INDEX_NAME, PINECONE_HOST);
    }
    return pineconeIndex;
}

/**
 * Extract user ID from Cognito JWT token
 */
function extractUserFromJWT(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid Authorization header');
    }
    
    const token = authHeader.substring(7);
    
    try {
        // Decode without verification for now (API Gateway should handle verification)
        const decoded = jwt.decode(token);
        
        if (!decoded || !decoded.sub) {
            throw new Error('Invalid token: missing sub claim');
        }
        
        return decoded.sub;
    } catch (error) {
        throw new Error(`Token validation failed: ${error.message}`);
    }
}

/**
 * Optimize search query using AWS Nova
 */
async function optimizeQueryWithNova(originalQuery) {
    try {
        const prompt = `You are a search query optimizer for professional LinkedIn profile search. 

Your task: Take the user's search query and optimize it for semantic vector search to find relevant professional profiles.

Guidelines:
- Fix any obvious typos or spelling errors
- Expand abbreviations (AI → artificial intelligence, PM → project manager)  
- Add relevant professional synonyms and related terms
- Keep the query focused and under 20 words
- Maintain the original intent
- Return only the optimized query, no explanation

Original query: "${originalQuery}"

Optimized query:`;

        const response = await bedrock.invokeModel({
            modelId: 'amazon.nova-micro-v1:0', // Fast and cost-effective
            body: JSON.stringify({
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 50,
                temperature: 0.1 // Low temperature for consistent results
            }),
            contentType: 'application/json'
        }).promise();

        const result = JSON.parse(response.body.toString());
        const optimizedQuery = result.content[0].text.trim();
        
        console.log(`Query optimization: "${originalQuery}" → "${optimizedQuery}"`);
        
        return optimizedQuery;
        
    } catch (error) {
        console.warn('Query optimization failed, using original:', error.message);
        return originalQuery; // Fallback to original query
    }
}

/**
 * Basic query preprocessing
 */
function preprocessQuery(query) {
    return query
        .trim()                          // Remove leading/trailing spaces
        .replace(/[^\w\s-]/g, ' ')       // Remove special chars except hyphens
        .replace(/\s+/g, ' ')            // Normalize multiple spaces to single
        .toLowerCase();                  // Consistent casing
}

/**
 * Get all profile IDs that the user has connections to
 */
async function getUserConnectedProfiles(userId) {
    try {
        const params = {
            TableName: DYNAMODB_TABLE,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': `USER#${userId}`,
                ':sk': 'PROFILE#'
            },
            ProjectionExpression: 'SK'
        };
        
        const result = await dynamodb.query(params).promise();
        
        // Extract profile IDs from SK values
        const profileIds = result.Items.map(item => item.SK);
        
        console.log(`Found ${profileIds.length} connected profiles for user ${userId}`);
        return profileIds;
        
    } catch (error) {
        console.error('Error fetching user connected profiles:', error);
        throw new Error('Failed to fetch user connections');
    }
}

/**
 * Build metadata filter expression for Pinecone
 */
function buildMetadataFilter(connectedProfileIds, additionalFilters = {}) {
    const filter = {
        // Only search profiles the user is connected to
        profile_id: { $in: connectedProfileIds }
    };
    
    // Add additional filters
    if (additionalFilters.company) {
        filter.company = { $eq: additionalFilters.company };
    }
    
    if (additionalFilters.location) {
        filter.location = { $eq: additionalFilters.location };
    }
    
    if (additionalFilters.skills && Array.isArray(additionalFilters.skills)) {
        filter.skills = { $in: additionalFilters.skills };
    }
    
    if (additionalFilters.title) {
        filter.title = { $eq: additionalFilters.title };
    }
    
    return filter;
}

/**
 * Perform semantic search with reranking
 */
async function searchPineconeWithUserFilter(query, connectedProfileIds, filters = {}, limit = 10, rerank = true) {
    try {
        const index = await initializePinecone();
        
        if (connectedProfileIds.length === 0) {
            return { matches: [], total: 0 };
        }
        
        // Build search parameters
        const searchParams = {
            query: {
                topK: rerank ? Math.min(limit * 3, 100) : limit, // Get more results for reranking
                inputs: { text: query }
            }
        };
        
        // Add metadata filter
        const metadataFilter = buildMetadataFilter(connectedProfileIds, filters);
        if (Object.keys(metadataFilter).length > 0) {
            searchParams.query.filter = metadataFilter;
        }
        
        console.log('Pinecone search params:', JSON.stringify(searchParams, null, 2));
        
        // Execute search
        const searchResults = await index.searchRecords(searchParams);
        
        let finalResults = searchResults.matches || [];
        
        // Apply reranking if requested and we have results
        if (rerank && finalResults.length > 0) {
            try {
                const rerankResults = await index.rerank({
                    query: query,
                    documents: finalResults,
                    model: 'bge-reranker-v2-m3',
                    topN: limit,
                    rankFields: ['summary'] // Rerank based on the summary field
                });
                
                finalResults = rerankResults.matches || finalResults;
                console.log(`Reranked ${finalResults.length} results`);
            } catch (rerankError) {
                console.warn('Reranking failed, using original results:', rerankError.message);
            }
        }
        
        // Limit final results
        finalResults = finalResults.slice(0, limit);
        
        return {
            matches: finalResults,
            total: finalResults.length,
            query_time_ms: Date.now() // Rough timing
        };
        
    } catch (error) {
        console.error('Pinecone search error:', error);
        throw new Error(`Search failed: ${error.message}`);
    }
}

/**
 * Format search results for API response
 */
function formatSearchResponse(searchResults, queryStartTime) {
    const queryTime = Date.now() - queryStartTime;
    
    const formattedResults = searchResults.matches.map(match => ({
        profile_id: match.metadata?.profile_id || match.id,
        name: match.metadata?.name || 'Unknown',
        title: match.metadata?.title || '',
        company: match.metadata?.company || '',
        location: match.metadata?.location || '',
        score: match.score || 0,
        summary: match.metadata?.summary || '',
        skills: match.metadata?.skills || [],
        headline: match.metadata?.headline || ''
    }));
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({
            results: formattedResults,
            total: searchResults.total || formattedResults.length,
            query_time_ms: queryTime
        })
    };
}

/**
 * Handle errors and return appropriate HTTP response
 */
function handleError(error) {
    console.error('Lambda error:', error);
    
    let statusCode = 500;
    let message = 'Internal server error';
    
    if (error.message.includes('Authorization') || error.message.includes('Token')) {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (error.message.includes('validation') || error.message.includes('Invalid')) {
        statusCode = 400;
        message = 'Bad request';
    }
    
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            error: message,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    };
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
    const queryStartTime = Date.now();
    
    try {
        console.log('Received event:', JSON.stringify(event, null, 2));
        
        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'POST,OPTIONS'
                },
                body: ''
            };
        }
        
        // Extract user ID from JWT token
        const userId = extractUserFromJWT(event.headers.Authorization || event.headers.authorization);
        console.log(`Processing search request for user: ${userId}`);
        
        // Parse request body
        let requestBody;
        try {
            requestBody = JSON.parse(event.body || '{}');
        } catch (parseError) {
            throw new Error('Invalid JSON in request body');
        }
        
        const { 
            query, 
            filters = {}, 
            limit = 10, 
            rerank = true 
        } = requestBody;
        
        // Validate required parameters
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            throw new Error('Query parameter is required and must be a non-empty string');
        }
        
        if (limit > 50) {
            throw new Error('Limit cannot exceed 50');
        }
        
        // Preprocess and optimize query
        const preprocessedQuery = preprocessQuery(query);
        const optimizedQuery = await optimizeQueryWithNova(preprocessedQuery);
        
        // Get user's connected profile IDs
        const connectedProfileIds = await getUserConnectedProfiles(userId);
        
        if (connectedProfileIds.length === 0) {
            return formatSearchResponse({ matches: [], total: 0 }, queryStartTime);
        }
        
        // Perform search with optimized query
        const searchResults = await searchPineconeWithUserFilter(
            optimizedQuery,
            connectedProfileIds,
            filters,
            limit,
            rerank
        );
        
        // Return formatted results
        return formatSearchResponse(searchResults, queryStartTime);
        
    } catch (error) {
        return handleError(error);
    }
};
