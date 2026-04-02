import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: "https://12d867267b8fb4885ad7d8dcc212af3f@o4511140646944768.ingest.us.sentry.io/4511140694458368",
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [nodeProfilingIntegration()],
});

// يمسك أي crash على مستوى الـ Node process
process.on("uncaughtException", (error) => {
  Sentry.captureException(error);
});

process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
});
