# S3 Storage Design for Profile Text Files

## Overview

This document defines the S3 bucket structure, naming conventions, and organization for LinkedIn profile text files. The design extends the existing screenshot storage pattern to include structured JSON text files extracted from LinkedIn profiles.

**Version:** 1.0.0
**Last Updated:** 2025-11-10
**Status:** Active

---

## Existing S3 Structure (Screenshots)

The current implementation stores profile screenshots in the following structure:

```
s3://bucket-name/
└── linkedin-profiles/
    └── {profile-id}/
        ├── {profile-id}-Profile-{timestamp}.png
        ├── {profile-id}-Reactions-{timestamp}.png
        ├── {profile-id}-Recent-Activity-{timestamp}.png
        └── {profile-id}-About-This-Profile-{timestamp}.png
```

**Example:**
```
s3://linkedin-screenshots-prod/
└── linkedin-profiles/
    └── john-doe-123/
        ├── john-doe-123-Profile-2025-11-10T120000.png
        ├── john-doe-123-Reactions-2025-11-10T120030.png
        └── john-doe-123-Recent-Activity-2025-11-10T120045.png
```

**Key Characteristics:**
- Bucket: `S3_SCREENSHOT_BUCKET_NAME` environment variable
- Prefix: `linkedin-profiles/`
- Organization: One folder per profile ID
- Naming: `{profile-id}-{label}-{timestamp}.png`
- Region: `us-west-2` (or from `AWS_REGION` env var)

---

## New S3 Structure (Profile Text)

### Bucket Strategy

**Decision: Use the same bucket with a new prefix structure**

**Rationale:**
- ✅ Simplifies AWS account management (single bucket)
- ✅ Unified S3 bucket policy and IAM permissions
- ✅ Consistent region configuration
- ✅ Easier backup and disaster recovery (single source)
- ✅ Lower AWS cost (no cross-bucket transfer fees)

**Alternative Considered:** Separate bucket for text files
- ❌ Requires managing two buckets and policies
- ❌ Increases configuration complexity
- ❌ Potential for divergent security settings

### Folder Structure

The new structure extends the existing `linkedin-profiles/` prefix:

```
s3://bucket-name/
└── linkedin-profiles/
    └── {profile-id}/
        ├── screenshots/                          # NEW: Screenshots subfolder
        │   ├── {profile-id}-Profile-{timestamp}.png
        │   ├── {profile-id}-Reactions-{timestamp}.png
        │   └── {profile-id}-Recent-Activity-{timestamp}.png
        └── text/                                 # NEW: Text subfolder
            ├── {profile-id}.json                 # Latest profile text
            ├── {profile-id}-{timestamp}.json     # Versioned text (optional)
            └── {profile-id}-meta.json            # Upload metadata (optional)
```

**Simplified Structure (Recommended):**
```
s3://bucket-name/
└── linkedin-profiles/
    └── {profile-id}/
        ├── {profile-id}-Profile-{timestamp}.png      # Screenshots (existing)
        ├── {profile-id}-Reactions-{timestamp}.png
        ├── {profile-id}-Recent-Activity-{timestamp}.png
        └── {profile-id}.json                         # Profile text (NEW)
```

**Decision: Use simplified structure (no subfolders)**
- ✅ Maintains consistency with existing screenshot pattern
- ✅ Simpler S3 key construction
- ✅ Easier file discovery (all files in same folder)
- ✅ Avoids breaking existing code that lists profile files

---

## File Naming Convention

### Profile ID Extraction

Profile IDs are derived from LinkedIn URLs:

| LinkedIn URL | Profile ID | S3 Key |
|--------------|------------|--------|
| `https://linkedin.com/in/john-doe` | `john-doe` | `linkedin-profiles/john-doe/john-doe.json` |
| `https://linkedin.com/in/jane-smith-123` | `jane-smith-123` | `linkedin-profiles/jane-smith-123/jane-smith-123.json` |
| `https://linkedin.com/in/alice-jones-PhD` | `alice-jones-PhD` | `linkedin-profiles/alice-jones-PhD/alice-jones-PhD.json` |

