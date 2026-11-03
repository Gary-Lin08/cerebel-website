// The dashboard's data layer on cerebel.tech. It answers the same requests the dashboard used to
// send to the Playground server (/api/admin/...), with the same shapes, from the Supabase mirror.
// Row level security lets only signed-in admins read; nothing here holds a secret.
import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "../supabase";

export const sb = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, storageKey: "cerebel-dashboard-auth", detectSessionInUrl: true },
});

const DAY = 86400000;
const LOGIN_KINDS = new Set(["signup", "login", "password_reset", "password_changed", "password_reset_requested"]);
const FEEDBACK_KINDS = new Set(["client_trust_yes", "client_trust_no", "feedback"]);
const PAYMENT_DONE = "billing_checkout.session.completed";
const FEED_KINDS = new Set(["signup", "login", "upload_saved", "capture_finalized", "checkout_created", "paywall_hit", PAYMENT_DONE]);
const ONLINE_WINDOW_MS = 90000;
export const SERVER_ADMIN_URL = "https://cerebel.tech/playground/admin";

export class AuthError extends Error {}

function fail(error) {
  if (!error) return;
  if (error.code === "PGRST301" || /JWT|not authorized|permission/i.test(error.message || "")) throw new AuthError("请重新登录。");
  throw new Error(error.message || "读取数据失败");
}

/** Every row of a table, 1000 at a time, newest first unless told otherwise. */
async function all(table, columns, build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(columns).range(from, from + 999);
    if (build) q = build(q);
    const { data, error } = await q;
    fail(error);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const ms = (iso) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? null : t;
};
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const days = (n, now) => Array.from({ length: n }, (_, i) => dayOf(now - (n - 1 - i) * DAY));
const count = (items, key) => items.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {});
const newest = (rows, key = "ts") => rows.slice().sort((a, b) => String(b[key] || "").localeCompare(String(a[key] || "")));
const top = (map, limit = 8) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, c]) => ({ name, count: c }));

const flatAccount = (a) => ({ ...a.data, user_id: a.user_id, email: a.email, created_at: a.data.created_at || a.created_at });
const flatCapture = (c) => ({ ...c.data, session_id: c.session_id, user_id: c.user_id, status: c.status, deleted: c.deleted });
const flatEvent = (e) => ({ ...e.data, ts: e.ts, kind: e.kind, user_id: e.user_id, session_id: e.session_id });

function isPro(sub) {
  if (!sub || !["active", "trialing"].includes(sub.status)) return false;
  const end = sub.current_period_end;
  return typeof end === "number" && end > 0 ? Date.now() / 1000 < end + 86400 : true;
}
function subscription(sub) {
  sub = sub || {};
  return {
    pro: isPro(sub), status: sub.status || null, plan: sub.plan || null, current_period_end: sub.current_period_end || null,
    cancel_at_period_end: !!sub.cancel_at_period_end, customer: sub.customer || null, updated_at: sub.updated_at || null,
  };
}
const visitSeconds = (v) => Math.max(0, Math.round(((ms(v.ended_at) || 0) - (ms(v.started_at) || 0)) / 1000));
const visitRow = (v) => ({ start: v.started_at, end: v.ended_at, seconds: visitSeconds(v) });
function lastSeen(account, visits) {
  const stamps = [account.last_active_at, ...(visits || []).map((v) => v.ended_at)].filter((s) => ms(s));
  return stamps.length ? stamps.reduce((a, b) => (ms(a) > ms(b) ? a : b)) : null;
}

const loaders = {
  accounts: () => all("accounts", "user_id,email,created_at,data", (q) => q.order("user_id")).then((r) => r.map(flatAccount)),
  captures: () => all("captures", "session_id,user_id,status,deleted,created_at,data", (q) => q.order("session_id")).then((r) => r.map(flatCapture)),
  events: () => all("events", "key,ts,kind,user_id,session_id,data", (q) => q.order("ts", { ascending: true }).order("key")).then((r) => r.map(flatEvent)),
  subs: () => all("subscriptions", "user_id,data", (q) => q.order("user_id")),
  visits: () => all("visits", "user_id,started_at,ended_at", (q) => q.order("user_id").order("started_at")),
  backers: () => all("backers", "*", (q) => q.order("created_at", { ascending: false })),
};

