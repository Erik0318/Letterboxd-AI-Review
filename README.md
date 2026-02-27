# Letterboxd AI Review (ZIP import)

A public no-login web app: upload Letterboxd export ZIP, parse locally, get rich stats, and generate AI roast/praise.

- No database, no persistence, refresh = clear.
- Frontend static on Cloudflare Pages.
- AI proxy via Pages Functions `/api/ai`.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Official sample input (for debug / QA)

- Put the sample ZIP at `public/sample_data.zip` so it is reachable as `/sample_data.zip` in both dev and production builds.
- In the UI, click **Use sample_data.zip** to run the exact same parse + merge pipeline as manual upload.
- Debug summary panel shows merge coverage/anomaly diagnostics (CSV list, hit rates, only-in-ratings/reviews counts, import spike, sampled films).

### Sample self-check

```bash
npm run verify:sample
```

This script loads `public/sample_data.zip` (or falls back to repo-root `sample_data.zip`), prints debug summary, and checks critical assertions.

## Cloudflare Pages setup

- Build command: `npm run build`
- Output directory: `dist`

### Recommended defaults (DeepSeek)

Set in **Production Variables/Secrets**:

- `OPENAI_API_KEY` = your DeepSeek API key (Secret)
- `OPENAI_BASE_URL` = `https://api.deepseek.com` (**do not** end with `/v1`)
- `OPENAI_MODEL` = `deepseek-chat` (or `deepseek-reasoner`)

Optional Gemini fallback:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

### Daily limit + whitelist

- `AI_DAILY_LIMIT=2`
- Bind KV namespace to `RLKV`
- Optional whitelist env: `AI_BYPASS_IPS` (comma-separated IPs)

This project also hard-bypasses `5.34.216.81` for unlimited testing.

After changing Variables/Bindings on Cloudflare Pages, redeploy the latest Production deployment.
