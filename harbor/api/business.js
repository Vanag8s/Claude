// Member businesses: create, read and update the profile Harbor answers from.
//   POST   {profile}                       → creates a business, returns {id, admin_key} (keep the key safe)
//   GET    ?id=...  (header x-admin-key)   → full profile for the owner
//   PUT    {id, profile} (header x-admin-key) → update
import { normalizeProfile } from "./_lib/profile.js";
import { saveBusiness, getBusiness, newId, newKey, hashKey } from "./_lib/store.js";
import { limited, clientIp } from "./_lib/ratelimit.js";

const authed = (rec, req) => rec && req.headers["x-admin-key"] && hashKey(req.headers["x-admin-key"]) === rec.keyHash;

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      if (limited("biz-create:" + clientIp(req), 10, 3600_000)) return res.status(429).json({ error: "Too many new businesses from here. Try later." });
      const id = newId(), key = newKey();
      const profile = normalizeProfile(req.body?.profile);
      await saveBusiness({ id, keyHash: hashKey(key), profile, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return res.status(201).json({ id, admin_key: key, profile });
    }
    const id = req.method === "GET" ? new URL(req.url, "http://x").searchParams.get("id") : req.body?.id;
    const rec = await getBusiness(id);
    if (!rec) return res.status(404).json({ error: "Business not found" });
    if (!authed(rec, req)) return res.status(403).json({ error: "Wrong or missing admin key" });
    if (req.method === "GET") return res.status(200).json({ id, profile: rec.profile, updated_at: rec.updated_at });
    if (req.method === "PUT") {
      rec.profile = normalizeProfile(req.body?.profile);
      rec.updated_at = new Date().toISOString();
      await saveBusiness(rec);
      return res.status(200).json({ id, profile: rec.profile, updated_at: rec.updated_at });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("business api", e?.message);
    return res.status(500).json({ error: "Storage error" });
  }
}
