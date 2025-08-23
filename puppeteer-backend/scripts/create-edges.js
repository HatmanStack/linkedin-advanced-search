import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
import { writeFile, readFile } from 'fs/promises';

dotenv.config();

// Initialize DynamoDB clients
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

class EdgeService {
    constructor() {
        this.tableName = process.env.DYNAMODB_TABLE_NAME;
    }

    async checkAndCreateEdges(userId, linkedinUrl) {
        try {
            // Generate profile ID
            const profileIdB64 = Buffer.from(linkedinUrl).toString('base64');
            const profileId = `PROFILE#${profileIdB64}`;

            // Check if profile exists
            const profileResponse = await docClient.send(new GetCommand({
                TableName: this.tableName,
                Key: {
                    PK: profileId,
                    SK: '#METADATA'
                }
            }));

            if (!profileResponse.Item) {
                logger.warn(`Profile ${profileId} not found`);
                return false;
            }

            // Create edges
            const timestamp = new Date().toISOString();
            
            await Promise.all([
                // Create User-to-Profile edge
                docClient.send(new PutCommand({
                    TableName: this.tableName,
                    Item: {
                        PK: `USER#${userId}`,
                        SK: `PROFILE#${profileIdB64}`,
                        GSI1PK: `USER#${userId}`,
                        GSI1SK: `STATUS#possible#PROFILE#${profileIdB64}`,
                        status: 'possible',
                        addedAt: timestamp,
                        messages: []
                    }
                })),

                // Create Profile-to-User edge
                docClient.send(new PutCommand({
                    TableName: this.tableName,
                    Item: {
                        PK: `PROFILE#${profileIdB64}`,
                        SK: `USER#${userId}`,
                        status: 'possible',
                        addedAt: timestamp,
                        attempts: 0,
                        lastFailedAttempt: null
                    }
                }))
            ]);

            logger.info(`Created edges for user ${userId} and profile ${profileId}`);
            return true;

        } catch (error) {
            logger.error('Error in checkAndCreateEdges:', error);
            return false;
        }
    }
}

const createEdgesForExistingProfiles = async (userId, profileUrls) => {
    const edgeService = new EdgeService();
    logger.info(`Starting edge creation for user ${userId} with ${profileUrls.length} profiles`);

    const results = {
        success: [],
        failed: []
    };

    for (const profileUrl of profileUrls) {
        try {
            logger.info(`Creating edges for profile: ${profileUrl}`);
            const success = await edgeService.checkAndCreateEdges(userId, profileUrl);
            
            if (success) {
                results.success.push(profileUrl);
                logger.info(`Successfully created edges for profile: ${profileUrl}`);
            } else {
                results.failed.push({ url: profileUrl, reason: 'Edge creation failed' });
                logger.error(`Failed to create edges for profile: ${profileUrl}`);
            }
        } catch (error) {
            results.failed.push({ url: profileUrl, reason: error.message });
            logger.error(`Error creating edges for profile ${profileUrl}:`, error);
        }
    }

    // Log summary
    logger.info('Edge creation completed');
    logger.info(`Successfully created edges for ${results.success.length} profiles`);
    logger.info(`Failed to create edges for ${results.failed.length} profiles`);
    
    if (results.failed.length > 0) {
        logger.info('Failed profiles:', results.failed);
    }

    return results;
};

// Usage example - you'll provide these values when running the script
const userId = '';
const profileUrls = JSON.parse(await readFile('new_edges_urls.json'));
console.log(profileUrls);
if (!userId || !profileUrls) {
    logger.error('Usage: node create-edges.js <userId> <profileUrlsFile>');
    logger.error('Example: node create-edges.js abc123 ./profile-urls.json');
    process.exit(1);
}

// Read profile URLs from file and create edges


try {
    
    const results = await createEdgesForExistingProfiles(userId, profileUrls);
    
    // Write results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `edge-creation-results-${timestamp}.json`;
    await writeFile(resultsFile, JSON.stringify(results, null, 2));
    
    logger.info(`Results written to ${resultsFile}`);
    process.exit(0);
} catch (error) {
    logger.error('Script failed:', error);
    process.exit(1);
}
