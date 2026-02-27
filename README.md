# Letterboxd AI Review (ZIP import)

A public no-login web app: upload Letterboxd export ZIP, parse locally, get rich stats, and generate AI roast/praise.

Official sample input for regression/dev: `public/sample_data.zip` (also available at `/sample_data.zip` in production builds). Use the **Use sample_data.zip** button in the UI to run the same merge pipeline without manual upload.

- No database, no persistence, refresh = clear.
- Frontend static on Cloudflare Pages.
- AI proxy via Pages Functions `/api/ai`.

## Local development

```bash
npm install
npm run dev
```

Sample self-check:

```bash
npm run verify:sample
```

## Build

```bash
npm run build
npm run preview
```

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
