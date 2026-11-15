/**
 * Mesh-body coaching on Vercel: DashScope/Qwen VLM + RGB frames from GEM-X HTTP.
 *
 * Env (set in Vercel project):
 *   MOTION_AGENT_API_KEY   — same value as CeRebel/.env.product
 *   MOTION_AGENT_BASE_URL  — default DashScope compatible-mode
 *   MOTION_AGENT_MODEL     — default qwen3.7-plus
 *   GEMX_HTTP_ORIGIN       — public GEM-X gateway (8091 tunnel)
 */

const GEMX_ORIGIN =
  process.env.GEMX_HTTP_ORIGIN ||
  process.env.CEREBEL_GEMX_HTTP_ORIGIN ||
  "https://0i5-79nucyondu7h6sp1a-cdhea2bz-custom.service.onethingrobot.com";

const BASE_URL =
  process.env.MOTION_AGENT_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MODEL = process.env.MOTION_AGENT_MODEL || "qwen3.7-plus";
const MAX_TOOLS = Math.max(1, Number(process.env.MOTION_AGENT_MAX_TOOL_CALLS || 8));

const SYSTEM = `You are CeRebel's athletic coach for a single uploaded clip.
The body was reconstructed with GEM-X (mesh only — no OpenSim joint angles or forces).
Use get_rgb_frame / get_rgb_clip when you need to see the athlete.
Be concrete, brief, and actionable. One main fix when possible. Do not invent joint-degree measurements.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_rgb_frame",
      description: "Fetch one JPEG frame from the athlete's uploaded video at time t seconds.",
      parameters: {
        type: "object",
        properties: {
          t: { type: "number", description: "Time in seconds from start of clip" },
        },
        required: ["t"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_rgb_clip",
      description: "Fetch a few JPEG frames spanning a short window of the clip.",
      parameters: {
        type: "object",
        properties: {
          t0: { type: "number" },
          t1: { type: "number" },
          n: { type: "integer", description: "Number of frames (2-6)", default: 3 },
        },
        required: ["t0", "t1"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_knowledge_sources",
      description: "List built-in coaching knowledge sources available in this deploy.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Search a small built-in coaching tip index.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
];

const KB = [
  {
    id: "golf-tempo",
    text: "Smooth tempo: backswing and downswing should feel connected; rush into the ball often shows as early arm cast.",
  },
  {
    id: "golf-weight",
    text: "Pressure should shift into the lead side through impact; hanging back on the trail foot leaks power and path.",
  },
  {
    id: "golf-face",
    text: "Clubface awareness at impact matters more than chasing perfect positions earlier in the swing.",
  },
  {
    id: "general-balance",
    text: "Finish in balance for a full second — loss of balance usually means the move was out of sequence.",
  },
];

function apiKey() {
  return (
    (process.env.MOTION_AGENT_API_KEY || "").trim() ||
    (process.env.DASHSCOPE_API_KEY || "").trim() ||
    (process.env.QWEN_API_KEY || "").trim()
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function fetchFrameDataUrl(origin, jobId, t) {
  const url =
    origin.replace(/\/$/, "") +
    "/v1/jobs/" +
    encodeURIComponent(jobId) +
    "/frame.jpg?t=" +
    encodeURIComponent(String(t));
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("frame " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  return "data:image/jpeg;base64," + buf.toString("base64");
}

async function runTool(name, args, { origin, jobId }) {
  if (name === "get_rgb_frame") {
    const t = Number(args.t) || 0;
    const url = await fetchFrameDataUrl(origin, jobId, t);
    return { ok: true, t, image_data_url: url };
  }
  if (name === "get_rgb_clip") {
    const t0 = Number(args.t0) || 0;
    const t1 = Math.max(t0 + 0.05, Number(args.t1) || t0 + 0.5);
    const n = Math.min(6, Math.max(2, Number(args.n) || 3));
    const frames = [];
    for (let i = 0; i < n; i++) {
      const t = t0 + ((t1 - t0) * i) / Math.max(1, n - 1);
      frames.push({ t, image_data_url: await fetchFrameDataUrl(origin, jobId, t) });
    }
    return { ok: true, frames };
  }
  if (name === "list_knowledge_sources") {
    return { ok: true, sources: [{ id: "builtin", label: "Built-in coaching tips" }] };
  }
  if (name === "search_knowledge_base") {
    const q = String(args.query || "").toLowerCase();
    const hits = KB.filter((row) => !q || row.text.toLowerCase().includes(q) || q.split(/\s+/).some((w) => row.text.toLowerCase().includes(w)));
    return { ok: true, hits: (hits.length ? hits : KB).slice(0, 3) };
  }
  return { ok: false, error: "unknown tool " + name };
}

function toolResultToMessage(toolCallId, result) {
  // Attach images as multimodal content when present so the next turn can see them.
  const images = [];
  if (result.image_data_url) images.push(result.image_data_url);
  if (Array.isArray(result.frames)) {
    for (const f of result.frames) if (f.image_data_url) images.push(f.image_data_url);
  }
  if (!images.length) {
    return {
      role: "tool",
      tool_call_id: toolCallId,
      content: JSON.stringify(result),
    };
  }
  const content = [
    { type: "text", text: JSON.stringify({ ...result, image_data_url: undefined, frames: result.frames && result.frames.map((f) => ({ t: f.t })) }) },
  ];
  for (const url of images.slice(0, 6)) {
    content.push({ type: "image_url", image_url: { url } });
  }
  // DashScope tool role is text-only on some models — also push a user-visible image turn.
  return [
    { role: "tool", tool_call_id: toolCallId, content: JSON.stringify({ ok: result.ok, t: result.t, frames: result.frames && result.frames.map((f) => ({ t: f.t })), note: "images follow" }) },
    { role: "user", content },
  ];
}

async function chatCompletion(messages) {
  const key = apiKey();
  if (!key) {
    const err = new Error("MOTION_AGENT_API_KEY not configured on Vercel");
    err.status = 503;
    throw err;
  }
  const r = await fetch(BASE_URL.replace(/\/$/, "") + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(120000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error?.message || data.message || "LLM HTTP " + r.status);
    err.status = r.status;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method not allowed" }));
  }

  try {
    const body = await readBody(req);
    const jobId = String(body.job_id || "").trim();
    const message = String(body.message || "").trim();
    const origin = String(body.gemx_origin || GEMX_ORIGIN).replace(/\/$/, "");
    if (!jobId || !message) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "job_id and message required" }));
    }

    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const messages = [
      { role: "system", content: SYSTEM },
      ...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })),
    ];
    // Ensure the latest user turn is present even if history already includes it.
    if (!messages.length || messages[messages.length - 1].content !== message) {
      messages.push({ role: "user", content: message });
    }

    let reply = "";
    for (let step = 0; step < MAX_TOOLS; step++) {
      const data = await chatCompletion(messages);
      const choice = data.choices && data.choices[0];
      const msg = choice && choice.message;
      if (!msg) break;
      messages.push(msg);
      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) {
        reply = String(msg.content || "").trim();
        break;
      }
      for (const tc of toolCalls) {
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || "{}");
        } catch (_) {
          args = {};
        }
        const result = await runTool(tc.function?.name, args, { origin, jobId });
        const packed = toolResultToMessage(tc.id, result);
        if (Array.isArray(packed)) messages.push(...packed);
        else messages.push(packed);
      }
    }

    if (!reply) {
      // Final pass without tools if the loop exhausted on tool calls.
      const data = await chatCompletion(messages.filter((m) => m.role !== "tool").concat([{ role: "user", content: "Give your best coaching answer now from what you saw." }]));
      reply = String(data.choices?.[0]?.message?.content || "").trim() || "I could not finish that answer. Try again.";
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, reply, job_id: jobId, model: MODEL }));
  } catch (err) {
    res.statusCode = err.status || 500;
    res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
  }
}
