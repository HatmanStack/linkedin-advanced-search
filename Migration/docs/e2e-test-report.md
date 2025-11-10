# End-to-End Workflow Test Report

## Overview

This document outlines the end-to-end testing performed for Phase 5 (Frontend Integration & Testing) to verify the complete refactored workflow from profile scraping through text extraction, S3 upload, to search API calls.

**Test Date:** _To be completed_
**Tester:** _To be completed_
**Environment:** _To be completed_

---

## Prerequisites

- [x] Phase 1-4 implementation complete
- [ ] AWS infrastructure deployed (RAG-CloudStack)
- [ ] API Gateway URL configured in `.env`
- [ ] Puppeteer backend running (`cd puppeteer-backend && npm start`)
- [ ] Frontend running (`npm run dev`)
- [ ] Valid LinkedIn credentials available
- [ ] AWS credentials configured

---

## Test Scenario 1: Profile Scraping & Text Extraction

### Objective
Verify that profile scraping works and text extraction is properly implemented.

### Steps
1. Start Puppeteer backend:
   ```bash
   cd puppeteer-backend
   npm start
   ```

2. Trigger profile scraping via frontend:
   - Open frontend: `http://localhost:5173`
   - Navigate to "New Connections" tab
   - Enter search criteria (company, job title, location)
   - Click "Search LinkedIn"

3. Monitor Puppeteer backend logs for:
   - Profile URLs being visited
   - Text extraction logs: "Extracted N experience entries..."
   - S3 upload attempts
   - No errors or exceptions

### Expected Results
- [ ] Profile successfully scraped
- [ ] Text extraction completes without errors
- [ ] Logs show: "Extracted text from profile: {profileId}"
- [ ] Backend logs show S3 upload initiated
- [ ] No exceptions in console

### Actual Results
_To be completed during testing_

### Screenshots
_Attach screenshots of:_
- Frontend search interface
- Backend console logs
- Browser console (no errors)

---

## Test Scenario 2: S3 Upload Verification

### Objective
Verify that extracted profile text is uploaded to S3.

### Steps
1. After profile scraping completes, check S3 bucket:
   ```bash
   aws s3 ls s3://{bucket-name}/linkedin-profiles/ --recursive
   ```

2. Download and verify file content:
   ```bash
   aws s3 cp s3://{bucket-name}/linkedin-profiles/{profile-id}.json - | jq .
   ```

3. Verify file contains:
   - `profileId`
   - `rawText`
   - `experiences` array
   - `skills` array
   - `about` text
   - `timestamp`

4. Check DynamoDB for S3 URL:
   ```bash
   aws dynamodb get-item \
     --table-name {table-name} \
     --key '{"PK": {"S": "PROFILE#{userId}"}, "SK": {"S": "PROFILE#{profileId}"}}'
   ```

### Expected Results
- [ ] Profile JSON file exists in S3
- [ ] File size > 0 bytes
- [ ] JSON is valid and well-formed
- [ ] Contains all expected fields
- [ ] DynamoDB record has `text_s3_key` and `text_s3_url` fields

### Actual Results
_To be completed during testing_

**S3 File Path:** _Record actual path_

**File Size:** _Record size_

**Sample Content:**
```json
{
  "_To be filled with actual content_"
}
```

---

## Test Scenario 3: Search API from Frontend

### Objective
Verify that frontend can call the placeholder search API and display results correctly.

### Steps
1. Open frontend application: `http://localhost:5173`

2. Navigate to "New Connections" tab

3. Enter search query:
   - Company: "TechCorp"
   - Job Title: "Software Engineer"
   - Location: "San Francisco"

4. Click "Search LinkedIn" button

5. Observe UI response:
   - Loading spinner appears
   - Info message banner displays
   - No error messages
   - Empty state handles gracefully

6. Check browser console for:
   - API call to `/search` endpoint
   - Response with `success: true`
   - Info message: "Search functionality is currently unavailable..."
   - No JavaScript errors

7. Check API Gateway CloudWatch logs:
   ```bash
   aws logs tail /aws/lambda/linkedin-advanced-search-placeholder-search-prod --follow
   ```

### Expected Results
- [ ] Loading spinner shows during API call
- [ ] Info banner displays: "Search functionality is currently unavailable. This is a placeholder response. External search system integration coming soon."
- [ ] Empty results state displays gracefully
- [ ] No error messages in UI
- [ ] No errors in browser console
- [ ] API call succeeds (200 status)
- [ ] Lambda logs show search request received

### Actual Results
_To be completed during testing_

**API Response:**
```json
{
  "_To be filled with actual response_"
}
```

**UI Screenshots:**
- _Attach screenshot of loading state_
- _Attach screenshot of info message banner_
- _Attach screenshot of empty results_

---

## Test Scenario 4: Existing Features Regression Testing

### Objective
Verify that all existing features still work after Phase 5 changes.

### 4.1 Connections Tab

**Steps:**
1. Navigate to "Connections" tab
2. View list of existing connections
3. Filter by status (possible, incoming, outgoing, ally)
4. Click on a connection to view details
5. Send a message to a connection (if feature exists)

**Expected Results:**
- [ ] Connection list loads correctly
- [ ] Filters work as expected
- [ ] Connection details display properly
- [ ] Messaging feature works (if applicable)
- [ ] No UI errors or console errors

**Actual Results:** _To be completed_

### 4.2 New Connections Tab

**Steps:**
1. Navigate to "New Connections" tab
2. View list of possible connections
3. Click "Add Connection" or similar action
4. Verify connection request sent

