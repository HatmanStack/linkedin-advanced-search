/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AWS_REGION: string
  readonly VITE_COGNITO_USER_POOL_ID: string
  readonly VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: string
  readonly VITE_COGNITO_IDENTITY_POOL_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
