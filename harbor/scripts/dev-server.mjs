// Local server: serves the site and runs the api/*.js functions the same way Vercel does.
// Usage: ANTHROPIC_API_KEY=... node scripts/dev-server.mjs   (PORT defaults to 4173)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const handlers = {};

function vercelRes(res) {
  res.status = c => { res.statusCode = c; return res; };
  res.json = b => { if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(b)); return res; };
  res.send = b => { res.end(typeof b === "string" || Buffer.isBuffer(b) ? b : JSON.stringify(b)); return res; };
  return res;
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = decodeURIComponent(url.pathname);
  try {
    if (path.startsWith("/api/")) {
      const name = path.slice(5).replace(/\/$/, "");
      if (!/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(name) || name.startsWith("_")) { res.writeHead(404); return res.end(); }
      const file = join(root, "api", name + ".js");
      try { await stat(file); } catch { res.writeHead(404); return res.end(); }
      handlers[name] ??= (await import(file)).default;
      let body = "";
      for await (const c of req) { body += c; if (body.length > 1e6) break; }
      const ct = req.headers["content-type"] || "";
      req.body = ct.includes("json") ? (body ? JSON.parse(body) : {}) : ct.includes("urlencoded") ? Object.fromEntries(new URLSearchParams(body)) : body;
      return await handlers[name](req, vercelRes(res));
    }
    let p = normalize(path).replace(/^(\.\.[/\\])+/, "");
    if (p.endsWith("/")) p += "index.html";
    const data = await readFile(join(root, p));
    res.writeHead(200, { "Content-Type": types[extname(p)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "EISDIR") { res.writeHead(404, { "Content-Type": types[".html"] }); return res.end(await readFile(join(root, "404.html"))); }
    console.error(e); if (!res.headersSent) res.writeHead(500); res.end();
  }
}).listen(PORT, () => console.log(`Harbor dev server on http://localhost:${PORT}`));
