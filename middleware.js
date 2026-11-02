// When the Playground server is down, its proxy answers with an empty 502. People opening a page get
// this explanation instead, and it reloads itself once the server is back.
//
// The Vercel project's "Playground app" rule runs before this file, so that rule has to skip page opens
// (missing header Sec-Fetch-Dest: document) for them to arrive here. API calls, videos and scripts stay
// on the rule. Our own request below has no such header, so the rule takes it to the server.
export const config = { matcher: ["/playground", "/playground/:path*"] };

const WAIT_MS = 8000;

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

export default async function middleware(request) {
  if (request.method !== "GET" || request.headers.get("sec-fetch-dest") !== "document") return undefined;
  const headers = new Headers(request.headers);
  headers.delete("sec-fetch-dest");
  headers.set("accept-encoding", "identity");
  try {
    const response = await fetch(request.url, { headers, redirect: "manual", signal: AbortSignal.timeout(WAIT_MS) });
    if (response.status < 500) return response;
  } catch {
    // No answer in time is the same as a 502.
  }
  return new Response(DOWN_PAGE, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "120" },
  });
}
