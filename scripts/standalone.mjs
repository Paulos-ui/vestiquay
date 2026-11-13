import { build } from "esbuild";
import fs from "node:fs/promises";
import { themeBootstrap } from "../lib/theme.mjs";
const [asset] = (
  await build({
    entryPoints: ["scripts/standalone.tsx"],
    bundle: true,
    minify: true,
    write: false,
    jsx: "automatic",
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.NEXT_PUBLIC_RHEA_PROXY": '"0"',
    },
  })
).outputFiles;
const fonts = await fs.readFile("app/fonts.css", "utf8");
const fontAssets = [...fonts.matchAll(/url\(\/([^)]*)\)/g)];
let embeddedFonts = fonts;
for (const [source, name] of fontAssets) {
  const font = await fs.readFile("public/" + name);
  embeddedFonts = embeddedFonts.replace(
    source,
    `url(data:font/ttf;base64,${font.toString("base64")})`,
  );
}
const css = [
  embeddedFonts,
  await fs.readFile("app/style.css", "utf8"),
  await fs.readFile("app/desk.css", "utf8"),
].join("\n");
await fs.writeFile(
  "out/recovery.html",
  '<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vestiquay | Independent client</title><script>' +
    themeBootstrap +
    "</script><style>" +
    css +
    '</style></head><body><main id="root"></main><script>' +
    asset.text.replaceAll("</script", "<\\/script") +
    "</script></body></html>",
);
