import { useState, type FC, type ChangeEvent, type FormEvent } from 'react';
import { Input } from '../common';
import { validateSearchForm, hasValidationErrors } from '../../utils/validation';
import type { SearchFormData, ValidationErrors } from '../../utils/validation';
import styles from './SearchForm.module.css';

interface SearchFormProps {
  onSubmit: (data: SearchFormData) => void;
  loading?: boolean;
}

const SearchForm: FC<SearchFormProps> = ({ onSubmit, loading = false }) => {
  const [formData, setFormData] = useState<SearchFormData>({
    companyName: '',
    companyRole: '',
    companyLocation: '',
    searchName: '',
    searchPassword: '',
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<keyof SearchFormData, boolean>>({
    companyName: false,
    companyRole: false,
    companyLocation: false,
    searchName: false,
    searchPassword: false,
  });

  const handleInputChange = (field: keyof SearchFormData) => (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleInputBlur = (field: keyof SearchFormData) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validate single field on blur
    const fieldErrors = validateSearchForm(formData);
    if (fieldErrors[field]) {
      setErrors(prev => ({ ...prev, [field]: fieldErrors[field] }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateSearchForm(formData);
    setErrors(validationErrors);
    
    // Mark all fields as touched
    setTouched({
      companyName: true,
      companyRole: true,
      companyLocation: true,
      searchName: true,
      searchPassword: true,
    });

    if (!hasValidationErrors(validationErrors)) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.row}>
        <Input
          id="companyName"
          label="Company Name"
          type="text"
          placeholder="Enter company name"
          value={formData.companyName}
          onChange={handleInputChange('companyName')}
          onBlur={handleInputBlur('companyName')}
          error={touched.companyName ? errors.companyName : undefined}
          required
        />
        
        <Input
          id="companyRole"
          label="Company Role"
          type="text"
          placeholder="Enter role/position"
          value={formData.companyRole}
          onChange={handleInputChange('companyRole')}
          onBlur={handleInputBlur('companyRole')}
          error={touched.companyRole ? errors.companyRole : undefined}
          required
        />
      </div>

      <div className={styles.row}>
        <Input
          id="companyLocation"
          label="Company Location"
          type="text"
          placeholder="Enter location"
          value={formData.companyLocation}
          onChange={handleInputChange('companyLocation')}
          onBlur={handleInputBlur('companyLocation')}
          error={touched.companyLocation ? errors.companyLocation : undefined}
          required
        />
      </div>

      <div className={styles.credentialsSection}>
        <h3 className={styles.sectionTitle}>LinkedIn Credentials</h3>
        <div className={styles.row}>
          <Input
            id="searchName"
            label="Username"
            type="text"
            placeholder="LinkedIn username/email"
            value={formData.searchName}
            onChange={handleInputChange('searchName')}
            onBlur={handleInputBlur('searchName')}
            error={touched.searchName ? errors.searchName : undefined}
            required
          />
          
          <Input
            id="searchPassword"
            label="Password"
            type="password"
            placeholder="LinkedIn password"
            value={formData.searchPassword}
            onChange={handleInputChange('searchPassword')}
            onBlur={handleInputBlur('searchPassword')}
            error={touched.searchPassword ? errors.searchPassword : undefined}
            required
          />
        </div>
      </div>

      <button 
        type="submit" 
        className={styles.submitButton} 
        disabled={loading}
      >
        {loading ? 'Searching...' : 'Search LinkedIn'}
      </button>
    </form>
  );
};

export default SearchForm;