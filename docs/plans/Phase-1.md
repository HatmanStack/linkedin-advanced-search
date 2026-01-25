# Phase 1: Security Hardening

## Phase Goal

Implement security fixes for the puppeteer backend: JWT validation with expiration checking and credential encryption for healing state files. Also configure Cognito token TTL to 4 hours in the SAM template.

**Success criteria:**
- JWTs with expired `exp` claims are rejected with 401
- JWTs missing required structure are rejected with 401
- Healing state files contain encrypted credentials (sealbox format)
- Cognito access tokens expire after 4 hours
- All existing tests pass
- New tests cover validation and encryption logic

**Estimated tokens:** ~25,000

---

## Prerequisites

- Phase-0 complete (patterns and ADRs understood)
- Access to puppeteer codebase
- Access to backend SAM template
- Understanding of libsodium sealbox encryption (see `puppeteer/src/shared/utils/crypto.js`)

---

## Task 1: JWT Expiration and Structure Validation

**Goal:** Prevent forged or expired JWTs from being accepted by the puppeteer backend. The current implementation at `linkedinInteractionController.js:700-742` parses JWTs without any validation.

**Files to Modify/Create:**
- `puppeteer/src/shared/utils/jwtValidator.js` - New utility for JWT validation
- `puppeteer/src/shared/utils/jwtValidator.test.js` - Tests for validator
- `puppeteer/src/domains/linkedin/controllers/linkedinInteractionController.js` - Replace unsafe parsing

**Prerequisites:**
- Read current JWT extraction at `linkedinInteractionController.js:700-742`
- Understand JWT structure (header.payload.signature, base64url encoded)

**Implementation Steps:**

1. **Create JWT validator utility** (`jwtValidator.js`)

   Create a new utility that:
   - Parses JWT without verifying signature (per ADR-001)
   - Validates structure: must have 3 dot-separated parts
   - Validates payload is valid JSON
   - Checks `exp` claim exists and is not expired (compare to `Date.now() / 1000`)
   - Checks `sub` or `user_id` claim exists
   - Returns `{ valid: true, payload, userId }` or `{ valid: false, reason: string }`

   Key considerations:
   - Use base64url decoding (handle `-` and `_` characters, add padding)
   - Allow 30-second clock skew tolerance for expiration
   - Log validation failures at `warn` level (not `error`)

2. **Write tests first** (TDD approach)

   Test cases to cover:
   - Valid token with future expiration → returns valid + payload
   - Expired token → returns invalid with "Token expired" reason
   - Token without `exp` claim → returns invalid with "Missing exp claim"
   - Token without user ID claim → returns invalid with "Missing user identifier"
   - Malformed token (not 3 parts) → returns invalid with "Malformed token"
   - Invalid base64 in payload → returns invalid with "Invalid payload encoding"
   - Invalid JSON in payload → returns invalid with "Invalid payload JSON"
   - Token expiring within clock skew window → returns valid
   - Token that just expired within clock skew → returns valid

3. **Integrate into controller**

   Replace the `_extractUserIdFromToken` method in `LinkedInInteractionController`:
   - Import the new validator
   - Call validator instead of manual parsing
   - If `!valid`, log the reason and return `null` (existing code handles null as 401)
   - If `valid`, return `userId`

**Verification Checklist:**
- [x] `npm test` passes in puppeteer directory
- [x] New tests cover all validation scenarios
- [x] Expired tokens return 401 from API endpoints
- [x] Valid tokens continue to work
- [x] No changes to existing API contracts

**Testing Instructions:**

Create `puppeteer/src/shared/utils/jwtValidator.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test helper to create JWT
function createTestJwt(payload, signature = 'test-signature') {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${payloadB64}.${signature}`;
}

describe('validateJwt', () => {
  // Mock Date.now for consistent testing
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('structure validation', () => {
    it('rejects token with less than 3 parts', () => { /* ... */ });
    it('rejects token with more than 3 parts', () => { /* ... */ });
    it('rejects token with invalid base64 payload', () => { /* ... */ });
    it('rejects token with non-JSON payload', () => { /* ... */ });
  });

  describe('expiration validation', () => {
    it('accepts token with future exp', () => { /* ... */ });
    it('rejects token with past exp', () => { /* ... */ });
    it('accepts token within clock skew tolerance', () => { /* ... */ });
    it('rejects token without exp claim', () => { /* ... */ });
  });

  describe('user ID extraction', () => {
    it('extracts sub claim as userId', () => { /* ... */ });
    it('extracts user_id claim as userId', () => { /* ... */ });
    it('extracts userId claim as userId', () => { /* ... */ });
    it('rejects token without any user identifier', () => { /* ... */ });
  });
});
```

Run tests:
```bash
cd puppeteer && npm test -- --run src/shared/utils/jwtValidator.test.js
```

**Commit Message Template:**
```
feat(security): add JWT expiration and structure validation

