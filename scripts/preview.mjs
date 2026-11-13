import http from "node:http";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
const args = process.argv.slice(2);
const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const port = Number(get("--port", "3000")),
  host = get("--host", "127.0.0.1");
const entry = path.resolve("dist/server/index.js");
await fs.access(entry);
const worker = (await import(pathToFileURL(entry))).default;
http
  .createServer(async (req, res) => {
    try {
      const parts = [];
      for await (const piece of req) parts.push(piece);
      const response = await worker.fetch(
        new Request("http://" + req.headers.host + req.url, {
          method: req.method,
          headers: req.headers,
          body: parts.length ? Buffer.concat(parts) : undefined,
        }),
        process.env,
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500);
      res.end("Preview failed");
    }
  })
  .listen(port, host);
