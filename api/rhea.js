// Vercel adapter. The hosted Worker uses the same upstream boundary.
import { forwardRhea } from "../server/rhea.mjs";
export default async function handler(req, res) {
  const origin = "https://" + req.headers.host;
  const query = new URL(req.url, origin).searchParams;
  const upstream = req.query?.op || query.get("op") || "";
  query.delete("op");
  const url = origin + "/rhea/" + upstream + "?" + query;
  const r = await forwardRhea(
    new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method === "POST" ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body)) : undefined,
    }),
    process.env.RHEA_API_KEY,
  );
  res.status(r.status).setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.send(await r.text());
}
