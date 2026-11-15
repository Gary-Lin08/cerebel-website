# CeRebel Playground (Vercel)

Static UI lives here. **GEM-X** runs on the GPU box (`GEMX_HTTP_ORIGIN`, port 8091). **Coaching** runs in Vercel serverless (`/api/playground/chat`) using `MOTION_AGENT_API_KEY`.

## Vercel env

**Required:** `MOTION_AGENT_API_KEY` (from `CeRebel/.env.product` or `~/Qwen_KEY.txt`).

**Defaults (same as live product — no need to set):**

| Variable | Default |
|---|---|
| `MOTION_AGENT_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `MOTION_AGENT_MODEL` | `qwen3.7-plus` |
| `GEMX_HTTP_ORIGIN` | `https://0i5-79nucyondu7h6sp1a-cdhea2bz-custom.service.onethingrobot.com` |

See `/.env.example.playground`.
