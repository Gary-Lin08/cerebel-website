// The sign-up API. Each handler takes the Request and a `deps` object so tests can run it against a
// memory store; the files under api/ bind them to the default store.
import { authorize, clean, context, guard, HttpError, isValidEmail, json, newId, readJson, requireStore, sameOrigin } from "./http.js";
import { notify } from "./notify.js";
import { defaultStore } from "./store.js";

const BACKER_USES = new Set(["Sports and coaching", "Robotics and embodied AI", "Research", "Just curious"]);
const LEAD_STATUSES = new Set(["new", "contacted", "qualified", "closed"]);

function defaults(deps) {
  return { getStore: defaultStore, notify, now: () => new Date(), ...deps };
}

function record(request, body, fields, now) {
  const createdAt = now().toISOString();
  return { id: newId(), createdAt, updatedAt: createdAt, ...fields, ...context(request, body) };
}

/** POST /api/backers — the glasses presale reservation. Free, no payment, one record per email. */
export function backers(deps = {}) {
  const { getStore, notify, now } = defaults(deps);
  return guard(async (request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { allow: "POST" });
    if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted." }, 403);
    const body = await readJson(request);
    // A field people never see; anything in it is a bot filling every input.
    if (clean(body.website, 10)) return json({ ok: true, status: "listed" }, 201);
    const email = clean(body.email, 254).toLowerCase();
    if (!isValidEmail(email)) return json({ error: "Enter a valid email address." }, 400);
    const name = clean(body.name, 120);
    const use = BACKER_USES.has(body.use) ? body.use : "";
    const store = await requireStore(getStore);

    const existing = await store.find("backers", email);
    if (existing) return json({ ok: true, status: "already", id: existing.id }, 200);

    const saved = await store.add("backers", record(request, body, { list: "glasses-presale", email, name, use }, now));
    await notify("New glasses presale backer", [
      `${saved.email}${name ? ` (${name})` : ""}`,
      use ? `Would use them for: ${use}` : "",
      `From ${saved.sourcePage}${saved.country ? ` · ${saved.country}` : ""}`,
      `Received ${saved.createdAt}`,
    ].filter(Boolean));
    return json({ ok: true, status: "listed", id: saved.id }, 201);
  });
}

/** POST /api/leads — the Request a demo form. */
export function leads(deps = {}) {
  const { getStore, notify, now } = defaults(deps);
  return guard(async (request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { allow: "POST" });
    if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not accepted." }, 403);
    const body = await readJson(request);
    if (clean(body.website, 10)) return json({ ok: true, status: "received" }, 201);
    const fields = {
      name: clean(body.name, 120),
      email: clean(body.email, 254).toLowerCase(),
      organization: clean(body.organization, 160),
      interest: clean(body.interest, 80),
      message: clean(body.message, 4000),
    };
    if (Object.values(fields).some((value) => !value)) {
      return json({ error: "Name, work email, organization, area of interest, and message are all required." }, 400);
    }
    if (!isValidEmail(fields.email)) return json({ error: "Please enter a valid work email." }, 400);
    const store = await requireStore(getStore);

    const saved = await store.add("leads", record(request, body, { ...fields, status: "new", notes: "", owner: "" }, now));
    await notify(`Demo request from ${saved.name} (${saved.organization})`, [
      `${saved.name} <${saved.email}>`,
      saved.organization,
      `Interest: ${saved.interest}`,
      "",
      saved.message,
      "",
      `From ${saved.sourcePage}${saved.country ? ` · ${saved.country}` : ""}`,
      `Received ${saved.createdAt}`,
    ]);
    return json({ ok: true, status: "received", id: saved.id }, 201);
  });
}

/** POST /api/events — accepted and dropped. Page analytics are not stored on this hosting. */
export function events() {
  return guard(async (request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { allow: "POST" });
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  });
}