**Extraction Logic:**
```javascript
function extractProfileId(url) {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
}
```

### File Naming Rules

**Primary Text File:**
- **Format:** `{profile-id}.json`
- **Example:** `john-doe.json`
- **Description:** Contains the latest extracted profile text in JSON format
- **Versioning:** Overwrites previous version (latest-only strategy)

**Optional Versioned Files:**
- **Format:** `{profile-id}-{timestamp}.json`
- **Example:** `john-doe-2025-11-10T120000.json`
- **Description:** Historical snapshots (if versioning enabled)
- **Use Case:** Track profile changes over time

**Optional Metadata File:**
- **Format:** `{profile-id}-meta.json`
- **Example:** `john-doe-meta.json`
- **Description:** Upload metadata, checksums, DynamoDB references
- **Use Case:** Debugging, audit trails

### Special Characters Handling

**URL Encoding:**
- LinkedIn profile IDs may contain hyphens, underscores, numbers
- All special characters are preserved (LinkedIn normalizes URLs)
- S3 keys support most characters without encoding
- No additional escaping needed for standard LinkedIn profile IDs

**Edge Cases:**
| Edge Case | Profile ID | S3 Key | Notes |
|-----------|------------|--------|-------|
| Trailing slash | `john-doe/` | `john-doe` | Remove trailing slash |
| Query params | `john-doe?src=...` | `john-doe` | Strip query params |
| Fragment | `john-doe#section` | `john-doe` | Strip fragments |
| Missing profile | N/A | `profile-{timestamp}` | Fallback for invalid URLs |

---

## File Format and Content

### Primary File: `{profile-id}.json`

**Format:** JSON (UTF-8 encoding)
**Content-Type:** `application/json`

**Structure:** Matches the profile text schema from Phase 2

**Example:**
```json
{
  "profile_id": "john-doe-123",
  "url": "https://linkedin.com/in/john-doe-123",
  "name": "John Doe",
  "headline": "Senior Software Engineer at TechCorp",
  "location": "San Francisco, CA",
  "current_position": {
    "company": "TechCorp",
    "title": "Senior Software Engineer",
    "employment_type": "Full-time",
    "start_date": "2020-01",
    "end_date": "Present",
    "description": "Leading development of cloud infrastructure"
  },
  "experience": [
    {
      "company": "Previous Corp",
      "title": "Software Engineer",
      "employment_type": "Full-time",
      "start_date": "2018-06",
      "end_date": "2019-12",
      "description": "Developed web applications"
    }
  ],
  "education": [
    {
      "school": "University of Technology",
      "degree": "Bachelor of Science",
      "field_of_study": "Computer Science",
      "start_date": "2014",
      "end_date": "2018"
    }
  ],
  "skills": [
    "JavaScript",
    "Python",
    "React",
    "Node.js",
    "AWS"
  ],
  "about": "Passionate software engineer with 5+ years of experience...",
  "fulltext": "John Doe Senior Software Engineer at TechCorp...",
  "extracted_at": "2025-11-10T12:00:00.000Z",
  "uploaded_at": "2025-11-10T12:00:05.000Z",
  "status": "possible"
}
```

**Required Fields:**
- `profile_id`: String (LinkedIn profile identifier)
- `url`: String (Full LinkedIn profile URL)
- `name`: String (Profile name)
- `extracted_at`: ISO 8601 timestamp (when text was extracted)

**Optional Fields:**
- All other schema fields (headline, location, experience, etc.)
- `uploaded_at`: ISO 8601 timestamp (when uploaded to S3)
- `status`: String (connection status: "ally", "possible", "incoming", "outgoing")

### Optional Metadata File: `{profile-id}-meta.json`

**Format:** JSON (UTF-8 encoding)