- Create jwtValidator utility with exp checking
- Add 30-second clock skew tolerance
- Validate required claims (exp, sub/user_id)
- Integrate into linkedinInteractionController
```

---

## Task 2: Configure Cognito Token TTL

**Goal:** Set Cognito access token expiration to 4 hours in the SAM template, reducing the window for token misuse.

**Files to Modify:**
- `backend/template.yaml` - Add token validity configuration to UserPoolClient

**Prerequisites:**
- Understand current Cognito configuration (lines 131-155 in template.yaml)
- Know that AWS Cognito default access token TTL is 1 hour

**Implementation Steps:**

1. **Add token validity settings to UserPoolClient**

   Locate the `UserPoolClient` resource in `template.yaml` (around line 147) and add:

   ```yaml
   TokenValidityUnits:
     AccessToken: hours
     IdToken: hours
     RefreshToken: days
   AccessTokenValidity: 4
   IdTokenValidity: 4
   RefreshTokenValidity: 30
   ```

   Place these properties at the same level as `ExplicitAuthFlows` and `GenerateSecret`.

2. **Verify template syntax**

   Run SAM validation:
   ```bash
   cd backend && sam validate
   ```

**Verification Checklist:**
- [x] `sam validate` passes without errors
- [x] TokenValidityUnits specifies `hours` for access/id tokens
- [x] AccessTokenValidity is set to 4
- [x] No other Cognito settings are modified

**Testing Instructions:**

This is an infrastructure change. Verification:

1. Validate template:
   ```bash
   cd backend && sam validate
   ```

2. After deployment (done by user, not engineer):
   - New tokens will have 4-hour expiration
   - Existing tokens continue with original expiration until refresh

**Commit Message Template:**
```
feat(backend): configure Cognito 4-hour token TTL

