import { googleOAuthConfig } from '../../config/googleOAuth';
import prisma from '../../config/database';
import logger from '../../utils/logger';

interface GoogleUserInfo {
  sub: string;      // Google ID
  email: string;
  name: string;
  picture: string;
}

/**
 * Build the Google OAuth consent screen URL.
 */
export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: googleOAuthConfig.clientId,
    redirect_uri: googleOAuthConfig.callbackUrl,
    response_type: 'code',
    scope: googleOAuthConfig.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${googleOAuthConfig.authUrl}?${params.toString()}`;
}

/**
 * Exchange the authorization code for tokens, then fetch user info.
 */
export async function handleGoogleCallback(code: string) {
  // 1. Exchange code for tokens
  const tokenResponse = await fetch(googleOAuthConfig.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: googleOAuthConfig.clientId,
      client_secret: googleOAuthConfig.clientSecret,
      redirect_uri: googleOAuthConfig.callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    logger.error('Google token exchange failed:', errorText);
    throw new Error('Failed to exchange authorization code');
  }

  const tokens = (await tokenResponse.json()) as { access_token: string };

  // 2. Fetch user info
  const userInfoResponse = await fetch(googleOAuthConfig.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;

  // 3. Find or create user in database
  const user = await findOrCreateUser(googleUser);

  return user;
}

/**
 * Upsert: find existing user by Google ID or create a new one.
 */
async function findOrCreateUser(googleUser: GoogleUserInfo) {
  const existing = await prisma.user.findUnique({
    where: { googleId: googleUser.sub },
  });

  if (existing) {
    // Update profile info in case it changed
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: googleUser.name,
        email: googleUser.email,
        avatarUrl: googleUser.picture,
      },
    });
  }

  // Create new user
  logger.info(`Creating new user: ${googleUser.email}`);
  return prisma.user.create({
    data: {
      googleId: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.picture,
      coins: 0,
    },
  });
}
