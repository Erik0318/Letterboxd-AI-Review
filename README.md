# Letterboxd Taste Report (ZIP import)

A single page web app that runs locally in the browser.

- Input: a Letterboxd data export ZIP (contains CSV files)
- Output: stats dashboards + share card + AI praise or roast
- No login, no database, no user data stored server side
- Optional AI proxy via Cloudflare Pages Functions (/api/ai)

## Local development

1. Install Node.js 18+.
2. In this folder:

```bash
npm install
npm run dev
```

Open the local URL Vite prints.

## Build

```bash
npm run build
npm run preview
```

## Deploy on Cloudflare Pages

1. Create a Cloudflare Pages project from this repo.
2. Build command: `npm run build`
3. Build output directory: `dist`

Pages Functions in `functions/` will deploy automatically.
Set environment variables in Cloudflare Pages project settings.

### AI defaults (optional)

If you want a default AI without users entering keys, set at least one provider.

OpenAI compatible (OpenAI, DeepSeek, Doubao, or any compatible gateway)
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` default `https://api.openai.com`
- `OPENAI_MODEL` default `gpt-4o-mini`

Gemini
- `GEMINI_API_KEY`
- `GEMINI_MODEL` default `gemini-1.5-flash`

Default provider selection logic:
- If `GEMINI_API_KEY` exists, default to Gemini
- Else if `OPENAI_API_KEY` exists, default to OpenAI compatible
- Else AI calls require the user to enter an API key

### Rate limit (recommended)

Create a Cloudflare KV namespace and bind it to the Pages project as `RLKV`.
The function enforces 2 AI calls per IP per day.

## Notes

This project intentionally treats ratings as optional.
Watched items without ratings are first class and appear in stats.
