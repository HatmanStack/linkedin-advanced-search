# Phase 3: S3 Integration & Upload

## Phase Goal

Implement S3 upload functionality for extracted profile text files. The Puppeteer backend will upload JSON-formatted text files to a dedicated S3 bucket/prefix, creating a centralized repository of profile data that can be ingested by external search systems. By the end of this phase, each processed profile will have both screenshots (existing) and text files (new) stored in S3.

**Success Criteria:**
- S3 bucket created (or prefix configured in existing bucket)
- S3 upload service implemented for text files
- Text files uploaded in JSON format (one file per profile)
- Upload integrated with LinkedInContactService workflow
- Error handling and retry logic for S3 uploads
- AWS credentials configured and tested
- Upload metadata logged and tracked

**Estimated tokens:** ~25,000

---

## Prerequisites

- **Previous Phases:** Phase 2 (Text Extraction) must be complete
- **External Dependencies:**
  - AWS account with S3 access
  - AWS credentials configured (IAM user or role)
  - `@aws-sdk/client-s3` already installed in puppeteer-backend
- **Environment Requirements:**
  - AWS CLI configured locally (for testing)
  - S3 bucket created or identified

---

## Tasks

### Task 1: Design S3 Storage Structure

**Goal:** Define the S3 bucket structure, naming conventions, and organization for profile text files.

**Files to Create:**
- `Migration/docs/s3-storage-design.md` - Documentation of S3 structure

**Prerequisites:**
- Understanding of existing S3 screenshot storage
- AWS S3 bucket access

**Implementation Steps:**

1. **Review existing S3 structure:**
   - Examine current screenshot storage pattern:
     ```
     s3://bucket-name/screenshots/<profile-id>-profile.png
     s3://bucket-name/screenshots/<profile-id>-activity.png
     ```
   - Understand existing bucket configuration (region, encryption, versioning)

2. **Design new S3 structure for text files:**
   - Decide on bucket strategy:
     - **Option A:** Use same bucket with new prefix `profiles/`
     - **Option B:** Create dedicated bucket for text files
     - **Recommendation:** Option A (same bucket, new prefix)
   - Define folder structure:
     ```
     s3://bucket-name/
     ├── screenshots/              # Existing
     │   ├── <profile-id>-profile.png
     │   └── <profile-id>-activity.png
     └── profiles/                 # NEW
         ├── <profile-id>.json     # Full profile text
         └── <profile-id>-meta.json # Optional metadata
     ```

3. **Define file naming convention:**
   - Use profile ID derived from LinkedIn URL:
     - LinkedIn URL: `https://linkedin.com/in/john-doe`
     - Profile ID: `john-doe`
     - S3 key: `profiles/john-doe.json`
   - Handle special characters in profile IDs (URL encoding)
   - Ensure unique keys to avoid collisions
   - Consider timestamp suffix for versioning (optional)

4. **Define file format and content:**
   - **Primary file:** `<profile-id>.json` (JSON format)
     - Contains all extracted profile data (from Phase 2 schema)
     - Example:
       ```json
       {
         "profile_id": "john-doe",
         "url": "https://linkedin.com/in/john-doe",
         "name": "John Doe",
         "headline": "Software Engineer at TechCorp",
         "extracted_at": "2025-11-09T12:00:00Z",
         "fulltext": "John Doe Software Engineer...",
         ...
       }
       ```
   - **Optional metadata file:** `<profile-id>-meta.json`
     - Upload timestamp, file size, checksum
     - DynamoDB item ID for cross-reference
     - Status (e.g., "extracted", "indexed")

5. **Define S3 object metadata:**
   - Use S3 object metadata for indexing:
     - `Content-Type: application/json`
     - `x-amz-meta-profile-id: john-doe`
     - `x-amz-meta-extracted-at: 2025-11-09T12:00:00Z`
     - `x-amz-meta-status: possible`
   - Enable server-side encryption (SSE-S3 or SSE-KMS)

6. **Document bucket policy and IAM requirements:**
   - Define minimum IAM permissions:
     ```json
     {
       "Effect": "Allow",
       "Action": [
         "s3:PutObject",
         "s3:GetObject",
         "s3:DeleteObject"
       ],
       "Resource": "arn:aws:s3:::bucket-name/profiles/*"
     }
     ```
   - Document bucket policy (if needed for cross-account access)

