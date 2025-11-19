// Auth feature barrel export
export { ProtectedRoute } from './components/ProtectedRoute';
export { cognitoService, CognitoAuthService } from './services/cognitoService';
export { AuthProvider, useAuth } from './contexts/AuthContext';
export type { User } from './contexts/AuthContext';
