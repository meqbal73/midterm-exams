// POST /api/read  { text?, image?: "data:image/jpeg;base64,...", courses, saved }
// Reads one screenshot (and/or pasted text) with Workers AI and returns
// { exams: [...], tasks: [...], note } for the page to review before saving.
import { json, authorized } from "../../lib/auth.js";

// Vision models on Workers AI, tried in order. Change here if Cloudflare renames them.
const MODELS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
];

function today() {
  return new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
}

function buildPrompt({ text, hasImage, courses, saved }) {
  return `You extract schedule items for one university student (King Abdulaziz University, FCIT, Saudi Arabia). All times are Saudi time (UTC+3). Today is ${today()}.
The student's courses: ${(courses || []).join(", ")}.

The student gave ${hasImage ? "a screenshot" : "no image"}${text ? " and this text:\n<<<\n" + text + "\n>>>" : "."}

Find two kinds of items:
1. "exams": rows of an exam timetable (midterm/final). The table may list many courses: include ONLY the student's courses listed above. Exam tables usually write dates as DD/MM/YYYY in a day-name header row above a group of rows, and a time range like "13:00 - 14:30". Each row belongs to the closest date header ABOVE it.
2. "tasks": assignments, labs, quizzes, projects or anything with a due date, e.g. Blackboard items like "Due: Lab 5" and "Due Date: 10/21/26, 10:00 AM". Blackboard dates are MM/DD/YY. Course codes there can look like "202701_CPIT405_IT2_46140_EL" which means CPIT-405. Include tasks for any CPIT course.

Normalize course codes to the form "CPIT-405". Use 24-hour times. Use "" for anything unknown. Never invent items or guess dates that are not shown.
Already saved (reuse the same title spelling when it is the same item): ${JSON.stringify(saved || {})}

Reply with ONLY this JSON and nothing else:
{"exams":[{"code":"CPIT-405","name":"course name in Arabic if shown, else empty","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","building":"","room":"","hijri":"DD/MM/YYYY or empty"}],
 "tasks":[{"code":"CPIT-405","name":"course name in Arabic if shown, else empty","title":"Lab 5","due":"YYYY-MM-DDTHH:MM","grade":"points if shown, else empty"}],
 "note":"one short sentence in Saudi Arabic about anything unclear, or empty"}`;
}

function extractJson(out) {
  const r = out?.response ?? out?.result?.response ?? out;
  if (r && typeof r === "object") return r;
  const s = String(r || "");
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : s;
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  return JSON.parse(body.slice(start, end + 1));
}

export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) return json({ error: "bad_key" }, 401);
  if (!env.AI) return json({ error: "no_ai" }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const text = String(body.text || "").slice(0, 20000);
  const image = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : null;
  if (!text && !image) return json({ error: "empty" }, 400);
  if (image && image.length > 6_000_000) return json({ error: "image_too_large" }, 413);

  const prompt = buildPrompt({ text, hasImage: !!image, courses: body.courses, saved: body.saved });
  const content = image
    ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }]
    : prompt;

  let lastErr = "";
  for (const model of MODELS) {
    try {
      const out = await env.AI.run(model, {
        messages: [{ role: "user", content }],
        max_tokens: 2048,
        temperature: 0.1,
      });
      const data = extractJson(out);
      return json({
        exams: Array.isArray(data.exams) ? data.exams : [],
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        note: String(data.note || ""),
        model,
      });
    } catch (e) {
      lastErr = String(e?.message || e);
    }
  }
  return json({ error: "ai_failed", detail: lastErr.slice(0, 300) }, 502);
}
