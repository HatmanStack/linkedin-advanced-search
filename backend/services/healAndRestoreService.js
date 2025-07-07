import { logger } from '../utils/logger.js';

// Simple in-memory storage for heal and restore authorization
const pendingAuthorizations = new Map();

// Function to wait for heal and restore authorization
export async function waitForHealAndRestoreAuthorization(sessionId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingAuthorizations.delete(sessionId);
      reject(new Error('Heal and restore authorization timeout'));
    }, 3600000); // 60 minute timeout

    pendingAuthorizations.set(sessionId, {
      resolve,
      reject,
      timeout,
      timestamp: Date.now()
    });

    logger.info(`Waiting for heal and restore authorization for session: ${sessionId}`);
  });
}

// Function to authorize heal and restore (called by API endpoint)
export function authorizeHealAndRestore(sessionId) {
  const pending = pendingAuthorizations.get(sessionId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingAuthorizations.delete(sessionId);
    pending.resolve();
    logger.info(`Heal and restore authorized for session: ${sessionId}`);
    return true;
  }
  return false;
}

// Function to check for pending authorizations (called by API endpoint)
export function getPendingAuthorizations() {
  return Array.from(pendingAuthorizations.entries()).map(([sessionId, data]) => ({
    sessionId,
    timestamp: data.timestamp
  }));
}
