const ADMIN_EMAILS = new Set(["lin@motionverse.ai", "kaijunlin08@outlook.com"]);
const LEAD_STATUSES = new Set(["new", "contacted", "qualified", "closed"]);
const EVENT_TYPES = new Set(["page_view", "cta_click", "form_start", "form_submit"]);

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, ...headers },
  });
}

function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requestIp(request) {
  return clean(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0], 64);
}

function maskIp(ip) {
  if (!ip) return "";
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":")}:****:${parts.at(-1) || ""}`;
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.***.***.${parts[3]}` : "***";
}

async function hashIp(ip, env) {
  if (!ip) return "";
  const payload = new TextEncoder().encode(`${env.IP_HASH_SALT || "motionverse-ip-v1"}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestGeo(request) {
  const cf = request.cf || {};
  return {
    country: clean(cf.country || request.headers.get("cf-ipcountry"), 8),
    region: clean(cf.region, 100),
    city: clean(cf.city, 100),
    timezone: clean(cf.timezone, 100),
  };
}

function parseUserAgent(userAgent) {
  const ua = userAgent.toLowerCase();
  const deviceType = /bot|crawler|spider/.test(ua)
    ? "bot"
    : /ipad|tablet/.test(ua)
      ? "tablet"
      : /mobile|iphone|android/.test(ua)
        ? "mobile"
        : "desktop";
  const browser = /edg\//.test(ua)
    ? "Edge"
    : /chrome|crios/.test(ua)
      ? "Chrome"
      : /firefox|fxios/.test(ua)
        ? "Firefox"
        : /safari/.test(ua)
          ? "Safari"
          : "Other";
  return { deviceType, browser };
}

function attribution(body) {
  return {
    referrer: clean(body.referrer, 500),
    utmSource: clean(body.utmSource, 120),
    utmMedium: clean(body.utmMedium, 120),
    utmCampaign: clean(body.utmCampaign, 160),
    utmContent: clean(body.utmContent, 160),
    utmTerm: clean(body.utmTerm, 160),
  };
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request, maxBytes = 16_384) {
  const size = Number(request.headers.get("content-length") || 0);
  if (size > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(text || "{}");
}

function adminEmail(request) {
  return clean(
    request.headers.get("oai-authenticated-user-email")
      || request.headers.get("cf-access-authenticated-user-email"),
    254,
  ).toLowerCase();
}

function requireAdmin(request) {
  const email = adminEmail(request);
  if (!email) return { error: json({ error: "Authentication required." }, 401) };
  if (!ADMIN_EMAILS.has(email)) return { error: json({ error: "This account is not authorized." }, 403) };
  return { email };
}

async function recordEvent(request, env, body, forcedType) {
  if (!env.DB) return json({ error: "Analytics database is unavailable." }, 503);
  const eventType = forcedType || clean(body.eventType, 40);
  if (!EVENT_TYPES.has(eventType)) return json({ error: "Invalid event type." }, 400);

  const ipAddress = requestIp(request);
  const ipHash = await hashIp(ipAddress, env);
  const geo = requestGeo(request);
  const userAgent = clean(request.headers.get("user-agent"), 500);
  const agent = parseUserAgent(userAgent);
  const attr = attribution(body);

  await env.DB.prepare(
    `INSERT INTO events (
      id, session_id, event_type, path, target, label, referrer,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      country, region, city, timezone, device_type, browser,
      ip_address, ip_hash, ip_masked, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    clean(body.sessionId, 80) || crypto.randomUUID(),
    eventType,
    clean(body.path, 300) || "/",
    clean(body.target, 300),
    clean(body.label, 200),
    attr.referrer,
    attr.utmSource,
    attr.utmMedium,
    attr.utmCampaign,
    attr.utmContent,
    attr.utmTerm,
    geo.country,
    geo.region,
    geo.city,
    geo.timezone,
    agent.deviceType,
    agent.browser,
    ipAddress,
    ipHash,
    maskIp(ipAddress),
    Date.now(),
  ).run();

  return json({ ok: true }, 201);
}

async function createLead(request, env) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin submission denied." }, 403);
  if (!env.DB) return json({ error: "Lead database is unavailable." }, 503);

  const body = await readJson(request);
  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const organization = clean(body.organization, 180);
  const interest = clean(body.interest, 120);
  const message = clean(body.message, 3_000);
  if (!name || !email || !organization || !interest || !message) {
    return json({ error: "Please complete every field." }, 400);
  }
  if (!isValidEmail(email)) return json({ error: "Please enter a valid work email." }, 400);

  const now = Date.now();
  const id = crypto.randomUUID();
  const ipAddress = requestIp(request);
  const ipHash = await hashIp(ipAddress, env);
  const geo = requestGeo(request);
  const attr = attribution(body);
  const sessionId = clean(body.sessionId, 80) || crypto.randomUUID();
  const userAgent = clean(request.headers.get("user-agent"), 500);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO leads (
        id, name, email, organization, interest, message, status, notes, owner,
        source_page, referrer, utm_source, utm_medium, utm_campaign, utm_content,
        utm_term, session_id, country, region, city, timezone, ip_address, ip_hash,
        ip_masked, user_agent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'new', '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      name,
      email,
      organization,
      interest,
      message,
      clean(body.path, 300) || "/",
      attr.referrer,
      attr.utmSource,
      attr.utmMedium,
      attr.utmCampaign,
      attr.utmContent,
      attr.utmTerm,
      sessionId,
      geo.country,
      geo.region,
      geo.city,
      geo.timezone,
      ipAddress,
      ipHash,
      maskIp(ipAddress),
      userAgent,
      now,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO events (
        id, session_id, event_type, path, target, label, referrer,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        country, region, city, timezone, device_type, browser,
        ip_address, ip_hash, ip_masked, created_at
      ) VALUES (?, ?, 'form_submit', ?, 'demo-form', 'Request a Demo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      sessionId,
      clean(body.path, 300) || "/",
      attr.referrer,
      attr.utmSource,
      attr.utmMedium,
      attr.utmCampaign,
      attr.utmContent,
      attr.utmTerm,
      geo.country,
      geo.region,
      geo.city,
      geo.timezone,
      parseUserAgent(userAgent).deviceType,
      parseUserAgent(userAgent).browser,
      ipAddress,
      ipHash,
      maskIp(ipAddress),
      now,
    ),
  ]);

  return json({ ok: true, id }, 201);
}

