export class StartupConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StartupConfigError";
  }
}

export type RuntimeEnv = {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  useNeonSsl: boolean;
  sessionSecret: string;
  settingsEncryptionKey?: string;
};

function readNonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePort(rawPort: string): number {
  const port = Number.parseInt(rawPort, 10);
  if (Number.isNaN(port) || port <= 0) {
    throw new StartupConfigError(`Invalid PORT value: ${rawPort}`);
  }
  return port;
}

export function resolveRuntimeEnv(): RuntimeEnv {
  const nodeEnv = readNonEmptyEnv("NODE_ENV") ?? "development";
  const neonDatabaseUrl = readNonEmptyEnv("NEON_DATABASE_URL");
  const databaseUrl = neonDatabaseUrl ?? readNonEmptyEnv("DATABASE_URL");

  if (!databaseUrl) {
    throw new StartupConfigError(
      "Missing DATABASE_URL/NEON_DATABASE_URL. Configure it in Railway service variables.",
    );
  }

  const sessionSecret = readNonEmptyEnv("SESSION_SECRET");
  if (nodeEnv === "production" && !sessionSecret) {
    throw new StartupConfigError(
      "Missing SESSION_SECRET in production. Configure it in Railway service variables.",
    );
  }

  return {
    nodeEnv,
    port: parsePort(readNonEmptyEnv("PORT") ?? "5000"),
    databaseUrl,
    useNeonSsl: !!neonDatabaseUrl,
    sessionSecret: sessionSecret ?? "fallback-secret-change-in-production",
    settingsEncryptionKey: readNonEmptyEnv("SETTINGS_ENCRYPTION_KEY"),
  };
}
