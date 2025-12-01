import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../shared/utils/logger.js';

const SESSIONS_FILE = path.join(process.cwd(), 'data', 'heal-restore-sessions.json');

async function loadSessions() {
  try {
    const data = await fs.readFile(SESSIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveSessions(sessions) {
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

export async function waitForHealAndRestoreAuthorization(sessionId) {
  const sessions = await loadSessions();
  sessions[sessionId] = {
    timestamp: Date.now(),
    status: 'pending'
  };
  await saveSessions(sessions);
  logger.info(`Waiting for heal and restore authorization for session: ${sessionId}`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(async () => {
      const sessions = await loadSessions();
      delete sessions[sessionId];
      await saveSessions(sessions);
      reject(new Error('Heal and restore authorization timeout'));
    }, 3600000);

    const checkAuthorization = async () => {
      const sessions = await loadSessions();
      const session = sessions[sessionId];
      
      if (!session) {
        clearTimeout(timeout);
        resolve();
        return;
      }
      
      if (session.status === 'authorized') {
        delete sessions[sessionId];
        await saveSessions(sessions);
        clearTimeout(timeout);
        resolve();
        return;
      }

      if (session.status === 'cancelled') {
        delete sessions[sessionId];
        await saveSessions(sessions);
        clearTimeout(timeout);
        reject(new Error('Heal and restore cancelled'));
        return;
      }
      
      setTimeout(checkAuthorization, 1000);
    };

    checkAuthorization();
  });
}

export async function authorizeHealAndRestore(sessionId) {
  const sessions = await loadSessions();
  const session = sessions[sessionId];
  
  if (session && session.status === 'pending') {
    sessions[sessionId].status = 'authorized';
    await saveSessions(sessions);
    logger.info(`Heal and restore authorized for session: ${sessionId}`);
    return true;
  }
  
  return false;
}

export async function cancelHealAndRestore(sessionId) {
  const sessions = await loadSessions();
  const session = sessions[sessionId];

  if (session && session.status === 'pending') {
    sessions[sessionId].status = 'cancelled';
    await saveSessions(sessions);
    logger.info(`Heal and restore cancelled for session: ${sessionId}`);
    return true;
  }

  return false;
}

export async function getPendingAuthorizations() {
  const sessions = await loadSessions();
  return Object.entries(sessions)
    .filter(([_, data]) => data.status === 'pending')
    .map(([sessionId, data]) => ({
      sessionId,
      timestamp: data.timestamp
    }));
}