**Expected Results:**
- [ ] New connections display correctly
- [ ] Actions work as expected
- [ ] Status updates after action
- [ ] No UI errors

**Actual Results:** _To be completed_

### 4.3 New Post Tab

**Steps:**
1. Navigate to "New Post" tab
2. Enter post content
3. Submit post
4. Verify post creation

**Expected Results:**
- [ ] Post composer works
- [ ] Post submits successfully
- [ ] Success message displays
- [ ] No errors

**Actual Results:** _To be completed_

---

## Test Scenario 5: Error Handling

### 5.1 S3 Upload Failure

**Objective:** Verify graceful degradation when S3 upload fails.

**Steps:**
1. Temporarily invalidate AWS credentials or disconnect network
2. Trigger profile scraping
3. Observe behavior

**Expected Results:**
- [ ] Profile scraping still completes
- [ ] Error logged: "Failed to upload profile text to S3"
- [ ] Application doesn't crash
- [ ] User sees generic error or success (scraping succeeded even if upload failed)

**Actual Results:** _To be completed_

### 5.2 Search API Unavailable

**Objective:** Verify error handling when search API is unavailable.

**Steps:**
1. Stop Lambda function or block network to API Gateway
2. Attempt search from frontend
3. Observe UI behavior

**Expected Results:**
- [ ] Loading spinner stops
- [ ] User-friendly error message displays
- [ ] Application doesn't crash
- [ ] Error logged in console
- [ ] User can retry

**Actual Results:** _To be completed_

### 5.3 Invalid Search Query

**Objective:** Verify validation of search input.

**Steps:**
1. Submit empty search query
2. Submit search with only whitespace
3. Submit search with invalid characters

**Expected Results:**
- [ ] 400 error handled gracefully
- [ ] User-friendly validation message
- [ ] No application crash
- [ ] Form validation prevents submission (if applicable)

**Actual Results:** _To be completed_

---

## Test Scenario 6: API Authentication

### Objective
Verify that search API requires proper authentication.

### Steps
1. Clear JWT token from browser storage
2. Attempt to call search API
3. Verify 401 Unauthorized response

**Expected Results:**
- [ ] API call fails with 401 status
- [ ] User redirected to login page (if applicable)
- [ ] Error message: "Authentication required"

**Actual Results:** _To be completed_

---

## Performance Testing

### API Response Times

**Search API:**
- Expected: < 200ms (placeholder)
- Actual: _To be measured_

**Profile Scraping:**
- Expected: 5-15 seconds per profile
- Actual: _To be measured_

**S3 Upload:**
- Expected: < 2 seconds
- Actual: _To be measured_

---

## CloudWatch Logs Analysis

### Lambda Function Logs

**Log Group:** `/aws/lambda/linkedin-advanced-search-placeholder-search-prod`

**Sample Logs:**
```
_To be filled with actual CloudWatch logs showing:_
- Search request received
- Search query parameters
- User ID from JWT
- Response status
- Any errors
```

### API Gateway Logs

**Sample Logs:**
```
_To be filled with API Gateway access logs_
```

---

## Issues Found

| Issue # | Description | Severity | Status | Resolution |
|---------|-------------|----------|--------|------------|
| 1 | _Example: Search API timeout_ | _High_ | _Open/Fixed_ | _Resolution details_ |
| 2 | _To be filled_ | | | |

---

## Test Coverage Summary

| Category | Tests Planned | Tests Passed | Tests Failed | Coverage |
|----------|---------------|--------------|--------------|----------|
| Profile Scraping | 1 | _ | _ | _% |
| S3 Upload | 1 | _ | _ | _% |
| Search API | 1 | _ | _ | _% |
| UI Components | 3 | _ | _ | _% |
| Error Handling | 3 | _ | _ | _% |
| Authentication | 1 | _ | _ | _% |
| **Total** | **10** | **_** | **_** | **_%** |

---

## Conclusion

### Overall Status
- [ ] All tests passed
- [ ] Some tests failed (see Issues Found)
- [ ] Testing incomplete

### Summary
_To be completed after testing_

### Next Steps
_To be completed after testing_

---

## Appendix

### Environment Details

**Frontend:**
- URL: _http://localhost:5173_
- Version: _To be filled_
- Build: _To be filled_

**Backend:**
- URL: _http://localhost:3001_
- Version: _To be filled_

**AWS:**
- Region: _To be filled_
- API Gateway URL: _To be filled_
- S3 Bucket: _To be filled_
- DynamoDB Table: _To be filled_
- Lambda Function: _linkedin-advanced-search-placeholder-search-prod_

### Commands Reference

**Check API Gateway URL:**
```bash
aws cloudformation describe-stacks \
  --stack-name rag-cloudstack-api \
  --query 'Stacks[0].Outputs[?OutputKey==`BaseUrl`].OutputValue' \
  --output text
```

**Check S3 Files:**
```bash
aws s3 ls s3://{bucket}/linkedin-profiles/ --recursive --human-readable
```

**Tail Lambda Logs:**
```bash
aws logs tail /aws/lambda/linkedin-advanced-search-placeholder-search-prod --follow
```

**Test Search API Directly:**
```bash
curl -X POST {api-gateway-url}/search \
  -H "Authorization: Bearer {jwt}" \
  -H "Content-Type: application/json" \
  -d '{"query": "software engineer", "limit": 10}'
```

---

**Test Report Template Version:** 1.0
**Last Updated:** 2025-11-10
