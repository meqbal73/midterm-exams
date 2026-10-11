// Shared helpers for the API routes.
// If an EDIT_KEY variable is set in Cloudflare, every write and every AI read needs it.

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function needsKey(env) {
  return Boolean(env.EDIT_KEY);
}

export function authorized(request, env) {
  if (!env.EDIT_KEY) return true;
  return request.headers.get("x-edit-key") === env.EDIT_KEY;
}
