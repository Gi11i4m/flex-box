import { Credentials, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import open from 'open';
import { env, envOptional } from '../shared/env.ts';
import { Database } from '../db/database.ts';
import {
  cancelOAuthCallbackWait,
  waitForOAuthCallbackCode,
} from './oauth-callback.ts';

export class OAuth2 {
  private readonly auth: OAuth2Client;

  constructor(private database: Database) {
    this.auth = new google.auth.OAuth2({
      clientId: env('GOOGLE_CLIENT_ID'),
      clientSecret: env('GOOGLE_CLIENT_SECRET'),
      redirectUri: env('GOOGLE_REDIRECT_URL'),
    });
    google.options({ auth: this.auth });
  }

  async authenticate() {
    const refreshTokenFromKv = await this.database.getRefreshKey();
    const refreshTokenFromEnv = envOptional('GOOGLE_REFRESH_TOKEN');
    const refreshToken = refreshTokenFromKv ?? refreshTokenFromEnv;

    const tokenSource = refreshTokenFromKv
      ? 'kv'
      : refreshTokenFromEnv
        ? 'env'
        : 'none';
    console.log(`🔐 OAuth token source: ${tokenSource}`);

    if (refreshToken) {
      console.log('🔓 Refresh token found, authenticating...\n');
      await this.setTokens({ refresh_token: refreshToken });
      await this.auth.refreshAccessToken().catch(async (error: any) => {
        if (error?.message?.includes('invalid_grant')) {
          await this.database.clearRefreshKey();
          throw new Error(
            'Google refresh token is invalid_grant. Cleared stored KV token; run again to re-authenticate and seed a new token.',
          );
        }
        throw error;
      });
      return this;
    }

    if (envOptional('DENO_DEPLOYMENT_ID')) {
      throw new Error(
        'No refresh token found in KV or GOOGLE_REFRESH_TOKEN. Interactive OAuth is unavailable on Deno Deploy; seed KV for ACCOUNT_NAME first.',
      );
    }

    console.log('🔒 No refresh token found, authenticating...\n');
    await this.authenticateWithoutCredentials();
    return this;
  }

  private async authenticateWithoutCredentials() {
    const url = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
    });

    const timeoutMs = 120_000;
    const callbackCodePromise = waitForOAuthCallbackCode(timeoutMs);

    await open(url).catch(error => {
      cancelOAuthCallbackWait(error);
    });

    const callbackCode = await callbackCodePromise;
    const { tokens } = await this.auth.getToken(callbackCode);
    await this.setTokens(tokens);
  }

  private async setTokens(tokens: Credentials | undefined) {
    if (tokens) {
      this.auth.setCredentials(tokens);
    }
    if (tokens?.refresh_token) {
      await this.database.setRefreshKey(tokens.refresh_token);
    }
  }
}
