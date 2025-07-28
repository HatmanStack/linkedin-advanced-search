export interface SearchFormData {
  companyName: string;
  companyRole: string;
  companyLocation: string;
  searchName: string;
  searchPassword: string;
  userId?: string;
}

export interface ValidationErrors {
  companyName?: string;
  companyRole?: string;
  companyLocation?: string;
  searchName?: string;
  searchPassword?: string;
}

export const validateSearchForm = (data: SearchFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.companyName.trim()) {
    errors.companyName = 'Company name is required';
  }

  if (!data.companyRole.trim()) {
    errors.companyRole = 'Company role is required';
  }

  if (!data.companyLocation.trim()) {
    errors.companyLocation = 'Company location is required';
  }

  if (!data.searchName.trim()) {
    errors.searchName = 'Username is required';
  }

  if (!data.searchPassword) {
    errors.searchPassword = 'Password is required';
  } else if (data.searchPassword.length < 6) {
    errors.searchPassword = 'Password must be at least 6 characters';
  }

  return errors;
};

export const hasValidationErrors = (errors: ValidationErrors): boolean => {
  return Object.keys(errors).length > 0;
};