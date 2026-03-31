import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getAdSensePublisherId, injectAdSenseScript } from "./adsense-injector";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Serve index.html for all SPA routes, with server-side AdSense script injection.
  // Reading the file as a string (instead of res.sendFile) allows us to modify the
  // HTML before it reaches the client — making the <script> tag visible in
  // "View Page Source" and to Google's AdSense verification crawler.
  app.use("*", async (_req, res) => {
    try {
      const indexPath = path.resolve(distPath, "index.html");
      let html = await fs.promises.readFile(indexPath, "utf-8");

      // Dynamically inject the AdSense script if a publisher ID is configured
      const publisherId = await getAdSensePublisherId();
      if (publisherId) {
        html = injectAdSenseScript(html, publisherId);
      }

      res.set("Content-Type", "text/html").send(html);
    } catch {
      res.status(500).send("Internal Server Error");
    }
  });
}