**Verification Checklist:**
- [ ] S3 structure documented with examples
- [ ] File naming convention defined
- [ ] File format specified (JSON)
- [ ] S3 object metadata defined
- [ ] IAM permissions documented
- [ ] Storage design reviewed and approved

**Testing Instructions:**
- Review documentation for completeness
- Verify file naming handles edge cases (special characters)
- Confirm S3 structure aligns with existing screenshot pattern

**Commit Message Template:**
```
docs(s3): design S3 storage structure for profile text

- Document S3 folder structure (profiles/ prefix)
- Define file naming convention (profile-id.json)
- Specify JSON file format and content
- Define S3 object metadata fields
- Document required IAM permissions
- Prepare for S3 upload implementation
```

**Estimated tokens:** ~4,000

---

### Task 2: Configure S3 Bucket and Environment Variables

**Goal:** Create or configure the S3 bucket for text file storage and update environment configuration.

**Files to Modify:**
- `.env.example` (root)
- `puppeteer-backend/config/index.js`

**Prerequisites:**
- Task 1 storage design complete
- AWS account with S3 access
- AWS CLI configured locally

**Implementation Steps:**

1. **Create or identify S3 bucket:**
   - **Option A:** Use existing screenshot bucket (recommended)
     - Identify bucket name from existing config
     - Verify bucket exists: `aws s3 ls s3://bucket-name`
   - **Option B:** Create new bucket for text files
     - Choose bucket name (must be globally unique)
     - Create bucket: `aws s3 mb s3://bucket-name --region us-west-2`
     - Enable versioning (optional): `aws s3api put-bucket-versioning --bucket bucket-name --versioning-configuration Status=Enabled`

2. **Configure bucket settings:**
   - Enable server-side encryption:
     ```bash
     aws s3api put-bucket-encryption \
       --bucket bucket-name \
       --server-side-encryption-configuration '{
         "Rules": [{
           "ApplyServerSideEncryptionByDefault": {
             "SSEAlgorithm": "AES256"
           }
         }]
       }'
     ```
   - Set bucket policy (if needed for IAM access)
   - Configure CORS (if frontend will access files directly)

3. **Create IAM policy for S3 access:**
   - Create policy JSON file:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "s3:PutObject",
             "s3:GetObject",
             "s3:DeleteObject"
           ],
           "Resource": "arn:aws:s3:::bucket-name/profiles/*"
         }
       ]
     }
     ```
   - Attach policy to IAM user or role used by Puppeteer backend

4. **Update .env.example:**
   - Add new environment variables for profile text storage:
     ```bash
     # S3 Text File Storage
     S3_PROFILE_TEXT_BUCKET_NAME=your-bucket-name
     S3_PROFILE_TEXT_PREFIX=profiles/
     S3_PROFILE_TEXT_REGION=us-west-2
     ```
   - Update comments to explain each variable
   - Keep existing S3_SCREENSHOT_BUCKET_NAME for screenshots

5. **Update puppeteer-backend config:**
   - Modify `config/index.js` to include S3 text storage config:
     ```javascript
     s3: {
       screenshots: {
         bucket: process.env.S3_SCREENSHOT_BUCKET_NAME || '',
         region: process.env.AWS_REGION || 'us-west-2',
       },
       profileText: {
         bucket: process.env.S3_PROFILE_TEXT_BUCKET_NAME || process.env.S3_SCREENSHOT_BUCKET_NAME || '',
         prefix: process.env.S3_PROFILE_TEXT_PREFIX || 'profiles/',
         region: process.env.S3_PROFILE_TEXT_REGION || process.env.AWS_REGION || 'us-west-2',
       },
     },
     ```
   - Fallback to screenshot bucket if text bucket not specified

6. **Test AWS credentials:**
   - Verify credentials can access S3:
     ```bash
     aws s3 ls s3://bucket-name/
     ```
   - Test upload:
     ```bash
     echo '{"test": true}' > test.json
     aws s3 cp test.json s3://bucket-name/profiles/test.json
     aws s3 rm s3://bucket-name/profiles/test.json
     ```

**Verification Checklist:**
- [ ] S3 bucket created or identified
- [ ] Bucket encryption enabled
- [ ] IAM policy created and attached
- [ ] Environment variables added to .env.example
- [ ] Config updated to read new environment variables
- [ ] AWS credentials tested and working
- [ ] Test file uploaded and deleted successfully

**Testing Instructions:**
- Verify config loads correctly:
  ```javascript
  import config from './config/index.js';
  console.log(config.s3.profileText.bucket);
  console.log(config.s3.profileText.prefix);
  ```
- Test AWS SDK can access bucket:
  ```javascript
  import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
  const client = new S3Client({ region: config.s3.profileText.region });
  const command = new ListObjectsV2Command({ Bucket: config.s3.profileText.bucket });
  const response = await client.send(command);
  console.log('S3 access successful:', response);
  ```

**Commit Message Template:**
```
chore(s3): configure S3 bucket for profile text storage

