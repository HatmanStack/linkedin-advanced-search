import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS
  frontendUrls: process.env.FRONTEND_URLS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  
  // LinkedIn Search
  linkedin: {
    recencyHours: parseInt(process.env.RECENCY_HOURS) || 6,
    recencyDays: parseInt(process.env.RECENCY_DAYS) || 5,
    recencyWeeks: parseInt(process.env.RECENCY_WEEKS) || 3,
    historyToCheck: parseInt(process.env.HISTORY_TO_CHECK) || 4,
    threshold: parseInt(process.env.THRESHOLD) || 8,
    pageNumberStart: parseInt(process.env.PAGE_NUMBER_START) || 1,
    pageNumberEnd: parseInt(process.env.PAGE_NUMBER_END) || 100,
  },
  
  // Google AI
  googleAI: {
    apiKey: process.env.GOOGLE_AI_API_KEY || '',
  },

  // Puppeteer
  puppeteer: {
    headless: process.env.HEADLESS === 'true',
    slowMo: parseInt(process.env.SLOW_MO) || 50,
    viewport: {
      width: parseInt(process.env.VIEWPORT_WIDTH) || 1200,
      height: parseInt(process.env.VIEWPORT_HEIGHT) || 1200,
    },
  },
  
  // Timeouts
  timeouts: {
    default: parseInt(process.env.DEFAULT_TIMEOUT) || 30000,
    navigation: parseInt(process.env.NAVIGATION_TIMEOUT) || 50000,
    login: parseInt(process.env.LOGIN_SECURITY_TIMEOUT) || 0,
  },
  
  // File Paths
  paths: {
    screenshots: process.env.SCREENSHOTS_DIR || './screenshots',
    linksFile: process.env.LINKS_FILE || './data/possible-links.json',
    goodConnectionsFile: process.env.GOOD_CONNECTIONS_FILE || './data/good-connections-links.json',
  },
};

export default config;