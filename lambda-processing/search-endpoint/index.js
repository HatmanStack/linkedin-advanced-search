'use strict';

const API_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

function resp(statusCode, body) {
  return {
    statusCode,
    headers: API_HEADERS,
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  if (!event) return {};
  const raw = event.body;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (_e) {
      return {};
    }
  }
  return raw || {};
}

function extractUserId(event) {
  const sub = event?.requestContext?.authorizer?.claims?.sub;
  if (sub) return sub;
  const authHeader = event?.headers?.Authorization || event?.headers?.authorization;
  if (authHeader) return 'test-user-id';
  return null;
}

exports.handler = async (event, _context) => {
  try {
    if (event?.httpMethod === 'OPTIONS') {
      return resp(200, { ok: true });
    }

    const body = parseBody(event);
    const userId = extractUserId(event);
    if (!userId) {
      return resp(401, { error: 'Unauthorized: Missing or invalid JWT token' });
    }

    // Placeholder: you will implement the core search logic
    return resp(200, {
      message: 'Search endpoint initialized',
      userId,
      received: body
    });
  } catch (err) {
    console.error('Unexpected error in handler:', err);
    return resp(500, { error: 'Internal server error' });
  }
};

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
const PINECONE_HOST = process.env.PINECONE_HOST;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'linkedin-advanced-search';


// Initialize AWS clients
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION });
const bedrock = new AWS.BedrockRuntime({ region: AWS_REGION });

// Initialize Pinecone client
let pineconeClient;
let pineconeIndex;

async function initializePinecone() {
    if (!pineconeClient) {
        pineconeClient = new Pinecone({ apiKey: PINECONE_API_KEY });
        pineconeIndex = pineconeClient.Index({ host: PINECONE_HOST });
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
 * Optimize search query and extract filters using AWS Nova
 */
async function optimizeQueryAndExtractFilters(originalQuery) {
    try {
        const prompt = `You are a search query optimizer and filter extractor for professional LinkedIn profile search.

Your task: 
1. Extract any explicit filters from the user's search query
2. Optimize the remaining text for semantic vector search

Extract these filter types if mentioned:
- company: Company names (Google, Microsoft, Apple, etc.)
- location: Cities, states, countries (San Francisco, CA, New York, remote, etc.)
- title: Job titles or levels (Senior, Manager, Director, Engineer, etc.)
- skills: Technical skills, programming languages, tools (Python, AWS, React, etc.)

Guidelines for optimization:
- Fix typos and expand abbreviations (AI → artificial intelligence, PM → project manager)
- Add relevant professional synonyms
- Keep optimized query focused and under 20 words
- Remove extracted filter terms from the optimized query

Return a JSON object with this exact structure:
{
  "optimizedQuery": "the optimized search text",
  "filters": {
    "company": "company name if found, otherwise null",
    "location": "location if found, otherwise null", 
    "title": "job title if found, otherwise null",
    "skills": ["array", "of", "skills"] or null if none found
  }
}

Examples:
Input: "senior python developer at Google in San Francisco"
Output: {
  "optimizedQuery": "senior software developer engineer python programming",
  "filters": {
    "company": "Google",
    "location": "San Francisco, CA",
    "title": "Senior Developer",
    "skills": ["Python"]
  }
}

Input: "machine learning engineer"
Output: {
  "optimizedQuery": "machine learning artificial intelligence engineer data scientist",
  "filters": {
    "company": null,
    "location": null,
    "title": null,
    "skills": null
  }
}

Original query: "${originalQuery}"

JSON Response:`;

        const response = await bedrock.invokeModel({
            modelId: 'amazon.nova-micro-v1:0',
            body: JSON.stringify({
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 200, // Increased for JSON response
                temperature: 0.1
            }),
            contentType: 'application/json'
        }).promise();

        const result = JSON.parse(response.body.toString());
        const responseText = result.content[0].text.trim();

        // Parse the JSON response
        let parsedResult;
        try {
            parsedResult = JSON.parse(responseText);
        } catch (parseError) {
            console.warn('Failed to parse Nova JSON response, using fallback');
            return {
                optimizedQuery: originalQuery,
                filters: {}
            };
        }

        // Clean up the filters - remove null values and empty arrays
        const cleanFilters = {};
        if (parsedResult.filters) {
            Object.keys(parsedResult.filters).forEach(key => {
                const value = parsedResult.filters[key];
                if (value !== null && value !== undefined) {
                    if (Array.isArray(value) && value.length > 0) {
                        cleanFilters[key] = value;
                    } else if (!Array.isArray(value) && value.trim() !== '') {
                        cleanFilters[key] = value;
                    }
                }
            });
        }

        const finalResult = {
            optimizedQuery: parsedResult.optimizedQuery || originalQuery,
            filters: cleanFilters
        };

        console.log(`Query processing: "${originalQuery}" → Query: "${finalResult.optimizedQuery}", Filters:`, finalResult.filters);

        return finalResult;

    } catch (error) {
        console.warn('Query optimization and filter extraction failed, using original:', error.message);
        return {
            optimizedQuery: originalQuery,
            filters: {}
        };
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

        // TEMP DISABLE MODE
        // This endpoint is temporarily configured to only log the request body and
        // return a successful response, skipping all normal actions.
        //
        // To revert back to normal functioning:
        // 1) Remove the early return block below (from 'Request body' logging to the return)
        // 2) Uncomment the original logic below to re-enable auth and search
        // 3) Deploy the Lambda

        // Parse request body, log it, and short-circuit with success
        let requestBody;
        try {
            requestBody = JSON.parse(event.body || '{}');
        } catch (parseError) {
            requestBody = event.body;
        }

        try {
            console.log('Request body:', JSON.stringify(requestBody).slice(0, 2000));
        } catch (e) {
            console.log('Request body received (non-serializable)');
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                message: 'Request received',
                echo: requestBody
            })
        };

        // --- Original logic (disabled) ---
        // // Extract user ID from JWT token
        // const userId = extractUserFromJWT(event.headers.Authorization || event.headers.authorization);
        // console.log(`Processing search request for user: ${userId}`);
        //
        // // Parse request body
        // let requestBody;
        // try {
        //     requestBody = JSON.parse(event.body || '{}');
        // } catch (parseError) {
        //     throw new Error('Invalid JSON in request body');
        // }

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

        // Preprocess query and extract filters using Nova
        const preprocessedQuery = preprocessQuery(query);
        const queryResult = await optimizeQueryAndExtractFilters(preprocessedQuery);

        // Merge extracted filters with any explicit filters from request
        // Explicit filters from request take precedence over extracted ones
        const mergedFilters = {
            ...queryResult.filters,  // Extracted from query text
            ...filters               // Explicit filters from request (override extracted)
        };

        console.log('Final merged filters:', mergedFilters);

        // Get user's connected profile IDs
        const connectedProfileIds = await getUserConnectedProfiles(userId);

        if (connectedProfileIds.length === 0) {
            return formatSearchResponse({ matches: [], total: 0 }, queryStartTime);
        }

        // Perform search with optimized query and merged filters
        const searchResults = await searchPineconeWithUserFilter(
            queryResult.optimizedQuery,
            connectedProfileIds,
            mergedFilters,
            limit,
            rerank
        );

        // Return formatted results
        return formatSearchResponse(searchResults, queryStartTime);

    } catch (error) {
        return handleError(error);
    }
};