/** GET /api/admin/summary — counts and the latest sign-ups, in the shape the admin console reads. */
export function adminSummary(deps = {}) {
  const { getStore } = defaults(deps);
  return guard(async (request) => {
    const denied = authorize(request, deps.token);
    if (denied) return denied;
    const store = await requireStore(getStore);
    const [leads, backers] = await Promise.all([store.all("leads"), store.all("backers")]);
    const since = Date.now() - 30 * 86_400_000;
    const before = since - 30 * 86_400_000;
    const inWindow = (records, from, to) =>
      records.filter((entry) => Date.parse(entry.createdAt) >= from && Date.parse(entry.createdAt) < to).length;
    return json({
      period: "30d",
      analytics: false,
      storage: store.kind,
      totals: { leads: inWindow(leads, since, Infinity), backers: inWindow(backers, since, Infinity), allLeads: leads.length, allBackers: backers.length },
      previous: { leads: inWindow(leads, before, since), backers: inWindow(backers, before, since) },
      recentLeads: leads.slice(0, 8),
      recentBackers: backers.slice(0, 8),
    });
  });
}

/** GET /api/admin/leads?list=leads|backers&status=&q= */
export function adminList(deps = {}) {
  const { getStore } = defaults(deps);
  return guard(async (request) => {
    const denied = authorize(request, deps.token);
    if (denied) return denied;
    const url = new URL(request.url);
    const list = url.searchParams.get("list") === "backers" ? "backers" : "leads";
    const status = clean(url.searchParams.get("status"), 20);
    const q = clean(url.searchParams.get("q"), 100).toLowerCase();
    const store = await requireStore(getStore);
    let records = await store.all(list);
    if (status && LEAD_STATUSES.has(status)) records = records.filter((entry) => entry.status === status);
    if (q) {
      records = records.filter((entry) =>
        [entry.name, entry.email, entry.organization, entry.interest, entry.use].some((value) => String(value ?? "").toLowerCase().includes(q)),
      );
    }
    return json({ list, [list]: records.slice(0, 500), total: records.length });
  });
}

/** PATCH /api/admin/leads/:id — status, owner and notes. */
export function adminUpdateLead(deps = {}) {
  const { getStore } = defaults(deps);
  return guard(async (request) => {
    const denied = authorize(request, deps.token);
    if (denied) return denied;
    if (request.method !== "PATCH") return json({ error: "Method not allowed." }, 405, { allow: "PATCH" });
    const id = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(id || "")) return json({ error: "Unknown lead." }, 404);
    const body = await readJson(request);
    const patch = {};
    if (body.status !== undefined) {
      if (!LEAD_STATUSES.has(body.status)) return json({ error: "Invalid status." }, 400);
      patch.status = body.status;
    }
    if (body.notes !== undefined) patch.notes = clean(body.notes, 4000);
    if (body.owner !== undefined) patch.owner = clean(body.owner, 120);
    const store = await requireStore(getStore);
    const updated = await store.update("leads", id, patch);
    if (!updated) return json({ error: "Unknown lead." }, 404);
    return json({ ok: true, lead: updated });
  });
}

const CSV_COLUMNS = {
  leads: ["createdAt", "name", "email", "organization", "interest", "message", "status", "owner", "notes", "sourcePage", "referrer", "utmSource", "utmMedium", "utmCampaign", "country", "region", "city"],
  backers: ["createdAt", "email", "name", "use", "sourcePage", "referrer", "utmSource", "utmMedium", "utmCampaign", "country", "region", "city"],
};

function csvCell(value) {
  const text = String(value ?? "");
  // A leading formula character would run in a spreadsheet; neutralise it.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** GET /api/admin/export?list=leads|backers — a CSV download. */
export function adminExport(deps = {}) {
  const { getStore } = defaults(deps);
  return guard(async (request) => {
    const denied = authorize(request, deps.token);
    if (denied) return denied;
    const list = new URL(request.url).searchParams.get("list") === "backers" ? "backers" : "leads";
    const store = await requireStore(getStore);
    const records = await store.all(list);
    const columns = CSV_COLUMNS[list];
    const rows = [columns.join(","), ...records.map((entry) => columns.map((column) => csvCell(entry[column])).join(","))];
    return new Response(`﻿${rows.join("\r\n")}\r\n`, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="cerebel-${list}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  });
}

export { HttpError };
