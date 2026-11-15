// When the Playground server is down, its proxy answers with an empty 502. People opening a page get
// this explanation instead, and it reloads itself once the server is back.
//
// The Vercel project's "Playground app" rule runs before this file, so that rule has to skip page opens
// (missing header Sec-Fetch-Dest: document) for them to arrive here. API calls, videos and scripts stay
// on the rule.
//
// Document opens used to re-fetch https://cerebel.tech/playground/... from Edge middleware. That
// same-host hop often stalled past the health budget and showed a false "offline" page even while
// /api/health was fine. Probe the GPU origin directly (PLAYGROUND_ORIGIN) with clean headers.
export const config = { matcher: ["/playground", "/playground/:path*"] };

const HEALTH_MS = 8000;
const PAGE_MS = 25000;

// Same host the Vercel "Playground app" rewrite targets (CeRebel / onething tunnel).
const DEFAULT_ORIGIN = "https://0i5-79nucyondu7h6sp1a-cdhea2bq-custom.service.onethingrobot.com";

export const DOWN_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Back soon | Cerebel Playground</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px; box-sizing: border-box;
    background: #08070b; color: #f4f0fa; font: 17px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 26rem; }
  h1 { margin: 0 0 .5rem; font-size: 1.75rem; line-height: 1.2; font-weight: 600; letter-spacing: -.01em; }
  p { margin: 0 0 1.5rem; color: #b9b2c6; }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem; }
  button { min-height: 44px; padding: 0 1.25rem; border: 0; border-radius: 999px; background: #f4f0fa; color: #08070b;
    font: inherit; font-weight: 600; cursor: pointer; }
  a { color: #f4f0fa; }
  :focus-visible { outline: 2px solid #f4f0fa; outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <h1>The Playground is offline</h1>
  <p>Our swing analysis server isn't answering right now. We're on it. This page will open by itself when it's back.</p>
  <div class="actions">
    <button type="button" onclick="location.reload()">Try again</button>
    <a href="/">Go to cerebel.tech</a>
  </div>
</main>
<script>
  setInterval(function () {
    fetch("/playground/api/health", { cache: "no-store" }).then(function (r) {
      if (r.ok) location.reload();
    }).catch(function () {});
  }, 30000);
</script>
</body>
</html>
`;

function playgroundOrigin() {
  const raw = (typeof process !== "undefined" && process.env && process.env.PLAYGROUND_ORIGIN) || DEFAULT_ORIGIN;
  return String(raw).replace(/\/$/, "");
}

function originUrl(pathWithQuery) {
  return playgroundOrigin() + (pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`);
}

function cleanHeaders(accept) {
  // Do not forward browser cookies / sec-fetch — those can stall the Edge→origin hop.
  const headers = new Headers({
    "user-agent": "cerebel-playground-middleware",
    accept: accept || "*/*",
  });
  return headers;
}

export default async function middleware(request) {
  if (request.method !== "GET" || request.headers.get("sec-fetch-dest") !== "document") return undefined;

  const incoming = new URL(request.url);
  const healthUrl = originUrl("/playground/api/health");
  try {
    const health = await fetch(healthUrl, {
      headers: cleanHeaders("application/json"),
      redirect: "manual",
      signal: AbortSignal.timeout(HEALTH_MS),
      cache: "no-store",
    });
    if (!health.ok) throw new Error("unhealthy");
  } catch {
    return new Response(DOWN_PAGE, {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "120" },
    });
  }

  try {
    const pageUrl = originUrl(incoming.pathname + incoming.search);
    const response = await fetch(pageUrl, {
      headers: cleanHeaders("text/html"),
      redirect: "manual",
      signal: AbortSignal.timeout(PAGE_MS),
      cache: "no-store",
    });
    if (response.status < 500) {
      // Rebuild so we can force no-store on the HTML shell.
      const headers = new Headers(response.headers);
      headers.set("cache-control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    }
  } catch {
    // Page transfer failed after health said up — still show the waiting page.
  }
  return new Response(DOWN_PAGE, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "120" },
  });
}
