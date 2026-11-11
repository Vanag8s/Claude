// Where member businesses are saved.
// Production: Upstash Redis over its REST API (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).
// Local/dev: a JSON file in harbor/data/ (not committed).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import crypto from "node:crypto";

const { UPSTASH_REDIS_REST_URL: URL_, UPSTASH_REDIS_REST_TOKEN: TOKEN } = process.env;
const FILE = new URL("../../data/businesses.json", import.meta.url);

async function redis(...cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error("store " + r.status);
  return (await r.json()).result;
}
async function readAll() {
  try { return JSON.parse(await readFile(FILE, "utf8")); } catch { return { businesses: {}, numbers: {} }; }
}
async function writeAll(db) {
  await mkdir(new URL("../../data/", import.meta.url), { recursive: true });
  await writeFile(FILE, JSON.stringify(db, null, 1));
}

export const hashKey = k => crypto.createHash("sha256").update(String(k)).digest("hex");
export const newId = () => crypto.randomBytes(6).toString("base64url");
export const newKey = () => crypto.randomBytes(24).toString("base64url");
const digits = n => String(n || "").replace(/\D/g, "");

/** record = { id, keyHash, profile, updated_at } */
export async function saveBusiness(record) {
  if (URL_ && TOKEN) {
    const old = await getBusiness(record.id);
    await redis("SET", `biz:${record.id}`, JSON.stringify(record));
    if (old?.profile?.phone_number && digits(old.profile.phone_number) !== digits(record.profile.phone_number)) await redis("DEL", `num:${digits(old.profile.phone_number)}`);
    if (record.profile.phone_number) await redis("SET", `num:${digits(record.profile.phone_number)}`, record.id);
    return;
  }
  const db = await readAll();
  const old = db.businesses[record.id];
  if (old?.profile?.phone_number) delete db.numbers[digits(old.profile.phone_number)];
  db.businesses[record.id] = record;
  if (record.profile.phone_number) db.numbers[digits(record.profile.phone_number)] = record.id;
  await writeAll(db);
}
export async function getBusiness(id) {
  if (!/^[\w-]{4,40}$/.test(String(id || ""))) return null;
  if (URL_ && TOKEN) { const v = await redis("GET", `biz:${id}`); return v ? JSON.parse(v) : null; }
  return (await readAll()).businesses[id] || null;
}
/** Which business owns the phone number a caller dialed. */
export async function businessForNumber(number) {
  const d = digits(number);
  if (!d) return null;
  if (URL_ && TOKEN) { const id = await redis("GET", `num:${d}`); return id ? getBusiness(id) : null; }
  const db = await readAll();
  return db.businesses[db.numbers[d]] || null;
}
