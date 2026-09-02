import { env } from './env';

export const googleOAuthConfig = {
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  callbackUrl: env.GOOGLE_CALLBACK_URL,
  scopes: ['openid', 'profile', 'email'],

  /** Google's OAuth2 endpoints */
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
};