**Example:**
```json
{
  "profile_id": "john-doe-123",
  "s3_key": "linkedin-profiles/john-doe-123/john-doe-123.json",
  "uploaded_at": "2025-11-10T12:00:05.000Z",
  "file_size": 2048,
  "checksum": "a1b2c3d4e5f6...",
  "dynamodb_item_id": "profile#john-doe-123",
  "upload_status": "success",
  "upload_duration_ms": 234,
  "upload_retries": 0,
  "extracted_at": "2025-11-10T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

## S3 Object Metadata

### Standard Metadata

S3 object metadata is set during upload to enable efficient querying and filtering:

**Content-Type:**
```
Content-Type: application/json
```

**Custom Metadata (x-amz-meta-*):**
```
x-amz-meta-profile-id: john-doe-123
x-amz-meta-extracted-at: 2025-11-10T12:00:00.000Z
x-amz-meta-uploaded-at: 2025-11-10T12:00:05.000Z
x-amz-meta-status: possible
x-amz-meta-version: 1.0.0
```

**Server-Side Encryption:**
```
ServerSideEncryption: AES256
```

### Metadata Usage

| Metadata Field | Purpose |
|----------------|---------|
| `profile-id` | Quick identification without downloading file |
| `extracted-at` | Track when profile was scraped |
| `uploaded-at` | Track upload timestamp |
| `status` | Connection status for filtering |
| `version` | Schema version for backward compatibility |

---

## IAM Permissions

### Minimum Required Permissions

The Puppeteer backend requires the following S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::bucket-name/linkedin-profiles/*",
        "arn:aws:s3:::bucket-name"
      ]
    }
  ]
}
```

**Permission Breakdown:**
- `s3:PutObject`: Upload profile text files
- `s3:GetObject`: Download files for verification
- `s3:DeleteObject`: Remove old or invalid files
- `s3:ListBucket`: List files in profile folder

### Bucket Policy (Optional)

For cross-account access or additional security:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPuppeteerBackendAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:role/puppeteer-backend-role"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::bucket-name/linkedin-profiles/*"
    }
  ]
}
```

---

## Storage Configuration

### Environment Variables

**New Variables (Phase 3):**
```bash
# S3 Profile Text Storage
S3_PROFILE_TEXT_BUCKET_NAME=your-bucket-name
S3_PROFILE_TEXT_PREFIX=linkedin-profiles/
S3_PROFILE_TEXT_REGION=us-west-2
```

**Existing Variables (Reused):**
```bash
# AWS Credentials (shared with screenshots)
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# S3 Screenshot Bucket (can be reused for text)
S3_SCREENSHOT_BUCKET_NAME=your-bucket-name
```

**Fallback Logic:**
- If `S3_PROFILE_TEXT_BUCKET_NAME` is not set, use `S3_SCREENSHOT_BUCKET_NAME`
- If `S3_PROFILE_TEXT_REGION` is not set, use `AWS_REGION`
- If `S3_PROFILE_TEXT_PREFIX` is not set, use `linkedin-profiles/`

### Configuration in Code

```javascript
export const config = {
  s3: {
    screenshots: {
      bucket: process.env.S3_SCREENSHOT_BUCKET_NAME || '',
      prefix: 'linkedin-profiles/',
      region: process.env.AWS_REGION || 'us-west-2',
    },
    profileText: {
      bucket: process.env.S3_PROFILE_TEXT_BUCKET_NAME ||
              process.env.S3_SCREENSHOT_BUCKET_NAME || '',
      prefix: process.env.S3_PROFILE_TEXT_PREFIX || 'linkedin-profiles/',
      region: process.env.S3_PROFILE_TEXT_REGION ||
              process.env.AWS_REGION || 'us-west-2',
    },
  },
};
```

---

## Bucket Configuration

### Encryption

**Server-Side Encryption (SSE-S3):**
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

### Versioning (Optional)

To track historical changes to profiles:

```bash
aws s3api put-bucket-versioning \
  --bucket bucket-name \
  --versioning-configuration Status=Enabled
