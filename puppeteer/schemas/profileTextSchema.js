/**
 * LinkedIn Profile Text Extraction Schema
 *
 * Defines the structure of extracted profile data and provides validation utilities
 */

/**
 * Schema definition for extracted LinkedIn profile data
 */
export const profileSchema = {
  // Unique identifier derived from LinkedIn profile URL
  profile_id: { type: 'string', required: true },

  // LinkedIn profile URL
  url: { type: 'string', required: true },

  // Basic profile information
  name: { type: 'string', required: true },
  headline: { type: 'string', required: false },
  location: { type: 'string', required: false },

  // Current position (object)
  current_position: {
    type: 'object',
    required: false,
    fields: {
      company: { type: 'string', required: false },
      title: { type: 'string', required: false },
      employment_type: { type: 'string', required: false },
      start_date: { type: 'string', required: false },
      end_date: { type: 'string', required: false },
      description: { type: 'string', required: false }
    }
  },

  // Experience history (array of objects)
  experience: {
    type: 'array',
    required: false,
    items: {
      type: 'object',
      fields: {
        company: { type: 'string', required: false },
        title: { type: 'string', required: false },
        employment_type: { type: 'string', required: false },
        start_date: { type: 'string', required: false },
        end_date: { type: 'string', required: false },
        description: { type: 'string', required: false }
      }
    }
  },

  // Education history (array of objects)
  education: {
    type: 'array',
    required: false,
    items: {
      type: 'object',
      fields: {
        school: { type: 'string', required: false },
        degree: { type: 'string', required: false },
        field_of_study: { type: 'string', required: false },
        start_date: { type: 'string', required: false },
        end_date: { type: 'string', required: false },
        description: { type: 'string', required: false }
      }
    }
  },

  // Skills (array of strings or objects)
  skills: {
    type: 'array',
    required: false,
    items: { type: 'string' }
  },

  // About/summary section
  about: { type: 'string', required: false },

  // Concatenated fulltext for search
  fulltext: { type: 'string', required: false },

  // Extraction metadata
  extracted_at: { type: 'string', required: true }
};

/**
 * Validates a field value against its schema definition
 * @param {*} value - The value to validate
 * @param {Object} fieldSchema - The schema definition for the field
 * @param {string} fieldName - Name of the field (for error messages)
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
function validateField(value, fieldSchema, fieldName) {
  const errors = [];

  // Check if required field is missing
  if (fieldSchema.required && (value === null || value === undefined || value === '')) {
    errors.push(`Required field '${fieldName}' is missing or empty`);
    return { isValid: false, errors };
  }

  // If field is not required and is missing, that's okay
  if (!fieldSchema.required && (value === null || value === undefined)) {
    return { isValid: true, errors: [] };
  }

  // Type validation
  if (fieldSchema.type === 'string' && typeof value !== 'string') {
    errors.push(`Field '${fieldName}' must be a string, got ${typeof value}`);
  }

  if (fieldSchema.type === 'object' && typeof value !== 'object') {
    errors.push(`Field '${fieldName}' must be an object, got ${typeof value}`);
  } else if (fieldSchema.type === 'object' && fieldSchema.fields && typeof value === 'object' && value !== null) {
    // Validate nested object fields
    for (const [subFieldName, subFieldSchema] of Object.entries(fieldSchema.fields)) {
      const subResult = validateField(value[subFieldName], subFieldSchema, `${fieldName}.${subFieldName}`);
      errors.push(...subResult.errors);
    }
  }

  if (fieldSchema.type === 'array' && !Array.isArray(value)) {
    errors.push(`Field '${fieldName}' must be an array, got ${typeof value}`);
  } else if (fieldSchema.type === 'array' && Array.isArray(value) && fieldSchema.items) {
    // Validate array items
    value.forEach((item, index) => {
      if (fieldSchema.items.type === 'string' && typeof item !== 'string') {
        errors.push(`Field '${fieldName}[${index}]' must be a string, got ${typeof item}`);
      } else if (fieldSchema.items.type === 'object' && fieldSchema.items.fields) {
        for (const [subFieldName, subFieldSchema] of Object.entries(fieldSchema.items.fields)) {
          const subResult = validateField(item[subFieldName], subFieldSchema, `${fieldName}[${index}].${subFieldName}`);
          errors.push(...subResult.errors);
        }
      }
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates profile data against the schema
 * @param {Object} profileData - The extracted profile data to validate
 * @returns {Object} - { isValid: boolean, errors: string[], warnings: string[] }
 */