async function adminSummary(request, env) {
  const auth = requireAdmin(request);
  if (auth.error) return auth.error;

  const [totals, previous, daily, markets, sources, devices, recentLeads] = await Promise.all([
    env.DB.prepare(
      `SELECT
        COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) AS visitors,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) AS clicks
       FROM events WHERE created_at >= ?`,
    ).bind(Date.now() - 30 * 86_400_000).first(),
    env.DB.prepare(
      `SELECT
        COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) AS visitors,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) AS clicks
       FROM events WHERE created_at >= ? AND created_at < ?`,
    ).bind(Date.now() - 60 * 86_400_000, Date.now() - 30 * 86_400_000).first(),
    env.DB.prepare(
      `SELECT date(created_at / 1000, 'unixepoch') AS day,
        COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) AS visitors,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) AS clicks
       FROM events WHERE created_at >= ?
       GROUP BY day ORDER BY day`,
    ).bind(Date.now() - 30 * 86_400_000).all(),
    env.DB.prepare(
      `SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS country,
        COUNT(DISTINCT session_id) AS visitors,
        COUNT(*) AS events
       FROM events WHERE created_at >= ?
       GROUP BY country ORDER BY visitors DESC LIMIT 12`,
    ).bind(Date.now() - 30 * 86_400_000).all(),
    env.DB.prepare(
      `SELECT
        CASE
          WHEN utm_source != '' THEN utm_source
          WHEN referrer != '' THEN referrer
          ELSE 'Direct'
        END AS source,
        COUNT(DISTINCT session_id) AS visitors
       FROM events WHERE created_at >= ?
       GROUP BY source ORDER BY visitors DESC LIMIT 10`,
    ).bind(Date.now() - 30 * 86_400_000).all(),
    env.DB.prepare(
      `SELECT device_type AS device, COUNT(DISTINCT session_id) AS visitors
       FROM events WHERE created_at >= ?
       GROUP BY device_type ORDER BY visitors DESC`,
    ).bind(Date.now() - 30 * 86_400_000).all(),
    env.DB.prepare(
      `SELECT id, name, email, organization, interest, status, country, ip_address AS ipAddress,
        created_at AS createdAt
       FROM leads ORDER BY created_at DESC LIMIT 6`,
    ).all(),
  ]);

  const leadCounts = await env.DB.prepare(
    `SELECT
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS current,
      SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS previous,
      COUNT(*) AS total
     FROM leads`,
  ).bind(
    Date.now() - 30 * 86_400_000,
    Date.now() - 60 * 86_400_000,
    Date.now() - 30 * 86_400_000,
  ).first();

  return json({
    period: "Last 30 days",
    totals: { ...totals, leads: leadCounts.current || 0, allLeads: leadCounts.total || 0 },
    previous: { ...previous, leads: leadCounts.previous || 0 },
    daily: daily.results,
    markets: markets.results,
    sources: sources.results,
    devices: devices.results,
    recentLeads: recentLeads.results,
  });
}