```

**Note:** Versioning is optional and adds storage costs. Recommended for production.

### Lifecycle Policies (Future)

For automatic cleanup of old files:

```json
{
  "Rules": [
    {
      "Id": "DeleteOldProfileTexts",
      "Status": "Enabled",
      "Prefix": "linkedin-profiles/",
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

---

## File Size Estimates

| Component | Typical Size | Maximum Size |
|-----------|-------------|--------------|
| Basic info | 200 bytes | 500 bytes |
| Experience (5 entries) | 1 KB | 5 KB |
| Education (3 entries) | 500 bytes | 2 KB |
| Skills (50 skills) | 500 bytes | 2 KB |
| About section | 500 bytes | 5 KB |
| Fulltext | 2 KB | 20 KB |
| **Total per profile** | **~5 KB** | **~30 KB** |

**Storage Estimates:**
- 1,000 profiles: ~5 MB
- 10,000 profiles: ~50 MB
- 100,000 profiles: ~500 MB
- 1,000,000 profiles: ~5 GB

**Cost Estimates (S3 Standard, us-west-2):**
- 100,000 profiles (~500 MB): $0.01/month storage
- 1,000,000 profiles (~5 GB): $0.12/month storage

---

## Integration with DynamoDB

### DynamoDB Schema Updates

Add S3 text file references to DynamoDB profile items:

```javascript
{
  profile_id: "john-doe-123",
  url: "https://linkedin.com/in/john-doe-123",
  // ... existing fields ...

  // NEW: S3 text file fields
  text_s3_key: "linkedin-profiles/john-doe-123/john-doe-123.json",
  text_s3_url: "s3://bucket-name/linkedin-profiles/john-doe-123/john-doe-123.json",
  text_uploaded_at: "2025-11-10T12:00:05.000Z",
  text_upload_status: "success",
  text_file_size: 5120
}
```

---

## Security Considerations

### Encryption
- ✅ Server-side encryption enabled (AES256)
- ✅ Encryption at rest (S3 default)
- ✅ Encryption in transit (HTTPS)

### Access Control
- ✅ IAM policy restricts access to `linkedin-profiles/*` prefix
- ✅ No public read access (bucket policy enforced)
- ✅ Separate IAM roles for different services

### Data Privacy
- ⚠️ Profile data contains PII (names, companies, locations)
- ⚠️ Ensure compliance with GDPR, CCPA if storing EU/CA data
- ⚠️ Consider data retention policies (auto-delete after N days)
- ⚠️ Implement audit logging for data access

---

## Future Enhancements

### Phase 4+ Considerations

**S3 Event Notifications:**
- Trigger Lambda on new profile text upload
- Automatically ingest into search index
- Send SNS notifications for monitoring

**CloudFront CDN:**
- Serve profile text files via CloudFront
- Reduce latency for global access
- Enable caching for frequently accessed profiles

**S3 Select:**
- Query JSON files directly in S3
- Filter profiles without downloading
- Reduce data transfer costs

**Cross-Region Replication:**
- Replicate to multiple regions for disaster recovery
- Enable global access with lower latency
- Automatic failover for high availability

---

## Testing Checklist

Before deploying:

- [ ] S3 bucket created and accessible
- [ ] Server-side encryption enabled
- [ ] IAM policy created and attached
- [ ] Test file upload with `aws s3 cp`
- [ ] Test file download with `aws s3 cp`
- [ ] Test file deletion with `aws s3 rm`
- [ ] Verify file appears in AWS Console
- [ ] Check S3 object metadata
- [ ] Test with special characters in profile ID
- [ ] Test with missing profile ID (fallback)
- [ ] Verify file size matches expectations
- [ ] Confirm JSON is valid and parseable

---

## References

- [Phase 2: Puppeteer Refactor for Text Extraction](./plans/Phase-2.md)
- [Profile Text Schema](./text-extraction-schema.md)
- [Environment Variables](./environment-variables.md)
- [AWS S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/best-practices.html)
- [S3 Object Metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html)

---

**Version History:**

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-10 | Initial design document |
