/**
 * Session management types for browser automation.
 */

import type { Page, Browser } from 'puppeteer';

/**
 * Memory usage statistics from Node.js process.
 */
export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers?: number;
}

/**
 * Comprehensive session health status.
 */
export interface SessionHealthStatus {
  /** Whether a browser instance exists */
  isActive: boolean;
  /** Whether the session is responding and usable */
  isHealthy: boolean;
  /** Whether LinkedIn authentication is confirmed */
  isAuthenticated: boolean;
  /** Timestamp of last activity */
  lastActivity: Date | null;
  /** Session age in milliseconds */
  sessionAge: number;
  /** Count of errors since session start */
  errorCount: number;
  /** Current memory usage */
  memoryUsage: MemoryUsage;
  /** Current page URL if available */
  currentUrl: string | null;
}

/**
 * Options for session initialization.
 */
export interface SessionInitOptions {
  /** Whether to reinitialize if current session is unhealthy */
  reinitializeIfUnhealthy?: boolean;
}

/**
 * Interface for PuppeteerService browser wrapper.
 */
export interface IPuppeteerService {
  initialize(): Promise<Page>;
  getBrowser(): Browser | null;
  getPage(): Page | null;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForSelector(
    selector: string,
    options?: { timeout?: number; visible?: boolean }
  ): Promise<unknown>;
  close(): Promise<void>;
}

/**
 * Interface for session management.
 * Allows for dependency injection and testing.
 */
export interface ISessionManager {
  /** Get or create session instance */
  getInstance(options?: SessionInitOptions): Promise<IPuppeteerService>;
  /** Check if current session is healthy */
  isSessionHealthy(): Promise<boolean>;
  /** Get detailed health status */
  getHealthStatus(): Promise<SessionHealthStatus>;
  /** Clean up session resources */
  cleanup(): Promise<void>;
  /** Attempt to recover from errors */
  recover(): Promise<IPuppeteerService>;
  /** Update authentication status */
  setAuthenticationStatus(authenticated: boolean): void;
  /** Record an error and potentially trigger recovery */
  recordError(error: Error): Promise<boolean>;
  /** Last activity timestamp */
  lastActivity: Date | null;
}

/**
 * Configuration for session management.
 */
export interface SessionConfig {
  /** Maximum errors before forced recovery */
  maxErrors: number;
  /** Session timeout in milliseconds */
  timeout: number;
}
