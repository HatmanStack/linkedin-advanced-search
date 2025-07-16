import { logger } from '../utils/logger.js';

class EdgeService {
    constructor() {
        this.apiGatewayUrl = process.env.API_GATEWAY_URL;
    }

    async checkAndCreateEdges(userId, linkedinUrl) {
        try {
            logger.info(`Calling edge processing API for user ${userId} and profile ${linkedinUrl}`);
            
            await new Promise(resolve => setTimeout(resolve, 30000));

            const response = await fetch(`${this.apiGatewayUrl}/edge-processing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.JWT_TOKEN || 'placeholder-token'}`
                },
                body: JSON.stringify({
                    linkedinurl: linkedinUrl,
                    userId: userId
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
}

export default EdgeService;
