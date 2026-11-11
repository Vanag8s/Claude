// Fetches a public web page for onboarding, refusing private/internal addresses (SSRF protection).
import dns from "node:dns/promises";
import net from "node:net";

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

async function assertPublic(url) {
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http(s) links are allowed");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Port not allowed");
  if (url.username || url.password) throw new Error("Credentials in URL not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error("That address isn't a public website");
}

export async function fetchPublicPage(raw, { maxBytes = 1_500_000, timeoutMs = 8000, fetchImpl = fetch } = {}) {
  let url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    for (let hop = 0; hop < 4; hop++) {
      await assertPublic(url);
      const r = await fetchImpl(url, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": "HarborOnboardingBot/1.0", Accept: "text/html" } });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { url = new URL(r.headers.get("location"), url); continue; }
      if (!r.ok) throw new Error(`The site answered with ${r.status}`);
      if (!/text\/html|application\/xhtml/.test(r.headers.get("content-type") || "")) throw new Error("That link isn't a web page");
      const reader = r.body.getReader(); const chunks = []; let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length; if (size > maxBytes) { ctrl.abort(); break; }
        chunks.push(value);
      }
      return { url: url.toString(), html: Buffer.concat(chunks).toString("utf8") };
    }
    throw new Error("Too many redirects");
  } finally { clearTimeout(t); }
}

export function pageText(html) {
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] || "";
  const body = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return `TITLE: ${title}\nDESCRIPTION: ${desc}\n\n${body}`.slice(0, 14000);
}
