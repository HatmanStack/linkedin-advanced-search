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

export const resetAllMocks = () => {
  const { resetCognitoMocks } = require('./cognitoService');
  const { resetApiMocks } = require('./apiServices');
  const { resetAppConfigMocks } = require('./appConfig');

  resetCognitoMocks();
  resetApiMocks();
  resetAppConfigMocks();
};
