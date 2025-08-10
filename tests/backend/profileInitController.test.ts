import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for backend utilities/services
vi.mock('../../puppeteer-backend/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../puppeteer-backend/utils/profileInitStateManager.js', () => ({
  ProfileInitStateManager: {
    buildInitialState: vi.fn(() => ({ requestId: 'req-1', recursionCount: 0 })),
    validateState: vi.fn(),
    isResumingState: vi.fn(() => false),
    createHealingState: vi.fn((state: any) => ({ ...state, recursionCount: (state.recursionCount || 0) + 1 })),
  },
}));

vi.mock('../../puppeteer-backend/utils/profileInitMonitor.js', () => ({
  profileInitMonitor: {
    startRequest: vi.fn(),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    recordHealing: vi.fn(),
  },
}));

vi.mock('../../puppeteer-backend/services/puppeteerService.js', () => ({
  default: vi.fn().mockImplementation(() => ({ initialize: vi.fn(), close: vi.fn() })),
}));

vi.mock('../../puppeteer-backend/services/linkedinService.js', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../puppeteer-backend/services/linkedinContactService.js', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../puppeteer-backend/services/dynamoDBService.js', () => ({
  default: vi.fn().mockImplementation(() => ({ setAuthToken: vi.fn() })),
}));

// Import after mocks
import { ProfileInitController } from '../../puppeteer-backend/controllers/profileInitController.js';
import { ProfileInitStateManager } from '../../puppeteer-backend/utils/profileInitStateManager.js';
import { profileInitMonitor } from '../../puppeteer-backend/utils/profileInitMonitor.js';

describe('ProfileInitController (backend, vitest)', () => {
  let controller: ProfileInitController;
  let req: any;
  let res: any;

  beforeEach(() => {
    controller = new ProfileInitController();
    req = {
      method: 'POST',
      url: '/api/profile-init',
      headers: { authorization: 'Bearer token', 'user-agent': 'vitest', 'content-type': 'application/json' },
      body: { linkedinCredentialsCiphertext: 'sealbox_x25519:b64:abc' },
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    vi.clearAllMocks();
  });

  it('rejects requests without JWT token', async () => {
    req.headers.authorization = undefined;
    await controller.performProfileInit(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Missing or invalid Authorization header' }));
  });

  it('accepts valid request and returns success payload', async () => {
    // Stub internal flow to bypass heavy work
    const mockResult = { success: true, data: { processed: 1, skipped: 0, errors: 0 } } as any;
    // @ts-expect-error private method monkey patch for test
    controller.performProfileInitFromState = vi.fn().mockResolvedValue(mockResult);

    await controller.performProfileInit(req, res);

    expect(ProfileInitStateManager.buildInitialState).toHaveBeenCalled();
    expect(profileInitMonitor.startRequest).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', data: mockResult }));
  });

  it('returns 202 and records healing when service indicates healing in progress', async () => {
    // Make performProfileInitFromState resolve undefined to simulate healing
    // @ts-expect-error private method monkey patch for test
    controller.performProfileInitFromState = vi.fn().mockResolvedValue(undefined);

    await controller.performProfileInit(req, res);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'healing' }));
    expect(profileInitMonitor.recordHealing).toHaveBeenCalled();
  });

  it('returns 500 for unhandled errors and records failure', async () => {
    const err = new Error('Unexpected error');
    // @ts-expect-error private method monkey patch for test
    controller.performProfileInitFromState = vi.fn().mockRejectedValue(err);

    await controller.performProfileInit(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(profileInitMonitor.recordFailure).toHaveBeenCalled();
  });
});


