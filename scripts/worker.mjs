import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
// Embed the static export so the private Worker can serve it and proxy the Rhea API on one origin.
const assets = {};
async function read(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await read(p);
    else {
      const key = "/" + path.relative("out", p).split(path.sep).join("/");
      assets[key] = (await fs.readFile(p)).toString("base64");
    }
  }
}
await read("out");
await fs.mkdir("dist/server", { recursive: true });
const src = `import {forwardRhea} from './server/rhea.mjs';
const assets=${JSON.stringify(assets)};
const types={html:'text/html; charset=utf-8',js:'application/javascript',css:'text/css',txt:'text/plain',woff2:'font/woff2',ttf:'font/ttf',svg:'image/svg+xml'};
export default {async fetch(req,env){const path=new URL(req.url).pathname;if(path.startsWith('/rhea/'))return forwardRhea(req,env.RHEA_API_KEY);const key=path==='/'?'/index.html':path==='/desk'||path==='/desk/'?'/desk.html':path;const data=assets[key];if(!data||!['GET','HEAD'].includes(req.method))return new Response('Not found',{status:404});const bytes=req.method==='HEAD'?null:Uint8Array.from(atob(data),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':types[key.split('.').pop()]||'application/octet-stream','Cache-Control':key.startsWith('/_next/static/')?'public, max-age=31536000, immutable':'no-cache'}})}}`;
await build({
  stdin: { contents: src, resolveDir: process.cwd() },
  outfile: "dist/server/index.js",
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
});
