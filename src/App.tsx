import React, { useMemo, useState } from "react";
import html2canvas from "html2canvas";
import Toast from "./components/Toast";
import { readLetterboxdExportZip, mergeTablesToMaster, FilmRecord, MergeDebugSummary } from "./lib/letterboxd";
import { computeStats, StatPack } from "./lib/stats";
import { BarList } from "./components/BarList";
import { Heatmap } from "./components/Heatmap";
import ShareCard from "./components/ShareCard";
import { formatInt, formatPct, round1 } from "./lib/utils";

type Provider = "default" | "openai_compat" | "gemini";

type Lang = "en" | "zh" | "uk";

const I18N: Record<Lang, Record<string, string>> = {
  en: {
    title: "Letterboxd AI Review",
    subtitle: "Local ZIP analysis + DeepSeek default AI",
    reset: "Reset",
    importTitle: "1) Import",
    uploadHint: "Upload your Letterboxd export ZIP",
    localOnly: "All parsing and stats are local in your browser. Refresh clears everything.",
    label: "Label on share card",
    language: "Language",
    merged: "unique films merged",
    watchedDates: "Watched dates",
    reviewSamples: "Review text samples",
    watched: "Watched",
    rated: "Rated",
    mean: "Mean",
    streak: "Streak",
    quickFacts: "Quick facts",
    unrated: "Unrated watched",
    commitment: "Commitment",
    volatility: "Taste volatility",
    noData: "No data",
    share: "2) Share",
    copySummary: "Copy summary",
    downloadCard: "Download share card PNG",
    ai: "3) AI Roast / Praise",
    mode: "Mode",
    roast: "Roast",
    praise: "Praise",
    level: "Intensity",
    mild: "Mild",
    normal: "Normal",
    savage: "Savage",
    provider: "Provider",
    key: "API key (optional)",
    keyHint: "Leave empty to use site default DeepSeek key",
    baseUrl: "Base URL (OpenAI compatible)",
    model: "Model",
    generate: "Generate",
    running: "Analyzing...",
    aiOutput: "AI Output",
    deepseekNote: "Default backend model is DeepSeek. Other models require your own API settings.",
    aiProgress: "AI analysis progress",
    tutorial: "Quick tutorial",
    t1: "Export Letterboxd data: Settings → Data → Export ZIP.",
    t2: "Upload ZIP here. No login. No database. Refresh = clear.",
    t3: "Default AI uses site DeepSeek key. To use Gemini/GPT/Doubao, fill provider + key (+ baseUrl/model).",
    t4: "Choose EN / 中文 / Українська to switch both UI and AI output language.",
    extraStats: "Cinephile boards",
    recBoard: "AI recommendation hooks",
    github: "Project GitHub",
    loading1: "Building full film dossier...",
    loading2: "Extracting patterns from every watched title...",
    loading3: "Writing a direct, non-generic critique...",
    loading4: "Final polishing..."
  },
  zh: {
    title: "Letterboxd AI 锐评",
    subtitle: "本地 ZIP 分析 + 默认 DeepSeek",
    reset: "重置",
    importTitle: "1）导入",
    uploadHint: "上传 Letterboxd 导出 ZIP",
    localOnly: "所有解析和统计都在浏览器本地完成。刷新即清空。",
    label: "分享卡片标签",
    language: "语言",
    merged: "部唯一影片已合并",
    watchedDates: "观看日期",
    reviewSamples: "短评样本",
    watched: "看过",
    rated: "评分",
    mean: "均分",
    streak: "连看",
    quickFacts: "快照",
    unrated: "未评分观看",
    commitment: "评分投入度",
    volatility: "口味波动",
    noData: "暂无数据",
    share: "2）分享",
    copySummary: "复制摘要",
    downloadCard: "下载分享图卡 PNG",
    ai: "3）AI 夸奖 / 锐评",
    mode: "模式",
    roast: "锐评",
    praise: "夸奖",
    level: "强度",
    mild: "温和",
    normal: "正常",
    savage: "狠一点",
    provider: "模型来源",
    key: "API Key（可选）",
    keyHint: "留空即使用站点默认 DeepSeek key",
    baseUrl: "Base URL（OpenAI 兼容）",
    model: "模型名",
    generate: "生成",
    running: "分析中...",
    aiOutput: "AI 输出",
    deepseekNote: "默认后端模型为 DeepSeek。其他模型需手动填写 API 配置。",
    aiProgress: "AI 分析进度",
    tutorial: "快速教程",
    t1: "导出数据：Letterboxd 设置 → Data → Export ZIP。",
    t2: "上传 ZIP 即可，无需登录，不落库，刷新即清空。",
    t3: "默认走站点 DeepSeek；若用 Gemini/GPT/豆包，请填写 provider + key（可加 baseUrl/model）。",
    t4: "选择 EN / 中文 / Українська，会同时切换界面和 AI 输出语言。",
    extraStats: "影迷爽点板块",
    recBoard: "AI 推荐钩子",
    github: "项目 GitHub",
    loading1: "正在构建全量观影档案...",
    loading2: "正在从每一部影片提取偏好模式...",
    loading3: "正在生成直接、不水的个人评价...",
    loading4: "正在润色最终结果..."
  },
  uk: {
    title: "Letterboxd AI Огляд",
    subtitle: "Локальний аналіз ZIP + DeepSeek за замовчуванням",
    reset: "Скинути",
    importTitle: "1) Імпорт",
    uploadHint: "Завантажте ZIP-експорт Letterboxd",
    localOnly: "Усе обробляється локально в браузері. Оновлення сторінки очищує дані.",
    label: "Підпис на картці",
    language: "Мова",
    merged: "унікальних фільмів об'єднано",
    watchedDates: "дат перегляду",
    reviewSamples: "текстів відгуків",
    watched: "Переглянуто",
    rated: "Оцінено",
    mean: "Середня",
    streak: "Серія",
    quickFacts: "Ключові факти",
    unrated: "Переглянуто без оцінки",
    commitment: "Індекс залучення",
    volatility: "Волатильність смаку",
    noData: "Немає даних",
    share: "2) Поділитися",
    copySummary: "Копіювати підсумок",
    downloadCard: "Завантажити PNG-картку",
    ai: "3) AI Похвала / Рознос",
    mode: "Режим",
    roast: "Рознос",
    praise: "Похвала",
    level: "Інтенсивність",
    mild: "М'яко",
    normal: "Нормально",
    savage: "Жорстко",
    provider: "Провайдер",
    key: "API ключ (необов'язково)",
    keyHint: "Порожньо = ключ DeepSeek сайту",
    baseUrl: "Base URL (OpenAI-сумісний)",
    model: "Модель",
    generate: "Згенерувати",
    running: "Аналіз...",
    aiOutput: "Відповідь AI",
    deepseekNote: "Модель за замовчуванням: DeepSeek. Інші моделі — лише з вашим API.",
    aiProgress: "Прогрес AI-аналізу",
    tutorial: "Швидкий гайд",
    t1: "Експорт у Letterboxd: Settings → Data → Export ZIP.",
    t2: "Завантажте ZIP. Без логіну, без БД, refresh очищує все.",
    t3: "Типово DeepSeek; для Gemini/GPT/Doubao заповніть provider + key (+ baseUrl/model).",
    t4: "EN / 中文 / Українська перемикає і UI, і мову AI.",
    extraStats: "Панелі для кіноманів",
    recBoard: "AI рекомендації",
    github: "GitHub проєкту",
    loading1: "Формуємо повне досьє переглядів...",
    loading2: "Витягуємо патерни з кожного переглянутого фільму...",
    loading3: "Пишемо пряму, не шаблонну рецензію...",
    loading4: "Фінальне шліфування..."
  }
};

