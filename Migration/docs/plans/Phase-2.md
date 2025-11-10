# Phase 2: Puppeteer Refactor for Text Extraction

## Phase Goal

Refactor the Puppeteer backend to extract clean, structured text from LinkedIn profiles instead of just taking screenshots. This extracted text will be formatted as JSON or plain text and prepared for S3 upload in Phase 3. By the end of this phase, the Puppeteer scraper will parse profile HTML, extract all relevant fields (name, company, title, experience, skills, etc.), and provide structured text output.

**Success Criteria:**
- Text extraction service created and functional
- Profile HTML parsing logic implemented for all key fields
- Extracted data formatted as structured JSON
- Integration with existing LinkedInContactService
- Text extraction tested with sample LinkedIn profiles
- No regression in existing screenshot functionality

**Estimated tokens:** ~30,000

---

## Prerequisites

- **Previous Phases:** Phase 1 (Code Cleanup) must be complete
- **External Dependencies:** Puppeteer must be functional and able to navigate LinkedIn
- **Environment Requirements:**
  - LinkedIn credentials for testing
  - Access to LinkedIn profiles (real or mocked HTML snapshots)
  - Puppeteer backend running locally

---

## Tasks

### Task 1: Design Text Extraction Data Schema

**Goal:** Define the structure and format of extracted profile text to ensure consistency and completeness.

**Files to Create:**
- `puppeteer-backend/schemas/profileTextSchema.js` - JSON schema for extracted profile data
- `Migration/docs/text-extraction-schema.md` - Human-readable documentation of the schema

**Prerequisites:**
- Understanding of LinkedIn profile structure
- Review of current DynamoDB schema (from Phase 0)

**Implementation Steps:**

1. **Analyze LinkedIn profile structure:**
   - Review typical LinkedIn profile sections:
     - Basic info (name, headline, location, profile URL)
     - Current position (company, title, employment type, dates)
     - Experience history (past companies, titles, descriptions, dates)
     - Education (schools, degrees, fields of study, dates)
     - Skills (skill names, endorsement counts)
     - About/summary section (bio text)
     - Recent activity (if accessible)
   - Identify which fields are essential vs. optional

2. **Define JSON schema structure:**
   - Create a schema that mirrors DynamoDB attributes but adds structured text
   - Include fields for:
     - `profile_id` (derived from URL)
     - `url` (LinkedIn profile URL)
     - `name`, `headline`, `location`
     - `current_position` (object with company, title, employment_type, start_date)
     - `experience` (array of past positions)
     - `education` (array of schools)
     - `skills` (array of skill objects)
     - `about` (bio text)
     - `fulltext` (concatenated text of all fields for search)
     - `extracted_at` (timestamp)
   - Consider data types and validation rules

3. **Document schema with examples:**
   - Create comprehensive documentation showing:
     - Field descriptions and data types
     - Required vs. optional fields
     - Example JSON output
     - Edge cases (missing data, private profiles)
     - Validation rules

4. **Create validation utility:**
   - Write a simple validation function to check extracted data against schema
   - Include type checking and required field verification
   - Add helpful error messages for debugging

**Verification Checklist:**
- [ ] Schema file created with all essential fields
- [ ] Documentation includes field descriptions and examples
- [ ] Validation utility implemented and tested
- [ ] Schema reviewed for completeness (no missing LinkedIn fields)

**Testing Instructions:**
- Create mock profile data and validate against schema:
  ```javascript
  import { validateProfileData } from './schemas/profileTextSchema.js';
  const mockProfile = { /* ... */ };
  const result = validateProfileData(mockProfile);
  console.log(result.isValid, result.errors);
  ```

**Commit Message Template:**
```
feat(schema): define profile text extraction schema

- Create profileTextSchema.js with JSON structure
- Document all profile fields and data types
- Add validation utility for extracted data
- Include example JSON output
- Prepare for text extraction implementation
```

**Estimated tokens:** ~4,000

---

### Task 2: Create Text Extraction Service

**Goal:** Build a new service responsible for extracting text from LinkedIn profile pages using Puppeteer.

**Files to Create:**
- `puppeteer-backend/services/textExtractionService.js` - Core text extraction logic

**Prerequisites:**
- Task 1 schema design complete
- Understanding of Puppeteer page manipulation
- Review of existing LinkedInService and LinkedInContactService

**Implementation Steps:**

1. **Create service class structure:**
   - Create `TextExtractionService` class
   - Accept Puppeteer page object as constructor parameter
   - Initialize with configuration (timeouts, selectors, etc.)
   - Set up logging using existing Winston logger

