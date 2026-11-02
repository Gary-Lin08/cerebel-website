// Shared request plumbing for the sign-up functions. Handlers use the Web Request/Response API.
import { timingSafeEqual } from "node:crypto";

export const MAX_BODY_BYTES = 16 * 1024;

const baseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...headers } });
}

export function clean(value, max = 200) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

export function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** A browser form posting from another origin is refused; server-to-server calls carry no Origin. */
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expected = new URL(request.url);
    const actual = new URL(origin);
    if (actual.host === expected.host) return true;
    // Vercel preview and production hosts for this project.
    return /(^|\.)cerebel\.tech$/.test(actual.hostname) || /^cerebel(-[a-z0-9]+)?(-kaijun-lins-projects)?\.vercel\.app$/.test(actual.hostname);
  } catch {
    return false;
  }
}

export async function readJson(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, "That request is too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "That request is too large.");
  try {
    const body = JSON.parse(text || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "Send a JSON object.");
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** What we keep about where a sign-up came from. No raw IP is stored. */
export function context(request, body) {
  const country = clean(request.headers.get("x-vercel-ip-country"), 8);
  const region = clean(request.headers.get("x-vercel-ip-country-region"), 100);
  const city = clean(decodeURIComponent(request.headers.get("x-vercel-ip-city") || ""), 100);
  return {
    sourcePage: clean(body.path, 300) || "/",
    referrer: clean(body.referrer, 500),
    utmSource: clean(body.utmSource, 120),
    utmMedium: clean(body.utmMedium, 120),
    utmCampaign: clean(body.utmCampaign, 160),
    utmContent: clean(body.utmContent, 160),
    utmTerm: clean(body.utmTerm, 160),
    sessionId: clean(body.sessionId, 80),
    country,
    region,
    city,
    userAgent: clean(request.headers.get("user-agent"), 300),
  };
}

export function newId() {
  return crypto.randomUUID();
}

/** Admin routes take `Authorization: Bearer <ADMIN_TOKEN>`; the token lives only in Vercel env. */
export function authorize(request, token = process.env.ADMIN_TOKEN) {
  if (!token) return json({ error: "Admin access is not configured on this deployment." }, 503);
  const header = request.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  if (!given || a.length !== b.length || !timingSafeEqual(a, b)) {
    return json({ error: "Authentication required." }, 401, { "www-authenticate": "Bearer" });
  }
  return null;
}

/** Wrap a handler so unexpected errors become a JSON 500 without leaking internals. */
export function guard(handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: "Something went wrong on our side. Try again, or write to hello@cerebel.tech." }, 500);
    }
  };
}

/** The store, or a 503 that says what is missing. */
export async function requireStore(getStore) {
  const store = await getStore();
  if (!store) {
    throw new HttpError(503, "Sign-ups are not being stored on this deployment yet. Write to hello@cerebel.tech instead.");
  }
  return store;
}