function emailsOf(accounts) {
  return Object.fromEntries(accounts.map((a) => [a.user_id, a.email]));
}
function visitsByUser(visits) {
  const out = {};
  visits.forEach((v) => (out[v.user_id] = out[v.user_id] || []).push(v));
  return out;
}
function billing(subs) {
  const users = {};
  let founding = 0;
  subs.forEach((s) => {
    if (s.user_id === "_meta") founding = Number(s.data.founding_used || 0);
    else users[s.user_id] = s.data;
  });
  return { users, founding };
}
function firstPayments(events) {
  const first = {};
  events.forEach((e) => {
    if (e.kind === PAYMENT_DONE && e.user_id && (!first[e.user_id] || e.ts < first[e.user_id])) first[e.user_id] = e.ts;
  });
  return first;
}
const feedbackRow = (e, emails) => ({
  ts: e.ts, user_id: e.user_id, email: emails[e.user_id] || null, session_id: e.session_id || null,
  rating: e.kind === "client_trust_yes" ? "yes" : e.kind === "client_trust_no" ? "no" : e.rating || null,
  text: e.kind === "feedback" ? e.text : null,
});

// ------------------------------------------------------------ the old server routes

async function overview() {
  const now = Date.now();
  const [accounts, captures, events, visits, subs] = await Promise.all([
    loaders.accounts(), loaders.captures(), loaders.events(), loaders.visits(), loaders.subs(),
  ]);
  const emails = emailsOf(accounts);
  const byUser = visitsByUser(visits);
  const created = accounts.map((a) => ms(a.created_at));
  const seen = accounts.map((a) => ms(lastSeen(a, byUser[a.user_id])));
  const since = (stamps, n) => stamps.filter((s) => s && s >= now - n * DAY).length;
  const perDay = count(created.filter(Boolean), dayOf);
  const bill = billing(subs);
  const proUsers = Object.keys(bill.users).filter((u) => isPro(bill.users[u]));
  const kinds = count(events, (e) => e.kind);
  const monthAgo = now - 30 * DAY;
  return {
    ok: true,
    now: new Date(now).toISOString(),
    accounts: {
      total: accounts.length, new_7d: since(created, 7), new_30d: since(created, 30),
      active_1d: since(seen, 1), active_7d: since(seen, 7), active_30d: since(seen, 30),
      video_consent: accounts.filter((a) => a.video_consent_at).length,
    },
    signups_by_day: days(30, now).map((d) => ({ day: d, count: perDay[d] || 0 })),
    billing: {
      pro: proUsers.length,
      plans: count(proUsers, (u) => bill.users[u].plan || "unknown"),
      founding_used: bill.founding,
      checkouts_started: kinds.checkout_created || 0,
      paywall_hits: kinds.paywall_hit || 0,
    },
    uploads: {
      total: captures.length,
      by_status: count(captures, (c) => c.status || "unknown"),
      saved_events: kinds.upload_saved || 0,
      pipeline_errors: kinds.pipeline_error || 0,
      failure_rate: kinds.upload_saved ? Math.round(((kinds.pipeline_error || 0) / kinds.upload_saved) * 1000) / 1000 : 0,
    },
    feedback: { trust_yes: kinds.client_trust_yes || 0, trust_no: kinds.client_trust_no || 0, written: kinds.feedback || 0 },
    questions_30d: events.filter((e) => e.kind === "chat_question" && (ms(e.ts) || now) >= monthAgo).length,
    event_counts: kinds,
    recent_events: newest(events.slice(-150)).map((e) => ({ ...e, email: emails[e.user_id] || null })),
  };
}

