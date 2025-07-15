import AWS from 'aws-sdk';
import { logger } from '../utils/logger.js';

class EdgeService {
    constructor() {
        this.dynamoDB = new AWS.DynamoDB.DocumentClient();
        this.tableName = process.env.DYNAMODB_TABLE_NAME;
    }

    async checkAndCreateEdges(userId, linkedinUrl) {
        try {
            // Wait 30 seconds before checking
            await new Promise(resolve => setTimeout(resolve, 30000));

            // Generate profile ID
            const profileIdB64 = Buffer.from(linkedinUrl).toString('base64');
            const profileId = `PROFILE#${profileIdB64}`;

            // Check if profile exists and was recently updated
            const profile = await this.dynamoDB.get({
                TableName: this.tableName,
                Key: {
                    PK: profileId,
                    SK: '#METADATA'
                }
            }).promise();

            if (!profile.Item) {
                logger.warn(`Profile ${profileId} not found after 30 seconds`);
                return false;
            }

            // Check if profile was updated in the last minute
         
            const updatedAt = new Date(profile.Item.updatedAt);
            const oneMinuteAgo = new Date(Date.now() - 60000);
            if (updatedAt < oneMinuteAgo) {
                logger.warn(`Profile ${profileId} exists but wasn't recently updated`);
                return false;
            }

            // Check for existing edges
            const [userToProfile, profileToUser] = await Promise.all([
                this.dynamoDB.get({
                    TableName: this.tableName,
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `PROFILE#${profileIdB64}`
                    }
                }).promise(),
                this.dynamoDB.get({
                    TableName: this.tableName,
                    Key: {
                        PK: `PROFILE#${profileIdB64}`,
                        SK: `USER#${userId}`
                    }
                }).promise()
            ]);

            // If either edge doesn't exist, create both
            if (!userToProfile.Item || !profileToUser.Item) {
                const timestamp = new Date().toISOString();
                
                // Create User-to-Profile edge
                await this.dynamoDB.put({
                    TableName: this.tableName,
                    Item: {
                        PK: `USER#${userId}`,
                        SK: `PROFILE#${profileIdB64}`,
                        GSI1PK: `USER#${userId}`,
                        GSI1SK: `STATUS#possible#PROFILE#${profileIdB64}`,
                        status: 'possible',
                        addedAt: timestamp,
                        messages: [],  // Initialize empty messages array
                    }
                }).promise(),

                // Create Profile-to-User edge
                await this.dynamoDB.put({
                    TableName: this.tableName,
                    Item: {
                        PK: `PROFILE#${profileIdB64}`,
                        SK: `USER#${userId}`,
                        status: 'possible',
                        addedAt: timestamp,
                        attempts: 0,  // Initialize attempts counter
                        lastFailedAttempt: null  // Initialize last failed attempt as null
                    }
                }).promise()
                

                logger.info(`Created edges for user ${userId} and profile ${profileId}`);
                return true;
            }

            logger.info(`Edges already exist for user ${userId} and profile ${profileId}`);
            return true;

        } catch (error) {
            logger.error('Error in checkAndCreateEdges:', error);
            return false;
        }
    }
}

export default EdgeService;
