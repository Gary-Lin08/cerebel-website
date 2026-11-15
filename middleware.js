// When the Playground server is down, its proxy answers with an empty 502. People opening a page get
// this explanation instead, and it reloads itself once the server is back.
//
// The Vercel project's "Playground app" rule runs before this file, so that rule has to skip page opens
// (missing header Sec-Fetch-Dest: document) for them to arrive here. API calls, videos and scripts stay
// on the rule.
//
// Document opens are handled here. We used to re-fetch the same cerebel.tech URL (often stalled) or
// only the GPU origin (unreachable from some Edge regions). Race both with clean headers — first
// healthy answer wins.
export const config = { matcher: ["/playground", "/playground/:path*"] };

const HEALTH_MS = 6000;
const PAGE_MS = 20000;

// Same host the Vercel "Playground app" rewrite targets (CeRebel / onething tunnel).
// Override with PLAYGROUND_ORIGIN in the Vercel project env if the tunnel hostname changes.
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

function cleanHeaders(accept) {
  // Do not forward browser cookies / sec-fetch — those can stall the Edge hop.
  return new Headers({
    "user-agent": "cerebel-playground-middleware",
    accept: accept || "*/*",
  });
}

function candidateUrls(request, pathWithQuery) {
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  const site = new URL(path, request.url).href;
  const origin = playgroundOrigin() + path;
  // Prefer the GPU origin first: same-host subrequests from Edge middleware can stall
  // behind the document request. Keep same-host as a fallback (uses the Vercel rewrite).
  return origin === site ? [site] : [origin, site];
}

async function fetchFirstOk(urls, { accept, timeoutMs, requireOk = true }) {
  const errors = [];
  const tasks = urls.map(async (url) => {
    const response = await fetch(url, {
      headers: cleanHeaders(accept),
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (requireOk && !response.ok) {
      throw new Error(`${url} → ${response.status}`);
    }
    if (!requireOk && response.status >= 500) {
      throw new Error(`${url} → ${response.status}`);
    }
    return response;
  });
  // Promise.any rejects with AggregateError if every candidate fails.
  try {
    return await Promise.any(tasks);
  } catch (err) {
    errors.push(err);
    throw err;
  }
}

function downResponse() {
  return new Response(DOWN_PAGE, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "120" },
  });
}

export default async function middleware(request) {
  if (request.method !== "GET" || request.headers.get("sec-fetch-dest") !== "document") return undefined;

  const incoming = new URL(request.url);
  try {
    await fetchFirstOk(candidateUrls(request, "/playground/api/health"), {
      accept: "application/json",
      timeoutMs: HEALTH_MS,
      requireOk: true,
    });
  } catch {
    return downResponse();
  }

  try {
    const response = await fetchFirstOk(
      candidateUrls(request, incoming.pathname + incoming.search),
      {
        accept: "text/html",
        timeoutMs: PAGE_MS,
        requireOk: false,
      },
    );
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return downResponse();
  }
}