- Create/identify S3 bucket for text files
- Enable server-side encryption
- Create IAM policy for S3 access
- Add S3 environment variables to .env.example
- Update config to include profileText S3 settings
- Test AWS credentials and S3 access
```

**Estimated tokens:** ~5,000

---

### Task 3: Create S3 Upload Service

**Goal:** Build a service to handle uploading extracted profile text to S3 with error handling and retry logic.

**Files to Create:**
- `puppeteer-backend/services/s3TextUploadService.js` - S3 upload service for profile text

**Prerequisites:**
- Task 2 S3 configuration complete
- `@aws-sdk/client-s3` installed (already present)
- Understanding of existing S3 screenshot upload logic

**Implementation Steps:**

1. **Review existing S3 upload implementation:**
   - Find and examine current screenshot upload code
   - Understand S3Client initialization, PutObjectCommand usage
   - Identify reusable patterns and error handling

2. **Create S3TextUploadService class:**
   - Initialize S3Client with region from config
   - Accept config and logger in constructor
   - Set up retry logic configuration (max retries, backoff)

3. **Implement upload method:**
   - Create `uploadProfileText` method:
     ```javascript
     async uploadProfileText(profileData) {
       const profileId = this.extractProfileId(profileData.url);
       const s3Key = `${config.s3.profileText.prefix}${profileId}.json`;
       const jsonContent = JSON.stringify(profileData, null, 2);

       const params = {
         Bucket: config.s3.profileText.bucket,
         Key: s3Key,
         Body: jsonContent,
         ContentType: 'application/json',
         Metadata: {
           'profile-id': profileId,
           'extracted-at': profileData.extracted_at,
           'status': profileData.status || 'unknown',
         },
         ServerSideEncryption: 'AES256',
       };

       const command = new PutObjectCommand(params);
       const response = await this.s3Client.send(command);
       return { s3Key, s3Url: this.buildS3Url(s3Key), response };
     }
     ```

4. **Implement helper methods:**
   - `extractProfileId(url)`: Extract profile ID from LinkedIn URL
     ```javascript
     extractProfileId(url) {
       const match = url.match(/linkedin\.com\/in\/([^/]+)/);
       return match ? match[1] : `profile-${Date.now()}`;
     }
     ```
   - `buildS3Url(key)`: Construct full S3 URL
     ```javascript
     buildS3Url(key) {
       return `s3://${config.s3.profileText.bucket}/${key}`;
     }
     ```
   - `validateProfileData(data)`: Validate required fields before upload

5. **Implement error handling:**
   - Wrap upload in try-catch block
   - Handle S3-specific errors (access denied, bucket not found, network errors)
   - Log errors with full context (profile ID, S3 key, error message)
   - Return error object instead of throwing (to allow caller to handle)

6. **Implement retry logic:**
   - Use exponential backoff for retries
   - Max 3 retries for transient failures (500s, network errors)
   - No retry for client errors (403, 404)
   - Example:
     ```javascript
     async uploadWithRetry(params, maxRetries = 3) {
       for (let attempt = 1; attempt <= maxRetries; attempt++) {
         try {
           return await this.s3Client.send(new PutObjectCommand(params));
         } catch (error) {
           if (!this.isRetriable(error) || attempt === maxRetries) {
             throw error;
           }
           const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
           logger.warn(`S3 upload retry ${attempt}/${maxRetries} after ${delay}ms`);
           await this.sleep(delay);
         }
       }
     }
     ```

7. **Add logging:**
   - Log upload start (profile ID, S3 key)
   - Log upload success (S3 key, file size, duration)
   - Log upload failure (profile ID, error message)
   - Log retry attempts

8. **Add metadata tracking:**
   - Return upload metadata:
     - S3 key
     - S3 URL
     - Upload timestamp
     - File size
     - ETag (from S3 response)

**Verification Checklist:**
- [ ] S3TextUploadService class created
- [ ] uploadProfileText method implemented
- [ ] Helper methods implemented (extractProfileId, buildS3Url)
- [ ] Error handling covers S3-specific errors
- [ ] Retry logic implemented with exponential backoff
- [ ] Logging provides visibility into upload process
- [ ] Upload metadata tracked and returned

**Testing Instructions:**
- Unit test with mock S3 client:
  ```javascript
  const mockS3Client = { send: jest.fn() };
  const service = new S3TextUploadService(mockS3Client, config);

  const mockProfile = { url: 'https://linkedin.com/in/test', name: 'Test' };
  await service.uploadProfileText(mockProfile);

  expect(mockS3Client.send).toHaveBeenCalled();
  ```
- Integration test with real S3:
  ```javascript
  const service = new S3TextUploadService(new S3Client({...}), config);
  const result = await service.uploadProfileText(testProfile);
  console.log('Uploaded to:', result.s3Url);

  // Verify file exists in S3
  const exists = await service.checkFileExists(result.s3Key);
  console.assert(exists, 'File not found in S3');
  ```

**Commit Message Template:**
```
feat(s3): create S3 text upload service