2. **Design extraction methods:**
   - Plan extraction workflow:
     1. Navigate to profile page
     2. Wait for key elements to load
     3. Extract basic info (name, headline, location)
     4. Extract current position
     5. Extract experience history
     6. Extract education
     7. Extract skills
     8. Extract about/summary
     9. Concatenate fulltext
   - Implement each extraction step as a separate method for testability

3. **Implement error handling:**
   - Wrap all Puppeteer operations in try-catch blocks
   - Handle missing elements gracefully (some fields may be private or empty)
   - Log extraction failures with context (profile URL, field name)
   - Return partial data when possible (don't fail if one field is missing)
   - Implement retry logic for transient failures

4. **Add human behavior simulation:**
   - Reuse existing human behavior utilities from `humanBehaviorManager.js`
   - Add random delays between extractions
   - Simulate scrolling to reveal content
   - Avoid detection as a bot

5. **Integrate with existing services:**
   - Review `LinkedInService` to understand current navigation patterns
   - Review `LinkedInContactService` to understand profile interaction
   - Ensure text extraction doesn't conflict with screenshot capture
   - Consider reusing existing navigation helpers

**Verification Checklist:**
- [ ] TextExtractionService class created
- [ ] Extraction methods implemented for all schema fields
- [ ] Error handling covers missing/private fields
- [ ] Logging provides detailed extraction progress
- [ ] Human behavior simulation integrated
- [ ] Service tested with sample LinkedIn profile

**Testing Instructions:**
- Manual test with real LinkedIn profile:
  ```javascript
  const service = new TextExtractionService(page);
  const data = await service.extractProfileText(profileUrl);
  console.log(JSON.stringify(data, null, 2));
  ```
- Verify data matches schema
- Test with profiles that have missing fields
- Test with private profiles (should handle gracefully)

**Commit Message Template:**
```
feat(extraction): create text extraction service

- Implement TextExtractionService class
- Add extraction methods for all profile fields
- Integrate human behavior simulation
- Add comprehensive error handling
- Support partial extraction for private profiles
- Prepare for S3 upload integration
```

**Estimated tokens:** ~6,000

---

### Task 3: Implement Profile Field Extractors

**Goal:** Implement detailed extraction logic for each LinkedIn profile section using Puppeteer selectors.

**Files to Modify:**
- `puppeteer-backend/services/textExtractionService.js`

**Files to Create (optional):**
- `puppeteer-backend/utils/linkedinSelectors.js` - Centralized selector definitions

**Prerequisites:**
- Task 2 TextExtractionService created
- Understanding of LinkedIn HTML structure
- Access to LinkedIn for selector testing

**Implementation Steps:**

1. **Review LinkedIn HTML snapshot from Phase 0.5:**
   - Open `Migration/docs/linkedin-html-snapshot.html` (created in Phase 0.5)
   - Review `Migration/docs/linkedin-selectors.md` for documented selectors
   - Verify selectors are still valid against current LinkedIn HTML
   - Test documented fallback strategies
   - If snapshot is stale or selectors don't match, update documentation

2. **Research additional LinkedIn selectors (if needed):**
   - If selectors from Phase 0.5 are incomplete, manually inspect LinkedIn profiles
   - Note: LinkedIn frequently changes class names, so use resilient selectors
   - Prefer data attributes or stable class patterns over random class names
   - Document selectors with comments explaining what they target
   - Update `linkedin-selectors.md` with any new findings

3. **Implement basic info extraction:**
   - Extract name from profile header (usually h1 tag)
   - Extract headline (tagline below name)
   - Extract location (city/region)
   - Extract profile URL (from current page or canonical link)
   - Handle cases where elements don't exist
   - Return structured object

4. **Implement current position extraction:**
   - Identify "Experience" section on profile
   - Extract first (current) position:
     - Company name
     - Job title
     - Employment type (Full-time, Part-time, etc.)
     - Start date (month/year)
     - End date (or "Present")
     - Description (if visible)
   - Parse dates into consistent format (YYYY-MM or "Present")

5. **Implement experience history extraction:**
   - Extract all past positions from Experience section
   - For each position, extract same fields as current position
   - Handle multi-role experiences (same company, different titles)
   - Return array of experience objects
   - Handle "Show more" buttons to reveal all experiences

6. **Implement education extraction:**
   - Extract all education entries
   - For each entry, extract:
     - School name
     - Degree (Bachelor's, Master's, etc.)
     - Field of study
     - Dates (start year - end year)
   - Return array of education objects

7. **Implement skills extraction:**
   - Navigate to or expand Skills section
   - Extract skill names (limit to top 20-30 if many)
   - Optionally extract endorsement counts
   - Return array of skill objects or simple string array

8. **Implement about/summary extraction:**
   - Extract "About" section text
   - Handle "Show more" button if text is truncated
   - Clean up formatting (remove extra whitespace)
   - Return as plain text string

9. **Create fulltext concatenation:**
   - Combine all extracted fields into a single searchable text:
     - Name, headline, location
     - Current position description
     - All experience descriptions
     - All education info
     - All skills
     - About section
   - Join with newlines or spaces
   - Store in `fulltext` field for future search

10. **Add selector fallback logic:**
   - Implement multiple selector strategies for resilience
   - If primary selector fails, try alternate selectors
   - Log when fallback selectors are used
   - Consider XPath as last resort for stable elements

**Verification Checklist:**
- [ ] Basic info extraction working (name, headline, location)
- [ ] Current position extraction working
- [ ] Experience history extraction working (multiple entries)
- [ ] Education extraction working
- [ ] Skills extraction working
- [ ] About section extraction working
- [ ] Fulltext concatenation implemented
- [ ] Selector fallbacks tested
- [ ] Extraction tested with 5+ different profiles

**Testing Instructions:**
- Test with diverse profiles:
  - Active professional with full profile
  - Entry-level profile with minimal experience
  - Profile with private/hidden sections
  - Profile with non-English characters
  - Profile with "Show more" sections
- For each, verify:
  ```javascript
  const data = await textExtractionService.extractProfileText(url);
  console.log('Name:', data.name);
  console.log('Experience count:', data.experience.length);
  console.log('Skills count:', data.skills.length);
  console.log('Fulltext length:', data.fulltext.length);
  ```

**Commit Message Template:**
```
feat(extraction): implement profile field extractors

- Add basic info extraction (name, headline, location)
- Add current position extraction
- Add experience history extraction (all past roles)
- Add education extraction
- Add skills extraction
- Add about/summary extraction
- Implement fulltext concatenation
- Add selector fallback logic for resilience
- Test with diverse profile types
```

**Estimated tokens:** ~8,000

---

### Task 4: Integrate Text Extraction with LinkedInContactService

**Goal:** Integrate the new text extraction service into the existing `LinkedInContactService` workflow so that profile text is extracted alongside screenshots.

**Files to Modify:**
- `puppeteer-backend/services/linkedinContactService.js`

**Prerequisites:**
- Task 3 field extractors implemented
- Understanding of current LinkedInContactService workflow
- Review of `takeScreenShotAndUploadToS3` method

**Implementation Steps:**

1. **Review current LinkedInContactService:**
   - Examine `takeScreenShotAndUploadToS3` method
   - Understand current workflow:
     1. Navigate to profile
     2. Take screenshot of profile
     3. Navigate to recent activity
     4. Take screenshot of activity
     5. Upload screenshots to S3
     6. Save metadata to DynamoDB
   - Identify where text extraction should be added

2. **Import TextExtractionService:**
   - Add import at top of file
   - Initialize TextExtractionService in constructor or methods as needed

3. **Add text extraction step:**
   - After navigating to profile (before or after screenshot), extract text:
     ```javascript
     const profileText = await this.textExtractionService.extractProfileText(profileUrl);
     ```
   - Store extracted text in memory for Phase 3 (S3 upload)
   - Include text data in DynamoDB save operation

4. **Update method signature:**
   - Modify `takeScreenShotAndUploadToS3` to also return extracted text:
     ```javascript
     async takeScreenShotAndUploadToS3(profileUrl, status) {
       // ... existing logic ...
       const profileText = await this.textExtractionService.extractProfileText(profileUrl);
       return { screenshots, profileText };
     }
     ```

5. **Handle extraction errors:**
   - If text extraction fails, log error but don't fail entire operation
   - Allow screenshots to succeed even if text extraction fails
   - Save partial data to DynamoDB (mark as extraction_failed: true)

6. **Update DynamoDB save operation:**
   - Add extracted text fields to DynamoDB item:
     - `name`, `headline`, `location`
     - `current_position` (JSON string)
     - `experience` (JSON string)
     - `education` (JSON string)
     - `skills` (JSON string)
     - `about`
     - `fulltext`
     - `extracted_at` (timestamp)

7. **Add logging:**
   - Log when text extraction starts
   - Log when text extraction completes
   - Log field counts (e.g., "Extracted 5 experience entries, 12 skills")
   - Log any extraction failures or missing fields

**Verification Checklist:**
- [ ] TextExtractionService integrated into LinkedInContactService
- [ ] Text extraction happens alongside screenshot capture
- [ ] Extracted text included in DynamoDB save
- [ ] Error handling prevents text extraction from breaking screenshots
- [ ] Logging provides visibility into extraction process
- [ ] Method returns both screenshots and profileText

**Testing Instructions:**
- Run LinkedInContactService with text extraction:
  ```javascript
  const result = await linkedInContactService.takeScreenShotAndUploadToS3(profileUrl, 'possible');
  console.log('Screenshots:', result.screenshots);
  console.log('Profile text:', result.profileText);
  ```
- Verify DynamoDB contains extracted text fields
- Test with profile that has extraction errors
- Verify screenshots still succeed if text extraction fails

**Commit Message Template:**
```
feat(contact): integrate text extraction with screenshot workflow

- Import and initialize TextExtractionService
- Add text extraction step in takeScreenShotAndUploadToS3
- Include extracted text in DynamoDB save operation
- Add error handling to prevent extraction failures from breaking screenshots
- Add comprehensive logging for extraction process
- Return both screenshots and extracted text
```

**Estimated tokens:** ~5,000

---

### Task 5: Add Text Formatting and Sanitization

**Goal:** Create utilities to format, clean, and sanitize extracted text before storage and upload.

**Files to Create:**
- `puppeteer-backend/utils/textFormatter.js` - Text formatting and sanitization utilities

**Prerequisites:**
- Task 4 integration complete
- Understanding of common text formatting issues

**Implementation Steps:**

1. **Create formatter utility module:**
   - Create `textFormatter.js` with exported functions
   - Include logger for debugging formatting issues

2. **Implement text cleaning functions:**
   - Remove extra whitespace (multiple spaces, tabs, newlines):
     ```javascript
     function cleanWhitespace(text) {
       return text.replace(/\s+/g, ' ').trim();
     }
     ```
   - Remove special characters that may break JSON or S3:
     ```javascript
     function sanitizeForJson(text) {
       // Remove control characters, preserve newlines
       return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
     }
     ```
   - Normalize line endings (convert all to \n)
   - Trim leading/trailing whitespace

3. **Implement date formatting:**
   - Parse LinkedIn date formats (e.g., "Jan 2020 - Present")
   - Convert to consistent format (YYYY-MM or ISO 8601)
   - Handle incomplete dates (only year, or "Present")
   - Return null for unparseable dates
   - Example:
     ```javascript
     function formatDate(linkedInDate) {
       // "Jan 2020" -> "2020-01"
       // "2020 - Present" -> { start: "2020", end: "Present" }
     }
     ```

4. **Implement name sanitization:**
   - Remove titles (Mr., Dr., etc.)
   - Remove emojis (if present)
   - Normalize capitalization (if needed)
   - Handle non-English characters properly (preserve Unicode)

5. **Implement fulltext generation:**
   - Create a function to concatenate all fields into searchable text:
     ```javascript
     function generateFulltext(profileData) {
       const parts = [
         profileData.name,
         profileData.headline,
         profileData.location,
         profileData.about,
         // Experience descriptions
         profileData.experience.map(e => e.description).join(' '),
         // Skills
         profileData.skills.join(', '),
         // Education
         profileData.education.map(e => `${e.school} ${e.degree}`).join(' ')
       ];
       return parts.filter(Boolean).join('\n').trim();
     }
     ```

6. **Add JSON stringification:**
   - Create safe JSON stringify function:
     ```javascript
     function safeStringify(obj) {
       try {
         return JSON.stringify(obj, null, 2);
       } catch (error) {
         logger.error('JSON stringify failed:', error);
         return '{}';
       }
     }
     ```

7. **Add plain text formatting:**
   - Create function to convert profile data to human-readable plain text:
     ```javascript
     function formatAsPlainText(profileData) {
       return `
Name: ${profileData.name}
Headline: ${profileData.headline}
Location: ${profileData.location}

About:
${profileData.about}

Experience:
${profileData.experience.map(e => `- ${e.title} at ${e.company}`).join('\n')}

Education:
${profileData.education.map(e => `- ${e.degree} from ${e.school}`).join('\n')}

Skills: ${profileData.skills.join(', ')}
       `.trim();
     }
     ```

**Verification Checklist:**
- [ ] Text cleaning functions implemented
- [ ] Date formatting handles LinkedIn date formats
- [ ] Name sanitization removes unwanted characters
- [ ] Fulltext generation concatenates all fields
- [ ] JSON stringification is safe and handles errors
- [ ] Plain text formatting creates readable output
- [ ] All functions tested with sample data

**Testing Instructions:**
- Unit test each formatter function:
  ```javascript
  import * as formatter from './utils/textFormatter.js';

  // Test whitespace cleaning
  console.log(formatter.cleanWhitespace('  Hello   World  '));
  // Expected: "Hello World"

  // Test date formatting
  console.log(formatter.formatDate('Jan 2020 - Present'));
  // Expected: { start: '2020-01', end: 'Present' }

  // Test fulltext generation
  const mockProfile = { /* ... */ };
  console.log(formatter.generateFulltext(mockProfile));
  // Verify output contains all fields
  ```

**Commit Message Template:**
```
feat(formatting): add text formatting and sanitization utils

- Implement text cleaning (whitespace, special chars)
- Add date formatting for LinkedIn date formats
- Add name sanitization
- Implement fulltext generation from all fields
- Add safe JSON stringification
- Add plain text formatting for human readability
- Test all formatting functions
```

**Estimated tokens:** ~4,500

---

### Task 6: Add Configuration for Text Extraction

**Goal:** Add configuration options for text extraction behavior, selectors, and timeouts.

**Files to Modify:**
- `puppeteer-backend/config/index.js`

**Files to Create:**
- `puppeteer-backend/config/extractionConfig.js` - Text extraction specific configuration

**Prerequisites:**
- Task 5 formatter utilities complete
- Understanding of current config structure

**Implementation Steps:**

1. **Create extraction configuration file:**
   - Create `extractionConfig.js` with extraction-specific settings
   - Include configuration for:
     - Timeouts (element wait, page load)
     - Selectors (CSS selectors for each field)
     - Behavior (max skills, max experiences, etc.)
     - Formatting options

2. **Define timeout configuration:**
   ```javascript
   export const extractionTimeouts = {
     elementWait: 10000,        // Wait for element to appear
     sectionLoad: 5000,         // Wait for section to load
     pageNavigation: 30000,     // Wait for page navigation
     scrollDelay: 1000,         // Delay between scrolls
   };
   ```

3. **Define selector configuration:**
   - Centralize all LinkedIn selectors:
     ```javascript
     export const selectors = {
       profile: {
         name: 'h1.text-heading-xlarge',
         headline: '.text-body-medium',
         location: '.text-body-small',
         about: '#about + div .inline-show-more-text',
         // ... more selectors
       },
       experience: {
         section: '#experience + div',
         items: 'ul > li',
         title: '.t-bold span',
         company: '.t-14 span',
         dates: '.t-12 span',
         // ... more selectors
       },
       // ... more sections
     };
     ```
   - Include alternate selectors for fallback

4. **Define extraction limits:**
   ```javascript
   export const extractionLimits = {
     maxExperiences: 20,    // Limit experience entries
     maxEducation: 10,      // Limit education entries
     maxSkills: 50,         // Limit skills
     maxAboutLength: 5000,  // Max length of about section
   };
   ```

5. **Define output format options:**
   ```javascript
   export const outputFormat = {
     includeFulltext: true,
     fulltextSeparator: '\n',
     dateFormat: 'YYYY-MM',
     includeMetadata: true,  // Include extracted_at timestamp
   };
   ```

6. **Add feature flags:**
   ```javascript
   export const extractionFeatures = {
     extractExperience: true,
     extractEducation: true,
     extractSkills: true,
     extractAbout: true,
     extractActivity: false,  // Future feature
   };
   ```

7. **Import into main config:**
   - Update `config/index.js` to include extraction config:
     ```javascript
     import * as extraction from './extractionConfig.js';
     export default {
       // ... existing config
       extraction,
     };
     ```

8. **Add environment variable overrides:**
   - Allow environment variables to override config:
     ```javascript
     extractionTimeouts: {
       elementWait: parseInt(process.env.EXTRACTION_ELEMENT_WAIT || '10000'),
       // ... more overrides
     }
     ```
   - Update `.env.example` with new variables (will be done in Phase 3)

**Verification Checklist:**
- [ ] extractionConfig.js created with all settings
- [ ] Timeout configuration defined
- [ ] Selector configuration defined
- [ ] Extraction limits defined
- [ ] Output format options defined
- [ ] Feature flags defined
- [ ] Config imported into main config
- [ ] Environment variable overrides supported

**Testing Instructions:**
- Import and verify config:
  ```javascript
  import config from './config/index.js';
  console.log(config.extraction.selectors.profile.name);
  console.log(config.extraction.timeouts.elementWait);
  ```
- Test environment variable override:
  ```bash
  EXTRACTION_ELEMENT_WAIT=5000 node -e "import('./config/index.js').then(c => console.log(c.default.extraction.timeouts.elementWait))"
  # Expected: 5000
  ```

**Commit Message Template:**
```
feat(config): add text extraction configuration

- Create extractionConfig.js with all extraction settings
- Define timeouts for element wait, page load
- Centralize LinkedIn selectors for all profile sections
- Add extraction limits (max experiences, skills, etc.)
- Add output format options
- Add feature flags for extraction sections
- Support environment variable overrides
```

**Estimated tokens:** ~3,500

---

## Phase Verification

**How to verify entire Phase 2 is complete:**

1. **Run text extraction on real profile:**
   ```bash
   cd puppeteer-backend
   node -e "
     import('./services/textExtractionService.js').then(async (module) => {
       // Initialize Puppeteer and navigate to profile
       // Run extraction
       // Verify output matches schema
     });
   "
   ```

2. **Verify schema validation:**
   ```javascript
   import { validateProfileData } from './schemas/profileTextSchema.js';
   const extractedData = { /* ... from extraction */ };
   const result = validateProfileData(extractedData);
   console.assert(result.isValid, 'Schema validation failed');
   ```

3. **Verify LinkedInContactService integration:**
   ```javascript
   const result = await linkedInContactService.takeScreenShotAndUploadToS3(url, 'possible');
   console.assert(result.profileText, 'Profile text not extracted');
   console.assert(result.profileText.name, 'Name not extracted');
   console.assert(result.profileText.experience.length > 0, 'Experience not extracted');
   ```

4. **Verify formatting utilities:**
   ```javascript
   import * as formatter from './utils/textFormatter.js';
   const fulltext = formatter.generateFulltext(result.profileText);
   console.assert(fulltext.length > 0, 'Fulltext not generated');
   ```

5. **Verify configuration:**
   ```javascript
   import config from './config/index.js';
   console.assert(config.extraction.selectors.profile.name, 'Selectors not configured');
   ```

6. **Test with multiple profiles:**
   - Test with at least 3 different profile types (full, minimal, private)
   - Verify extraction succeeds or fails gracefully
   - Check DynamoDB for extracted text fields

**Integration points to test:**
- Text extraction runs alongside screenshot capture
- Extracted text saved to DynamoDB
- Errors in text extraction don't break screenshot workflow
- All extracted fields match schema

**Known limitations or technical debt introduced:**
- LinkedIn selectors may break if LinkedIn updates HTML structure (requires maintenance)
- Extraction may fail for non-English profiles (future enhancement)
- Activity extraction not yet implemented (future phase)
- Text not yet uploaded to S3 (Phase 3)

---

## Review Feedback

**Review Date:** 2025-11-10
**Reviewer:** Senior Engineer (Code Review)
**Status:** ⚠️ Implementation Not Started

### Verification Results

When reviewing the codebase against Phase 2's success criteria and task list, several questions arose:

**Prerequisite Check:**

1. **Phase 1 Completion:**
   - ✅ Phase 1 is complete - verified with `grep -ri "pinecone"` returning 0 results
   - ✅ No Pinecone Lambda directories exist
   - ✅ Ready to proceed with Phase 2

**Task 1: Design Text Extraction Data Schema**

2. **Schema File Creation:**
   - The plan specifies creating `puppeteer-backend/schemas/profileTextSchema.js`
   - When running `find . -name "profileTextSchema.js"`, what results appear?
   - Does the `puppeteer-backend/schemas/` directory exist?
   - Have you created the schema file with all required fields (profile_id, url, name, headline, location, current_position, experience, education, skills, about, fulltext, extracted_at)?

3. **Documentation:**
   - The plan requires `Migration/docs/text-extraction-schema.md`
   - When checking `ls Migration/docs/ | grep text-extraction-schema`, does the file exist?
   - Have you documented the schema with field descriptions, data types, required vs optional fields, and example JSON output?

4. **Validation Utility:**
   - The plan specifies creating a validation function to check extracted data against schema
   - When reading `puppeteer-backend/schemas/profileTextSchema.js`, is there a `validateProfileData` function exported?
   - Does the validation cover type checking and required field verification?

**Task 2: Create Text Extraction Service**

5. **Service File:**
   - The plan requires `puppeteer-backend/services/textExtractionService.js`
   - When running `ls puppeteer-backend/services/ | grep textExtraction`, what appears?
   - Have you created the TextExtractionService class?

6. **Service Implementation:**
   - When reading the service file, does it accept a Puppeteer page object as constructor parameter?
   - Are there separate extraction methods for each profile section (basic info, current position, experience, education, skills, about)?
   - Is error handling implemented with try-catch blocks for missing/private fields?
   - Does it integrate with existing `humanBehaviorManager.js` for bot detection avoidance?

**Task 3: Implement Profile Field Extractors**

7. **Field Extractor Methods:**
   - Have you implemented extractors for all fields mentioned in the schema?
   - When reading `textExtractionService.js`, do you see methods like:
     - `extractBasicInfo()` - name, headline, location
     - `extractCurrentPosition()` - company, title, employment type, dates
     - `extractExperience()` - past positions array
     - `extractEducation()` - schools array
     - `extractSkills()` - skills array
     - `extractAbout()` - bio text

8. **LinkedIn Selectors:**
   - The plan recommends reviewing Phase 0.5's HTML snapshot and `linkedin-selectors.md`
   - Have you consulted these documents before implementing selectors?
   - Are your CSS selectors defensive with fallback strategies for different LinkedIn layouts?

**Task 4: Integrate with LinkedInContactService**

9. **Service Integration:**
   - When reading `puppeteer-backend/services/linkedinContactService.js`, have you modified it to call text extraction?
   - Does the `takeScreenShotAndUploadToS3` method now also extract profile text?
   - Is the extracted text being saved to DynamoDB alongside screenshot metadata?

10. **Data Flow:**
    - When reviewing `linkedinContactService.js`, does it:
      - Create TextExtractionService instance
      - Call text extraction after successful screenshot
      - Handle extraction errors without breaking screenshot workflow
      - Store extracted text in DynamoDB with proper field names

**Task 5: Add Text Formatting and Sanitization**

11. **Formatter Utility:**
    - The plan requires `puppeteer-backend/utils/textFormatter.js`
    - When checking `ls puppeteer-backend/utils/ | grep textFormatter`, does the file exist?
    - Have you implemented functions for:
      - `sanitizeText()` - remove special characters, normalize whitespace
      - `generateFulltext()` - concatenate all fields into searchable text
      - `formatExperience()` - format experience array into readable text
      - `formatEducation()` - format education array into readable text

12. **Sanitization Quality:**
    - When reading the formatter code, does it handle:
      - Unicode characters properly
      - HTML entities (if any slip through)
      - Extra whitespace and newlines
      - Empty or null values gracefully

**Task 6: Add Configuration for Text Extraction**

13. **Configuration File:**
    - Have you added text extraction configuration to `puppeteer-backend/config/index.js`?
    - When reading the config file, is there a section for:
      - LinkedIn CSS selectors (with fallback options)
      - Extraction timeouts
      - Retry logic parameters
      - Feature flags for text extraction

14. **Selector Management:**
    - Are selectors centralized in config rather than hardcoded in service files?
    - Is there documentation for updating selectors when LinkedIn changes?

**Git History:**

15. **Commits:**
    - When running `git log --oneline --all | grep -i "schema\|extraction\|text"`, do any Phase 2 commits appear?
    - The plan specifies commit message templates for each task - have they been followed?
    - Expected commits should include:
      - `feat(schema): define profile text extraction schema`
      - `feat(extraction): create text extraction service`
      - `feat(extractors): implement profile field extractors`
      - `refactor(contact): integrate text extraction with LinkedInContactService`
      - `feat(format): add text formatting and sanitization utilities`
      - `config(extraction): add text extraction configuration`

16. **Working Directory:**
    - When running `git status`, are there uncommitted changes for Phase 2?
    - Are you working on the correct branch: `claude/create-plan-branch-011CUxxjrkvYFvyvfjgRUodq`?

**Testing & Verification:**

17. **Tests:**
    - When running `find tests/ -name "*extraction*" -o -name "*schema*"`, do any test files appear?
    - The plan mentions testing with sample LinkedIn profiles - have tests been created?
    - Are there tests for:
      - Schema validation with valid/invalid data
      - Text extraction with different profile types (full, minimal, private)
      - Formatter utilities
      - Error handling for missing fields

18. **Manual Testing:**
    - Have you manually tested text extraction with a real or mocked LinkedIn profile?
    - When importing and running TextExtractionService, does it successfully extract data?
    - Does the extracted data match the schema structure?

**Success Criteria Review:**

19. **Text Extraction Service:**
    - ✅ or ❌ Is the text extraction service created and functional?

20. **Profile HTML Parsing:**
    - ✅ or ❌ Is profile HTML parsing logic implemented for all key fields?

21. **Structured JSON Format:**
    - ✅ or ❌ Is extracted data formatted as structured JSON matching the schema?

22. **LinkedInContactService Integration:**
    - ✅ or ❌ Is text extraction integrated with existing LinkedInContactService?

23. **Testing:**
    - ✅ or ❌ Has text extraction been tested with sample LinkedIn profiles?

24. **No Regression:**
    - ✅ or ❌ Does existing screenshot functionality still work without issues?

### Questions to Consider

Before proceeding or continuing with Phase 2 implementation:

- Have you started working on Phase 2, or are you ready to begin?
- If you haven't started, have you reviewed Phase 0.5 documentation (linkedin-selectors.md, codebase-map.md)?
- If you have started, where are the implementation files? Are they on a different branch?
- Should you begin with Task 1 (schema design) before implementing the extraction service?
- Have you confirmed Phase 1 is complete by verifying zero Pinecone references?
- Do you understand the existing LinkedInContactService workflow before modifying it?

### Next Steps

To move forward with Phase 2:

1. **Start with Task 1:** Create the schema files first
   - Create `puppeteer-backend/schemas/` directory if it doesn't exist
   - Design and document the profile text schema
   - Implement validation utility

2. **Proceed to Task 2:** Implement the extraction service
   - Review existing services (linkedinService.js, linkedinContactService.js)
   - Understand current Puppeteer workflow
   - Create TextExtractionService with proper error handling

3. **Continue sequentially through Tasks 3-6**
   - Implement field extractors with defensive selectors
   - Integrate with LinkedInContactService carefully to avoid breaking screenshots
   - Add formatting utilities
   - Centralize configuration

4. **Commit after each task** using the provided commit message templates

5. **Test thoroughly:**
   - Create test files for each component
   - Manual test with real LinkedIn profiles
   - Verify no regression in existing functionality

### Evidence Required for Approval

For Phase 2 to be marked as complete, the following evidence is needed:

- [ ] `find . -name "profileTextSchema.js"` returns the schema file
- [ ] `find . -name "textExtractionService.js"` returns the service file
- [ ] `find . -name "textFormatter.js"` returns the formatter utility
- [ ] `ls Migration/docs/ | grep text-extraction-schema` shows documentation file
- [ ] `git log --oneline | grep -E "schema|extraction|format"` shows at least 6 commits for Phase 2 tasks
- [ ] Reading `puppeteer-backend/services/linkedinContactService.js` shows text extraction integration
- [ ] Reading `puppeteer-backend/config/index.js` shows extraction configuration section
- [ ] Manual test demonstrates successful text extraction from a LinkedIn profile
- [ ] Extracted JSON matches the schema structure
- [ ] Tests exist for schema validation and text extraction
- [ ] Existing screenshot functionality still works (no regression)

### Implementation Guidance

**Key architectural considerations from Phase 0:**

> **Remember:** The plan emphasizes preserving existing Puppeteer architecture. When integrating text extraction:
> - Don't break existing screenshot workflow
> - Reuse human behavior simulation from `humanBehaviorManager.js`
> - Follow existing error handling patterns in LinkedIn services
> - Store extracted text in DynamoDB alongside screenshot metadata

**From Task 2 Implementation Steps:**

> **Think about:** Before implementing selectors, review Phase 0.5's `linkedin-html-snapshot.html` and `linkedin-selectors.md`. Have you captured recent LinkedIn HTML? LinkedIn frequently changes class names, so defensive selectors with fallbacks are critical.

**From Task 4 Integration:**

> **Consider:** The LinkedInContactService's `takeScreenShotAndUploadToS3` method is central to the profile workflow. When adding text extraction:
> - Should extraction happen before or after screenshot?
> - What if extraction fails - should the screenshot still be saved?
> - How do you pass extracted text to DynamoDB service?
> - Are you maintaining backward compatibility?

---

**Previous Phase:** [Phase 1: Code Cleanup & Dead Code Removal](./Phase-1.md)

**Next Phase:** [Phase 3: S3 Integration & Upload](./Phase-3.md)