async function users() {
  const [accounts, captures, events, visits, subs] = await Promise.all([
    loaders.accounts(), loaders.captures(), loaders.events(), loaders.visits(), loaders.subs(),
  ]);
  const byUser = visitsByUser(visits);
  const kinds = {};
  events.forEach((e) => {
    if (!e.user_id) return;
    const k = (kinds[e.user_id] = kinds[e.user_id] || {});
    k[e.kind] = (k[e.kind] || 0) + 1;
  });
  const bill = billing(subs);
  const rows = accounts.map((a) => {
    const mine = captures.filter((c) => c.user_id === a.user_id);
    const k = kinds[a.user_id] || {};
    const v = byUser[a.user_id] || [];
    const sub = subscription(bill.users[a.user_id]);
    return {
      user_id: a.user_id, email: a.email, created_at: a.created_at, last_login_at: a.last_login_at,
      last_seen_at: lastSeen(a, v), logins: k.login || 0, visits: v.length,
      total_seconds: v.reduce((s, x) => s + visitSeconds(x), 0),
      uploads: mine.length, swings: mine.filter((c) => !c.deleted).length,
      ready: mine.filter((c) => c.status === "ready" && !c.deleted).length,
      failed: mine.filter((c) => ["error", "rejected", "no_swing"].includes(c.status)).length,
      feedback: [...FEEDBACK_KINDS].reduce((s, x) => s + (k[x] || 0), 0),
      questions: k.chat_question || 0, coach_code: a.coach_code, video_consent_at: a.video_consent_at,
      pro: sub.pro, plan: sub.pro ? sub.plan : "free", subscription_status: sub.status,
    };
  });
  return { ok: true, users: newest(rows, "created_at") };
}

async function userDetail(userId) {
  const [accounts, captures, events, visits, subs, qs] = await Promise.all([
    loaders.accounts(), loaders.captures(), loaders.events(), loaders.visits(), loaders.subs(),
    all("questions", "ts,user_id,session_id,question", (q) => q.eq("user_id", userId).order("ts", { ascending: false })),
  ]);
  const account = accounts.find((a) => a.user_id === userId);
  if (!account) throw new Error("没有这个用户（可能已删除）。");
  const emails = emailsOf(accounts);
  const rows = newest(captures.filter((c) => c.user_id === userId), "created_at");
  const sids = new Set(rows.map((r) => r.session_id));
  const mine = newest(events.filter((e) => e.user_id === userId || (!e.user_id && sids.has(e.session_id))));
  const v = newest(visits.filter((x) => x.user_id === userId), "started_at").map(visitRow);
  return {
    ok: true,
    account,
    subscription: subscription(billing(subs).users[userId]),
    logins: mine.filter((e) => LOGIN_KINDS.has(e.kind)),
    visits: v,
    total_seconds: v.reduce((s, x) => s + x.seconds, 0),
    // Videos stay on the Playground server; the page links there to play one.
    captures: rows.map((c) => ({ ...c, has_video: false, video_on_server: !c.deleted })),
    feedback: mine.filter((e) => FEEDBACK_KINDS.has(e.kind)).map((e) => feedbackRow(e, emails)),
    questions: qs,
    question_retention_days: 90,
    events: mine.slice(0, 300),
  };
}

async function payments(userId) {
  const { data, error } = await sb.from("subscriptions").select("data").eq("user_id", userId).maybeSingle();
  fail(error);
  const sub = subscription(data && data.data);
  const customer = /^cus_[A-Za-z0-9]+$/.test(sub.customer || "") ? sub.customer : null;
  return {
    ok: true, subscription: sub, invoices: [],
    dashboard_url: customer ? `https://dashboard.stripe.com/customers/${customer}` : null,
    note: customer ? "发票在 Stripe 后台查看。" : "这个用户没有在 Stripe 付过款。",
  };
}

async function feedback() {
  const [accounts, events] = await Promise.all([
    loaders.accounts(),
    all("events", "key,ts,kind,user_id,session_id,data", (q) => q.in("kind", [...FEEDBACK_KINDS]).order("ts", { ascending: false }).order("key")),
  ]);
  const emails = emailsOf(accounts);
  return { ok: true, feedback: events.map(flatEvent).map((e) => feedbackRow(e, emails)).slice(0, 1000) };
}