- Implement S3TextUploadService class
- Add uploadProfileText method with retry logic
- Implement profile ID extraction from URL
- Add comprehensive error handling
- Implement exponential backoff retry
- Add detailed logging for upload process
- Return upload metadata (S3 key, URL, ETag)
```

**Estimated tokens:** ~6,000

---

### Task 4: Integrate S3 Upload with LinkedInContactService

**Goal:** Integrate the S3 text upload service into the existing profile processing workflow so that text files are uploaded alongside screenshots.

**Files to Modify:**
- `puppeteer-backend/services/linkedinContactService.js`

**Prerequisites:**
- Task 3 S3 upload service implemented
- Phase 2 text extraction integrated

**Implementation Steps:**

1. **Import S3TextUploadService:**
   - Add import at top of file:
     ```javascript
     import { S3TextUploadService } from './s3TextUploadService.js';
     ```

2. **Initialize S3 upload service:**
   - In LinkedInContactService constructor, initialize upload service:
     ```javascript
     constructor(puppeteerService) {
       this.puppeteerService = puppeteerService;
       this.textExtractionService = new TextExtractionService(/* ... */);
       this.s3TextUploadService = new S3TextUploadService(config, logger);
     }
     ```

3. **Update takeScreenShotAndUploadToS3 method:**
   - After text extraction (from Phase 2), add S3 upload:
     ```javascript
     async takeScreenShotAndUploadToS3(profileUrl, status) {
       // ... existing screenshot logic ...

       // Extract text (from Phase 2)
       const profileText = await this.textExtractionService.extractProfileText(profileUrl);

       // NEW: Upload text to S3
       let s3TextUpload = null;
       try {
         s3TextUpload = await this.s3TextUploadService.uploadProfileText({
           ...profileText,
           status,
           uploaded_at: new Date().toISOString(),
         });
         logger.info(`Profile text uploaded to S3: ${s3TextUpload.s3Key}`);
       } catch (error) {
         logger.error(`Failed to upload profile text to S3:`, error);
         // Don't fail entire operation if S3 upload fails
       }

       return {
         screenshots,
         profileText,
         s3TextUpload,
       };
     }
     ```

4. **Update DynamoDB save operation:**
   - Add S3 text file URL to DynamoDB item:
     ```javascript
     await dynamoDBService.saveProfile({
       // ... existing fields ...
       text_s3_key: s3TextUpload?.s3Key,
       text_s3_url: s3TextUpload?.s3Url,
       text_uploaded_at: s3TextUpload ? new Date().toISOString() : null,
     });
     ```

5. **Handle S3 upload failures:**
   - If S3 upload fails, log error but don't fail entire operation
   - Mark DynamoDB item as `text_upload_failed: true`
   - Allow screenshot upload to succeed independently
   - Consider retry queue for failed uploads (future enhancement)

6. **Add upload status tracking:**
   - Track upload progress in logs
   - Include upload duration in metrics
   - Log file size of uploaded text

7. **Test integration:**
   - Run full workflow from profile scraping to S3 upload
   - Verify screenshots AND text files both upload successfully
   - Test failure scenarios (S3 unavailable, invalid credentials)

**Verification Checklist:**
- [ ] S3TextUploadService imported and initialized
- [ ] S3 upload added to takeScreenShotAndUploadToS3 method
- [ ] S3 text URL saved to DynamoDB
- [ ] Error handling prevents S3 failures from breaking workflow
- [ ] Upload status tracked in logs
- [ ] Integration tested with real profile

**Testing Instructions:**
- Run full profile processing:
  ```javascript
  const result = await linkedInContactService.takeScreenShotAndUploadToS3(
    'https://linkedin.com/in/test-profile',
    'possible'
  );
  console.log('Screenshots:', result.screenshots);
  console.log('Profile text:', result.profileText);
  console.log('S3 upload:', result.s3TextUpload);

  // Verify S3 file exists
  const s3Key = result.s3TextUpload.s3Key;
  // Check S3...
  ```
- Verify DynamoDB contains S3 text URL
- Test with S3 unavailable (disconnect network, verify graceful failure)

**Commit Message Template:**
```
feat(contact): integrate S3 text upload with profile workflow

