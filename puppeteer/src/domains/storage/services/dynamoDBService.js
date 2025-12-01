import axios from 'axios';
import { logger } from '../../shared/utils/logger.js';

const API_BASE_URL = process.env.API_GATEWAY_BASE_URL;

class DynamoDBService {
    constructor() {
        this.authToken = null;
        const normalizedBaseUrl = API_BASE_URL
            ? (API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`)
            : API_BASE_URL;

        this.apiClient = axios.create({
            baseURL: normalizedBaseUrl,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }


    async _post(path, body) {
        try {
            const response = await this.apiClient.post(path, body, { headers: this.getHeaders() });
            return response?.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    
    async _get(path, params = {}) {
        try {
            const response = await this.apiClient.get(path, {
                headers: this.getHeaders(),
                params
            });
            return response?.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    
    setAuthToken(token) {
        this.authToken = token;
    }

    
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        return headers;
    }

    
    async getProfileDetails(profileId) {
        try {
            const data = await this._get('profiles', {
                profileId: profileId
            });
            if (!data || !data.profile) return true;
            const { updatedAt, evaluated } = data.profile;
            const isStale = this._isStale(updatedAt);
            if (typeof evaluated === 'boolean') return evaluated === false ? true : isStale;
            return isStale;
        } catch (error) {
            logger.info(`getProfileDetails fallback: ${error.message}`);
            return true;
        }
    }

    _isStale(updatedAt) {
        if (!updatedAt) return true;
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
        return new Date(updatedAt) < oneMonthAgo;
    }

    
    async createBadContactProfile(profileId) {
        try {
            const response = await this.apiClient.post('profiles', {
                operation: 'create',
                profileId: profileId,
                updates: {
                    evaluated: true,
                    addedAt: new Date().toISOString(),
                    processedAt: new Date().toISOString(),
                }
            }, { headers: this.getHeaders() });

            return response.data;
        } catch (error) {
            logger.error('Error creating bad contact profile', { error: error.message });
            throw this.handleError(error);
        }
    }

    
    async markBadContact(profileId) {
        if (!profileId) throw new Error('profileId is required');
        try {
            await this.createBadContactProfile(profileId);
            logger?.info?.(`Marked bad contact profile: ${profileId}`);
            return true;
        } catch (error) {
            logger?.error?.(`Failed to mark bad contact for ${profileId}: ${error.message}`);
            throw error;
        }
    }

        
        async upsertEdgeStatus(profileId, status, extraUpdates = {}) {
            const now = new Date().toISOString();
            return await this._post('edge', {
                operation: 'upsert_status',
                profileId,
                updates: {status, ...extraUpdates, updatedAt: now}
            });
        }

    
    async checkEdgeExists(connectionProfileId) {
        try {
            const data = await this._post('edge', {
                operation: 'check_exists',
                linkedinurl: connectionProfileId
            });
            const exists = !!data?.result?.exists;
            logger.info(`Edge existence for ${connectionProfileId}: ${exists}`);
            return exists;
        } catch (error) {
            logger.warn(`checkEdgeExists failed for ${connectionProfileId}: ${error.message}`);
            return false;
        }
    }

    
    handleError(error) {
        if (error.response) {
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
            return new Error('Network error. Please check your connection.');
        } else {
            return new Error(error.message || 'An unexpected error occurred.');
        }
    }
}

export default DynamoDBService;
