export class ProfileInitStateManager {
  
  static buildInitialState({
    searchName,
    searchPassword,
    credentialsCiphertext,
    jwtToken,
    recursionCount = 0,
    healPhase = null,
    healReason = null,
    currentProcessingList = null,
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
      credentialsCiphertext,
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

  
  static validateState(state) {
    const hasPlain = !!(state.searchName && state.searchPassword);
    const hasCipher = typeof state.credentialsCiphertext === 'string' && state.credentialsCiphertext.startsWith('sealbox_x25519:b64:');
    if (!hasPlain && !hasCipher) {
      throw new Error('Missing required credentials: provide searchName/searchPassword or credentialsCiphertext');
    }
    if (!state.jwtToken) {
      throw new Error('Missing required state field: jwtToken');
    }

    if (state.currentBatch !== undefined && state.currentBatch < 0) {
      throw new Error('currentBatch must be non-negative');
    }

    if (state.currentIndex !== undefined && state.currentIndex < 0) {
      throw new Error('currentIndex must be non-negative');
    }

    if (state.batchSize !== undefined && state.batchSize <= 0) {
      throw new Error('batchSize must be positive');
    }

    const validConnectionTypes = ['ally', 'incoming', 'outgoing'];
    if (
      state.currentProcessingList !== undefined &&
      state.currentProcessingList !== null &&
      state.currentProcessingList !== '' &&
      !validConnectionTypes.includes(state.currentProcessingList)
    ) {
      throw new Error(`Invalid currentProcessingList: ${state.currentProcessingList}. Must be one of: ${validConnectionTypes.join(', ')}`);
    }
  }

  
  static isHealingState(state) {
    return !!(state.healPhase && state.healReason);
  }

  
  static isResumingState(state) {
    return !!(
      state.masterIndexFile || 
      state.currentBatch > 0 || 
      state.currentIndex > 0 || 
      (state.completedBatches && state.completedBatches.length > 0)
    );
  }

  
  static getProgressSummary(state) {
    const totalExpectedConnections = Object.values(state.totalConnections || {}).reduce((sum, count) => sum + count, 0);
    const completedBatches = state.completedBatches ? state.completedBatches.length : 0;
    const currentBatch = state.currentBatch || 0;
    const currentIndex = state.currentIndex || 0;
    const batchSize = state.batchSize || 100;

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

  
  static createHealingState(baseState, healPhase, healReason, additionalParams = {}) {
    return this.buildHealingState(baseState, {
      healPhase,
      healReason,
      ...additionalParams
    });
  }

  
  static createListCreationHealingState(baseState, connectionType, expansionAttempt, currentFileIndex, masterIndex, healReason) {
    return {
      ...baseState,
      recursionCount: (baseState.recursionCount || 0) + 1,
      healPhase: 'list-creation',
      healReason: healReason,
      currentProcessingList: connectionType,
      listCreationState: {
        connectionType: connectionType,
        expansionAttempt: expansionAttempt,
        currentFileIndex: currentFileIndex,
        masterIndexFile: baseState.masterIndexFile,
        lastSavedFile: masterIndex?.files?.[`${connectionType}Connections`]?.slice(-1)?.[0] || null,
        resumeFromExpansion: true
      },
      timestamp: new Date().toISOString()
    };
  }

  
  static updateListCreationProgress(state, progress) {
    return {
      ...state,
      currentProcessingList: progress.connectionType || state.currentProcessingList,
      listCreationState: {
        ...state.listCreationState,
        expansionAttempt: progress.expansionAttempt !== undefined ? progress.expansionAttempt : state.listCreationState?.expansionAttempt,
        currentFileIndex: progress.currentFileIndex !== undefined ? progress.currentFileIndex : state.listCreationState?.currentFileIndex,
        lastSavedFile: progress.lastSavedFile || state.listCreationState?.lastSavedFile,
        totalLinksCollected: progress.totalLinksCollected || state.listCreationState?.totalLinksCollected
      },
      timestamp: new Date().toISOString()
    };
  }

  
  static isListCreationHealingState(state) {
    return state.healPhase === 'list-creation' && !!state.listCreationState;
  }

  
  static getListCreationResumeParams(state) {
    if (!this.isListCreationHealingState(state)) {
      return null;
    }

    return {
      connectionType: state.listCreationState.connectionType,
      expansionAttempt: state.listCreationState.expansionAttempt || 0,
      currentFileIndex: state.listCreationState.currentFileIndex || 0,
      masterIndexFile: state.listCreationState.masterIndexFile,
      lastSavedFile: state.listCreationState.lastSavedFile,
      resumeFromExpansion: state.listCreationState.resumeFromExpansion || false,
      totalLinksCollected: state.listCreationState.totalLinksCollected || 0
    };
  }

  
  static resetProcessingState(state) {
    return {
      ...state,
      currentProcessingList: 'ally',
      currentBatch: 0,
      currentIndex: 0,
      completedBatches: [],
      masterIndexFile: null,
      healPhase: null,
      healReason: null,
      listCreationState: null,
      timestamp: new Date().toISOString()
    };
  }
}