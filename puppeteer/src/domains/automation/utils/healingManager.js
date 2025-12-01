import { logger } from '../../../shared/utils/logger.js';
import path from 'path';
import fsSync from 'fs';

export class HealingManager {
  async healAndRestart(params) {
    if (this._isProfileInitHealing(params)) {
      return await this._healProfileInit(params);
    } else {
      return await this._healSearch(params);
    }
  }

  
  _isProfileInitHealing(params) {
    return params.healPhase === 'profile-init' || 
           params.currentProcessingList !== undefined ||
           params.masterIndexFile !== undefined ||
           params.batchSize !== undefined;
  }

  
  async _healProfileInit(params) {
    logger.info('Initiating profile initialization healing', {
      requestId: params.requestId,
      recursionCount: params.recursionCount,
      healPhase: params.healPhase,
      healReason: params.healReason,
      currentProcessingList: params.currentProcessingList,
      currentBatch: params.currentBatch,
      currentIndex: params.currentIndex
    });

    const stateFile = this._createProfileInitStateFile(params);
    await this._launchProfileInitWorker(stateFile);
  }

  
  async _healSearch({
    companyName,
    companyRole,
    companyLocation,
    searchName,
    searchPassword,
    jwtToken,
    resumeIndex = 0,
    recursionCount = 0,
    lastPartialLinksFile = null,
    extractedCompanyNumber = null,
    extractedGeoNumber = null,
    healPhase = null,
    healReason = null,
  }) {
    logger.info('Initiating search healing', {
      recursionCount,
      healPhase,
      healReason,
      resumeIndex
    });

    const stateFile = this._createStateFile({
      companyName,
      companyRole,
      companyLocation,
      searchName,
      searchPassword,
      jwtToken,
      resumeIndex,
      recursionCount,
      lastPartialLinksFile,
      extractedCompanyNumber,
      extractedGeoNumber,
      healPhase,
      healReason
    });

    await this._launchWorkerProcess(stateFile);
  }

  
  _createProfileInitStateFile(stateData) {
    const timestamp = Date.now();
    const stateFile = path.join('data', `profile-init-heal-${timestamp}.json`);
    
    const profileInitState = {
      searchName: stateData.searchName,
      searchPassword: stateData.searchPassword,
      jwtToken: stateData.jwtToken,
      
      recursionCount: stateData.recursionCount || 0,
      healPhase: stateData.healPhase || 'profile-init',
      healReason: stateData.healReason || 'Unknown error',
      
      currentProcessingList: stateData.currentProcessingList || null,
      currentBatch: stateData.currentBatch || 0,
      currentIndex: stateData.currentIndex || 0,
      completedBatches: stateData.completedBatches || [],
      masterIndexFile: stateData.masterIndexFile,
      batchSize: stateData.batchSize || 100,
      totalConnections: stateData.totalConnections || { all: 0, pending: 0, sent: 0 },
      
      requestId: stateData.requestId,
      userProfileId: stateData.userProfileId,
      sessionId: stateData.sessionId,
      timestamp: new Date().toISOString()
    };

    fsSync.writeFileSync(stateFile, JSON.stringify(profileInitState, null, 2));
    
    logger.info(`Created profile init healing state file: ${stateFile}`, {
      requestId: stateData.requestId,
      recursionCount: profileInitState.recursionCount,
      healPhase: profileInitState.healPhase
    });
    
    return stateFile;
  }

  
  async _launchProfileInitWorker(stateFile) {
    const { spawn } = await import('child_process');
    const worker = spawn('node', ['profileInitWorker.js', stateFile], {
      detached: true,
      stdio: 'ignore'
    });
    worker.unref();
    
    logger.info(`Launched profile init healing worker with state file: ${stateFile}`);
  }

  _createStateFile(stateData) {
    const stateFile = path.join('data', `search-heal-${Date.now()}.json`);
    fsSync.writeFileSync(stateFile, JSON.stringify(stateData, null, 2));
    return stateFile;
  }

  async _launchWorkerProcess(stateFile) {
    const { spawn } = await import('child_process');
    const worker = spawn('node', ['searchWorker.js', stateFile], {
      detached: true,
      stdio: 'ignore'
    });
    worker.unref();
    logger.info(`Launched healing worker with state file: ${stateFile}`);
  }
}
