import {
  CognitoUserPool,
  CognitoUser as CognitoUserClass,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import type { ISignUpResult } from 'amazon-cognito-identity-js';
import { cognitoConfig } from '@/config/appConfig';
import { createLogger } from '@/shared/utils/logger';
import type { AuthError, CognitoAttributeList } from '../types';

const logger = createLogger('CognitoService');

const userPool = new CognitoUserPool({
  UserPoolId: cognitoConfig.userPoolId,
  ClientId: cognitoConfig.userPoolWebClientId,
});

function extractUserData(session: CognitoUserSession, attributes: CognitoAttributeList, email: string): CognitoUserData {
  const userAttributes: { [key: string]: string } = {};
  attributes?.forEach((attr) => {
    userAttributes[attr.getName()] = attr.getValue();
  });

  return {
    id: session.getIdToken().payload.sub,
    email: userAttributes.email || email,
    firstName: userAttributes.given_name,
    lastName: userAttributes.family_name,
    emailVerified: userAttributes.email_verified === 'true',
  };
}


export interface CognitoUserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
}

export class CognitoAuthService {
  static async signUp(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ): Promise<{ error: AuthError | null; user?: ISignUpResult }> {
    return new Promise((resolve) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email,
        }),
      ];

      if (firstName) {
        attributeList.push(
          new CognitoUserAttribute({
            Name: 'given_name',
            Value: firstName,
          })
        );
      }

      if (lastName) {
        attributeList.push(
          new CognitoUserAttribute({
            Name: 'family_name',
            Value: lastName,
          })
        );
      }

      userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          resolve({ error: { message: err.message } });
          return;
        }

        resolve({
          error: null,
          user: result!,
        });
      });
    });
  }

  static async signIn(email: string, password: string): Promise<{ error: AuthError | null; user?: CognitoUserData }> {
    return new Promise((resolve) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUserClass({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session: CognitoUserSession) => {
          cognitoUser.getUserAttributes((err, attributes) => {
            if (err) {
              resolve({ error: { message: err.message } });
              return;
            }

            const user = extractUserData(session, attributes || [], email);

            resolve({ error: null, user });
          });
        },
        onFailure: (err) => {
          logger.error('Cognito sign-in error', { error: err });
          resolve({ error: { message: err.message, code: err.code } });
        },
        newPasswordRequired: (userAttributes) => {
          logger.debug('Completing new password challenge with same password');

          const writableAttributes = { ...userAttributes };
          delete writableAttributes.email;
          delete writableAttributes.email_verified;
          delete writableAttributes.phone_number;
          delete writableAttributes.phone_number_verified;

          cognitoUser.completeNewPasswordChallenge(password, writableAttributes, {
            onSuccess: (session: CognitoUserSession) => {
              cognitoUser.getUserAttributes((err, attributes) => {
                if (err) {
                  resolve({ error: { message: err.message } });
                  return;
                }

                const user = extractUserData(session, attributes || [], email);

                resolve({ error: null, user });
              });
            },
            onFailure: (err) => {
              logger.error('New password challenge failed', { error: err });
              resolve({ error: { message: err.message, code: err.code } });
            },
          });
        },
      });
    });
  }

  static async signOut(): Promise<void> {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
  }

  static async getCurrentUser(): Promise<CognitoUserData | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser();

      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession) => {
        if (err || !session.isValid()) {
          resolve(null);
          return;
        }

        cognitoUser.getUserAttributes((err, attributes) => {
          if (err) {
            resolve(null);
            return;
          }

          const userAttributes: { [key: string]: string } = {};
          attributes?.forEach((attr) => {
            userAttributes[attr.getName()] = attr.getValue();
          });

          
          const user: CognitoUserData = {
            id: session.getIdToken().payload.sub,
            email: userAttributes.email,
            firstName: userAttributes.given_name,
            lastName: userAttributes.family_name,
            emailVerified: userAttributes.email_verified === 'true',
          };

          resolve(user);
        });
      });
    });
  }

  static async confirmSignUp(email: string, code: string): Promise<{ error: AuthError | null }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUserClass({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          resolve({ error: { message: err.message } });
          return;
        }
        resolve({ error: null });
      });
    });
  }

  static async resendConfirmationCode(email: string): Promise<{ error: AuthError | null }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUserClass({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.resendConfirmationCode((err) => {
        if (err) {
          resolve({ error: { message: err.message } });
          return;
        }
        resolve({ error: null });
      });
    });
  }

  static async forgotPassword(email: string): Promise<{ error: AuthError | null }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUserClass({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.forgotPassword({
        onSuccess: () => {
          resolve({ error: null });
        },
        onFailure: (err) => {
          resolve({ error: { message: err.message } });
        },
      });
    });
  }

  static async confirmPassword(
    email: string,
    code: string,
    newPassword: string
  ): Promise<{ error: AuthError | null }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUserClass({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve({ error: null });
        },
        onFailure: (err) => {
          resolve({ error: { message: err.message } });
        },
      });
    });
  }

  static async getCurrentUserToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser();

      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession) => {
        if (err || !session.isValid()) {
          resolve(null);
          return;
        }

        resolve(session.getIdToken().getJwtToken());
      });
    });
  }
}
