import React, { useMemo, useState } from "react";
import html2canvas from "html2canvas";
import Toast from "./components/Toast";
import { readLetterboxdExportZip, mergeTablesToFilms, FilmRecord, MergeDebug } from "./lib/letterboxd";
import { computeStats, StatPack } from "./lib/stats";
import { Heatmap } from "./components/Heatmap";
import ShareCard from "./components/ShareCard";
import { formatInt, round1 } from "./lib/utils";

type Provider = "default" | "openai_compat" | "gemini";

type Lang = "en" | "zh" | "uk";

function aiDossier(films: FilmRecord[], stats: StatPack, debug: MergeDebug | null) {
  return {
    hardRules: {
      useMasterTableOnly: true,
      noImportDateForPace: true,
      ifSpikeUseWatchedAtOrLoggedAtOnly: true,
      importSpikeDetected: stats.anomaly.importSpikeDetected,
    },
    anomaly: stats.anomaly,
    debug,
    totals: stats.totals,
    cards: stats.cards,
    radar: stats.radar,
    trend: stats.trends,
    films: films.slice(0, 500).map((f) => ({
      film_id: f.film_id,
      name: f.name,
      year: f.year,
      watched: f.watched,
      rating: f.rating,
      watched_at: f.watched_at,
      logged_at: f.logged_at,
      watch_dates: f.watch_dates,
      review_text: f.review_text.slice(0, 2),
    }))
  };
}

function Radar({ data }: { data: Array<{ axis: string; value: number }> }) {
  const r = 90;
  const cx = 120;
  const cy = 120;
  const points = data.map((d, i) => {
    const a = (Math.PI * 2 * i) / data.length - Math.PI / 2;
    const rr = (d.value / 100) * r;
    return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
  }).join(" ");
  return <div className="card"><h2>Taste Radar</h2><svg width="240" height="240"><polygon points={points} fill="rgba(85,214,190,.3)" stroke="#55d6be" />{data.map((d, i) => { const a = (Math.PI * 2 * i) / data.length - Math.PI / 2; return <text key={d.axis} x={cx + Math.cos(a) * 110} y={cy + Math.sin(a) * 110} fontSize="10" fill="#dce4ea" textAnchor="middle">{d.axis}</text>; })}</svg></div>;
}