export function validateProfileData(profileData) {
  const errors = [];
  const warnings = [];

  if (!profileData || typeof profileData !== 'object') {
    return {
      isValid: false,
      errors: ['Profile data must be an object'],
      warnings: []
    };
  }

  // Validate each field
  for (const [fieldName, fieldSchema] of Object.entries(profileSchema)) {
    const result = validateField(profileData[fieldName], fieldSchema, fieldName);
    errors.push(...result.errors);
  }

  // Check for unexpected fields (warnings only)
  for (const fieldName of Object.keys(profileData)) {
    if (!profileSchema[fieldName]) {
      warnings.push(`Unexpected field '${fieldName}' found in profile data`);
    }
  }

  // Warnings for common issues
  if (!profileData.headline && !profileData.current_position) {
    warnings.push('No headline or current position found - profile may be incomplete');
  }

  if (!profileData.experience || profileData.experience.length === 0) {
    warnings.push('No experience data extracted');
  }

  if (!profileData.skills || profileData.skills.length === 0) {
    warnings.push('No skills extracted');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Creates an empty profile data object with all required fields
 * @param {string} profileId - The LinkedIn profile ID
 * @param {string} url - The LinkedIn profile URL
 * @returns {Object} - Empty profile data structure
 */
export function createEmptyProfile(profileId, url) {
  return {
    profile_id: profileId,
    url: url,
    name: '',
    headline: null,
    location: null,
    current_position: null,
    experience: [],
    education: [],
    skills: [],
    about: null,
    fulltext: '',
    extracted_at: new Date().toISOString()
  };
}

/**
 * Example profile data (for testing and documentation)
 */
export const exampleProfile = {
  profile_id: 'john-doe-123',
  url: 'https://www.linkedin.com/in/john-doe-123/',
  name: 'John Doe',
  headline: 'Senior Software Engineer at Tech Company',
  location: 'San Francisco, CA',
  current_position: {
    company: 'Tech Company',
    title: 'Senior Software Engineer',
    employment_type: 'Full-time',
    start_date: '2020-01',
    end_date: 'Present',
    description: 'Leading development of cloud infrastructure'
  },
  experience: [
    {
      company: 'Previous Corp',
      title: 'Software Engineer',
      employment_type: 'Full-time',
      start_date: '2018-06',
      end_date: '2019-12',
      description: 'Developed web applications using React and Node.js'
    }
  ],
  education: [
    {
      school: 'University of Technology',
      degree: 'Bachelor of Science',
      field_of_study: 'Computer Science',
      start_date: '2014',
      end_date: '2018',
      description: null
    }
  ],
  skills: [
    'JavaScript',
    'Python',
    'React',
    'Node.js',
    'AWS',
    'Docker',
    'Kubernetes'
  ],
  about: 'Passionate software engineer with 5+ years of experience building scalable web applications and cloud infrastructure.',
  fulltext: 'John Doe Senior Software Engineer at Tech Company San Francisco, CA Passionate software engineer with 5+ years of experience building scalable web applications and cloud infrastructure. Tech Company Senior Software Engineer Full-time 2020-01 to Present Previous Corp Software Engineer Full-time 2018-06 to 2019-12 University of Technology Bachelor of Science Computer Science 2014 to 2018 Skills: JavaScript, Python, React, Node.js, AWS, Docker, Kubernetes',
  extracted_at: '2025-11-09T12:00:00.000Z'
};

export default {
  profileSchema,
  validateProfileData,
  createEmptyProfile,
  exampleProfile
};
