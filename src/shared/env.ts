export type Env = {
  DENO_DEPLOYMENT_ID?: string;

  DRY_RUN?: string;

  NUMBER_OF_WEEKS_TO_RESERVE?: string;

  GOOGLE_CALENDAR_ID?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URL?: string;
  GOOGLE_REFRESH_TOKEN?: string;

  SUPER7_LOGIN?: string;
  SUPER7_PASS?: string;

  ACCOUNT_NAME?: string;
};

export function env<T = string>(
  value: keyof Omit<Env, 'DRY_RUN' | 'NUMBER_OF_WEEKS_TO_RESERVE'>,
): T {
  return getRawEnvValue(value) as T;
}

export function envOptional<T = string>(value: keyof Env): T | undefined {
  return Deno.env.get(value) as T | undefined;
}

export function envBoolean(value: keyof Pick<Env, 'DRY_RUN'>): boolean {
  const envValue = getRawEnvValue(value);
  if (envValue === 'false') {
    return false;
  }
  return Boolean(value);
}

export function isDryRun() {
  return envBoolean('DRY_RUN');
}

export function envNumber(
  value: keyof Pick<Env, 'NUMBER_OF_WEEKS_TO_RESERVE'>,
): number {
  const numberValue = Number.parseInt(getRawEnvValue(value));
  if (Number.isNaN(numberValue)) {
    throw new Error(
      `Env variable for ${value} could not be parsed to a number`,
    );
  }
  return numberValue;
}

function getRawEnvValue(value: keyof Env) {
  const envValue = envOptional(value);
  if (!envValue) {
    throw new Error(`Env variable ${value} is missing`);
  }
  return envValue;
}
