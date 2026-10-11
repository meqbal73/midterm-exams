// GET  /api/data  -> the saved schedule (falls back to /data.json until the first save)
// PUT  /api/data  -> replace the saved schedule
import { json, needsKey, authorized } from "../../lib/auth.js";

const KEY = "schedule";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "no_kv" }, 503);
  let data = await env.DB.get(KEY, "json");
  if (!data) {
    const seed = await env.ASSETS.fetch(new URL("/data.json", request.url));
    data = seed.ok ? await seed.json() : { courses: [], names: {}, exams: [], tasks: [] };
  }
  return json(data, 200, { "x-needs-key": needsKey(env) ? "1" : "0", "x-ai": env.AI ? "1" : "0" });
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: "no_kv" }, 503);
  if (!authorized(request, env)) return json({ error: "bad_key" }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!body || !Array.isArray(body.exams) || !Array.isArray(body.tasks)) return json({ error: "bad_shape" }, 400);

  const text = JSON.stringify(body);
  if (text.length > 200_000) return json({ error: "too_large" }, 413);

  await env.DB.put(KEY, text);
  return json({ ok: true });
}
