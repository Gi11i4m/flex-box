import express from "express";
import { Credentials, OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import open from "open";
import { env } from "../shared/environment";

export class OAuth2 {
  private _tokens?: Credentials;
  private auth: OAuth2Client;

  constructor() {
    this.auth = new google.auth.OAuth2({
      clientId: env("GOOGLE_CLIENT_ID"),
      clientSecret: env("GOOGLE_CLIENT_SECRET"),
      redirectUri: env("GOOGLE_REDIRECT_URL"),
    });
    google.options({ auth: this.auth });
  }

  async authenticate() {
    if (this.tokens?.refresh_token) {
      this.auth.setCredentials(this.tokens);
      return this;
    }

    console.log(OAuth2.name, "No refresh token found, authenticating...");

    const url = this.auth.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/calendar.events"],
    });

    let resolveGotTokens: Function;
    const gotTokens = new Promise((res) => (resolveGotTokens = res));

    const server = express()
      .get("/auth_callback", async ({ query: { code } }, res) => {
        const { tokens } = await this.auth.getToken(code as string);
        this.tokens = tokens;
        res.send("<html><script>window.close()</script></html>");
        server.close();
        resolveGotTokens();
      })
      .listen(8080);

    open(url);
    await gotTokens;
    return this;
  }

  private get tokens(): Credentials | undefined {
    if (this._tokens?.refresh_token) {
      return this._tokens;
    }
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      return {
        ...this._tokens,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      };
    }
    return this._tokens;
  }

  private set tokens(tokens: Credentials | undefined) {
    console.log(tokens);
    this._tokens = tokens;
  }
}
