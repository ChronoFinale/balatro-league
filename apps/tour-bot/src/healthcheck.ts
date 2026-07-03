// Minimal HTTP server for Railway's health check (league bot pattern). The bot is a
// Discord gateway client — it serves no traffic — but Railway kills containers that
// don't bind to $PORT.
import { createServer } from "node:http";

export function startHealthCheck(): void {
  const port = parseInt(process.env.PORT ?? "8080", 10);
  const server = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found - the Tour bot has no public pages.");
  });
  server.listen(port, () => {
    console.log(`[healthcheck] listening on :${port}`);
  });
}
