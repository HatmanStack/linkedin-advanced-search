/**
 * RAGStack configuration module
 *
 * Provides configuration for connecting to RAGStack-Lambda's GraphQL API
 * for web scraping and knowledge base operations.
 */

export type ScrapeMode = 'AUTO' | 'FAST' | 'FULL';
export type ScrapeScope = 'SUBPAGES' | 'HOSTNAME' | 'DOMAIN';

export interface RagstackScrapeConfig {
  maxPages: number;
  maxDepth: number;
  scrapeMode: ScrapeMode;
  scope: ScrapeScope;
}

export interface RagstackRetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

export interface RagstackConfig {
  endpoint: string;
  apiKey: string;
  scrape: RagstackScrapeConfig;
  retry: RagstackRetryConfig;
  isConfigured: () => boolean;
}

/**
 * RAGStack configuration with environment variable overrides
 */
export const ragstackConfig: RagstackConfig = {
  endpoint: process.env.RAGSTACK_GRAPHQL_ENDPOINT || '',
  apiKey: process.env.RAGSTACK_API_KEY || '',

  scrape: {
    maxPages: parseInt(process.env.RAGSTACK_SCRAPE_MAX_PAGES || '5', 10),
    maxDepth: parseInt(process.env.RAGSTACK_SCRAPE_MAX_DEPTH || '1', 10),
    scrapeMode: (process.env.RAGSTACK_SCRAPE_MODE || 'FULL') as ScrapeMode,
    scope: 'SUBPAGES' as ScrapeScope,
  },

  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
  },

  /**
   * Check if RAGStack is properly configured
   * @returns true if both endpoint and apiKey are set
   */
  isConfigured(): boolean {
    return Boolean(this.endpoint && this.apiKey);
  },
};

export default ragstackConfig;