- Set AccessTokenValidity to 4 hours
- Set IdTokenValidity to 4 hours
- Set RefreshTokenValidity to 30 days
- Add TokenValidityUnits for explicit time units
```

---

## Task 3: Encrypt Credentials in Healing State Files

**Goal:** Encrypt LinkedIn credentials (searchPassword, jwtToken) when written to healing state files, preventing plaintext credential exposure on disk.

**Files to Modify/Create:**
- `puppeteer/src/shared/utils/crypto.js` - Add encryption function (currently only has decrypt)
- `puppeteer/src/shared/utils/crypto.test.js` - Add encryption tests
- `puppeteer/src/domains/automation/utils/healingManager.js` - Use encryption for sensitive fields
- `puppeteer/src/domains/automation/workers/searchWorker.js` - New worker script (does not exist yet)
- `puppeteer/src/domains/automation/workers/profileInitWorker.js` - New worker script (does not exist yet)

**Prerequisites:**
- Read existing `crypto.js` to understand sealbox pattern
- Read `healingManager.js` to see current state file creation (lines 96-136, 153-156)
- Understand that private key is at `process.env.CRED_SEALBOX_PRIVATE_KEY_PATH`

**Implementation Steps:**

1. **Add encryption function to crypto.js**

   The existing `crypto.js` only has `decryptSealboxB64Tag`. Add a corresponding encrypt function:

   ```javascript
   export async function encryptToSealboxB64Tag(plaintext) {
     // Load public key (derive from private key, same as decrypt does)
     // Use sodium.crypto_box_seal to encrypt
     // Return prefixed format: 'sealbox_x25519:b64:' + base64(ciphertext)
   }
   ```

   Key considerations:
   - Reuse `readPrivateKeyB64` to get the private key
   - Derive public key using `sodium.crypto_scalarmult_base(sk)`
   - Use `sodium.crypto_box_seal(message, pk)` for encryption
   - Return the same prefix format used in decryption
   - Handle errors gracefully, return null on failure

2. **Write encryption tests**

   Add tests to `crypto.test.js`:
   - Encrypt then decrypt roundtrip → original plaintext
   - Encryption produces different ciphertext each time (sealed box property)
   - Returns null when private key not configured
   - Output has correct prefix format

3. **Create credential encryption wrapper**

   Add a convenience function for encrypting credential objects:

   ```javascript
   export async function encryptCredentials(credentials) {
     // credentials = { searchPassword, jwtToken }
     // Returns { searchPassword: 'sealbox_x25519:b64:...', jwtToken: 'sealbox_x25519:b64:...' }
     // Or null if encryption fails
   }
   ```

4. **Modify HealingManager to encrypt before writing**

   In `healingManager.js`, modify `_createProfileInitStateFile` and `_createStateFile`:

   Before writing state:
   ```javascript
   // Encrypt sensitive fields
   const encryptedCreds = await encryptCredentials({
     searchPassword: stateData.searchPassword,
     jwtToken: stateData.jwtToken
   });

   if (!encryptedCreds) {
     logger.error('Failed to encrypt credentials for healing state');
     throw new Error('Credential encryption failed');
   }

   const stateToWrite = {
     ...stateData,
     searchPassword: encryptedCreds.searchPassword,
     jwtToken: encryptedCreds.jwtToken,
   };
   ```

5. **Create healing worker scripts**

   The worker scripts referenced by `healingManager.js` do not exist yet. Create them:

   **Files to Create:**
   - `puppeteer/src/domains/automation/workers/profileInitWorker.js`
   - `puppeteer/src/domains/automation/workers/searchWorker.js`

   Each worker should:
   - Read the state file path from `process.argv[2]`
   - Parse JSON state from the file
   - Decrypt credentials before use
   - Proceed with the healing operation (login, resume profile init/search)

   ```javascript
   // Example: searchWorker.js
   import fs from 'fs/promises';
   import { decryptSealboxB64Tag } from '#utils/crypto.js';
   import { logger } from '#utils/logger.js';

   async function main() {
     const stateFile = process.argv[2];
     if (!stateFile) {
       logger.error('No state file provided');
       process.exit(1);
     }

     // Read and parse state
     const stateJson = await fs.readFile(stateFile, 'utf8');
     const state = JSON.parse(stateJson);

     // Decrypt credentials
     state.searchPassword = await decryptSealboxB64Tag(state.searchPassword);
     state.jwtToken = await decryptSealboxB64Tag(state.jwtToken);

     if (!state.searchPassword || !state.jwtToken) {
       logger.error('Failed to decrypt healing state credentials');
       process.exit(1);
     }

     // Proceed with healing operation...
     logger.info('Starting search healing', { resumeIndex: state.resumeIndex });
     // TODO: Implement actual search resumption logic
   }

   main().catch((err) => {
     logger.error('Worker failed', { error: err.message });
     process.exit(1);
   });
   ```

6. **Update healingManager.js to use correct worker paths**

   Modify the spawn calls to reference the actual worker locations:

   ```javascript
   import { fileURLToPath } from 'url';
   import { dirname } from 'path';

   const __filename = fileURLToPath(import.meta.url);
   const __dirname = dirname(__filename);

   // In _launchProfileInitWorker:
   const workerPath = path.join(__dirname, '../workers/profileInitWorker.js');
   spawn('node', [workerPath, stateFile], { detached: true, stdio: 'ignore' });

   // In _launchWorkerProcess:
   const workerPath = path.join(__dirname, '../workers/searchWorker.js');
   spawn('node', [workerPath, stateFile], { detached: true, stdio: 'ignore' });
   ```

**Verification Checklist:**
- [x] `npm test` passes in puppeteer directory
- [x] encrypt → decrypt roundtrip works correctly
- [x] State files written by HealingManager contain encrypted credentials
- [x] State files no longer contain plaintext passwords
- [x] Healing workers successfully decrypt and use credentials
- [x] Existing healing functionality still works end-to-end

**Testing Instructions:**

Add to `puppeteer/src/shared/utils/crypto.test.js`:

```javascript
describe('encryptToSealboxB64Tag', () => {
  it('returns string with sealbox prefix', async () => {
    const result = await encryptToSealboxB64Tag('test-plaintext');
    expect(result).toMatch(/^sealbox_x25519:b64:/);
  });

  it('produces different ciphertext each encryption', async () => {
    const result1 = await encryptToSealboxB64Tag('same-input');
    const result2 = await encryptToSealboxB64Tag('same-input');
    expect(result1).not.toBe(result2); // Sealed box uses random nonce
  });

  it('roundtrips with decryptSealboxB64Tag', async () => {
    const original = 'my-secret-password';
    const encrypted = await encryptToSealboxB64Tag(original);
    const decrypted = await decryptSealboxB64Tag(encrypted);
    expect(decrypted).toBe(original);
  });
});

