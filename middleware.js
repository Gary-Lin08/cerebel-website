// When the Playground server is down, show a clear waiting page instead of an empty 502.
//
// Happy-path HTML/API are proxied by vercel.json rewrites to the GPU origin. This middleware
// only gates browser document opens: a quick health probe, then fall through to the rewrite.
// It used to re-fetch and stream the HTML from Edge, which hung or false-offlined often.
export const config = { matcher: ["/playground", "/playground/:path*"] };

const HEALTH_MS = 5000;

// Same host vercel.json rewrites target. Override with PLAYGROUND_ORIGIN in Vercel env.
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

function healthUrls(request) {
  const origin = `${playgroundOrigin()}/playground/api/health`;
  const site = new URL("/playground/api/health", request.url).href;
  return origin === site ? [origin] : [origin, site];
}

function cleanHeaders() {
  return new Headers({
    "user-agent": "cerebel-playground-middleware",
    accept: "application/json",
  });
}

async function healthOk(request) {
  const tasks = healthUrls(request).map(async (url) => {
    const response = await fetch(url, {
      headers: cleanHeaders(),
      redirect: "manual",
      signal: AbortSignal.timeout(HEALTH_MS),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(String(response.status));
    return true;
  });
  await Promise.any(tasks);
  return true;
}

export default async function middleware(request) {
  if (request.method !== "GET" || request.headers.get("sec-fetch-dest") !== "document") {
    return undefined;
  }

  try {
    await healthOk(request);
  } catch {
    return new Response(DOWN_PAGE, {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "120" },
    });
  }

  // Healthy: let vercel.json rewrite proxy the real Playground HTML.
  return undefined;
}
