import axios from 'axios';
import { logger } from '#utils/logger.js';
import config from '#config';

// Circuit breaker states
const CIRCUIT_CLOSED = 'closed';
const CIRCUIT_OPEN = 'open';
const CIRCUIT_HALF_OPEN = 'half-open';

// Class-level static state (survives across instances, not process restarts)
let _circuitState = CIRCUIT_CLOSED;
let _consecutiveFailures = 0;
let _circuitOpenedAt = null;
let _rateLimitCache = null;
let _rateLimitCacheExpiry = 0;

const FAILURE_THRESHOLD = 3;
const RECOVERY_TIMEOUT_MS = 30_000; // 30 seconds
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 5_000; // 5 seconds

class ControlPlaneService {
  constructor() {
    const cp = config.controlPlane || {};
    this._url = cp.url;
    this._deploymentId = cp.deploymentId;
    this._apiKey = cp.apiKey;

    if (this._url) {
      this._client = axios.create({
        baseURL: this._url.endsWith('/') ? this._url : `${this._url}/`,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          ...(this._apiKey ? { 'x-api-key': this._apiKey } : {}),
        },
      });
    }
  }

  /**
   * Whether the control plane is configured and usable.
   */
  get isConfigured() {
    return Boolean(this._url);
  }

  // ─── Circuit Breaker ───────────────────────────────────────────────

  _isCircuitOpen() {
    if (_circuitState === CIRCUIT_OPEN) {
      const elapsed = Date.now() - _circuitOpenedAt;
      if (elapsed >= RECOVERY_TIMEOUT_MS) {
        _circuitState = CIRCUIT_HALF_OPEN;
        logger.debug('Control plane circuit breaker: half-open (testing)');
        return false;
      }
      return true;
    }
    return false;
  }

  _recordSuccess() {
    _consecutiveFailures = 0;
    if (_circuitState === CIRCUIT_HALF_OPEN) {
      _circuitState = CIRCUIT_CLOSED;
      logger.debug('Control plane circuit breaker: closed (recovered)');
    }
  }

  _recordFailure(error) {
    _consecutiveFailures += 1;
    if (_consecutiveFailures >= FAILURE_THRESHOLD && _circuitState !== CIRCUIT_OPEN) {
      _circuitState = CIRCUIT_OPEN;
      _circuitOpenedAt = Date.now();
      logger.warn('Control plane circuit breaker: open', {
        failures: _consecutiveFailures,
        error: error?.message,
      });
    }
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Fetch dynamic rate limits from the control plane.
   * Returns null when not configured, circuit is open, or on error.
   * Cached for CACHE_TTL_MS.
   */
  async syncRateLimits() {
    if (!this.isConfigured) return null;
    if (this._isCircuitOpen()) return _rateLimitCache;

    // Return cached value if still fresh
    if (_rateLimitCache && Date.now() < _rateLimitCacheExpiry) {
      return _rateLimitCache;
    }

    try {
      const params = this._deploymentId ? { deploymentId: this._deploymentId } : {};
      const response = await this._client.get('rate-limits', { params });
      this._recordSuccess();

      _rateLimitCache = response.data;
      _rateLimitCacheExpiry = Date.now() + CACHE_TTL_MS;
      return _rateLimitCache;
    } catch (error) {
      this._recordFailure(error);
      logger.debug('Control plane syncRateLimits failed', { error: error.message });
      return _rateLimitCache; // return stale cache or null
    }
  }

  /**
   * Report an interaction to the control plane (fire-and-forget).
   * Never throws. Logs errors at debug level.
   */
  reportInteraction(operation, metadata = {}) {
    if (!this.isConfigured) return;
    if (this._isCircuitOpen()) return;

    const payload = {
      deploymentId: this._deploymentId,
      operation,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Fire and forget — do not await
    this._client.post('report-interaction', payload).then(
      () => this._recordSuccess(),
      (error) => {
        this._recordFailure(error);
        logger.debug('Control plane reportInteraction failed', { error: error.message });
      }
    );
  }

  /**
   * Register this deployment with the control plane.
   * Returns { deploymentId, controlPlaneApiKey } on success, null on failure.
   */
  async register(stackInfo) {
    if (!this.isConfigured) return null;

    try {
      const response = await this._client.post('register', stackInfo);
      this._recordSuccess();
      return response.data;
    } catch (error) {
      this._recordFailure(error);
      logger.warn('Control plane registration failed', { error: error.message });
      return null;
    }
  }

  // ─── Testing helpers ───────────────────────────────────────────────

  /**
   * Reset all class-level static state. For tests only.
   */
  static _resetState() {
    _circuitState = CIRCUIT_CLOSED;
    _consecutiveFailures = 0;
    _circuitOpenedAt = null;
    _rateLimitCache = null;
    _rateLimitCacheExpiry = 0;
  }

  /**
   * Expose internals for assertions. For tests only.
   */
  static _getState() {
    return {
      circuitState: _circuitState,
      consecutiveFailures: _consecutiveFailures,
      circuitOpenedAt: _circuitOpenedAt,
      rateLimitCache: _rateLimitCache,
      rateLimitCacheExpiry: _rateLimitCacheExpiry,
    };
  }
}

export default ControlPlaneService;
