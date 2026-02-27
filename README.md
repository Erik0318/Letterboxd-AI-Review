# Letterboxd AI Review

一个**无需登录、纯前端解析**的 Letterboxd 数据分析与 AI 点评工具。你可以上传 Letterboxd 导出的 ZIP（或直接加载仓库内官方样本），在浏览器里完成数据合并、统计分析、可视化展示，并生成 AI 风格化评价（夸奖 / 锐评）。

## 在线地址

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

```bash
npm run build
npm run preview
```

---

## 样本回归与自检

仓库内已包含官方样本：

- `public/sample_data.zip`

可以运行自检脚本：

```bash
npm run verify:sample
```

该脚本会：

- 加载 `public/sample_data.zip`
- 执行解析与合并
- 输出 debug summary
- 对关键约束做断言（时间线来源、ratings/reviews 来源、comments 排除等）

---

## Cloudflare Pages 部署说明

- Build command: `npm run build`
- Output directory: `dist`

### 推荐默认（DeepSeek）

在 Production Variables/Secrets 中设置：

- `OPENAI_API_KEY`（Secret）
- `OPENAI_BASE_URL=https://api.deepseek.com`（不要带 `/v1`）
- `OPENAI_MODEL=deepseek-chat`（或 `deepseek-reasoner`）

### 可选 Gemini 回退

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

### 每日限流与白名单

- `AI_DAILY_LIMIT=2`
- 绑定 KV 命名空间到 `RLKV`
- 可选白名单：`AI_BYPASS_IPS`（逗号分隔）

变量或绑定修改后，需要重新部署 Production。

---

## 隐私与数据说明

- 本项目设计目标是**本地解析、无登录、无数据库持久化**。
- 刷新页面会清空当前前端状态。
- 调用 AI 时会把整理后的统计摘要发送到 `/api/ai`（由部署环境执行下游模型请求）。

---

## 适用场景

- 个人年度观影复盘
- 与朋友分享风格画像
- 校验 Letterboxd 导出数据质量
- 给后续推荐/画像系统提供结构化输入
