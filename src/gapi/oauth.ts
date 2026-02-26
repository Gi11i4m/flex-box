import express, { Request, Response } from 'express';
import { Credentials, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import open from 'open';
import { env, envOptional } from '../shared/env.ts';
import { Database } from '../db/database.ts';

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

    let resolveGotTokens!: () => void;
    let rejectGotTokens!: (reason?: unknown) => void;
    const gotTokens = new Promise<void>((resolve, reject) => {
      resolveGotTokens = resolve;
      rejectGotTokens = reject;
    });

    const timeoutMs = 120_000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const server = express()
      .get(
        '/auth_callback',
        async ({ query: { code } }: Request, res: Response) => {
          try {
            const { tokens } = await this.auth.getToken(code as string);
            await this.setTokens(tokens);
            res.send(
              `
<html lang="html">
<script>window.close()</script>
<body><h3>Dit venster mag gesloten worden</h3></body>
</html>
`,
            );
            resolveGotTokens();
          } catch (error) {
            res.status(500).send('Authentication failed.');
            rejectGotTokens(error);
          } finally {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            server.close();
          }
        },
      )
      .listen(8080);

    timeoutId = setTimeout(() => {
      server.close();
      rejectGotTokens(
        new Error(
          `Timed out after ${timeoutMs}ms waiting for OAuth callback on http://localhost:8080/auth_callback`,
        ),
      );
    }, timeoutMs);

    await open(url).catch(error => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      server.close();
      rejectGotTokens(error);
    });

    await gotTokens;
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
