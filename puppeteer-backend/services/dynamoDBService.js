import axios from 'axios';
import { logger } from '../utils/logger.js';

const API_BASE_URL = process.env.API_GATEWAY_BASE_URL;

class DynamoDBService {
    constructor() {
        this.authToken = null;
        this.apiClient = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Set the authorization token for API requests
     * @param {string} token - JWT token from Cognito
     */
    setAuthToken(token) {
        this.authToken = token;
    }

    /**
     * Get headers for API requests
     * @returns {Object} Headers object
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        return headers;
    }

    /**
     * Check if a profile exists and has been updated in the past month
     * @param {string} profileId - Profile ID to check
     * @returns {Promise<boolean>} true if profile doesn't exist or hasn't been updated in last month, false otherwise
     */
    async getProfileDetails(profileId) {
        try {
            logger.info(`Request payload:`, {
                operation: 'get_details',
                profileId: profileId
            });

            const response = await this.apiClient.post('/profiles', {
                operation: 'get_details',
                profileId: profileId
            }, { headers: this.getHeaders() });
            // If profile doesn't exist, return true
            if (!response.data || !response.data.profile) {
                return true;
            }

            const profile = response.data.profile;
            const updatedAt = profile.updatedAt;
            const evaluated = profile.evaluated;
            logger.info(`Profile flags from DynamoDBService: evaluated=${evaluated}, updatedAt=${updatedAt}`);

            // Evaluate using new evaluated flag and last-updated staleness
            const isStale = (() => {
                if (!updatedAt) return true; // no timestamp = stale
                const oneMonthAgo = new Date();
                oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
                const profileUpdateDate = new Date(updatedAt);
                return profileUpdateDate < oneMonthAgo;
            })();

            if (typeof evaluated === 'boolean') {
                // evaluated === false => not yet evaluated, process
                if (evaluated === false) return true;
                // evaluated === true => process only if stale
                return isStale;
            }

            // No evaluated flag present: fall back to staleness logic
            return isStale;

        } catch (error) {
            logger.info(`Caught error in getProfileDetails:`, error.message);
            logger.info(`Full error object:`, error);
            logger.info(`Error status:`, error.response?.status);
            logger.info(`Error response:`, error.response?.data);
            logger.info(`Has error.response:`, !!error.response);

            // API Gateway likely returns 200 with error in body, not HTTP error codes
            logger.info(`This is likely a 200 response with error in body, not a real HTTP error`);
            return true;
        }
    }

    /**
     * Create a "bad contact" profile and its edges with processed status
     * @param {Object} profileData - Profile information
     * @param {Object} edgesData - Edge relationship data
     * @returns {Promise<Object>} Creation result
     */
    async createBadContactProfile(profileId) {
        try {
            const response = await this.apiClient.post('/profiles', {
                operation: 'create',
                profileId: profileId,
                updates: {
                    status: 'processed',
                    addedAt: new Date().toISOString(),
                    processedAt: new Date().toISOString(),
                }
            }, { headers: this.getHeaders() });

            return response.data;
        } catch (error) {
            console.error('Error creating bad contact profile:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Create edges for a good contact with possible status
     * @param {string} profileId - Profile ID for the good contact
     * @param {Object} edgesData - Edge relationship data
     * @returns {Promise<Object>} Edge creation result
     */
    async createGoodContactEdges(profileId, connectionType) {
        try {
            // Call the edge-processing endpoint to create edges with possible status
            const response = await this.apiClient.post('/edge', {
                operation: 'create_edges',
                profileId: profileId,
                status: connectionType,
                edgesData: {
                    addedAt: new Date().toISOString()
                }
            }, { headers: this.getHeaders() });

            return response.data;
        } catch (error) {
            console.error('Error creating good contact edges:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Check if an edge relationship exists between user and connection profile
     * The user ID is extracted from the JWT token in the Lambda function
     * @param {string} connectionProfileId - Connection profile ID to check
     * @returns {Promise<boolean>} true if edge exists, false otherwise
     */
    async checkEdgeExists(connectionProfileId) {
        try {
            logger.info(`Checking edge existence for profile: ${connectionProfileId}`);

            // Call the edge-processing endpoint to check if edge exists
            // The user ID is extracted from the JWT token in the Lambda function
            const response = await this.apiClient.post('/edge', {
                operation: 'check_exists',
                linkedinurl: connectionProfileId
            }, { headers: this.getHeaders() });

            // Extract the result from the response
            const result = response.data?.result;

            if (result && result.success) {
                const exists = result.exists || false;
                logger.info(`Edge existence check result: ${exists} for profile ${connectionProfileId}`);
                return exists;
            } else {
                logger.warn(`Edge existence check failed for profile ${connectionProfileId}:`, result);
                return false;
            }

        } catch (error) {
            logger.error(`Error checking edge existence for profile ${connectionProfileId}:`, error.message);

            // If there's an error checking, assume edge doesn't exist to allow processing
            // This ensures the system continues to work even if the check fails
            return false;
        }
    }

    /**
     * Handle API errors consistently
     * @param {Error} error - The error object
     * @returns {Error} Formatted error
     */
    handleError(error) {
        if (error.response) {
            // API responded with error status
            const message = error.response.data?.error || error.response.statusText;
            const statusCode = error.response.status;

            if (statusCode === 401) {
                return new Error('Authentication required. Please log in again.');
            } else if (statusCode === 403) {
                return new Error('Access denied. Check your permissions.');
            } else if (statusCode === 404) {
                return new Error('Resource not found.');
            } else if (statusCode >= 500) {
                return new Error('Server error. Please try again later.');
            }

            return new Error(`API Error (${statusCode}): ${message}`);
        } else if (error.request) {
            // Network error
            return new Error('Network error. Please check your connection.');
        } else {
            // Other error
            return new Error(error.message || 'An unexpected error occurred.');
        }
    }
}

// Export singleton instance
export default DynamoDBService;
