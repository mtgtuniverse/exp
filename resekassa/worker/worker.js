/* Resekassan – Cloudflare Worker (delad lagring via KV)
 *
 * Endpoints:
 *   GET  /trip/:id   -> hämtar hela state-blobben (JSON)
 *   PUT  /trip/:id   -> sparar hela state-blobben, returnerar { rev }
 *
 * Lagringen är en enda JSON-blob per resa i KV. Enkelt och räcker gott
 * för en liten grupp. Kräver en KV-namespace bunden som TRIPS (se wrangler.toml).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const MAX_BODY = 256 * 1024; // 256 KB tak – skydd mot missbruk

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function sanitizeId(id) {
  return (id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/trip\/([^/]+)\/?$/);
    if (!match) return json({ error: "not found" }, 404);

    const id = sanitizeId(decodeURIComponent(match[1]));
    if (!id) return json({ error: "invalid trip id" }, 400);
    const key = `trip:${id}`;

    if (request.method === "GET") {
      const stored = await env.TRIPS.get(key);
      if (!stored) {
        return json({ people: [], expenses: [], settled: {}, rev: 0 });
      }
      return new Response(stored, {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (request.method === "PUT") {
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: "too large" }, 413);

      let data;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        return json({ error: "invalid json" }, 400);
      }
      if (typeof data !== "object" || data === null) {
        return json({ error: "invalid body" }, 400);
      }

      const clean = {
        people: Array.isArray(data.people) ? data.people : [],
        expenses: Array.isArray(data.expenses) ? data.expenses : [],
        settled: data.settled && typeof data.settled === "object" ? data.settled : {},
        rev: Number.isFinite(data.rev) ? data.rev : 0,
      };

      await env.TRIPS.put(key, JSON.stringify(clean));
      return json({ ok: true, rev: clean.rev });
    }

    return json({ error: "method not allowed" }, 405);
  },
};
