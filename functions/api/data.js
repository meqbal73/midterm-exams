// GET  /api/data  -> the saved schedule (falls back to /data.json until the first save)
// PUT  /api/data  -> replace the saved schedule
import { json, needsKey, authorized } from "../../lib/auth.js";

const KEY = "schedule";

const examKey = e => e.code;
const taskKey = t => (t.code + "|" + t.title).toLowerCase().replace(/\s+/g, "");
const isPast = s => new Date(s + ":00+03:00") < new Date();

function mergeSeed(seed, saved) {
  const out = { ...saved, ...seed, names: { ...(saved.names || {}), ...(seed.names || {}) } };
  const seedEx = new Set(seed.exams.map(examKey));
  const seedTk = new Set(seed.tasks.map(taskKey));
  out.exams = [...seed.exams, ...(saved.exams || []).filter(e => !seedEx.has(examKey(e)))];
  out.tasks = [...seed.tasks, ...(saved.tasks || []).filter(t => !seedTk.has(taskKey(t)) && !isPast(t.due))];
  return out;
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "no_kv" }, 503);
  let data = await env.DB.get(KEY, "json");
  const res = await env.ASSETS.fetch(new URL("/data.json", request.url));
  const seed = res.ok ? await res.json() : null;
  if (!data) {
    data = seed || { courses: [], names: {}, exams: [], tasks: [] };
  } else if (seed && (seed.rev || 0) > (data.rev || 0)) {
    // A newer data.json was pushed: take it, and keep anything added from the page that it doesn't have.
    data = mergeSeed(seed, data);
    await env.DB.put(KEY, JSON.stringify(data));
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
