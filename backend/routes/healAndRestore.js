import express from 'express';
import { authorizeHealAndRestore, getPendingAuthorizations } from '../services/healAndRestoreService.js';

const router = express.Router();

// Get pending heal and restore sessions
router.get('/status', async (req, res) => {
  try {
    const pendingSessions = await getPendingAuthorizations();
    const pendingSession = pendingSessions.length > 0 ? pendingSessions[0] : null;
    
    res.json({
      success: true,
      data: { pendingSession }
    });
  } catch (error) {
    console.error('Error getting heal and restore status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

// Authorize heal and restore
router.post('/authorize', async (req, res) => {
  try {
    const { sessionId, autoApprove } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    const success = await authorizeHealAndRestore(sessionId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Heal and restore authorized successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Session not found or already processed'
      });
    }
  } catch (error) {
    console.error('Error authorizing heal and restore:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to authorize'
    });
  }
});

export default router;
