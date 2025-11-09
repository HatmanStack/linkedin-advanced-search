# LinkedIn Profile Text Extraction Schema

## Overview

This document defines the structure and format of extracted LinkedIn profile data. The schema ensures consistency across all text extraction operations and provides a foundation for S3 storage and future search capabilities.

---

## Schema Version

**Version:** 1.0.0
**Last Updated:** 2025-11-09
**Status:** Active

---

## Schema Definition

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `profile_id` | string | Yes | Unique identifier derived from LinkedIn profile URL (e.g., "john-doe-123") |
| `url` | string | Yes | Full LinkedIn profile URL |
| `name` | string | Yes | Full name as displayed on profile |
| `headline` | string | No | Professional headline/tagline below name |
| `location` | string | No | Current location (city, state/country) |
| `current_position` | object | No | Current employment information (see below) |
| `experience` | array | No | Array of past positions (see below) |
| `education` | array | No | Array of education entries (see below) |
| `skills` | array | No | Array of skill names (strings) |
| `about` | string | No | About/summary section text |
| `fulltext` | string | No | Concatenated searchable text from all fields |
| `extracted_at` | string | Yes | ISO 8601 timestamp of extraction |

---

### Current Position Object

The `current_position` field is an object with the following structure:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company` | string | No | Company name |
| `title` | string | No | Job title/role |
| `employment_type` | string | No | Employment type (e.g., "Full-time", "Part-time", "Contract") |
| `start_date` | string | No | Start date in YYYY-MM format or "YYYY" for year only |
| `end_date` | string | No | End date in YYYY-MM format, "YYYY", or "Present" |
| `description` | string | No | Job description/responsibilities |

**Example:**
```json
{
  "company": "Tech Company",
  "title": "Senior Software Engineer",
  "employment_type": "Full-time",
  "start_date": "2020-01",
  "end_date": "Present",
  "description": "Leading development of cloud infrastructure"
}
```

---

### Experience Array

The `experience` field is an array of objects with the same structure as `current_position`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company` | string | No | Company name |
| `title` | string | No | Job title/role |
| `employment_type` | string | No | Employment type |
| `start_date` | string | No | Start date (YYYY-MM or YYYY) |
| `end_date` | string | No | End date (YYYY-MM, YYYY, or "Present") |
| `description` | string | No | Job description/responsibilities |

**Example:**
```json
[
  {
    "company": "Previous Corp",
    "title": "Software Engineer",
    "employment_type": "Full-time",
    "start_date": "2018-06",
    "end_date": "2019-12",
    "description": "Developed web applications using React and Node.js"
  },
  {
    "company": "Startup Inc",
    "title": "Junior Developer",
    "employment_type": "Full-time",
    "start_date": "2016-01",
    "end_date": "2018-05",
    "description": "Built mobile-first web applications"
  }
]
```

---

### Education Array

The `education` field is an array of objects representing educational history:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `school` | string | No | Institution name |
| `degree` | string | No | Degree type (e.g., "Bachelor of Science", "Master of Arts") |
| `field_of_study` | string | No | Major/field of study |
| `start_date` | string | No | Start year (YYYY) |
| `end_date` | string | No | End year (YYYY) or "Present" |
| `description` | string | No | Additional details (activities, honors, etc.) |

**Example:**
```json
[
  {
    "school": "University of Technology",
    "degree": "Bachelor of Science",
    "field_of_study": "Computer Science",
    "start_date": "2014",
    "end_date": "2018",
    "description": null
  },
  {
    "school": "Code Academy",
    "degree": "Certificate",
    "field_of_study": "Web Development",
    "start_date": "2013",
    "end_date": "2014",
    "description": "Full-stack web development bootcamp"
  }
]
```

---

### Skills Array

The `skills` field is a simple array of strings:

**Example:**
```json
[
  "JavaScript",
  "Python",
  "React",
  "Node.js",
  "AWS",
  "Docker",
  "Kubernetes"
]
```

**Notes:**
- Skills are typically extracted without endorsement counts
- Maximum 50 skills recommended (most relevant skills first)
- Duplicates should be removed during extraction

---

### Fulltext Field

The `fulltext` field is a concatenated string of all profile text for search purposes.

**Generation Logic:**
1. Concatenate all text fields: name, headline, location, about
2. Add current position description
3. Add all experience descriptions
4. Add all education info (school + degree + field)
5. Add all skills
6. Join with newlines or spaces

**Example:**
```
John Doe Senior Software Engineer at Tech Company San Francisco, CA Passionate software engineer with 5+ years of experience building scalable web applications and cloud infrastructure. Tech Company Senior Software Engineer Full-time 2020-01 to Present Previous Corp Software Engineer Full-time 2018-06 to 2019-12 University of Technology Bachelor of Science Computer Science 2014 to 2018 Skills: JavaScript, Python, React, Node.js, AWS, Docker, Kubernetes
```

