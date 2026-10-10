import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend and project root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function validateTimezone(tz: string): string {
  if (!tz || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) {
    throw new Error('DEFAULT_TIMEZONE must be a valid IANA timezone');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    throw new Error('DEFAULT_TIMEZONE must be a valid IANA timezone');
  }
}

const defaultTimezone = validateTimezone(process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata');

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:3001/api/auth/google/callback',

  // Gemini AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  GEMINI_MODEL_FALLBACKS: (
    process.env.GEMINI_MODEL_FALLBACKS || 'gemini-1.5-flash-latest,gemini-2.0-flash-exp,gemini-1.5-pro-latest'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // CORS
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Timezone used when the client does not send X-Timezone
  DEFAULT_TIMEZONE: defaultTimezone,

  // Helpers
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
} as const;

/**
 * Fails loudly at startup if a production deployment is still using the
 * localhost default — this previously failed silently, producing a
 * confusing browser-side CORS error for real users instead of an
 * obvious deployment misconfiguration at boot time.
 */
export function assertProductionConfig(e: typeof env = env): void {
  const firstOrigin = e.FRONTEND_URL.split(',')[0]?.trim();
  if (e.isProd && firstOrigin === 'http://localhost:5173') {
    throw new Error(
      'FRONTEND_URL is not configured for production (still the localhost default). ' +
      'Set FRONTEND_URL to your deployed frontend origin(s) before starting in production.'
    );
  }
}

