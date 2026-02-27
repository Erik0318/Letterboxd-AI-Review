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

- 生产环境：**https://erikdev.cc**

## 这个项目解决什么问题

Letterboxd 导出的 ZIP 往往包含多份 CSV（如 `watched.csv`、`ratings.csv`、`diary.csv`、`reviews.csv` 等），直接阅读成本高、信息分散。本项目把这些表合并为统一的影片主表（master table），并提供：

- 观影/评分核心统计
- 评分分布与时间活跃度图表
- 影迷风格面板（如重看倾向、探索倾向等）
- 可复制摘要与分享卡片导出
- 基于合并结果的 AI 个性化点评
- 调试面板（Debug summary）用于验证 CSV 合并是否正确

---

## 功能总览

### 1) 导入方式

- **上传 ZIP**：直接上传你自己的 Letterboxd 导出包。
- **官方样本一键加载**：点击页面上的 `Use sample_data.zip`，自动读取 `/sample_data.zip`（即 `public/sample_data.zip`），走与上传完全一致的解析/合并管线。

### 2) CSV 解析与合并（核心）

当前会识别并读取以下顶层 CSV（如果存在）：

- `watched.csv`
- `ratings.csv`
- `reviews.csv`
- `diary.csv`
- `watchlist.csv`
- `profile.csv`
- `comments.csv`

合并规则（为可解释性固定）：

- `watched.csv` 决定基准 `watched=true`
- `ratings.csv` 写入评分字段
- `reviews.csv` 写入短评字段（不会把 `comments.csv` 当 reviews）
- `diary.csv` 提供时间线（优先 `watched_at`，缺失时退化到 `logged_at`）、重看与标签
- 缺失于 watched 但存在于 ratings/reviews/diary 的影片会并入主表并在 debug 中可见

### 3) 可视化与统计

导入成功后会生成：

- 总观影数、评分数、均分、中位数
- 最长 streak（连续观影天数）
- 月度热力图/活跃度
- 评分直方图、发行年份分布
- 文本词频与若干风格指数

### 4) AI 点评

支持 roast / praise 模式与不同强度，默认后端模型为 DeepSeek（可切换兼容 OpenAI 的提供方或 Gemini，按页面配置）。AI 输入来自合并后的统一数据与统计摘要。

### 5) Debug Summary（验收与排错）

页面内置 Debug 开关，展示：

- 识别到的 CSV 列表
- 合并后影片总数
- watched=true 数量
- watched 时间覆盖率
- ratings/reviews 命中率
- only-in-ratings / only-in-reviews 数量
- import spike 指标（包括最大导入日计数）
- 随机样本影片的来源与字段命中状态

用于快速确认“是不是正确走了全量合并而不是单表统计”。

---

## 技术栈

- **Frontend**: React + TypeScript + Vite
- **CSV/ZIP 处理**: PapaParse + JSZip
- **截图导出**: html2canvas
- **Serverless API**: Cloudflare Pages Functions (`/api/ai`)

---

## 本地开发

```bash
npm install
npm run dev
```

开发服务默认由 Vite 提供。

## 生产构建
Sample self-check:

```bash
npm run verify:sample
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

### 可选 Gemini 回退

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

## Українська

Це вебзастосунок без логіну для локального аналізу ZIP-експорту Letterboxd.
Він об’єднує CSV у єдину таблицю фільмів, будує статистику/графіки та генерує AI-огляд (roast/praise).
Продакшн: **https://erikdev.cc**.
