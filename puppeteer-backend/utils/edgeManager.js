import { logger } from '../utils/logger.js';

/**
 * Centralized helpers for creating and marking contact edges via DynamoDBService.
 * All functions expect a live instance of dynamoDBService with auth token set.
 */

/**
 * Ensure an edge exists for a given profile with the provided status.
 * Performs a best-effort existence check to avoid duplicate writes.
 */
export async function ensureEdge(dynamoDBService, profileId, status) {
  if (!dynamoDBService) throw new Error('dynamoDBService is required');
  if (!profileId) throw new Error('profileId is required');
  if (!status) throw new Error('status is required');

  try {
    let exists = false;
    try {
      exists = await dynamoDBService.checkEdgeExists(profileId);
    } catch (e) {
      logger?.warn?.(`Edge existence check failed for ${profileId}: ${e.message}`);
      exists = false; // allow create to proceed
    }

    if (exists) {
      logger?.debug?.(`Edge already exists for ${profileId}; skipping create for status=${status}`);
      return { created: false, existed: true, status };
    }

    await dynamoDBService.createGoodContactEdges(profileId, status);
    logger?.info?.(`Edge created for ${profileId} with status=${status}`);
    return { created: true, existed: false, status };
  } catch (error) {
    logger?.error?.(`Failed to ensure edge for ${profileId} (status=${status}): ${error.message}`);
    throw error;
  }
}

/**
 * Mark a profile as bad contact.
 */
export async function markBadContact(dynamoDBService, profileId) {
  if (!dynamoDBService) throw new Error('dynamoDBService is required');
  if (!profileId) throw new Error('profileId is required');
  try {
    await dynamoDBService.createBadContactProfile(profileId);
    logger?.info?.(`Marked bad contact profile: ${profileId}`);
    return true;
  } catch (error) {
    logger?.error?.(`Failed to mark bad contact for ${profileId}: ${error.message}`);
    throw error;
  }
}


