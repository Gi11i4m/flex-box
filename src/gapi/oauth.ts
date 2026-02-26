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
    const refreshToken =
      (await this.database.getRefreshKey()) ??
      envOptional('GOOGLE_REFRESH_TOKEN');
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

    console.log('🔒 No refresh token found, authenticating...\n');
    await this.authenticateWithoutCredentials();
    return this;
  }

  private async authenticateWithoutCredentials() {
    const url = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
    });

    let resolveGotTokens: Function;
    const gotTokens = new Promise(res => (resolveGotTokens = res));

    const server = express()
      .get(
        '/auth_callback',
        async ({ query: { code } }: Request, res: Response) => {
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
          server.close();
          resolveGotTokens();
        },
      )
      .listen(8080);

    open(url);
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
