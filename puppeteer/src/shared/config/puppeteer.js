export const puppeteerConfig = {
  HEADLESS: process.env.PUPPETEER_HEADLESS !== 'false',
  SLOW_MO: process.env.PUPPETEER_SLOW_MO ? parseInt(process.env.PUPPETEER_SLOW_MO) : 0,
  DEFAULT_TIMEOUT: 30000,
  DEFAULT_NAVIGATION_TIMEOUT: 30000,

  BROWSER_ARGS: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
  ],

  VIEWPORT: {
    width: 1920,
    height: 1080,
  },
};