- Import and initialize S3TextUploadService
- Add S3 upload step in takeScreenShotAndUploadToS3
- Save S3 text URL to DynamoDB
- Add error handling to prevent S3 failures from breaking workflow
- Track upload status and duration in logs
- Test full workflow end-to-end
```

**Estimated tokens:** ~5,000

---

### Task 5: Add S3 Upload Utilities and Verification

**Goal:** Create utilities for verifying S3 uploads, checking file existence, and retrieving uploaded files.

**Files to Create:**
- `puppeteer-backend/utils/s3Helpers.js` - S3 utility functions

**Prerequisites:**
- Task 4 integration complete
- S3 uploads functional

**Implementation Steps:**

1. **Create s3Helpers utility module:**
   - Create `s3Helpers.js` with exported helper functions
   - Import S3Client and necessary commands

2. **Implement file existence check:**
   - Create function to check if file exists in S3:
     ```javascript
     export async function checkFileExists(bucket, key, region) {
       const client = new S3Client({ region });
       try {
         const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
         await client.send(command);
         return true;
       } catch (error) {
         if (error.name === 'NotFound') {
           return false;
         }
         throw error;
       }
     }
     ```

3. **Implement file download:**
   - Create function to download and parse JSON from S3:
     ```javascript
     export async function downloadProfileText(bucket, key, region) {
       const client = new S3Client({ region });
       const command = new GetObjectCommand({ Bucket: bucket, Key: key });
       const response = await client.send(command);
       const bodyString = await streamToString(response.Body);
       return JSON.parse(bodyString);
     }

     async function streamToString(stream) {
       const chunks = [];
       for await (const chunk of stream) {
         chunks.push(chunk);
       }
       return Buffer.concat(chunks).toString('utf-8');
     }
     ```

4. **Implement file deletion:**
   - Create function to delete file from S3:
     ```javascript
     export async function deleteProfileText(bucket, key, region) {
       const client = new S3Client({ region });
       const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
       await client.send(command);
       logger.info(`Deleted S3 file: ${key}`);
     }
     ```

5. **Implement list files:**
   - Create function to list all profile text files:
     ```javascript
     export async function listProfileTexts(bucket, prefix, region, maxKeys = 1000) {
       const client = new S3Client({ region });
       const command = new ListObjectsV2Command({
         Bucket: bucket,
         Prefix: prefix,
         MaxKeys: maxKeys,
       });
       const response = await client.send(command);
       return response.Contents || [];
     }
     ```

6. **Implement batch upload verification:**
   - Create function to verify multiple uploads:
     ```javascript
     export async function verifyUploads(bucket, keys, region) {
       const results = await Promise.all(
         keys.map(async (key) => ({
           key,
           exists: await checkFileExists(bucket, key, region),
         }))
       );
       return results;
     }
     ```

7. **Add error handling:**
   - Handle S3 errors gracefully (access denied, network errors)
   - Log errors with context
   - Return null or default values on failure

**Verification Checklist:**
- [ ] checkFileExists function implemented
- [ ] downloadProfileText function implemented
- [ ] deleteProfileText function implemented
- [ ] listProfileTexts function implemented
- [ ] verifyUploads function implemented
- [ ] Error handling for all functions
- [ ] All functions tested with real S3

**Testing Instructions:**
- Test file existence check:
  ```javascript
  const exists = await checkFileExists(bucket, 'profiles/test.json', region);
  console.log('File exists:', exists);
  ```
- Test file download:
  ```javascript
  const data = await downloadProfileText(bucket, 'profiles/test.json', region);
  console.log('Downloaded data:', data);
  ```
- Test list files:
  ```javascript
  const files = await listProfileTexts(bucket, 'profiles/', region);
  console.log(`Found ${files.length} profile text files`);
  ```

**Commit Message Template:**
```
feat(s3): add S3 utility functions for profile text

