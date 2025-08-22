import express from 'express';
import SearchController from '@/controllers/searchController.js';

const router = express.Router();
const searchController = new SearchController();

// Main search endpoint
router.post('/', async (req, res) => {
  await searchController.performSearch(req, res);
});

// Get stored results
router.get('/results', async (req, res) => {
  await searchController.getStoredResults(req, res);
});

// Health check
router.get('/health', async (req, res) => {
  await searchController.getHealthCheck(req, res);
});

export default router;