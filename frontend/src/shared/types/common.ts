/**
 * Common shared types used across the application
 */

export type ErrorResponse = {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type FilterOptions = Record<string, unknown>;

export type SortOptions = {
  field: string;
  direction: 'asc' | 'desc';
};

// Generic event handler types
export type ChangeHandler<T = unknown> = (value: T) => void;
export type ClickHandler = (event: React.MouseEvent) => void;
export type SubmitHandler = (event: React.FormEvent) => void;

// Generic data types
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
