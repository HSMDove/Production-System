import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

Sentry.init({
  dsn: "https://1b153c5d72573759cc00a1bb29bd2b08@o4511140646944768.ingest.us.sentry.io/4511140680302592",
  sendDefaultPii: true,
});

createRoot(document.getElementById("root")!).render(<App />);
