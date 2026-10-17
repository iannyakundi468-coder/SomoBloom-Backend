export type AppEnv = {
  JWT_SECRET?: string;
  ENCRYPTION_SECRET?: string;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  [key: string]: any;
};

const DEV_DEFAULT_JWT_SECRET = 'somobloom_super_secret_dev_key_123';
const DEV_DEFAULT_ENCRYPTION_SECRET = 'somobloom_super_secret_encryption_key_123';

/**
 * Safely retrieves JWT Secret from environment bindings.
 * In production environment, throws an explicit error if missing.
 */
export function getJwtSecret(env: AppEnv): string {
  if (env && env.JWT_SECRET && env.JWT_SECRET.trim() !== '') {
    return env.JWT_SECRET;
  }
  
  const isProduction = env?.ENVIRONMENT === 'production';
  if (isProduction) {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is strictly required in production.');
  }

  return DEV_DEFAULT_JWT_SECRET;
}

/**
 * Safely retrieves Encryption Secret from environment bindings.
 * In production environment, throws an explicit error if missing.
 */
export function getEncryptionSecret(env: AppEnv): string {
  if (env && env.ENCRYPTION_SECRET && env.ENCRYPTION_SECRET.trim() !== '') {
    return env.ENCRYPTION_SECRET;
  }

  const isProduction = env?.ENVIRONMENT === 'production';
  if (isProduction) {
    throw new Error('FATAL SECURITY ERROR: ENCRYPTION_SECRET environment variable is strictly required in production.');
  }

  return DEV_DEFAULT_ENCRYPTION_SECRET;
}

/**
 * Retrieves allowed CORS origins list.
 */
export function getAllowedOrigins(env: AppEnv): string[] {
  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8787',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://somobloom.com',
    'https://app.somobloom.com',
    'https://admin.somobloom.com',
    'https://staging-app.somobloom.com',
    'https://staging.somobloom.com'
  ];

  if (env && env.ALLOWED_ORIGINS) {
    const configured = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    if (configured.length > 0) return configured;
  }

  return defaultDevOrigins;
}