async function questions() {
  const [accounts, qs] = await Promise.all([
    loaders.accounts(),
    all("questions", "ts,user_id,session_id,question", (q) => q.order("ts", { ascending: false }).order("key")),
  ]);
  const emails = emailsOf(accounts);
  return { ok: true, questions: qs.slice(0, 1000).map((q) => ({ ...q, email: emails[q.user_id] || null })) };
}

async function audit() {
  const [server, here] = await Promise.all([
    all("admin_audit", "ts,admin,action,data", (q) => q.order("ts", { ascending: false }).order("key")),
    all("dashboard_audit", "ts,admin,action,data", (q) => q.order("ts", { ascending: false }).order("id")),
  ]);
  const rows = newest([...server, ...here].map((r) => ({ ...r.data, ts: r.ts, admin: r.admin, action: r.action })));
  return { ok: true, rows: rows.slice(0, 500) };
}

async function live() {
  const now = Date.now();
  const today = dayOf(now);
  const startOfToday = `${today}T00:00:00Z`;
  const [accounts, presence, recentSite, todaySite, recentEvents, backers, subs] = await Promise.all([
    loaders.accounts(),
    all("presence", "*", (q) => q.gte("last_seen", new Date(now - ONLINE_WINDOW_MS).toISOString()).order("last_seen", { ascending: false })),
    all("site_events", "ts,event,visitor,site,path,label,ref,utm_source,country,user_id", (q) => q.order("ts", { ascending: false }).limit(60)),
    all("site_events", "visitor,event,ts", (q) => q.gte("ts", startOfToday).order("ts")),
    all("events", "key,ts,kind,user_id,session_id,data", (q) => q.gte("ts", new Date(now - 7 * DAY).toISOString()).order("ts", { ascending: false }).order("key")),
    loaders.backers(),
    loaders.subs(),
  ]);
  const emails = emailsOf(accounts);
  const product = recentEvents.map(flatEvent);
  const online = presence.map((r) => ({
    ...r, email: emails[r.user_id] || null,
    seconds: Math.max(0, Math.round(((ms(r.last_seen) || 0) - (ms(r.first_seen) || 0)) / 1000)),
  }));
  const minute = Math.floor(now / 60000);
  const recentMinutes = await all("site_events", "visitor,ts", (q) => q.gte("ts", new Date((minute - 29) * 60000).toISOString()).order("ts"));
  const perMinute = {};
  recentMinutes.forEach((r) => {
    const m = Math.floor(ms(r.ts) / 60000);
    (perMinute[m] = perMinute[m] || new Set()).add(r.visitor);
  });
  const feed = [
    ...recentSite.map((r) => ({
      ts: r.ts, type: r.event, visitor: r.visitor, site: r.site, path: r.path, label: r.label,
      source: r.utm_source || r.ref, country: r.country, email: emails[r.user_id] || null,
    })),
    ...product.filter((e) => FEED_KINDS.has(e.kind)).map((e) => ({ ts: e.ts, type: e.kind, email: emails[e.user_id] || null, plan: e.plan })),
    ...backers.slice(0, 60).map((b) => ({ ts: b.created_at, type: "backer", email: b.email, source: b.utm_source || b.ref, country: b.country })),
  ];
  const bill = billing(subs);
  const isToday = (s) => String(s || "").startsWith(today);
  return {
    ok: true,
    now: new Date(now).toISOString(),
    online,
    per_minute: Array.from({ length: 30 }, (_, i) => {
      const m = minute - 29 + i;
      return { minute: new Date(m * 60000).toISOString(), count: perMinute[m] ? perMinute[m].size : 0 };
    }),
    today: {
      visitors: new Set(todaySite.map((r) => r.visitor)).size,
      page_views: todaySite.filter((r) => r.event === "page_view").length,
      signups: product.filter((e) => e.kind === "signup" && isToday(e.ts)).length,
      backers: backers.filter((b) => isToday(b.created_at)).length,
      payments: product.filter((e) => e.kind === PAYMENT_DONE && isToday(e.ts)).length,
    },
    backers_total: backers.length,
    latest_backer: backers[0] ? backers[0].email : null,
    backer_store_error: null,
    pro_total: Object.values(bill.users).filter(isPro).length,
    feed: newest(feed).slice(0, 50),
  };
}

