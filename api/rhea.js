// Vercel adapter. The hosted Worker uses the same upstream boundary.
import { forwardRhea } from "../server/rhea.mjs";
export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const protocol =
    req.headers["x-forwarded-proto"] === "http" ? "http" : "https";
  const origin = protocol + "://" + host;
  const query = new URL(req.url, origin).searchParams;
  const op = req.query?.op || query.get("op") || "";
  const upstream =
    typeof op === "string" && /^[a-z0-9_/-]+$/.test(op) ? op : "";
  query.delete("op");
  const url = origin + "/rhea/" + upstream + "?" + query;
  const r = await forwardRhea(
    new Request(url, {
      method: req.method,
      headers: req.headers,
      body:
        req.method === "POST"
          ? typeof req.body === "string"
            ? req.body
            : JSON.stringify(req.body)
          : undefined,
    }),
    process.env.RHEA_API_KEY,
  );
  res.status(r.status).setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.send(await r.text());
}
