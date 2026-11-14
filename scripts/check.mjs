import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { forwardRhea } from "../server/rhea.mjs";

const base = "https://vestiquay.example/rhea";
const quote = base + "/api/v2/swap/quote";
assert.equal(
  (await forwardRhea(new Request(quote, { method: "POST" }))).status,
  503,
);
assert.equal(
  (
    await forwardRhea(
      new Request(quote, {
        method: "POST",
        headers: { Origin: "https://elsewhere.example" },
      }),
      "demo",
    )
  ).status,
  403,
);
assert.equal((await forwardRhea(new Request(base + "/unlisted"))).status, 404);
const savedFetch = globalThis.fetch;
try {
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, "Bearer fixture");
    return Response.json({ msg: "blocked" }, { status: 403 });
  };
  const denied = await forwardRhea(
    new Request(quote, { method: "POST" }),
    "fixture",
  );
  assert.equal(denied.status, 403);
  assert.match((await denied.json()).msg, /Rhea denied this swap API request/);
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, undefined);
    return Response.json({ msg: "blocked" }, { status: 403 });
  };
  const catalog = await forwardRhea(
    new Request(base + "/get_chain_prices?chain=900001"),
    "fixture",
  );
  assert.equal(catalog.status, 403);
  assert.match((await catalog.json()).msg, /public token catalog/);
} finally {
  globalThis.fetch = savedFetch;
}
const { default: worker } = await import("../dist/server/index.js");
for (const resource of [
  "/",
  "/desk",
  "/desk/",
  "/recovery.html",
  "/ref-inspector.html",
]) {
  const response = await worker.fetch(
    new Request("https://vestiquay.example" + resource),
    {},
  );
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Vestiquay/i);
}
for (const theme of ["dark", "light"]) {
  for (const size of ["", "-mobile"]) {
    const response = await worker.fetch(
      new Request(`https://vestiquay.example/harbor-${theme}${size}.webp`, {
        method: "HEAD",
      }),
      {},
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/webp");
  }
}
const client = await fs.readFile("out/recovery.html", "utf8");
assert.equal(/<script\s+src=/i.test(client), false);
assert.match(client, /data:font\/ttf;base64,/);
assert.match(client, /vestiquay\.theme/);
console.log(
  "Landing, desk, theme assets, independent client and Rhea credential boundary passed.",
);
await import("./check-recovery.mjs");