async function traffic(daysArg) {
  const now = Date.now();
  const n = { 7: 7, 30: 30, 90: 90 }[daysArg] || 30;
  const labels = days(n, now);
  const start = labels[0];
  const [rows, accounts, events, backers] = await Promise.all([
    all("site_events", "ts,event,visitor,site,path,ref,utm_source,country,device,browser,label,target", (q) => q.gte("ts", `${start}T00:00:00Z`).order("ts").order("id")),
    loaders.accounts(),
    all("events", "key,ts,kind,user_id", (q) => q.in("kind", ["upload_saved", PAYMENT_DONE]).order("ts").order("key")),
    loaders.backers(),
  ]);
  const main = {}, playground = {}, views = {}, pages = {}, clicks = {};
  labels.forEach((d) => { main[d] = new Set(); playground[d] = new Set(); });
  const first = {};
  const clickers = new Set();
  rows.forEach((r) => {
    const d = String(r.ts).slice(0, 10);
    if (!main[d]) return;
    (r.site === "playground" ? playground : main)[d].add(r.visitor);
    if (!first[r.visitor]) first[r.visitor] = r;
    if (r.event === "page_view") {
      views[d] = (views[d] || 0) + 1;
      const page = (r.site === "playground" ? "Playground " : "") + (r.path || "/");
      pages[page] = (pages[page] || 0) + 1;
    } else if (r.event === "cta_click") {
      clickers.add(r.visitor);
      const label = r.label || r.target || "(未命名)";
      clicks[label] = (clicks[label] || 0) + 1;
    }
  });
  const firsts = Object.values(first);
  const created = accounts.map((a) => ms(a.created_at)).filter(Boolean);
  const perDay = count(created, dayOf);
  const paid = Object.values(firstPayments(events.map(flatEvent)));
  const running = (stamps) => {
    const sorted = stamps.map((t) => dayOf(t)).sort();
    let i = 0;
    return labels.map((d) => { while (i < sorted.length && sorted[i] <= d) i += 1; return i; });
  };
  const inWindow = (s) => String(s || "").slice(0, 10) >= start;
  return {
    ok: true,
    days: n,
    labels,
    visitors_main: labels.map((d) => main[d].size),
    visitors_playground: labels.map((d) => playground[d].size),
    page_views: labels.map((d) => views[d] || 0),
    total_visitors: firsts.length,
    total_page_views: Object.values(views).reduce((a, b) => a + b, 0),
    clickers: clickers.size,
    sources: top(count(firsts, (r) => r.utm_source || r.ref || "直接访问")),
    countries: top(count(firsts, (r) => r.country || "未知")),
    devices: top(count(firsts, (r) => r.device || "未知")),
    browsers: top(count(firsts, (r) => r.browser || "未知")),
    pages: top(pages),
    clicks: top(clicks),
    signups: labels.map((d) => perDay[d] || 0),
    backers_running: running(backers.map((b) => ms(b.created_at)).filter(Boolean)),
    paying_running: running(paid.map(ms).filter(Boolean)),
    funnel: [
      { name: "访客", count: firsts.length },
      { name: "点过按钮", count: clickers.size },
      { name: "注册", count: created.filter((t) => dayOf(t) >= start).length },
      { name: "上传过挥杆", count: new Set(events.filter((e) => e.kind === "upload_saved" && e.user_id && inWindow(e.ts)).map((e) => e.user_id)).size },
      { name: "付费", count: paid.filter(inWindow).length },
    ],
    backers_in_window: backers.filter((b) => inWindow(b.created_at)).length,
  };
}

