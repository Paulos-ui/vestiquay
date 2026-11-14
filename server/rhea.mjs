// Only the SDK operations used by this desk may reach the credentialed upstream.
const routes = new Map([
  ["/get_chain_prices", "GET"],
  ["/api/swap/supported_to_tokens", "GET"],
  ["/api/v2/swap/quote", "POST"],
  ["/api/v2/swap/swap", "POST"],
  ["/api/swap/order-submit", "POST"],
  ["/api/swap/report", "POST"],
  ["/api/swap/order-status", "GET"],
]);
export async function forwardRhea(req, secret) {
  const url = new URL(req.url),
    path = url.pathname.slice("/rhea".length);
  if (req.method === "GET" && path === "/availability")
    return Response.json(
      { configured: Boolean(secret?.trim()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  if (routes.get(path) !== req.method)
    return Response.json({ msg: "Unknown Rhea operation" }, { status: 404 });
  if (
    req.method === "POST" &&
    req.headers.get("Origin") &&
    req.headers.get("Origin") !== url.origin
  )
    return Response.json({ msg: "Origin rejected." }, { status: 403 });
  const catalog =
    path === "/get_chain_prices" || path === "/api/swap/supported_to_tokens";
  if (!catalog && !secret?.trim())
    return Response.json(
      {
        msg: "Rhea routing is unavailable on this deployment. You can still recover NEAR.",
      },
      { status: 503 },
    );
  let body;
  if (req.method === "POST") {
    body = await req.text();
    if (new TextEncoder().encode(body).length > 131072)
      return Response.json({ msg: "Request too large." }, { status: 413 });
  }
  const headers = { "Content-Type": "application/json" };
  if (!catalog) headers.Authorization = "Bearer " + secret.trim();
  const id = req.headers.get("Idempotency-Key");
  if (id) headers["Idempotency-Key"] = id;
  try {
    const r = await fetch("https://api.rhea.finance" + path + url.search, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (r.status === 401 || r.status === 403)
      return Response.json(
        {
          msg: catalog
            ? "Rhea denied access to the public token catalog."
            : "Rhea denied this swap API request. Check Production access in the Rhea Boss portal or use NEAR Intents.",
        },
        { status: r.status, headers: { "Cache-Control": "no-store" } },
      );
    return new Response(r.body, {
      status: r.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { msg: "Rhea is temporarily unreachable." },
      { status: 502 },
    );
  }
}
