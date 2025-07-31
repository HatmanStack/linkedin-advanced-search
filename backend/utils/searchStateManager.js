export class SearchStateManager {
  static buildInitialState({
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
    ...opts
  }) {
    return {
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
      healReason,
      ...opts
    };
  }
}
