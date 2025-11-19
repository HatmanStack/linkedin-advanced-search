/**
 * Auth feature type definitions
 */

import { CognitoUserAttribute } from 'amazon-cognito-identity-js';

export interface AuthError {
  code?: string;
  name?: string;
  message: string;
}

export interface AuthResult<T = void> {
  error: AuthError | null;
  data?: T;
}

export interface SignUpResult {
  error: AuthError | null;
  user?: {
    username: string;
    userConfirmed: boolean;
    userSub: string;
  };
}

export interface SignInResult {
  error: AuthError | null;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified?: boolean;
  };
}

export interface CognitoAttributes {
  [key: string]: string;
}

export type CognitoAttributeList = CognitoUserAttribute[];