describe('encryptCredentials', () => {
  it('encrypts both searchPassword and jwtToken', async () => {
    const creds = { searchPassword: 'pass123', jwtToken: 'jwt.token.here' };
    const encrypted = await encryptCredentials(creds);

    expect(encrypted.searchPassword).toMatch(/^sealbox_x25519:b64:/);
    expect(encrypted.jwtToken).toMatch(/^sealbox_x25519:b64:/);
  });
});
```

Add to `puppeteer/src/domains/automation/utils/healingManager.test.js`:

```javascript
describe('credential encryption in state files', () => {
  it('writes encrypted searchPassword to state file', async () => {
    // ... setup mock
    const healingManager = new HealingManager();
    await healingManager._healSearch({ searchPassword: 'plaintext', /* ... */ });

    const writeCall = fsSync.writeFileSync.mock.calls[0];
    const stateData = JSON.parse(writeCall[1]);

    expect(stateData.searchPassword).toMatch(/^sealbox_x25519:b64:/);
    expect(stateData.searchPassword).not.toContain('plaintext');
  });
});
```

Run tests:
```bash
cd puppeteer && npm test
```

**Commit Message Template:**
```
feat(security): encrypt credentials in healing state files

- Add encryptToSealboxB64Tag function to crypto.js
- Add encryptCredentials convenience wrapper
- Encrypt searchPassword and jwtToken before writing state
- Update healing workers to decrypt on state load
```

---

## Task 4: Integration Testing for Security Changes

**Goal:** Verify the security changes work together in realistic scenarios.

**Files to Create:**
- `puppeteer/src/shared/utils/jwtValidator.integration.test.js` - Integration tests

**Prerequisites:**
- Tasks 1-3 complete
- Understanding of puppeteer API endpoints

**Implementation Steps:**

1. **Create integration test file**

   Test realistic scenarios:
   - Request with valid JWT → succeeds
   - Request with expired JWT → returns 401
   - Request with malformed JWT → returns 401
   - Healing flow with encrypted credentials → credentials recoverable

2. **Test JWT validation in controller context**

   ```javascript
   import { LinkedInInteractionController } from '../../../domains/linkedin/controllers/linkedinInteractionController.js';

   describe('JWT validation integration', () => {
     it('rejects expired tokens in extractUserIdFromToken', () => {
       const controller = new LinkedInInteractionController();
       const expiredToken = createTestJwt({
         sub: 'user-123',
         exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
       });

       const result = controller._extractUserIdFromToken(expiredToken);
       expect(result).toBeNull();
     });
   });
   ```

3. **Test healing encryption end-to-end**

   ```javascript
   import { HealingManager } from '../../../domains/automation/utils/healingManager.js';
   import { decryptSealboxB64Tag } from '../../utils/crypto.js';

   describe('Healing encryption integration', () => {
     it('encrypts credentials that can be decrypted', async () => {
       // Create healing state
       // Read state file
       // Verify credentials decrypt correctly
     });
   });
   ```

**Verification Checklist:**
- [x] All integration tests pass
- [x] Tests verify actual module interactions (not just unit behavior)
- [x] Error paths are covered

**Testing Instructions:**

```bash
cd puppeteer && npm test -- --run src/shared/utils/jwtValidator.integration.test.js
```

**Commit Message Template:**
```
test(security): add integration tests for JWT and encryption

- Test JWT validation in controller context
- Test healing credential encryption roundtrip
- Verify 401 responses for invalid tokens
```

---

## Phase Verification

After completing all tasks:

1. **Run all puppeteer tests:**
   ```bash
   cd puppeteer && npm test
   ```

2. **Run linting:**
   ```bash
   cd puppeteer && npm run lint
   ```

3. **Validate SAM template:**
   ```bash
   cd backend && sam validate
   ```

4. **Manual verification (optional):**
   - Start puppeteer server
   - Send request with expired JWT → expect 401
   - Trigger healing flow → verify state file has encrypted credentials

---

## Known Limitations

1. **No signature verification:** Per ADR-001, we validate structure and expiration only. This is a conscious tradeoff.

2. **Key management:** Encryption uses the same keypair as frontend credential encryption. Key rotation would require re-encrypting all state files.

3. **State file cleanup:** Encrypted state files persist until manually deleted. Consider adding TTL-based cleanup in future.

---

## Rollback Plan

If issues arise after deployment:

1. **JWT validation:** Revert `linkedinInteractionController.js` changes to restore permissive parsing
2. **Encryption:** State files with encrypted credentials will fail to decrypt if code is rolled back. May need to manually delete state files.
3. **Cognito TTL:** Requires SAM redeployment to change; existing tokens keep original expiration
