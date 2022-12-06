import express from 'express';
import fs from 'fs';
import { Credentials, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import open from 'open';

const DATA_FILE = 'gapi-credentials.json';

export class OAuth2 {
  private auth: OAuth2Client;

  constructor() {
    this.auth = new google.auth.OAuth2({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URL,
    });
    google.options({ auth: this.auth });
  }

  async authenticate() {
    if (this.tokens) {
      this.tokens = this.tokens;
      return this;
    }

    const url = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
    });

    let resolveGotTokens: Function;
    const gotTokens = new Promise(res => (resolveGotTokens = res));

    const server = express()
      .get('/auth_callback', async ({ query: { code } }, res) => {
        const { tokens } = await this.auth.getToken(code as string);
        this.tokens = tokens;
        res.send('<html><script>window.close()</script></html>');
        server.close();
        resolveGotTokens();
      })
      .listen(8080);

    open(url);
    await gotTokens;

    this.auth.on('tokens', tokens => {
      this.tokens = {
        ...tokens,
        refresh_token: tokens.refresh_token || this.tokens?.refresh_token,
      };
    });

    return this;
  }

  private get tokens(): Credentials | undefined {
    return !fs.existsSync(DATA_FILE)
      ? undefined
      : JSON.parse(fs.readFileSync(DATA_FILE).toString());
  }

  private set tokens(tokens: Credentials | undefined) {
    if (tokens) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(tokens, undefined, 2));
      this.auth.setCredentials(tokens);
    } else {
      fs.rmSync(DATA_FILE);
    }
  }
}
