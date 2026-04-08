import "./instrument";
import * as Sentry from "@sentry/node";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { startScheduler } from "./scheduler";
import { refreshPublicNewsCache } from "./public-feed-cache";
import { serveStatic } from "./static";
import {
  checkDatabaseReady,
  ensureIntegrationTables,
  getPool,
  initializeDatabase,
} from "./db";
import { resolveRuntimeEnv, StartupConfigError } from "./config/env";

const app = express();
const httpServer = createServer(app);
const APP_VERSION = "2.8.6";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

function setupBodyParsers() {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupSession(sessionSecret: string, isProduction: boolean) {
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool: getPool(),
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: isProduction,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? ("none" as const) : ("lax" as const),
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );
}

function setupApiRequestLogging() {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });
}

function setupHealthRoutes() {
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/readyz", async (_req, res) => {
    try {
      await checkDatabaseReady(2_000);
      res.status(200).json({ status: "ready" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(503).json({ status: "not_ready", reason: message });
    }
  });
}

function setupErrorHandler() {
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`request failed (${status}): ${message}`, "error");

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });
}

function handleStartupFailure(error: unknown) {
  if (error instanceof StartupConfigError) {
    log(`startup failed: ${error.message}`, "startup");
    process.exit(1);
    return;
  }

  if (error instanceof Error) {
    log(`startup failed: ${error.message}`, "startup");
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  } else {
    log(`startup failed: ${String(error)}`, "startup");
  }

  process.exit(1);
}

async function bootstrap() {
  try {
    const env = resolveRuntimeEnv();
    const isProduction = env.nodeEnv === "production";

    if (isProduction) {
      app.set("trust proxy", 1);
    }

    initializeDatabase({
      connectionString: env.databaseUrl,
      useNeonSsl: env.useNeonSsl,
    });

    if (!env.settingsEncryptionKey) {
      log(
        "SETTINGS_ENCRYPTION_KEY is not set. Sensitive settings will be tied to SESSION_SECRET and may fail after secret rotation.",
        "startup",
      );
    }

    setupBodyParsers();
    setupHealthRoutes();
    setupSession(env.sessionSecret, isProduction);
    setupApiRequestLogging();

    await ensureIntegrationTables();

    await getPool()
      .query(
        `
          insert into system_settings (key, value, description, updated_at)
          values ($1, $2, $3, now())
          on conflict (key) do update
          set value = excluded.value,
              description = excluded.description,
              updated_at = now()
        `,
        ["app_version", APP_VERSION, "رقم إصدار التطبيق"],
      )
      .catch((error) => {
        log(
          `failed to sync app version setting: ${error instanceof Error ? error.message : String(error)}`,
          "startup",
        );
      });

    // ربط هوية المستخدم بكل request في Sentry
    app.use((req, _res, next) => {
      if (req.session?.userId) {
        Sentry.setUser({ id: req.session.userId });
      } else {
        Sentry.setUser(null);
      }
      next();
    });

    await registerRoutes(httpServer, app);

    // ─── Public news feed cache ───────────────────────────────────────────
    refreshPublicNewsCache().catch((e: unknown) =>
      log(`public-feed-cache initial refresh failed: ${e instanceof Error ? e.message : String(e)}`, "startup"),
    );
    setInterval(
      () =>
        refreshPublicNewsCache().catch((e: unknown) =>
          log(`public-feed-cache refresh failed: ${e instanceof Error ? e.message : String(e)}`, "cache"),
        ),
      2 * 60 * 60 * 1000, // every 2 hours
    );

    app.get("/debug-sentry", function mainHandler(_req, res) {
      throw new Error("My first Sentry error!");
    });

    Sentry.setupExpressErrorHandler(app);
    setupErrorHandler();

    app.use(function onError(err: any, _req: Request, res: Response, _next: NextFunction) {
      res.statusCode = 500;
      res.end((res as any).sentry + "\n");
    });

    if (isProduction) {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    httpServer.listen(
      {
        port: env.port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${env.port}`);
        startScheduler();
      },
    );
  } catch (error) {
    handleStartupFailure(error);
  }
}

void bootstrap();