- Implement checkFileExists to verify uploads
- Add downloadProfileText to retrieve files
- Add deleteProfileText for cleanup
- Implement listProfileTexts to list all files
- Add verifyUploads for batch verification
- Include comprehensive error handling
```

**Estimated tokens:** ~4,000

---

### Task 6: Add Upload Metrics and Monitoring

**Goal:** Add metrics and monitoring for S3 uploads to track success rate, failures, and performance.

**Files to Modify:**
- `puppeteer-backend/services/s3TextUploadService.js`

**Files to Create:**
- `puppeteer-backend/utils/uploadMetrics.js` - Upload metrics tracking

**Prerequisites:**
- Task 5 utilities complete
- Understanding of existing logging and metrics

**Implementation Steps:**

1. **Create upload metrics tracker:**
   - Create `uploadMetrics.js` with metrics collection:
     ```javascript
     class UploadMetrics {
       constructor() {
         this.metrics = {
           totalUploads: 0,
           successfulUploads: 0,
           failedUploads: 0,
           retriedUploads: 0,
           totalBytesUploaded: 0,
           avgUploadDuration: 0,
           uploadDurations: [],
         };
       }

       recordUpload(success, duration, bytes, retries = 0) {
         this.metrics.totalUploads++;
         if (success) {
           this.metrics.successfulUploads++;
         } else {
           this.metrics.failedUploads++;
         }
         if (retries > 0) {
           this.metrics.retriedUploads++;
         }
         this.metrics.totalBytesUploaded += bytes;
         this.metrics.uploadDurations.push(duration);
         this.metrics.avgUploadDuration = this.calculateAverage();
       }

       getMetrics() {
         return { ...this.metrics };
       }
     }
     ```

2. **Integrate metrics into S3TextUploadService:**
   - Initialize metrics tracker in constructor
   - Record metrics for each upload:
     ```javascript
     async uploadProfileText(profileData) {
       const startTime = Date.now();
       let success = false;
       let bytes = 0;
       let retries = 0;

       try {
         const result = await this.uploadWithRetry(/* ... */);
         success = true;
         bytes = Buffer.byteLength(JSON.stringify(profileData));
         return result;
       } catch (error) {
         throw error;
       } finally {
         const duration = Date.now() - startTime;
         this.metrics.recordUpload(success, duration, bytes, retries);
       }
     }
     ```

3. **Add metrics endpoint:**
   - Add route to expose upload metrics:
     ```javascript
     // In routes file
     router.get('/upload-metrics', (req, res) => {
       const metrics = s3TextUploadService.getMetrics();
       res.json(metrics);
     });
     ```

4. **Add CloudWatch metrics (optional):**
   - If using CloudWatch, publish custom metrics:
     ```javascript
     import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

     async publishMetrics(success, duration) {
       const metric = {
         Namespace: 'LinkedInAdvancedSearch',
         MetricData: [
           {
             MetricName: 'S3TextUploadSuccess',
             Value: success ? 1 : 0,
             Unit: 'Count',
           },
           {
             MetricName: 'S3TextUploadDuration',
             Value: duration,
             Unit: 'Milliseconds',
           },
         ],
       };
       // Send to CloudWatch...
     }
     ```

5. **Add periodic metrics logging:**
   - Log metrics summary every N uploads:
     ```javascript
     if (this.metrics.totalUploads % 10 === 0) {
       logger.info('S3 Upload Metrics:', this.metrics.getMetrics());
     }
     ```

6. **Add metrics reset:**
   - Provide method to reset metrics:
     ```javascript
     resetMetrics() {
       this.metrics = { /* reset to initial state */ };
     }
     ```

**Verification Checklist:**
- [ ] UploadMetrics class created
- [ ] Metrics integrated into S3TextUploadService
- [ ] Metrics recorded for every upload (success and failure)
- [ ] Metrics endpoint added to expose data
- [ ] Periodic metrics logging implemented
- [ ] Metrics tested with multiple uploads

**Testing Instructions:**
- Perform multiple uploads and check metrics:
  ```javascript
  // Upload 10 profiles
  for (let i = 0; i < 10; i++) {
    await s3TextUploadService.uploadProfileText(testProfile);
  }

  const metrics = s3TextUploadService.getMetrics();
  console.log('Total uploads:', metrics.totalUploads);
  console.log('Success rate:', metrics.successfulUploads / metrics.totalUploads);
  console.log('Avg duration:', metrics.avgUploadDuration);
  ```
- Access metrics endpoint:
  ```bash
  curl http://localhost:3001/upload-metrics
  ```

**Commit Message Template:**
```
feat(metrics): add upload metrics and monitoring