async function backerOverview() {
  const [accounts, backers, subs, events] = await Promise.all([
    loaders.accounts(), loaders.backers(), loaders.subs(),
    all("events", "key,ts,kind,user_id", (q) => q.eq("kind", PAYMENT_DONE).order("ts").order("key")),
  ]);
  const known = new Set(accounts.map((a) => a.email));
  const emails = emailsOf(accounts);
  const paidAt = firstPayments(events.map(flatEvent));
  const bill = billing(subs);
  const paying = Object.entries(bill.users)
    .map(([uid, row]) => ({ uid, sub: subscription(row) }))
    .filter(({ sub }) => sub.pro || sub.status)
    .map(({ uid, sub }) => ({
      user_id: uid, email: emails[uid] || null, plan: sub.plan, status: sub.status, pro: sub.pro,
      since: paidAt[uid] || sub.updated_at, current_period_end: sub.current_period_end, cancel_at_period_end: sub.cancel_at_period_end,
    }));
  return {
    ok: true,
    backers: backers.map((b) => ({ ...b, use: b.use_case, has_account: known.has(b.email) })),
    backer_store_error: null,
    paying: newest(paying, "since"),
    founding_used: bill.founding,
  };
}

async function note(action, data) {
  const { error } = await sb.from("dashboard_audit").insert({ action, data });
  fail(error);
}

async function removeBacker(id) {
  const { data, error } = await sb.from("backers").delete().eq("id", id).select("id");
  fail(error);
  if (!data || !data.length) throw new Error("这条记录已不存在。");
  // The log keeps the row's random id, not the address of someone who asked to be removed.
  await note("backer_removed", { backer_id: id });
  return { ok: true };
}

// ------------------------------------------------------------ router and sign-in

export async function api(path, opts = {}) {
  const url = new URL(path, location.origin);
  const arg = (name) => url.searchParams.get(name) || "";
  const routes = {
    "/api/admin/live": () => live(),
    "/api/admin/traffic": () => traffic(arg("days")),
    "/api/admin/backers": () => backerOverview(),
    "/api/admin/overview": () => overview(),
    "/api/admin/users": () => users(),
    "/api/admin/user": () => userDetail(arg("user_id")),
    "/api/admin/payments": () => payments(arg("user_id")),
    "/api/admin/feedback": () => feedback(),
    "/api/admin/questions": () => questions(),
    "/api/admin/audit": () => audit(),
    "/api/admin/backers/remove": () => removeBacker(String((opts.body || {}).id || "")),
    "/api/admin/backers/exported": () => note("backers_export", { rows: Number((opts.body || {}).rows || 0) }).then(() => ({ ok: true })),
  };
  const route = routes[url.pathname];
  if (!route) throw new Error("这个功能只在服务器后台上：" + SERVER_ADMIN_URL);
  return route();
}

/** The signed-in admin's email, or null when nobody is signed in. Throws when signed in but not an admin. */
export async function currentAdmin() {
  const { data } = await sb.auth.getSession();
  const user = data.session && data.session.user;
  if (!user) return null;
  const { data: ok, error } = await sb.rpc("is_admin");
  fail(error);
  if (!ok) {
    await sb.auth.signOut();
    throw new Error(user.email_confirmed_at ? "这个账号没有后台权限。" : "请先点邮件里的链接确认邮箱，再登录。");
  }
  return user.email;
}

export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(/confirm/i.test(error.message) ? "请先点邮件里的链接确认邮箱，再登录。" : "邮箱或密码不对。");
  const admin = await currentAdmin();
  await note("dashboard_login", {}).catch(() => {});
  return admin;
}

export async function signUp(email, password) {
  const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/admin` } });
  if (error) throw new Error(error.message);
}

export async function sendReset(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin` });
  if (error) throw new Error(error.message);
}

export async function setNewPassword(password) {
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await sb.auth.signOut();
}