async function adminLeads(request, env) {
  const auth = requireAdmin(request);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const status = clean(url.searchParams.get("status"), 30);
  const search = clean(url.searchParams.get("q"), 100);
  const clauses = [];
  const values = [];
  if (status && LEAD_STATUSES.has(status)) {
    clauses.push("status = ?");
    values.push(status);
  }
  if (search) {
    clauses.push("(name LIKE ? OR email LIKE ? OR organization LIKE ? OR interest LIKE ?)");
    for (let index = 0; index < 4; index += 1) values.push(`%${search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await env.DB.prepare(
    `SELECT
      id, name, email, organization, interest, message, status, notes, owner,
      source_page AS sourcePage, referrer, utm_source AS utmSource,
      utm_medium AS utmMedium, utm_campaign AS utmCampaign, session_id AS sessionId,
      country, region, city, timezone, ip_address AS ipAddress, ip_masked AS ipMasked,
      user_agent AS userAgent, created_at AS createdAt, updated_at AS updatedAt
     FROM leads ${where} ORDER BY created_at DESC LIMIT 500`,
  ).bind(...values).all();
  return json({ leads: result.results });
}

async function updateLead(request, env, leadId) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin request denied." }, 403);
  const auth = requireAdmin(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  const status = clean(body.status, 30);
  if (!LEAD_STATUSES.has(status)) return json({ error: "Invalid lead status." }, 400);
  const notes = clean(body.notes, 4_000);
  const owner = clean(body.owner, 120);
  const now = Date.now();
  const result = await env.DB.batch([
    env.DB.prepare(
      "UPDATE leads SET status = ?, notes = ?, owner = ?, updated_at = ? WHERE id = ?",
    ).bind(status, notes, owner, now, leadId),
    env.DB.prepare(
      `INSERT INTO admin_audit
        (id, admin_email, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, 'update', 'lead', ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      auth.email,
      leadId,
      JSON.stringify({ status, owner }),
      now,
    ),
  ]);
  if (!result[0].meta?.changes) return json({ error: "Lead not found." }, 404);
  return json({ ok: true });
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

async function exportLeads(request, env) {
  const auth = requireAdmin(request);
  if (auth.error) return auth.error;
  const result = await env.DB.prepare(
    `SELECT created_at, name, email, organization, interest, message, status, notes, owner,
      country, region, city, ip_address, source_page, referrer, utm_source, utm_medium, utm_campaign
     FROM leads ORDER BY created_at DESC`,
  ).all();
  const columns = [
    "created_at", "name", "email", "organization", "interest", "message", "status",
    "notes", "owner", "country", "region", "city", "ip_address", "source_page",
    "referrer", "utm_source", "utm_medium", "utm_campaign",
  ];
  const rows = result.results.map((row) =>
    columns.map((column) =>
      csvCell(column === "created_at" ? new Date(row[column]).toISOString() : row[column]),
    ).join(","),
  );
  return new Response(`\uFEFF${columns.join(",")}\n${rows.join("\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="motionverse-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}

async function handleApi(request, env, url) {
  const leadMatch = url.pathname.match(/^\/api\/admin\/leads\/([a-zA-Z0-9-]+)$/);
  const isKnownRoute =
    (url.pathname === "/api/events" && request.method === "POST")
    || (url.pathname === "/api/leads" && request.method === "POST")
    || (url.pathname === "/api/admin/summary" && request.method === "GET")
    || (url.pathname === "/api/admin/leads" && request.method === "GET")
    || (url.pathname === "/api/admin/leads/export.csv" && request.method === "GET")
    || (Boolean(leadMatch) && request.method === "PATCH");
  if (!isKnownRoute) return json({ error: "Not found." }, 404);
  if (!env.DB) return json({ error: "Database binding is unavailable." }, 503);
  if (url.pathname === "/api/events" && request.method === "POST") {
    if (!sameOrigin(request)) return json({ error: "Cross-origin request denied." }, 403);
    return recordEvent(request, env, await readJson(request));
  }
  if (url.pathname === "/api/leads" && request.method === "POST") return createLead(request, env);
  if (url.pathname === "/api/admin/summary" && request.method === "GET") return adminSummary(request, env);
  if (url.pathname === "/api/admin/leads" && request.method === "GET") return adminLeads(request, env);
  if (url.pathname === "/api/admin/leads/export.csv" && request.method === "GET") return exportLeads(request, env);
  if (leadMatch && request.method === "PATCH") return updateLead(request, env, leadMatch[1]);
  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);

      const acceptsHtml = request.headers.get("accept")?.includes("text/html");
      const isAdminRoute = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
      if (isAdminRoute && acceptsHtml && ["GET", "HEAD"].includes(request.method)) {
        const indexUrl = new URL(request.url);
        indexUrl.pathname = "/";
        indexUrl.search = "";
        return env.ASSETS.fetch(new Request(indexUrl, request));
      }

      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
        return response;
      }

      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/";
      indexUrl.search = "";
      return env.ASSETS.fetch(new Request(indexUrl, request));
    } catch (error) {
      console.error("Motionverse worker error", error);
      if (error?.message === "PAYLOAD_TOO_LARGE") return json({ error: "Payload too large." }, 413);
      if (error instanceof SyntaxError) return json({ error: "Invalid JSON." }, 400);
      return json({ error: "Unexpected server error." }, 500);
    }
  },
};
