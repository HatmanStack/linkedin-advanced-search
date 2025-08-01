export class ProfileInitStateManager {
  /**
   * Build initial state for profile initialization
   * @param {Object} params - State parameters
   * @returns {Object} Initial state object
   */
  static buildInitialState({
    searchName,
    searchPassword,
    jwtToken,
    recursionCount = 0,
    healPhase = null,
    healReason = null,
    currentProcessingList = 'all',
    currentBatch = 0,
    currentIndex = 0,
    completedBatches = [],
    masterIndexFile = null,
    batchSize = 100,
    totalConnections = { all: 0, pending: 0, sent: 0 },
    userProfileId = null,
    sessionId = null,
    ...opts
  }) {
    return {
      searchName,
      searchPassword,
      jwtToken,
      recursionCount,
      healPhase,
      healReason,
      currentProcessingList,
      currentBatch,
      currentIndex,
      completedBatches,
      masterIndexFile,
      batchSize,
      totalConnections,
      userProfileId,
      sessionId,
      timestamp: new Date().toISOString(),
      ...opts
    };
  }

  /**
   * Build state for healing/recovery scenarios
   * @param {Object} existingState - Current state
   * @param {Object} healingParams - Healing parameters
   * @returns {Object} Updated state for healing
   */
  static buildHealingState(existingState, healingParams) {
    return {
      ...existingState,
      recursionCount: (existingState.recursionCount || 0) + 1,
      healPhase: healingParams.healPhase || 'profile-init',
      healReason: healingParams.healReason || 'Unknown error',
      currentProcessingList: healingParams.currentProcessingList || existingState.currentProcessingList,
      currentBatch: healingParams.currentBatch || existingState.currentBatch,
      currentIndex: healingParams.currentIndex || existingState.currentIndex,
      completedBatches: healingParams.completedBatches || existingState.completedBatches,
      masterIndexFile: healingParams.masterIndexFile || existingState.masterIndexFile,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update state with batch processing progress
   * @param {Object} state - Current state
   * @param {Object} progress - Progress update
   * @returns {Object} Updated state
   */
  static updateBatchProgress(state, progress) {
    return {
      ...state,
      currentProcessingList: progress.currentProcessingList || state.currentProcessingList,
      currentBatch: progress.currentBatch !== undefined ? progress.currentBatch : state.currentBatch,
      currentIndex: progress.currentIndex !== undefined ? progress.currentIndex : state.currentIndex,
      completedBatches: progress.completedBatches || state.completedBatches,
      totalConnections: progress.totalConnections || state.totalConnections,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate required state fields
   * @param {Object} state - State to validate
   * @throws {Error} If validation fails
   */
  static validateState(state) {
    const requiredFields = ['searchName', 'searchPassword', 'jwtToken'];
    
    for (const field of requiredFields) {
      if (!state[field]) {
        throw new Error(`Missing required state field: ${field}`);
      }
    }

    // Validate batch processing fields if present
    if (state.currentBatch !== undefined && state.currentBatch < 0) {
      throw new Error('currentBatch must be non-negative');
    }

    if (state.currentIndex !== undefined && state.currentIndex < 0) {
      throw new Error('currentIndex must be non-negative');
    }

    if (state.batchSize !== undefined && state.batchSize <= 0) {
      throw new Error('batchSize must be positive');
    }

    // Validate connection list type
    const validConnectionTypes = ['all', 'pending', 'sent'];
    if (state.currentProcessingList && !validConnectionTypes.includes(state.currentProcessingList)) {
      throw new Error(`Invalid currentProcessingList: ${state.currentProcessingList}. Must be one of: ${validConnectionTypes.join(', ')}`);
    }
  }

  /**
   * Check if state indicates a healing scenario
   * @param {Object} state - State to check
   * @returns {boolean} True if healing is in progress
   */
  static isHealingState(state) {
    return !!(state.healPhase && state.healReason);
  }

  /**
   * Check if state indicates resumption from a previous session
   * @param {Object} state - State to check
   * @returns {boolean} True if resuming
   */
  static isResumingState(state) {
    return !!(
      state.masterIndexFile || 
      state.currentBatch > 0 || 
      state.currentIndex > 0 || 
      (state.completedBatches && state.completedBatches.length > 0)
    );
  }

  /**
   * Get progress summary from state
   * @param {Object} state - Current state
   * @returns {Object} Progress summary
   */
  static getProgressSummary(state) {
    const totalExpectedConnections = Object.values(state.totalConnections || {}).reduce((sum, count) => sum + count, 0);
    const completedBatches = state.completedBatches ? state.completedBatches.length : 0;
    const currentBatch = state.currentBatch || 0;
    const currentIndex = state.currentIndex || 0;
    const batchSize = state.batchSize || 100;

    // Estimate progress based on completed batches and current position
    const estimatedProcessed = (completedBatches * batchSize) + currentIndex;
    const progressPercentage = totalExpectedConnections > 0 
      ? Math.min(100, (estimatedProcessed / totalExpectedConnections) * 100)
      : 0;

    return {
      currentProcessingList: state.currentProcessingList || 'all',
      currentBatch,
      currentIndex,
      completedBatches,
      totalExpectedConnections,
      estimatedProcessed,
      progressPercentage: Math.round(progressPercentage * 100) / 100,
      isHealing: this.isHealingState(state),
      isResuming: this.isResumingState(state),
      recursionCount: state.recursionCount || 0
    };
  }

  /**
   * Create state for specific healing scenarios
   * @param {Object} baseState - Base state
   * @param {string} healPhase - Healing phase identifier
   * @param {string} healReason - Reason for healing
   * @param {Object} additionalParams - Additional healing parameters
   * @returns {Object} Healing state
   */
  static createHealingState(baseState, healPhase, healReason, additionalParams = {}) {
    return this.buildHealingState(baseState, {
      healPhase,
      healReason,
      ...additionalParams
    });
  }

  /**
   * Reset state for fresh start while preserving authentication
   * @param {Object} state - Current state
   * @returns {Object} Reset state
   */
  static resetProcessingState(state) {
    return {
      ...state,
      currentProcessingList: 'all',
      currentBatch: 0,
      currentIndex: 0,
      completedBatches: [],
      masterIndexFile: null,
      healPhase: null,
      healReason: null,
      timestamp: new Date().toISOString()
    };
  }
}