- Create UploadMetrics class for tracking uploads
- Integrate metrics into S3TextUploadService
- Record success, failures, retries, duration, bytes
- Add metrics endpoint to expose upload statistics
- Add periodic metrics logging
- Support metrics reset
```

**Estimated tokens:** ~4,000

---

## Phase Verification

**How to verify entire Phase 3 is complete:**

1. **Verify S3 bucket configured:**
   ```bash
   aws s3 ls s3://bucket-name/profiles/
   # Should list uploaded profile text files
   ```

2. **Verify environment variables:**
   ```bash
   grep "S3_PROFILE_TEXT" .env.example
   # Should show new S3 variables
   ```

3. **Verify S3 upload service:**
   ```javascript
   import { S3TextUploadService } from './services/s3TextUploadService.js';
   const service = new S3TextUploadService(config, logger);
   const result = await service.uploadProfileText(testProfile);
   console.assert(result.s3Key, 'S3 key not returned');
   console.assert(result.s3Url, 'S3 URL not returned');
   ```

4. **Verify integration with LinkedInContactService:**
   ```javascript
   const result = await linkedInContactService.takeScreenShotAndUploadToS3(profileUrl, 'possible');
   console.assert(result.s3TextUpload, 'S3 text upload not present');
   console.assert(result.s3TextUpload.s3Key, 'S3 key missing');
   ```

5. **Verify S3 file content:**
   ```bash
   aws s3 cp s3://bucket-name/profiles/test-profile.json - | jq .
   # Should display valid JSON with profile data
   ```

6. **Verify DynamoDB contains S3 URL:**
   - Query DynamoDB for a processed profile
   - Verify `text_s3_key` and `text_s3_url` fields are populated

7. **Verify upload metrics:**
   ```bash
   curl http://localhost:3001/upload-metrics
   # Should return metrics JSON with totalUploads > 0
   ```

**Integration points to test:**
- Profile processing triggers text extraction AND S3 upload
- S3 upload failures don't break screenshot workflow
- DynamoDB contains both screenshot URLs and text file URLs
- Metrics accurately track uploads

**Known limitations or technical debt introduced:**
- No automatic retry queue for failed uploads (manual retry required)
- No S3 lifecycle policies configured (manual cleanup needed)
- No CloudFront CDN for S3 text files (direct S3 access only)
- No S3 event notifications for ingestion pipeline (future enhancement)

---

**Previous Phase:** [Phase 2: Puppeteer Refactor for Text Extraction](./Phase-2.md)

**Next Phase:** [Phase 4: Placeholder Search API Implementation](./Phase-4.md)
