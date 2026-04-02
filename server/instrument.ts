import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://12d867267b8fb4885ad7d8dcc212af3f@o4511140646944768.ingest.us.sentry.io/4511140694458368",
  sendDefaultPii: true,
});
