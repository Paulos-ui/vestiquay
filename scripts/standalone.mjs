import { build } from "esbuild";
import fs from "node:fs/promises";
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
const css = (await fs.readFile("app/style.css", "utf8")).replace(
  '@import "tailwindcss";',
  "",
);
await fs.writeFile(
  "out/recovery.html",
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vestiquay | Independent client</title><style>' +
    css +
    '</style><header><b class="brand">Vestiquay</b>Independent recovery client</header><main id="root"></main><script>' +
    asset.text.replaceAll("</script", "<\\/script") +
    "</script></html>",
);
