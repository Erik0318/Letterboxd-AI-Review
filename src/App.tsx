import React, { useMemo, useState } from "react";
import html2canvas from "html2canvas";
import Toast from "./components/Toast";
import { readLetterboxdExportZip, mergeTablesToFilms, FilmRecord } from "./lib/letterboxd";
import { computeStats, StatPack, TrendPoint } from "./lib/stats";
import { BarList } from "./components/BarList";
import { Heatmap } from "./components/Heatmap";
import ShareCard from "./components/ShareCard";
import { formatInt, formatPct, round1 } from "./lib/utils";
import { RadarChart } from "./components/RadarChart";
import { LineChart } from "./components/LineChart";

type Provider = "default" | "openai_compat" | "gemini";
type Lang = "en" | "zh" | "uk";
type TrendRange = "12" | "24" | "all";

const LANG_LABEL: Record<Lang, string> = { en: "English", zh: "中文", uk: "Українська" };

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmRecord[] | null>(null);
  const [stats, setStats] = useState<StatPack | null>(null);
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
  const [trendRange, setTrendRange] = useState<TrendRange>("24");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function onUploadZip(f: File) {
    setAiText("");
    setStats(null);
    setFilms(null);
    setFileName(f.name);
    try {
      const tables = await readLetterboxdExportZip(f);
      const merged = mergeTablesToFilms(tables);
      setFilms(merged);
      setStats(computeStats(merged, label));
      showToast("Import complete.");
    } catch {
      showToast("Import failed. Check ZIP format.");
    }
  }

  async function runAI() {
    if (!stats || !films) return;
    setAiBusy(true);
    setAiText("");
    setAiProgress(7);
    const id = window.setInterval(() => setAiProgress((p) => Math.min(92, p + 8)), 600);
    const profile = {
      master_table_summary: {
        film_count: films.length,
        with_watched_at: films.filter((f) => f.watchedAtDates.length > 0).length,
        with_logged_at_only: films.filter((f) => !f.watchedAtDates.length && f.loggedAtDates.length > 0).length
      },
      metrics: stats,
      timeline_basis: "watched_at first, fallback logged_at, never imported_at"
    };

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
          profile
        })
      });
      const data = (await res.json().catch(() => ({}))) as { text?: unknown; error?: unknown };
      if (!res.ok) setAiText(typeof data.error === "string" ? data.error : "AI request failed.");
      else setAiText(typeof data.text === "string" ? data.text : "");
    } catch {
      setAiText("AI request failed.");
    } finally {
      window.clearInterval(id);
      setAiProgress(100);
      setTimeout(() => setAiProgress(0), 800);
      setAiBusy(false);
    }
  }

  async function downloadShareCard() {
    const el = document.getElementById("shareCard");
    if (!el) return;
    const canvas = await html2canvas(el as HTMLElement, { backgroundColor: null, scale: 2 });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "letterboxd-card.png";
    a.click();
  }

  const trendPoints: TrendPoint[] = useMemo(() => {
    if (!stats) return [];
    if (trendRange === "12") return stats.trends.recent12;
    if (trendRange === "24") return stats.trends.recent24;
    return stats.trends.timeline;
  }, [stats, trendRange]);

  const monthFilms = useMemo(() => {
    if (!films || !selectedMonth) return [] as FilmRecord[];
    return films.filter((f) => {
      const timelineDates = [...f.watchedAtDates, ...f.loggedAtDates];
      return timelineDates.some((d) => d.startsWith(selectedMonth));
    }).slice(0, 40);
  }, [films, selectedMonth]);

  const ratingHistogram = stats?.ratings.histogram.map((h) => ({ label: String(h.rating), value: h.count })) || [];
  const topYears = stats?.releaseYears.top.map((y) => ({ label: String(y.year), value: y.count })) || [];
  const topDecades = stats?.releaseYears.decadeBuckets.slice(0, 8).map((d) => ({ label: d.decade, value: d.count })) || [];

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <h1>🎬 Letterboxd AI Review</h1>
          <div className="sub">DeepSeek default • master-table based analytics • no DB</div>
        </div>
        <div className="row">
          <a className="badge" href="https://github.com/Erik0318/Letterboxd-AI-Review" target="_blank" rel="noreferrer">GitHub</a>
          <button className="btn danger" onClick={() => window.location.reload()}>Reset</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>1) Import ZIP</h2>
          <div className="drop">
            <input type="file" accept=".zip" onChange={(e) => e.target.files?.[0] && onUploadZip(e.target.files[0])} />
            <div className="small">{fileName || "Upload your Letterboxd export ZIP."}</div>
            <div className="small">All parsing runs locally. We merge all CSVs into one canonical master table first.</div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div>
              <div className="small">Label on share card</div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <div className="small">Language</div>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
                <option value="en">{LANG_LABEL.en}</option>
                <option value="zh">{LANG_LABEL.zh}</option>
                <option value="uk">{LANG_LABEL.uk}</option>
              </select>
            </div>
          </div>
        </div>

        {stats && (
          <>
            <div className="card span3"><h2>Watched</h2><div className="kpi"><div className="value">{formatInt(stats.totals.filmsWatched)}</div></div></div>
            <div className="card span3"><h2>Rated</h2><div className="kpi"><div className="value">{formatInt(stats.totals.filmsRated)}</div></div></div>
            <div className="card span3"><h2>Mean</h2><div className="kpi"><div className="value">{stats.ratings.mean === null ? "n/a" : round1(stats.ratings.mean)}</div></div></div>
            <div className="card span3"><h2>Longest streak</h2><div className="kpi"><div className="value">{stats.activity.longestStreakDays}</div></div></div>

            <div className="card span6">
              <h2>New metrics cards</h2>
              <div className="row">
                <span className="badge">Unrated share: {formatPct(stats.totals.unratedWatched / Math.max(1, stats.totals.filmsWatched))}</span>
                <span className="badge">Most given rating: {stats.ratings.mode ?? "n/a"}</span>
                <span className="badge">Indecisive band (2.5/3.0): {formatPct(stats.ratings.indecisiveShare)}</span>
                <span className="badge">Exploration index: {formatPct(stats.releaseYears.explorationIndex)}</span>
                <span className="badge">Comfort-zone return: {formatPct(stats.releaseYears.comfortZoneReturnRate)}</span>
                <span className="badge">Review persona: {stats.text.persona.type}</span>
                <span className="badge">Expression intensity: {formatPct(stats.text.expressionIntensity)}</span>
                <span className="badge">Top 3 streaks: {stats.activity.topStreaks.map((s) => `${s.days}d`).join(" / ") || "n/a"}</span>
              </div>
              <p className="small">Persona reason: {stats.text.persona.reason}</p>
            </div>

            <div className="span6">
              <RadarChart title="Taste Radar (0-100)" metrics={stats.radar.map((r) => ({ label: r.label, value: r.value }))} />
            </div>

            <div className="card span6">
              <h2>Trend range</h2>
              <div className="row">
                <button className="btn" onClick={() => setTrendRange("12")}>Last 12m</button>
                <button className="btn" onClick={() => setTrendRange("24")}>Last 24m</button>
                <button className="btn" onClick={() => setTrendRange("all")}>All time</button>
              </div>
              <p className="small">All timeline charts use watched_at first; fallback to logged_at only if watched_at is missing.</p>
              {stats.activity.usedLoggedFallback && <p className="small">⚠️ Some watched_at are missing; part of timeline uses logged_at estimates.</p>}
            </div>
          </div>

            <div className="span6"><LineChart title="Watch count trend" points={trendPoints} yLabel="Watched films" valueKey="watched" /></div>
            <div className="span6"><LineChart title="Rating trend" points={trendPoints} yLabel="Average rating" valueKey="meanRating" /></div>

            <div className="span6">
              <Heatmap byMonth={stats.activity.byMonth} selectedMonth={selectedMonth} onSelectMonth={(m) => setSelectedMonth((v) => (v === m ? null : m))} />
            </div>
            <div className="card span6">
              <h2>Selected month films {selectedMonth ? `(${selectedMonth})` : ""}</h2>
              {selectedMonth ? (
                monthFilms.length ? <div className="row">{monthFilms.map((f) => <span className="badge" key={f.filmId}>{f.title} {f.rating ? `(${f.rating})` : ""}</span>)}</div> : <p>No films in this month.</p>
              ) : <p>Click heatmap month cells to filter.</p>}
            </div>

            <div className="span6"><BarList title="Rating histogram" items={ratingHistogram} /></div>
            <div className="span6"><BarList title="Top release years" items={topYears} /></div>
            <div className="span6"><BarList title="Top decades" items={topDecades} /></div>

            <div className="card span6">
              <h2>Import anomaly detection</h2>
              <div className="row">
                <span className="badge">import_spike_detected: {String(stats.anomaly.importSpikeDetected)}</span>
                <span className="badge">largest_single_day_import_count: {stats.anomaly.largestSingleDayImportCount}</span>
                <span className="badge">percent_with_watched_dates: {formatPct(stats.anomaly.percentWithWatchedDates)}</span>
                <span className="badge">watched_date_span_years: {stats.anomaly.watchedDateSpanYears}</span>
                <span className="badge">diary_entry_span_years: {stats.anomaly.diaryEntrySpanYears}</span>
              </div>
              <p className="small">AI is instructed not to treat import-day spikes as real watch binges.</p>
            </div>

            <div className="card">
              <h2>2) Share</h2>
              <div className="row">
                <button className="btn primary" onClick={async () => { await navigator.clipboard.writeText(stats.shareText.long); showToast("Copied"); }}>Copy summary</button>
                <button className="btn primary" onClick={downloadShareCard}>Download card PNG</button>
              </div>
              <div style={{ marginTop: 10 }}>
                <ShareCard stats={stats} label={label} labels={{ generated: "Generated", badge: "Badge", watched: "Watched", rated: "Rated", meanRating: "Mean", median: "Median", longestStreak: "Streak", commitment: "Commitment", topWords: "Top words", oneLine: "One line", na: "n/a", titleSuffix: "taste report" }} />
              </div>
            </div>
            <p className="small" style={{ marginTop: 10 }}>{t("deepseekNote")}</p>

            <div className="card">
              <h2>3) AI roast / praise</h2>
              <div className="row">
                <div><div className="small">Mode</div><select value={mode} onChange={(e) => setMode(e.target.value as any)}><option value="roast">Roast</option><option value="praise">Praise</option></select></div>
                <div><div className="small">Intensity</div><select value={roastLevel} onChange={(e) => setRoastLevel(Number(e.target.value) as any)}><option value={1}>Mild</option><option value={2}>Normal</option><option value={3}>Savage</option></select></div>
                <div><div className="small">Provider</div><select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}><option value="default">Default (DeepSeek)</option><option value="openai_compat">DeepSeek/GPT/Doubao</option><option value="gemini">Gemini</option></select></div>
                <div style={{ flex: 1, minWidth: 220 }}><div className="small">API key (optional)</div><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="empty = site default" /></div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL optional" style={{ minWidth: 220 }} />
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model optional" style={{ minWidth: 220 }} />
                <button className="btn primary" onClick={runAI} disabled={aiBusy}>{aiBusy ? "Running..." : "Generate"}</button>
              </div>
              <p className="small">Default backend model is DeepSeek. If you pick language above, AI output follows it.</p>
              {aiBusy && <div className="kpi"><div className="label">Analysis progress</div><div className="bar"><div style={{ width: `${aiProgress}%` }} /></div></div>}
              {aiText && <div className="card" style={{ marginTop: 12 }}><h2>AI output</h2><pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", color: "var(--text)" }}>{aiText}</pre></div>}
            </div>
          </>
        )}
      </div>
      <Toast text={toast} />
    </div>
  );
}
