import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createApi } from "./server/api.mjs";
import { installBundledMusic } from "./server/music-seed.mjs";
import { createPublisher } from "./server/publishing.mjs";
const root = path.resolve("dist/client");
const api = createApi({ publisher: createPublisher() });
installBundledMusic(api.store);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
const server = createServer((req, res) =>
  api.handle(req, res, async () => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep) && file !== root) {
        res.writeHead(403);
        return res.end();
      }
      try {
        if (!(await stat(file)).isFile()) throw new Error();
      } catch {
        if (path.extname(pathname)) {
          res.writeHead(404);
          return res.end();
        }
        file = path.join(root, "index.html");
      }
      const bytes = await readFile(file);
      res.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "same-origin");
      res.setHeader(
        "Cache-Control",
        file.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
      );
      res.writeHead(200);
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch {
      res.writeHead(500);
      res.end("Unable to serve XGN");
    }
  }),
);
const port = Number(process.env.PORT || 4173),
  host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () =>
  console.log(`XGN running at http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      api.store.db.close();
      process.exit(0);
    }),
  );
