import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { adminExport, adminList, adminSummary, adminUpdateLead, backers, events, leads } from "../api/_lib/handlers.js";
import { createFileStore, createMemoryStore } from "../api/_lib/store.js";

const TOKEN = "test-admin-token";
const ORIGIN = "https://cerebel.tech";

function post(path, body, headers = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-vercel-ip-country": "US", "user-agent": "test", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function admin(path, init = {}) {
  return new Request(`${ORIGIN}${path}`, { ...init, headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...(init.headers || {}) } });
}

function deps(store = createMemoryStore()) {
  const mails = [];
  return { store, mails, deps: { getStore: async () => store, notify: async (subject, lines) => { mails.push({ subject, lines }); return true; }, token: TOKEN } };
}

test("a backer is stored once per email and the team is told", async () => {
  const { store, mails, deps: d } = deps();
  const handler = backers(d);
  const first = await handler(post("/api/backers", { email: "Ada@Example.com", name: "Ada", use: "Research", path: "/?utm_source=x", utmSource: "x" }));
  assert.equal(first.status, 201);
  const body = await first.json();
  assert.equal(body.status, "listed");
  assert.equal(mails.length, 1);
  assert.match(mails[0].lines.join("\n"), /ada@example\.com \(Ada\)/);

  const again = await handler(post("/api/backers", { email: " ada@example.com " }));
  assert.equal(again.status, 200);
  assert.equal((await again.json()).status, "already");
  assert.equal((await store.all("backers")).length, 1);
  const [record] = await store.all("backers");
  assert.equal(record.list, "glasses-presale");
  assert.equal(record.country, "US");
  assert.equal(record.utmSource, "x");
  assert.equal(record.ipAddress, undefined, "no IP is kept");
});

test("bad backer input is refused with a reason", async () => {
  const handler = backers(deps().deps);
  assert.equal((await handler(post("/api/backers", { email: "nope" }))).status, 400);
  assert.equal((await handler(post("/api/backers", "{not json"))).status, 400);
  assert.equal((await handler(post("/api/backers", { email: "a@b.co" }, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await handler(new Request(`${ORIGIN}/api/backers`))).status, 405);
  const big = await handler(post("/api/backers", { email: "a@b.co", name: "x".repeat(20_000) }));
  assert.equal(big.status, 413);
  // The honeypot answers as if it worked and stores nothing.
  const { store, deps: d } = deps();
  const trap = await backers(d)(post("/api/backers", { email: "bot@example.com", website: "http://spam" }));
  assert.equal(trap.status, 201);
  assert.equal((await store.all("backers")).length, 0);
});

test("without storage the public endpoints say so instead of pretending", async () => {
  const handler = backers({ getStore: async () => null, notify: async () => false });
  const response = await handler(post("/api/backers", { email: "a@b.co" }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /hello@cerebel\.tech/);
});

test("a demo request needs every field and is stored as a new lead", async () => {
  const { store, mails, deps: d } = deps();
  const handler = leads(d);
  const missing = await handler(post("/api/leads", { name: "Grace", email: "grace@example.com" }));
  assert.equal(missing.status, 400);
  const bad = await handler(post("/api/leads", { name: "Grace", email: "grace", organization: "Lab", interest: "Research Collaboration", message: "Hi" }));
  assert.equal(bad.status, 400);
  const ok = await handler(post("/api/leads", { name: "Grace", email: "Grace@Example.com", organization: "Lab", interest: "Research Collaboration", message: "We want to try it.", referrer: "https://linkedin.com/" }));
  assert.equal(ok.status, 201);
  const [lead] = await store.all("leads");
  assert.equal(lead.status, "new");
  assert.equal(lead.email, "grace@example.com");
  assert.equal(mails[0].subject, "Demo request from Grace (Lab)");
});

test("events are accepted and dropped", async () => {
  const response = await events()(post("/api/events", { eventType: "page_view" }));
  assert.equal(response.status, 204);
});

test("admin routes need the token and serve counts, lists, updates and CSV", async () => {
  const { store, deps: d } = deps();
  await leads(d)(post("/api/leads", { name: "Grace", email: "grace@example.com", organization: "Lab", interest: "Research Collaboration", message: 'Says "hi", twice' }));
  await backers(d)(post("/api/backers", { email: "ada@example.com", name: "=cmd()" }));

  assert.equal((await adminSummary(d)(new Request(`${ORIGIN}/api/admin/summary`))).status, 401);
  assert.equal((await adminSummary(d)(admin("/api/admin/summary", { headers: { authorization: "Bearer wrong" } }))).status, 401);
  assert.equal((await adminSummary({ ...d, token: "" })(admin("/api/admin/summary"))).status, 503);

  const summary = await (await adminSummary(d)(admin("/api/admin/summary"))).json();
  assert.equal(summary.totals.leads, 1);
  assert.equal(summary.totals.backers, 1);
  assert.equal(summary.analytics, false);
  assert.equal(summary.recentLeads[0].name, "Grace");

  const list = await (await adminList(d)(admin("/api/admin/leads?q=grace"))).json();
  assert.equal(list.leads.length, 1);
  const none = await (await adminList(d)(admin("/api/admin/leads?status=closed"))).json();
  assert.equal(none.leads.length, 0);
  const backerList = await (await adminList(d)(admin("/api/admin/leads?list=backers"))).json();
  assert.equal(backerList.backers[0].email, "ada@example.com");

  const [lead] = await store.all("leads");
  const updated = await adminUpdateLead(d)(admin(`/api/admin/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status: "contacted", owner: "Gary", notes: "Called." }) }));
  assert.equal(updated.status, 200);
  assert.equal((await store.get("leads", lead.id)).status, "contacted");
  assert.equal((await adminUpdateLead(d)(admin(`/api/admin/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status: "bogus" }) }))).status, 400);
  assert.equal((await adminUpdateLead(d)(admin(`/api/admin/leads/missing-id-000`, { method: "PATCH", body: "{}" }))).status, 404);

  const csv = await adminExport(d)(admin("/api/admin/export?list=leads"));
  assert.equal(csv.headers.get("content-type"), "text/csv; charset=utf-8");
  const bytes = new Uint8Array(await csv.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "a BOM so Excel reads UTF-8");
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /^createdAt,name,email/);
  assert.match(text, /"Says ""hi"", twice"/);
  const backersCsv = await (await adminExport(d)(admin("/api/admin/export?list=backers"))).text();
  assert.match(backersCsv, /'=cmd\(\)/, "formula characters are neutralised");
});

const tmp = await mkdtemp(path.join(os.tmpdir(), "cerebel-signups-"));
after(() => rm(tmp, { recursive: true, force: true }));

test("the file store behaves like the memory store", async () => {
  const store = createFileStore(tmp);
  const handler = backers({ getStore: async () => store, notify: async () => false });
  assert.equal((await handler(post("/api/backers", { email: "file@example.com" }))).status, 201);
  assert.equal((await handler(post("/api/backers", { email: "FILE@example.com" }))).status, 200);
  const all = await store.all("backers");
  assert.equal(all.length, 1);
  const updated = await store.update("backers", all[0].id, { name: "Named" });
  assert.equal(updated.name, "Named");
  assert.equal((await store.get("backers", all[0].id)).name, "Named");
});
