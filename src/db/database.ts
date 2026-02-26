import { env } from '../shared/env.ts';

const REFRESH_KEYS_PREFIX = 'refreshKeys';

export class Database {
  private constructor(
    private readonly kv: Deno.Kv,
    private readonly accountName: string,
  ) {}

  static async initialize(): Promise<Database> {
    const accountName = env('ACCOUNT_NAME');
    const timeoutMs = 10_000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms while initializing Deno KV`,
          ),
        );
      }, timeoutMs);
    });

    const kv = await Promise.race([Deno.openKv(), timeoutPromise]).finally(
      () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      },
    );

    return new Database(kv, accountName);
  }

  async getRefreshKey(): Promise<string | undefined> {
    const { value } = await this.kv.get<string>([
      REFRESH_KEYS_PREFIX,
      this.accountName,
    ]);
    return value ?? undefined;
  }

  async setRefreshKey(key: string): Promise<void> {
    await this.kv.set([REFRESH_KEYS_PREFIX, this.accountName], key);
  }

  async clearRefreshKey(): Promise<void> {
    await this.kv.delete([REFRESH_KEYS_PREFIX, this.accountName]);
  }
}
