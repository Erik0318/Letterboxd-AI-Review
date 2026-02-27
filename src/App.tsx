import React, { useMemo, useState } from "react";
import html2canvas from "html2canvas";
import Toast from "./components/Toast";
import { Heatmap } from "./components/Heatmap";
import { RadarChart } from "./components/RadarChart";
import { LineChart } from "./components/LineChart";
import ShareCard from "./components/ShareCard";
import { readLetterboxdExportZip, mergeTablesToFilms, FilmRecord } from "./lib/letterboxd";
import { computeStats, selectRange, StatPack, TimeRange } from "./lib/stats";
import { formatInt, round1 } from "./lib/utils";

type Provider = "default" | "openai_compat" | "gemini";

function aiDossier(films: FilmRecord[], stats: StatPack) {
  return {
    totals: stats.totals,
    activity: stats.activity,
    ratings: stats.ratings,
    radar: stats.radar,
    anomaly: stats.anomalies,
    date_policy: "Use watched_at timeline only. Never use imported_at as viewing timeline.",
    films: films.map((f) => ({
      film_id: f.film_id,
      title: f.name,
      year: f.year,
      watched_dates: f.watched_at_dates,
      logged_dates: f.logged_at_dates,
      imported_at: f.imported_at,
      rating: f.rating,
      review_text: f.review_text,
      like: f.like
    }))
  };
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [stats, setStats] = useState<StatPack | null>(null);
  const [films, setFilms] = useState<FilmRecord[] | null>(null);
  const [label, setLabel] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("12m");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const [provider, setProvider] = useState<Provider>("default");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2000); }

  async function onUploadZip(file: File) {
    setFileName(file.name);
    const tables = await readLetterboxdExportZip(file);
    const merged = mergeTablesToFilms(tables);
    setFilms(merged);
    setStats(computeStats(merged, label));
    showToast("导入完成");
  }

  async function runAI() {
    if (!films || !stats) return;
    setAiBusy(true);
    setAiText("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined, model: model || undefined, language: "zh", profile: aiDossier(films, stats), mode: "roast", roastLevel: 2 })
      });
      const data = (await res.json().catch(() => ({}))) as { text?: unknown; error?: unknown };
      setAiText(String(data.text || data.error || "AI 请求失败"));
    } finally {
      setAiBusy(false);
    }
  }

  async function downloadShareCard() {
    const el = document.getElementById("shareCard");
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "letterboxd-ai-card.png";
    a.click();
  }

  const ratingSeries = useMemo(() => stats ? selectRange(stats.activity.ratingTrendByMonth, range) : [], [stats, range]);
  const watchedSeries = useMemo(() => stats ? selectRange(stats.activity.watchedTrendByMonth, range) : [], [stats, range]);

  const monthFilms = useMemo(() => {
    if (!films || !selectedMonth) return [];
    return films.filter((f) => f.watched_at_dates.some((d) => d.startsWith(selectedMonth)) || (f.watched_at_dates.length === 0 && f.logged_at_dates.some((d) => d.startsWith(selectedMonth)))).slice(0, 40);
  }, [films, selectedMonth]);

  return (
    <div className="container">
      <div className="topbar"><h1>Letterboxd AI Review</h1><button className="btn danger" onClick={() => window.location.reload()}>重置</button></div>
      <div className="grid">
        <div className="card">
          <h2>1 导入 ZIP</h2>
          <input type="file" accept=".zip" onChange={(e) => e.target.files?.[0] && void onUploadZip(e.target.files[0])} />
          <div className="small">{fileName || "上传 Letterboxd 导出 ZIP"}</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="标签（可选）" />
          {films && <div className="row"><span className="badge">合并影片 {films.length}</span><span className="badge">master table 已构建</span></div>}
        </div>

        {stats && <>
          <div className="card span3"><h2>看过</h2><div className="value">{formatInt(stats.totals.filmsWatched)}</div></div>
          <div className="card span3"><h2>已评分</h2><div className="value">{formatInt(stats.totals.filmsRated)}</div></div>
          <div className="card span3"><h2>均分</h2><div className="value">{stats.ratings.mean ? round1(stats.ratings.mean) : "n/a"}</div></div>
          <div className="card span3"><h2>最长连看</h2><div className="value">{stats.activity.longestStreakDays}</div></div>

          {stats.extraCards.slice(0, 8).map((c) => (
            <div className="card span3" key={c.label}><h2>{c.label}</h2><div className="value" style={{ fontSize: 18 }}>{c.value}</div></div>
          ))}

          <div className="span6"><RadarChart items={stats.radar} /></div>
          <div className="card span6">
            <h2>趋势范围</h2>
            <div className="row">
              <button className="btn" onClick={() => setRange("12m")}>近12个月</button>
              <button className="btn" onClick={() => setRange("24m")}>近24个月</button>
              <button className="btn" onClick={() => setRange("all")}>全时间</button>
            </div>
            <div className="small">观影时间轴默认使用 {stats.activity.dateSourceLabel}{stats.activity.usingLoggedFallback ? "（部分日期缺失，使用日志日期估算）" : ""}</div>
          </div>

          <div className="span6"><LineChart title="评分随时间趋势" series={ratingSeries} color="#8aa0ff" /></div>
          <div className="span6"><LineChart title="观影数量随时间趋势" series={watchedSeries} /></div>

          <div className="span6"><Heatmap byMonth={stats.activity.byMonth} onSelectMonth={setSelectedMonth} activeMonth={selectedMonth} title="年 x 月观影热力图" /></div>
          <div className="card span6">
            <h2>月份筛选结果 {selectedMonth || "(未选择)"}</h2>
            <div className="small">点击热力图月份即可筛选列表</div>
            <ul>
              {monthFilms.map((f) => <li key={f.film_id}>{f.name} {f.year || ""} / 评分 {f.rating ?? "n/a"}</li>)}
            </ul>
          </div>

          <div className="card span6">
            <h2>导入异常检测</h2>
            <div className="badge">import_spike_detected: {String(stats.anomalies.import_spike_detected)}</div>
            <div className="badge">largest_single_day_import_count: {stats.anomalies.largest_single_day_import_count}</div>
            <div className="badge">percent_with_watched_dates: {stats.anomalies.percent_with_watched_dates}%</div>
            <div className="badge">watched_date_span_years: {stats.anomalies.watched_date_span_years}</div>
            <div className="badge">diary_entry_span_years: {stats.anomalies.diary_entry_span_years}</div>
          </div>

          <div className="card span6">
            <h2>AI 评论</h2>
            <p className="small">免费用户每天用两次。AI 不会使用 imported_at 当作观影时间线，也不会输出 markdown 排版语言。</p>
            <div className="row">
              <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}><option value="default">Default</option><option value="openai_compat">OpenAI Compatible</option><option value="gemini">Gemini</option></select>
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key" />
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL" />
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" />
              <button className="btn primary" onClick={runAI} disabled={aiBusy}>{aiBusy ? "生成中" : "生成"}</button>
            </div>
            {aiText && <pre style={{ whiteSpace: "pre-wrap" }}>{aiText}</pre>}
          </div>

          <div className="card">
            <h2>分享</h2>
            <button className="btn primary" onClick={downloadShareCard}>下载图卡</button>
            <ShareCard stats={stats} label={label} labels={{ generated: "生成于", badge: "标签", watched: "看过", rated: "评分", meanRating: "均分", median: "中位数", longestStreak: "连看", commitment: "投入度", topWords: "高频词", oneLine: "一句话", na: "n/a", titleSuffix: "观影报告" }} />
          </div>
        </>}
      </div>
      <Toast text={toast} />
    </div>
  );
}