function ratingLabel(r: number): string { return String(r); }

function aiDossier(films: FilmRecord[], stats: StatPack) {
  const sorted = [...films].sort((a, b) => {
    const da = a.watchedDates[a.watchedDates.length - 1] || "0000-00-00";
    const db = b.watchedDates[b.watchedDates.length - 1] || "0000-00-00";
    return db.localeCompare(da);
  });
  const entries = sorted.map((f) => ({
    n: f.name,
    y: f.year,
    r: f.rating,
    w: f.watchedDates,
    rw: f.rewatchCount,
    rv: f.reviewTextSamples.slice(0, 1)
  }));

  return {
    totals: stats.totals,
    rating: stats.ratings,
    activity: stats.activity,
    release: stats.releaseYears,
    topWords: stats.text.topWords,
    films: entries
  };
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmRecord[] | null>(null);
  const [stats, setStats] = useState<StatPack | null>(null);
  const [mergeDebug, setMergeDebug] = useState<MergeDebugSummary | null>(null);
  const [label, setLabel] = useState<string>("");
  const [language, setLanguage] = useState<Lang>("en");
  const [mode, setMode] = useState<"praise" | "roast">("roast");
  const [roastLevel, setRoastLevel] = useState<1 | 2 | 3>(2);
  const [provider, setProvider] = useState<Provider>("default");
  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [aiText, setAiText] = useState<string>("");
  const [aiBusy, setAiBusy] = useState<boolean>(false);
  const [aiProgress, setAiProgress] = useState(0);

  const t = (k: string) => I18N[language][k] || k;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function onUploadZip(f: File) {
    setAiText("");
    setStats(null);
    setFilms(null);
    setFileName(f.name);
    setMergeDebug(null);
    try {
      const tables = await readLetterboxdExportZip(f);
      const merged = mergeTablesToMaster(tables);
      setFilms(merged.films);
      setMergeDebug(merged.debug);
      setStats(computeStats(merged.films, label));
      showToast("Import complete.");
    } catch {
      showToast("Import failed. Check ZIP format.");
    }
  }

  async function downloadShareCard() {
    const el = document.getElementById("shareCard");
    if (!el) return showToast("Share card not ready.");
    const canvas = await html2canvas(el as HTMLElement, { backgroundColor: null, scale: 2 });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "letterboxd-ai-card.png";
    a.click();
  }

  async function runAI() {
    if (!stats || !films) return;
    setAiBusy(true);
    setAiText("");
    setAiProgress(8);
    const id = window.setInterval(() => setAiProgress((p) => Math.min(p + 7, 92)), 700);
    try {
      const dossier = aiDossier(films, stats);
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
          model: model || undefined,
          language,
          mode,
          roastLevel,
          profile: dossier
        })
      });
      const data = (await res.json().catch(() => ({}))) as { text?: unknown; error?: unknown };
      if (!res.ok) {
        setAiText(typeof data.error === "string" ? data.error : "AI request failed.");
      } else {
        setAiText(typeof data.text === "string" ? data.text : "");
      }
    } catch {
      setAiText("AI request failed.");
    } finally {
      window.clearInterval(id);
      setAiProgress(100);
      window.setTimeout(() => setAiProgress(0), 1200);
      setAiBusy(false);
    }
  }

  const topDecades = stats?.releaseYears.decadeBuckets ? [...stats.releaseYears.decadeBuckets].sort((a, b) => b.count - a.count).slice(0, 8).map((d) => ({ label: d.decade, value: d.count })) : [];
  const topReleaseYears = stats?.releaseYears.top ? stats.releaseYears.top.map((y) => ({ label: String(y.year), value: y.count })) : [];
  const ratingHistogram = stats?.ratings.histogram ? stats.ratings.histogram.map((h) => ({ label: ratingLabel(h.rating), value: h.count })) : [];

  const altTasteBoard = useMemo(() => {
    if (!films || !stats) return [] as Array<{ label: string; value: string }>;
    const high = films.filter((f) => (f.rating ?? 0) >= 4).length;
    const low = films.filter((f) => (f.rating ?? 5) <= 2).length;
    const rewatchShare = stats.totals.filmsWatched ? Math.round((stats.totals.rewatchFilms / stats.totals.filmsWatched) * 100) : 0;
    const oldies = films.filter((f) => (f.year ?? 3000) < 1980).length;
    return [
      { label: "Exploration Index", value: `${Math.max(0, 100 - rewatchShare)} / 100` },
      { label: "Harshness", value: `${Math.round((low / Math.max(1, high + low)) * 100)}%` },
      { label: "Rewatch DNA", value: `${rewatchShare}%` },
      { label: "Classic pull", value: `${oldies} films pre-1980` },
      { label: "Unrated behavior", value: `${stats.totals.unratedWatched} unrated watched` },
    ];
  }, [films, stats]);

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <h1>🎬 {t("title")}</h1>
          <div className="sub">{t("subtitle")}</div>
        </div>
        <div className="row">
          <a className="badge" href="https://github.com/Erik0318/Letterboxd-AI-Review" target="_blank" rel="noreferrer">{t("github")}</a>
          <button className="btn danger" onClick={() => window.location.reload()}>{t("reset")}</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>{t("importTitle")}</h2>
          <div className="drop">
            <input type="file" accept=".zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUploadZip(f); }} />
            <div className="small">{fileName || t("uploadHint")}</div>
            <div className="small">{t("localOnly")}</div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div>
              <div className="small">{t("label")}</div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <div className="small">{t("language")}</div>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
                <option value="en">English</option>
                <option value="zh">中文</option>
                <option value="uk">Українська</option>
              </select>
            </div>
          </div>

          <div className="hr" />
          <h2>{t("tutorial")}</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>{t("t1")}</li><li>{t("t2")}</li><li>{t("t3")}</li><li>{t("t4")}</li>
          </ul>

          {films && <div className="row" style={{ marginTop: 10 }}>
            <span className="badge">{formatInt(films.length)} {t("merged")}</span>
            <span className="badge">{t("watchedDates")}: {formatInt(films.flatMap((f) => f.watchedDates).length)}</span>
            <span className="badge">{t("reviewSamples")}: {formatInt(films.flatMap((f) => f.reviewTextSamples).length)}</span>
          </div>}
          {mergeDebug && <div className="card" style={{ marginTop: 10 }}>
            <h2>Debug summary</h2>
            <div className="small">CSV detected: {mergeDebug.csvDetected.join(", ") || "none"}</div>
            <div className="small">Merged films: {formatInt(mergeDebug.mergedFilmCount)}</div>
            <div className="small">With watched_at: {formatPct(mergeDebug.percentWithWatchedAt)}</div>
            <div className="small">ratings merge hit: {formatPct(mergeDebug.ratingsMergeHitRate)}</div>
            <div className="small">reviews merge hit: {formatPct(mergeDebug.reviewsMergeHitRate)}</div>
            <div className="small">only in ratings/reviews: {formatInt(mergeDebug.onlyInRatingsOrReviews)}</div>
          </div>}

        </div>

        {stats && <>
          <div className="card span3"><h2>{t("watched")}</h2><div className="kpi"><div className="value">{formatInt(stats.totals.filmsWatched)}</div></div></div>
          <div className="card span3"><h2>{t("rated")}</h2><div className="kpi"><div className="value">{formatInt(stats.totals.filmsRated)}</div></div></div>
          <div className="card span3"><h2>{t("mean")}</h2><div className="kpi"><div className="value">{stats.ratings.mean === null ? "n/a" : round1(stats.ratings.mean)}</div></div></div>
          <div className="card span3"><h2>{t("streak")}</h2><div className="kpi"><div className="value">{formatInt(stats.activity.longestStreakDays)}</div></div></div>

          <div className="card span6">
            <h2>{t("quickFacts")}</h2>
            <div className="row" style={{ alignItems: "stretch" }}>
              <div className="kpi" style={{ flex: 1 }}><div className="label">{t("unrated")}</div><div className="value">{formatInt(stats.totals.unratedWatched)}</div></div>
              <div className="kpi" style={{ flex: 1 }}><div className="label">{t("commitment")}</div><div className="value">{formatPct(stats.fun.commitmentIndex)}</div></div>
              <div className="kpi" style={{ flex: 1 }}><div className="label">{t("volatility")}</div><div className="value">{stats.fun.tasteVolatilityIndex === null ? "n/a" : round1(stats.fun.tasteVolatilityIndex)}</div></div>
            </div>
          </div>

          <div className="card span6">
            <h2>{t("extraStats")}</h2>
            <div className="row">
              {altTasteBoard.map((x) => <div className="badge" key={x.label}>{x.label}: {x.value}</div>)}
            </div>
          </div>

          <div className="span6"><BarList title="Rating histogram" items={ratingHistogram} emptyText={t("noData")} /></div>
          <div className="span6"><Heatmap byMonth={stats.activity.byMonth} /></div>
          <div className="span6"><BarList title="Top release years" items={topReleaseYears} emptyText={t("noData")} /></div>
          <div className="span6"><BarList title="Top decades" items={topDecades} emptyText={t("noData")} /></div>

          <div className="card">
            <h2>{t("share")}</h2>
            <div className="row">
              <button className="btn primary" onClick={async () => { await navigator.clipboard.writeText(stats.shareText.long); showToast("Copied"); }}>{t("copySummary")}</button>
              <button className="btn primary" onClick={downloadShareCard}>{t("downloadCard")}</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <ShareCard
                stats={stats}
                label={label}
                labels={{ generated: "Generated", badge: "Badge", watched: t("watched"), rated: t("rated"), meanRating: "Mean", median: "Median", longestStreak: "Streak", commitment: t("commitment"), topWords: "Top words", oneLine: "One line", na: "n/a", titleSuffix: "taste report" }}
              />
            </div>
          </div>

          <div className="card">
            <h2>{t("ai")}</h2>
            <div className="row">
              <div><div className="small">{t("mode")}</div><select value={mode} onChange={(e) => setMode(e.target.value as any)}><option value="roast">{t("roast")}</option><option value="praise">{t("praise")}</option></select></div>
              <div><div className="small">{t("level")}</div><select value={roastLevel} onChange={(e) => setRoastLevel(Number(e.target.value) as any)}><option value={1}>{t("mild")}</option><option value={2}>{t("normal")}</option><option value={3}>{t("savage")}</option></select></div>
              <div><div className="small">{t("provider")}</div><select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}><option value="default">Default (DeepSeek)</option><option value="openai_compat">DeepSeek / GPT / Doubao</option><option value="gemini">Gemini</option></select></div>
              <div style={{ flex: 1, minWidth: 220 }}><div className="small">{t("key")}</div><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={t("keyHint")} /></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div style={{ flex: 1, minWidth: 220 }}><div className="small">{t("baseUrl")}</div><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com" /></div>
              <div style={{ flex: 1, minWidth: 220 }}><div className="small">{t("model")}</div><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" /></div>
              <button className="btn primary" onClick={runAI} disabled={aiBusy}>{aiBusy ? t("running") : t("generate")}</button>
            </div>
            <p className="small" style={{ marginTop: 10 }}>{t("deepseekNote")}</p>

            {aiBusy && <div className="kpi" style={{ marginTop: 10 }}>
              <div className="label">{t("aiProgress")}</div>
              <div className="bar" style={{ height: 14, marginTop: 8 }}><div style={{ width: `${aiProgress}%` }} /></div>
              <div className="small" style={{ marginTop: 6 }}>{aiProgress < 30 ? t("loading1") : aiProgress < 60 ? t("loading2") : aiProgress < 85 ? t("loading3") : t("loading4")}</div>
            </div>}

            {aiText && <div className="card" style={{ marginTop: 12 }}><h2>{t("aiOutput")}</h2><pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", color: "var(--text)" }}>{aiText}</pre></div>}
          </div>
        </>}
      </div>

      <Toast text={toast} />
    </div>
  );
}
