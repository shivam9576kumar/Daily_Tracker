import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend and project root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  GEMINI_MODEL_FALLBACKS: (
    process.env.GEMINI_MODEL_FALLBACKS || 'gemini-3.6-flash,gemini-2.5-flash'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // CORS
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Timezone used when the client does not send X-Timezone
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',

  // Helpers
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
} as const;
