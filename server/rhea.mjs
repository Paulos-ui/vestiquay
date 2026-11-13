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
  if (routes.get(path) !== req.method)
    return Response.json(
      { message: "Unknown Rhea operation" },
      { status: 404 },
    );
  if (
    req.method === "POST" &&
    req.headers.get("Origin") &&
    req.headers.get("Origin") !== url.origin
  )
    return new Response("Origin rejected", { status: 403 });
  const catalog =
    path === "/get_chain_prices" || path === "/api/swap/supported_to_tokens";
  if (!catalog && !secret)
    return Response.json(
      {
        message:
          "Rhea API access is pending. The staking inspector and NEAR withdrawal remain available.",
      },
      { status: 503 },
    );
  let body;
  if (req.method === "POST") {
    body = await req.text();
    if (body.length > 131072)
      return new Response("Request too large", { status: 413 });
  }
  const headers = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = "Bearer " + secret;
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
    return new Response(r.body, {
      status: r.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { message: "Rhea is temporarily unreachable." },
      { status: 502 },
    );
  }
}