---

## Complete Example

```json
{
  "profile_id": "john-doe-123",
  "url": "https://www.linkedin.com/in/john-doe-123/",
  "name": "John Doe",
  "headline": "Senior Software Engineer at Tech Company",
  "location": "San Francisco, CA",
  "current_position": {
    "company": "Tech Company",
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
      "description": "Developed web applications using React and Node.js"
    }
  ],
  "education": [
    {
      "school": "University of Technology",
      "degree": "Bachelor of Science",
      "field_of_study": "Computer Science",
      "start_date": "2014",
      "end_date": "2018",
      "description": null
    }
  ],
  "skills": [
    "JavaScript",
    "Python",
    "React",
    "Node.js",
    "AWS",
    "Docker",
    "Kubernetes"
  ],
  "about": "Passionate software engineer with 5+ years of experience building scalable web applications and cloud infrastructure.",
  "fulltext": "John Doe Senior Software Engineer at Tech Company San Francisco, CA Passionate software engineer with 5+ years of experience building scalable web applications and cloud infrastructure. Tech Company Senior Software Engineer Full-time 2020-01 to Present Previous Corp Software Engineer Full-time 2018-06 to 2019-12 University of Technology Bachelor of Science Computer Science 2014 to 2018 Skills: JavaScript, Python, React, Node.js, AWS, Docker, Kubernetes",
  "extracted_at": "2025-11-09T12:00:00.000Z"
}
```

---

## Validation Rules

### Required Fields
- `profile_id`: Must not be empty
- `url`: Must be a valid LinkedIn profile URL
- `name`: Must not be empty
- `extracted_at`: Must be valid ISO 8601 timestamp

### Optional Fields
- All other fields are optional
- If a field cannot be extracted, it should be `null` (objects/strings) or `[]` (arrays)
- Empty strings should be avoided; use `null` for missing string values

### Data Types
- Strings: `name`, `headline`, `location`, `about`, `fulltext`, etc.
- Objects: `current_position`
- Arrays: `experience`, `education`, `skills`
- ISO 8601 Date String: `extracted_at`

### Date Formats
- Full date: `YYYY-MM` (e.g., "2020-01")
- Year only: `YYYY` (e.g., "2018")
- Current/ongoing: `"Present"`

---

## Edge Cases

### Private or Incomplete Profiles

If a profile section is private or unavailable:
- Set the field to `null` (for objects/strings) or `[]` (for arrays)
- Log a warning but do not fail extraction
- Continue extracting available fields

**Example (private experience):**
```json
{
  "profile_id": "jane-smith-456",
  "url": "https://www.linkedin.com/in/jane-smith-456/",
  "name": "Jane Smith",
  "headline": null,
  "location": null,
  "current_position": null,
  "experience": [],
  "education": [],
  "skills": [],
  "about": null,
  "fulltext": "Jane Smith",
  "extracted_at": "2025-11-09T12:00:00.000Z"
}
```

### Non-English Profiles

- Unicode characters should be preserved
- No translation is performed
- Text extraction works with any language that uses standard HTML

### Multi-Role Experiences

LinkedIn sometimes shows multiple roles at the same company:
- Extract each role as a separate experience entry
- Keep company name consistent across entries
- Differentiate by title and dates

---

## Validation Utility

The schema includes a validation utility (`validateProfileData`) that:

1. Checks all required fields are present
2. Validates data types for each field
3. Checks nested object and array structures
4. Returns validation result with errors and warnings

**Usage:**
```javascript
import { validateProfileData } from './schemas/profileTextSchema.js';

const result = validateProfileData(extractedData);

if (result.isValid) {
  console.log('Profile data is valid!');
} else {
  console.error('Validation errors:', result.errors);
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

---

## Future Enhancements

Fields that may be added in future versions:

- `recent_activity`: Array of recent posts/comments
- `certifications`: Array of professional certifications
- `languages`: Array of languages spoken
- `volunteer_experience`: Array of volunteer work
- `publications`: Array of published works
- `projects`: Array of personal/professional projects
- `honors_awards`: Array of recognitions
- `profile_picture_url`: URL to profile image
- `connections_count`: Number of connections (if visible)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-09 | Initial schema definition |

---

## References

- [Phase 2 Implementation Plan](./plans/Phase-2.md)
- [Profile Text Schema (JavaScript)](../puppeteer-backend/schemas/profileTextSchema.js)
- [Phase 0 Architecture Decisions](./plans/Phase-0.md)
