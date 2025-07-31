import { logger } from './logger.js';
import path from 'path';
import fsSync from 'fs';

export class HealingManager {
  async healAndRestart({
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
