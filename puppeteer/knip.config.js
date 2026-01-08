/** @type {import('knip').KnipConfig} */
module.exports = {
  entry: [
    'src/server.js',
    'routes/**/*.js',
    'profileInitWorker.js',
    'searchWorker.js',
  ],
  project: [
    'src/**/*.js',
    'routes/**/*.js',
    'utils/**/*.js',
    '*.js',
  ],
  ignore: [
    // Test files
    'src/**/*.test.js',
    'src/**/*.spec.js',
    'src/setupTests.js',
    // Config files
    'eslint.config.js',
    'vitest.config.js',
    'knip.config.js',
  ],
  ignoreDependencies: [
    // Testing dependencies
    'vitest',
    '@vitest/*',
    // Runtime dependencies loaded dynamically
    'puppeteer-core',
  ],
};
