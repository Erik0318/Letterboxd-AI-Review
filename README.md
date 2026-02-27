# Letterboxd AI Review

A no-login web app to analyze your Letterboxd export ZIP locally, generate rich stats/visualizations, and produce AI roast/praise based on merged data.

## Live site

- Production: **https://erikdev.cc**

## What this project does

Letterboxd exports contain multiple CSV files (`watched.csv`, `ratings.csv`, `diary.csv`, `reviews.csv`, etc.).
This app merges them into one master film dataset and provides:

- core watched/rated statistics
- activity and distribution charts
- shareable summary text + share card image
- AI commentary (roast/praise)
- debug panel to inspect merge quality and anomalies

---

## Features

### 1) Import options

- Upload your own Letterboxd ZIP.
- Click **Use sample_data.zip** to load the official sample from `/sample_data.zip` (`public/sample_data.zip`) using the exact same import pipeline.

### 2) CSV parsing and merge rules

Top-level CSVs recognized (when present):

- `watched.csv`
- `ratings.csv`
- `reviews.csv`
- `diary.csv`
- `watchlist.csv`
- `profile.csv`
- `comments.csv`

Current merge behavior:

- `watched.csv` sets the watched baseline (`watched=true`)
- `ratings.csv` writes rating fields
- `reviews.csv` writes review text fields
- `diary.csv` provides watch timeline (`watched_at` preferred, fallback to logged date), rewatch, tags
- `comments.csv` is **not** treated as reviews

### 3) Visualizations and stats

After import, the app shows:

- watched/rated totals
- mean/median rating
- longest streak
- monthly activity heatmap
- rating histogram
- release year/decade distributions

### 4) AI output

Supports roast/praise modes and intensity levels.
Default backend path is DeepSeek (with optional OpenAI-compatible/Gemini settings in UI).
AI input is generated from merged master data + computed stats.

### 5) Debug summary

A toggleable debug panel shows merge diagnostics such as:

- detected CSV list
- merged film totals
- watched/date coverage
- ratings/reviews hit rates
- import spike metrics
- sampled films with field/source presence

---

## Tech stack

- React + TypeScript + Vite
- PapaParse + JSZip
- html2canvas (share card export)
- Cloudflare Pages Functions (`/api/ai`)

---

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

---

## Sample verification

Official sample data is included at:

- `public/sample_data.zip`

Run verification:

```bash
npm run verify:sample
```

This command loads sample ZIP, runs parser+merge, prints debug summary, and validates key constraints.

---

## Cloudflare Pages deployment

- Build command: `npm run build`
- Output directory: `dist`

Recommended production env (DeepSeek):

- `OPENAI_API_KEY` (Secret)
- `OPENAI_BASE_URL=https://api.deepseek.com` (without `/v1`)
- `OPENAI_MODEL=deepseek-chat` (or `deepseek-reasoner`)

Optional Gemini fallback:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

Rate-limit / bypass options:

- `AI_DAILY_LIMIT=2`
- Bind KV namespace to `RLKV`
- Optional `AI_BYPASS_IPS` (comma-separated)

---

## Privacy

- Parsing/stat calculations are done in-browser.
- No login, no user database, refresh clears local state.
- AI calls send generated profile/stat payload to `/api/ai` in your deployment.

---

## Українська (коротко)

Це вебзастосунок без логіну для локального аналізу ZIP-експорту Letterboxd.
Він об’єднує CSV у єдину таблицю фільмів, будує статистику/графіки та генерує AI-огляд (roast/praise).
Продакшн: **https://erikdev.cc**.