function TrendLine({ title, points, valueKey }: { title: string; points: any[]; valueKey: string }) {
  const max = Math.max(1, ...points.map((p) => p[valueKey] || 0));
  const poly = points.map((p, i) => `${(i / Math.max(1, points.length - 1)) * 220},${100 - ((p[valueKey] || 0) / max) * 90}`).join(" ");
  return <div className="card"><h2>{title}</h2><svg width="240" height="110"><polyline points={poly} fill="none" stroke="#55d6be" strokeWidth="2" /></svg></div>;
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmRecord[] | null>(null);
  const [stats, setStats] = useState<StatPack | null>(null);
  const [debug, setDebug] = useState<MergeDebug | null>(null);
  const [label, setLabel] = useState<string>("");
  const [language, setLanguage] = useState<Lang>("en");
  const [debugMode, setDebugMode] = useState(false);
  const [windowSize, setWindowSize] = useState<"12m"|"24m"|"all">("12m");
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [mode, setMode] = useState<"praise" | "roast">("roast");
  const [roastLevel, setRoastLevel] = useState<1 | 2 | 3>(2);
  const [provider, setProvider] = useState<Provider>("default");
  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [aiText, setAiText] = useState<string>("");

  async function onUploadZip(f: File) {
    try {
      const tables = await readLetterboxdExportZip(f);
      const merged = mergeTablesToFilms(tables);
      setFileName(f.name);
      setFilms(merged.films);
      setDebug(merged.debug);
      setStats(computeStats(merged.films, label));
      setToast("Import complete");
      setTimeout(() => setToast(null), 1800);
    } catch {
      setToast("Import failed");
    }
  }

  const trendData = useMemo(() => {
    if (!stats) return { c: [], r: [] as any[] };
    const counts = stats.trends.monthlyCount;
    const ratings = stats.trends.monthlyAvgRating.map((x) => ({ ...x, avgRating: x.avgRating || 0 }));
    const size = windowSize === "12m" ? 12 : windowSize === "24m" ? 24 : counts.length;
    return { c: counts.slice(-size), r: ratings.slice(-size) };
  }, [stats, windowSize]);

  async function runAI() {
    if (!stats || !films) return;
    const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined, model: model || undefined, language, mode, roastLevel, profile: aiDossier(films, stats, debug) }) });
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    setAiText(data.text || data.error || "AI failed");
  }

  async function downloadShareCard() {
    const el = document.getElementById("shareCard");
    if (!el) return;
    const canvas = await html2canvas(el as HTMLElement, { backgroundColor: null, scale: 2 });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "letterboxd-ai-card.png";
    a.click();
  }

  const monthFilms = (films || []).filter((f) => !monthFilter || f.watch_dates.some((d) => d.startsWith(monthFilter)));

  return <div className="container">
    <h1>Letterboxd AI Review</h1>
    <p>Free users can run AI two times per day.</p>
    <div className="card">
      <input type="file" accept=".zip" onChange={(e) => e.target.files?.[0] && void onUploadZip(e.target.files[0])} />
      <div className="small">{fileName || "Upload Letterboxd zip"}</div>
      <div className="row"><input placeholder="Label" value={label} onChange={(e)=>setLabel(e.target.value)} /><select value={language} onChange={(e)=>setLanguage(e.target.value as Lang)}><option value="en">English</option><option value="zh">中文</option><option value="uk">Українська</option></select><label><input type="checkbox" checked={debugMode} onChange={(e)=>setDebugMode(e.target.checked)} /> Developer mode</label></div>
    </div>

    {stats && <>
      <div className="grid">
        <div className="card"><h2>Watched</h2><div className="value">{formatInt(stats.totals.filmsWatched)}</div></div>
        <div className="card"><h2>Rated</h2><div className="value">{formatInt(stats.totals.filmsRated)}</div></div>
        <div className="card"><h2>Mean</h2><div className="value">{stats.totals.ratingMean ? round1(stats.totals.ratingMean) : "n/a"}</div></div>
      </div>
      <div className="card"><h2>New Metrics</h2><div className="row">{stats.cards.map((c) => <span key={c.label} className="badge" title={c.calc}>{c.label}: {c.value}</span>)}</div></div>
      <Radar data={stats.radar} />
      <div className="row"><button className="btn" onClick={()=>setWindowSize("12m")}>12m</button><button className="btn" onClick={()=>setWindowSize("24m")}>24m</button><button className="btn" onClick={()=>setWindowSize("all")}>All</button></div>
      <div className="grid"><TrendLine title="Monthly watch trend" points={trendData.c} valueKey="count" /><TrendLine title="Monthly average rating trend" points={trendData.r} valueKey="avgRating" /></div>
      <Heatmap byMonth={stats.heatmap} title="Year x month heatmap" onMonthClick={setMonthFilter} selectedMonth={monthFilter} />
      {monthFilter && <div className="card"><h2>Filtered films {monthFilter}</h2><div className="small">{monthFilms.slice(0, 20).map((f) => f.name).join(", ") || "No films"}</div></div>}

      {debugMode && debug && <div className="card"><h2>Debug summary</h2>
        <div className="small">CSV detected: {debug.csvDetected.join(", ")}</div>
        <div className="small">Merged films: {debug.mergedFilmCount}</div>
        <div className="small">With watched_at: {Math.round(debug.percentWithWatchedAt * 100)}%</div>
        <div className="small">ratings merge hit: {Math.round(debug.ratingsMergeHitRate * 100)}%</div>
        <div className="small">reviews merge hit: {Math.round(debug.reviewsMergeHitRate * 100)}%</div>
        <div className="small">only in ratings/reviews: {debug.onlyInRatingsOrReviews}</div>
        <div className="small">import spike: {String(stats.anomaly.importSpikeDetected)} {stats.anomaly.importSpikeDay || ""} x {stats.anomaly.largestSingleDayImportCount}</div>
      </div>}

      <div className="card"><h2>AI</h2><div className="row"><select value={mode} onChange={(e)=>setMode(e.target.value as any)}><option value="roast">roast</option><option value="praise">praise</option></select><select value={roastLevel} onChange={(e)=>setRoastLevel(Number(e.target.value) as any)}><option value={1}>mild</option><option value={2}>normal</option><option value={3}>savage</option></select><select value={provider} onChange={(e)=>setProvider(e.target.value as Provider)}><option value="default">default deepseek</option><option value="openai_compat">openai compat</option><option value="gemini">gemini</option></select><input placeholder="apiKey" value={apiKey} onChange={(e)=>setApiKey(e.target.value)} /><input placeholder="baseUrl" value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)} /><input placeholder="model" value={model} onChange={(e)=>setModel(e.target.value)} /><button className="btn primary" onClick={runAI}>Generate</button></div>
      {aiText && <pre style={{whiteSpace:"pre-wrap"}}>{aiText}</pre>}</div>

      <div className="card"><button className="btn" onClick={downloadShareCard}>Download card</button><ShareCard stats={stats as any} label={label} labels={{ generated: "Generated", badge: "Badge", watched: "Watched", rated: "Rated", meanRating: "Mean", median: "Median", longestStreak: "Streak", commitment: "Commitment", topWords: "Top", oneLine: "One line", na: "n/a", titleSuffix: "report" }} /></div>
    </>}
    <Toast text={toast} />
  </div>;
}
