export {
  mockUser,
  mockCognitoService,
  resetCognitoMocks,
  createMockCognitoService,
} from './cognitoService';

export {
  mockSearchResult,
  mockConnection,
  mockMessage,
  mockPuppeteerApiService,
  mockLambdaApiService,
  resetApiMocks,
  createMockPuppeteerApiService,
  createMockLambdaApiService,
} from './apiServices';

export {
  mockCognitoConfig,
  mockApiConfig,
  mockStorageKeys,
  mockUiConfig,
  mockAppConfig,
  setIsCognitoConfigured,
  resetAppConfigMocks,
  createMockAppConfig,
} from './appConfig';

export const resetAllMocks = async () => {
  const cognitoModule = await import('./cognitoService');
  const apiModule = await import('./apiServices');
  const appConfigModule = await import('./appConfig');

  cognitoModule.resetCognitoMocks();
  apiModule.resetApiMocks();
  appConfigModule.resetAppConfigMocks();
};
