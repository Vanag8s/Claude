// Small in-memory rate limiter. Per server instance only; good enough as a first line of defense.
const buckets = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= max) { buckets.set(key, hits); return true; }
  hits.push(now); buckets.set(key, hits);
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value);
  return false;
}
export const clientIp = req => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
