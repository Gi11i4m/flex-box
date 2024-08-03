import axios, { Axios } from "axios";
import { env } from "../shared/env";

const DB_BASE_URL = "https://api.jsonbin.io/v3/b";

export type JsonBinData<D> = {
  record: D;
};
export type DatabaseSchema = {
  refreshKeys: DatabaseAccounts;
};
export type DatabaseAccounts = {
  gilliam?: string;
  ariane?: string;
};

// Make sure there exists a DB at JSON bin and the BIN_ID is set in env
export class Database {
  private http: Axios;

  constructor() {
    this.http = axios.create({
      baseURL: DB_BASE_URL,
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 422, // 422 bug, see [here](https://laracasts.com/discuss/channels/laravel/422-unprocessable-entity-when-logging-out-using-axios-headers) ;
    });
    this.http.defaults.headers.common["X-Master-Key"] =
      env("JSONBIN_MASTER_KEY");
    this.http.defaults.headers.common["X-Access-Key"] =
      env("JSONBIN_ACCESS_KEY");
    this.http.defaults.headers.common["Content-Type"] = "application/json";
  }

  async getRefreshKey(): Promise<string | undefined> {
    const isInitialized = await this.http
      .get<JsonBinData<DatabaseSchema>>(`/${env("JSONBIN_BIN_ID")}`)
      .then(({ data: { record } }) => !!record.refreshKeys)
      .catch(() => false);
    if (!isInitialized) {
      throw new Error(
        `No BIN with id ${env(
          "JSONBIN_BIN_ID",
        )} has been found on ${DB_BASE_URL}`,
      );
    }
    const { refreshKeys } = await this.getAllRefreshKeys();
    return refreshKeys[env<keyof DatabaseAccounts>("JSONBIN_ACCOUNT_NAME")];
  }

  async getAllRefreshKeys() {
    const {
      data: { record },
    } = await this.http.get<JsonBinData<DatabaseSchema>>(
      `/${env("JSONBIN_BIN_ID")}`,
    );
    return record;
  }

  async setRefreshKey(key: string) {
    const newRefreshKeys: DatabaseSchema = {
      refreshKeys: {
        ...(await this.getAllRefreshKeys()).refreshKeys,
        [env<keyof DatabaseAccounts>("JSONBIN_ACCOUNT_NAME")]: key,
      },
    };
    return this.http.put(`/${env("JSONBIN_BIN_ID")}`, newRefreshKeys);
  }
}
