import { logger } from '../utils/logger.js';

class DynamoDBService {
    constructor() {
        this.apiGatewayUrl = process.env.API_GATEWAY_BASE_URL;
    }

    /**
     * Check if a profile has been processed recently
     * @param {string} profileId - The LinkedIn profile ID
     * @param {number} hoursThreshold - Hours to consider "recent" (default: 24)
     * @returns {Promise<{shouldProcess: boolean, reason: string, lastProcessed?: string}>}
     */
    async checkProfileRecentlyProcessed(profileId, userId, hoursThreshold = 24) {
        try {
            logger.info(`Checking if profile ${profileId} was processed recently (within ${hoursThreshold} hours)`);
            
            const response = await fetch(`${this.apiGatewayUrl}/edges/check-processed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.jwtToken}`
                },
                body: JSON.stringify({
                    operation: 'get_last_updated',
                    updates: {
                        limit: 1,
                        days_back: Math.ceil(hoursThreshold / 24) // Convert hours to days, round up
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                logger.error(`Failed to check profile processing status: ${response.status}`, errorData);
                // If API call fails, allow processing to continue
                return {
                    shouldProcess: true,
                    reason: 'API call failed, allowing processing to continue'
                };
            }

            const result = await response.json();
            
            if (result.result && result.result.success && result.result.profiles) {
                // Check if this specific profile was processed recently
                const recentProfile = result.result.profiles.find(profile => 
                    profile.linkedin_url && profile.linkedin_url.includes(profileId)
                );

                if (recentProfile && recentProfile.hours_ago <= hoursThreshold) {
                    logger.info(`Profile ${profileId} was processed ${recentProfile.hours_ago} hours ago - skipping`);
                    return {
                        shouldProcess: false,
                        reason: `Profile processed ${recentProfile.hours_ago} hours ago`,
                        lastProcessed: recentProfile.last_updated
                    };
                }
            }

            logger.info(`Profile ${profileId} not found in recent processing - proceeding with analysis`);
            return {
                shouldProcess: true,
                reason: 'Profile not processed recently or not found in recent activity'
            };

        } catch (error) {
            logger.error('Error checking profile processing status:', error);
            // If there's an error, allow processing to continue
            return {
                shouldProcess: true,
                reason: 'Error checking status, allowing processing to continue'
            };
        }
    }

    /**
     * Mark a profile as processed with a specific status
     * @param {string} profileId - The LinkedIn profile ID
     * @param {string} status - The processing status ('good_contact', 'bad_contact', 'processed', etc.)
     * @param {Date} date - The processing date (defaults to now)
     * @param {Object} additionalData - Any additional data to store
     * @returns {Promise<boolean>} - Success status
     */
    async markProfileAsProcessed(profileId, userId, status = 'processed', date = new Date(), additionalData = {}) {
        try {
            logger.info(`Marking profile ${profileId} as processed with status: ${status}`);
            
            const linkedinUrl = `https://www.linkedin.com/in/${profileId}`;
            
            const response = await fetch(`${this.apiGatewayUrl}/edges/mark-processed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.jwtToken}`
                },
                body: JSON.stringify({
                    linkedinurl: linkedinUrl,
                    operation: 'create',
                    updates: {
                        status: status,
                        processedAt: date.toISOString(),
                        addedAt: date.toISOString(),
                        ...additionalData
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                logger.error(`Failed to mark profile as processed: ${response.status}`, errorData);
                return false;
            }

            const result = await response.json();
            logger.info(`Successfully marked profile ${profileId} as processed:`, result);
            return true;

        } catch (error) {
            logger.error('Error marking profile as processed:', error);
            return false;
        }
    }

    /**
     * Create or update edges between user and profile (legacy method from edgeService)
     * @param {string} userId - The user ID
     * @param {string} linkedinUrl - The LinkedIn profile URL
     * @returns {Promise<boolean>} - Success status
     */
    async checkAndCreateEdges(userId, linkedinUrl) {
        try {
            logger.info(`Calling edge processing API for user ${userId} and profile ${linkedinUrl}`);
            
            // Add delay as in original edgeService
            await new Promise(resolve => setTimeout(resolve, 60000));

            const response = await fetch(`${this.apiGatewayUrl}/edges/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.jwtToken}`
                },
                body: JSON.stringify({
                    linkedinurl: linkedinUrl,
                    operation: 'create',
                    updates: {
                        status: 'good_contact',
                        addedAt: new Date().toISOString()
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                logger.error(`API Gateway call failed with status ${response.status}:`, errorData);
                return false;
            }

            const result = await response.json();
            logger.info(`Edge processing API response:`, result);
            return true;

        } catch (error) {
            logger.error('Error calling edge processing API:', error);
            return false;
        }
    }

    /**
     * Update profile status (e.g., from 'processed' to 'good_contact' or 'bad_contact')
     * @param {string} profileId - The LinkedIn profile ID
     * @param {string} newStatus - The new status
     * @param {Object} additionalUpdates - Additional fields to update
     * @returns {Promise<boolean>} - Success status
     */
    async updateProfileStatus(profileId, userId, newStatus, additionalUpdates = {}) {
        try {
            logger.info(`Updating profile ${profileId} status to: ${newStatus}`);
            
            const linkedinUrl = `https://www.linkedin.com/in/${profileId}`;
            
            const response = await fetch(`${this.apiGatewayUrl}/edges/update-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.jwtToken}`
                },
                body: JSON.stringify({
                    linkedinurl: linkedinUrl,
                    operation: 'update_status',
                    updates: {
                        status: newStatus,
                        updatedAt: new Date().toISOString(),
                        ...additionalUpdates
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                logger.error(`Failed to update profile status: ${response.status}`, errorData);
                return false;
            }

            const result = await response.json();
            logger.info(`Successfully updated profile ${profileId} status:`, result);
            return true;

        } catch (error) {
            logger.error('Error updating profile status:', error);
            return false;
        }
    }
}

export default DynamoDBService;