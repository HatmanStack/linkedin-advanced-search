import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    const isIncluded = true;
    const isExcluded = false;
    expect(cn('base', isIncluded && 'included', isExcluded && 'excluded')).toBe('base included');
  });

  it('should handle undefined and null values', () => {
    expect(cn('base', undefined, null, 'valid')).toBe('base valid');
  });

  it('should merge conflicting Tailwind classes', () => {
    // twMerge should keep the last conflicting class
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should handle array of classes', () => {
    expect(cn(['class1', 'class2'])).toBe('class1 class2');
  });

  it('should handle object syntax', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });

  it('should handle complex combinations', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn(
      'base-class',
      'px-2',
      isActive && 'conditional',
      isDisabled && 'excluded',
      { hover: true, focus: false },
      ['array1', 'array2'],
      'px-4' // should override px-2
    );
    expect(result).toContain('base-class');
    expect(result).toContain('conditional');
    expect(result).not.toContain('excluded');
    expect(result).toContain('hover');
    expect(result).not.toContain('focus');
    expect(result).toContain('array1');
    expect(result).toContain('array2');
    expect(result).toContain('px-4');
    expect(result).not.toContain('px-2');
  });

  it('should return empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('should handle empty strings', () => {
    expect(cn('valid', '', 'another')).toBe('valid another');
  });
});
