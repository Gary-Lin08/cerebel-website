const GEMX_ORIGIN =
  process.env.GEMX_HTTP_ORIGIN ||
  process.env.CEREBEL_GEMX_HTTP_ORIGIN ||
  "https://0i5-79nucyondu7h6sp1a-cdhea2bz-custom.service.onethingrobot.com";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method not allowed" }));
  }

  let gemx = { ok: false };
  try {
    const r = await fetch(GEMX_ORIGIN.replace(/\/$/, "") + "/v1/health", {
      signal: AbortSignal.timeout(8000),
    });
    gemx = await r.json().catch(() => ({ ok: false, status: r.status }));
    gemx.http_status = r.status;
  } catch (err) {
    gemx = { ok: false, error: String(err && err.message ? err.message : err) };
  }

  const hasKey = !!(
    process.env.MOTION_AGENT_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    process.env.QWEN_API_KEY
  );
  // Same defaults as CeRebel/.env.product — override only if you change providers.
  const baseUrl =
    process.env.MOTION_AGENT_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.MOTION_AGENT_MODEL || "qwen3.7-plus";

  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      service: "playground-vercel",
      gemx_origin: GEMX_ORIGIN.replace(/\/$/, ""),
      gemx,
      llm_key_configured: hasKey,
      base_url: baseUrl,
      model,
    })
  );
}
