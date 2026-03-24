import React, { useMemo, useState } from "react";
import html2canvas from "html2canvas";
import Toast from "./components/Toast";
import {
  DatasetSummary,
  FilmRecord,
  getBestTimelineDates,
  mergeTablesToFilms,
  readLetterboxdExportZip,
} from "./lib/letterboxd";
import { computeStats, StatPack } from "./lib/stats";
import { BarList } from "./components/BarList";
import { Heatmap } from "./components/Heatmap";
import ShareCard from "./components/ShareCard";
import { formatInt, formatPct, round1, round3 } from "./lib/utils";

type Provider = "default" | "openai_compat" | "gemini";
type Lang = "en" | "zh" | "uk";

function ratingLabel(rating: number): string {
  return String(rating);
}

function aiDossier(films: FilmRecord[], stats: StatPack, summary: DatasetSummary | null) {
  const entries = [...films]
    .sort((left, right) => (right.bestWatchedDate || "0000-00-00").localeCompare(left.bestWatchedDate || "0000-00-00"))
    .map((film) => ({
      name: film.name,
      year: film.year,
      currentRating: film.currentRating,
      loggedRating: film.loggedRating,
      bestRating: film.bestRating,
      bestWatchedDate: film.bestWatchedDate,
      exactWatchedDate: film.exactWatchedDate,
      estimatedWatchedDate: film.estimatedWatchedDate,
      sources: film.sourceFlags.tables,
      inWatchlist: film.inWatchlist,
      rewatchCount: film.rewatchCount,
      reviewSample: film.reviewTexts.slice(0, 1),
    }));

  return {
    overview: stats.overview,
    quickFacts: stats.quickFacts,
    ratings: stats.ratings,
    activity: stats.activity,
    releaseYears: stats.releaseYears,
    text: stats.text,
    shareCard: stats.shareCard,
    summary,
    films: entries,
  };
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmRecord[] | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [label, setLabel] = useState("");
  const [language, setLanguage] = useState<Lang>("en");
  const [mode, setMode] = useState<"praise" | "roast">("roast");
  const [roastLevel, setRoastLevel] = useState<1 | 2 | 3>(2);
  const [provider, setProvider] = useState<Provider>("default");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  const stats = useMemo(
    () => (films && datasetSummary ? computeStats(films, datasetSummary, label) : null),
    [films, datasetSummary, label],
  );

  const ratingHistogram = stats
    ? stats.ratings.current.histogram.map((item) => ({ label: ratingLabel(item.rating), value: item.count }))
    : [];
  const topReleaseYears = stats
    ? stats.releaseYears.watchedFilms.topYears.map((item) => ({ label: String(item.year), value: item.count }))
    : [];
  const topDecades = stats
    ? [...stats.releaseYears.watchedFilms.decadeBuckets]
      .sort((left, right) => right.count - left.count)
      .slice(0, 8)
      .map((item) => ({ label: item.decade, value: item.count }))
    : [];

  const quickFacts = useMemo(() => {
    if (!stats) {
      return [] as Array<{ label: string; value: string }>;
    }
    return [
      {
        label: "Watch entries",
        value: `${formatInt(stats.overview.watchEntries.value)} (${formatInt(stats.overview.watchEntries.exactEntries)} exact / ${formatInt(stats.overview.watchEntries.estimatedEntries)} estimated)`,
      },
      { label: "Unrated watched films", value: formatInt(stats.quickFacts.unratedWatchedFilmsWithoutCurrentRating.value) },
      { label: "Logged-rated films", value: formatInt(stats.quickFacts.loggedRatedFilms.value) },
      { label: "Review rows", value: formatInt(stats.quickFacts.reviewRows.value) },
      { label: "Watchlist films", value: formatInt(stats.quickFacts.watchlistFilms.value) },
      { label: "Commitment", value: formatPct(stats.quickFacts.commitmentIndex.value) },
      { label: "Current volatility", value: stats.quickFacts.currentRatingStddev.value === null ? "n/a" : String(round1(stats.quickFacts.currentRatingStddev.value)) },
    ];
  }, [stats]);

  const coverageFacts = useMemo(() => {
    if (!datasetSummary) {
      return [] as Array<{ label: string; value: string }>;
    }
    return [
      {
        label: "Exact dated films",
        value: `${formatInt(datasetSummary.dateQualitySummary.filmsWithExactDate)} / ${formatInt(datasetSummary.coverageSummary.watchedUniverseFilmCount)}`,
      },
      { label: "Estimated-only films", value: formatInt(datasetSummary.dateQualitySummary.filmsWithEstimatedOnly) },
      { label: "Current+logged overlap", value: formatInt(datasetSummary.ratingSourceSummary.both) },
      { label: "Changed current vs logged", value: formatInt(datasetSummary.ratingSourceSummary.changed) },
      {
        label: "Top import day",
        value: datasetSummary.importSpikeSummary.largestSingleDayImportDate
          ? `${datasetSummary.importSpikeSummary.largestSingleDayImportDate} (${formatInt(datasetSummary.importSpikeSummary.largestSingleDayImportCount)})`
          : "n/a",
      },
      {
        label: "Lists / archived",
        value: `${formatInt(datasetSummary.listSummary.activeListCount)} / ${formatInt(datasetSummary.listSummary.archivedListCount)}`,
      },
    ];
  }, [datasetSummary]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function importZip(input: Blob | ArrayBuffer, sourceName: string) {
    setAiText("");
    setFilms(null);
    setDatasetSummary(null);
    setFileName(sourceName);
    try {
      const tables = await readLetterboxdExportZip(input);
      const merged = mergeTablesToFilms(tables);
      setFilms(merged.films);
      setDatasetSummary(merged.summary);
      showToast("Import complete.");
    } catch {
      showToast("Import failed. Check ZIP format.");
    }
  }

  async function onUploadZip(file: File) {
    await importZip(file, file.name);
  }

  async function onLoadSample() {
    try {
      const res = await fetch("/sample_data.zip", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("sample_data.zip not found");
      }
      const buffer = await res.arrayBuffer();
      await importZip(buffer, "sample_data.zip");
    } catch {
      showToast("Failed to load sample_data.zip");
    }
  }

  async function downloadShareCard() {
    const el = document.getElementById("shareCard");
    if (!el) {
      return showToast("Share card not ready.");
    }
    const canvas = await html2canvas(el as HTMLElement, { backgroundColor: null, scale: 2 });
    const url = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "letterboxd-ai-card.png";
    anchor.click();
  }

  async function runAI() {
    if (!stats || !films) return;
    setAiBusy(true);
    setAiText("");
    setAiProgress(8);
    const id = window.setInterval(() => setAiProgress((value) => Math.min(value + 7, 92)), 700);
    try {
      const dossier = aiDossier(films, stats, datasetSummary);
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
          profile: dossier,
        }),
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

  const exactEntries = stats?.overview.watchEntries.exactEntries || 0;
  const estimatedEntries = stats?.overview.watchEntries.estimatedEntries || 0;
  const debugJson = datasetSummary ? JSON.stringify(datasetSummary, null, 2) : "";
  const sampleTimeline = films ? films.slice(0, 3).map((film) => ({ film: film.name, timeline: getBestTimelineDates(film) })) : [];

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <h1>Letterboxd AI Review</h1>
          <div className="sub">Generic Letterboxd ZIP parsing with corrected data semantics.</div>
        </div>
        <div className="row">
          <a className="badge" href="https://github.com/Erik0318/Letterboxd-AI-Review" target="_blank" rel="noreferrer">Project GitHub</a>
          <button className="btn danger" onClick={() => window.location.reload()}>Reset</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>1) Import</h2>
          <div className="drop">
            <input type="file" accept=".zip" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onUploadZip(file); }} />
            <div className="small">{fileName || "Upload your Letterboxd export ZIP"}</div>
            <div className="small">All parsing and stats run locally in your browser. Refresh clears everything.</div>
            <button className="btn primary" style={{ marginTop: 10 }} onClick={onLoadSample}>Use sample_data.zip</button>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div>
              <div className="small">Label on share card</div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <div className="small">AI language</div>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
                <option value="en">English</option>
                <option value="zh">Chinese</option>
                <option value="uk">Ukrainian</option>
              </select>
            </div>
          </div>

          <div className="hr" />
          <h2>Quick tutorial</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Export Letterboxd data from Settings to a ZIP file.</li>
            <li>Upload any user export here. The sample ZIP is only a regression fixture.</li>
            <li>Current phase focuses on parser, merge and stats correctness instead of new UI modules.</li>
            <li>The debug summary below is the fastest way to validate unfamiliar exports.</li>
          </ul>

          {stats && (
            <div className="row" style={{ marginTop: 10 }}>
              <span className="badge">{formatInt(films?.length || 0)} merged film records</span>
              <span className="badge">{formatInt(stats.overview.watchedFilmsUnique.value)} watched films</span>
              <span className="badge">{formatInt(stats.overview.watchEntries.value)} watch entries</span>
              <span className="badge">{formatInt(stats.quickFacts.watchlistFilms.value)} watchlist films</span>
              <span className="badge">{formatInt(stats.quickFacts.reviewRows.value)} review rows</span>
            </div>
          )}

          {datasetSummary && (
            <div style={{ marginTop: 10 }}>
              <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} /> Debug summary
              </label>
              {showDebug && (
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="small">recognized files: {datasetSummary.recognizedFiles.join(", ") || "none"}</div>
                  <div className="small">unknown files: {datasetSummary.unknownFiles.map((item) => item.path).join(", ") || "none"}</div>
                  <div className="small">exact date coverage: {formatPct(datasetSummary.dateQualitySummary.exactCoverage)}</div>
                  <div className="small">lists parsed: {formatInt(datasetSummary.listSummary.activeListCount)} active / {formatInt(datasetSummary.listSummary.archivedListCount)} archived</div>
                  <div className="small">likes rows: {formatInt(datasetSummary.archiveSummary.likes.filmRows + datasetSummary.archiveSummary.likes.reviewRows + datasetSummary.archiveSummary.likes.listRows)}</div>
                  <div className="small">sample timeline probe: {JSON.stringify(sampleTimeline)}</div>
                  <pre style={{ whiteSpace: "pre-wrap", margin: "10px 0 0", overflowX: "auto", fontSize: 12, color: "var(--muted)" }}>
                    {debugJson}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {stats && datasetSummary && (
          <>
            <div className="card span3">
              <h2>Watched Films</h2>
              <div className="kpi">
                <div className="value">{formatInt(stats.overview.watchedFilmsUnique.value)}</div>
                <div className="label">unique film-level watched universe</div>
              </div>
            </div>
            <div className="card span3">
              <h2>Current Rated</h2>
              <div className="kpi">
                <div className="value">{formatInt(stats.overview.currentRatedFilms.value)}</div>
                <div className="label">unique films with current rating</div>
              </div>
            </div>
            <div className="card span3">
              <h2>Current Mean</h2>
              <div className="kpi">
                <div className="value">{stats.overview.currentMeanRating.value === null ? "n/a" : round3(stats.overview.currentMeanRating.value)}</div>
                <div className="label">based on currentRating only</div>
              </div>
            </div>
            <div className="card span3">
              <h2>Best Streak</h2>
              <div className="kpi">
                <div className="value">{formatInt(stats.overview.bestStreakDays.value)}</div>
                <div className="label">{formatInt(stats.overview.bestStreakDays.exactOnlyValue)} exact only</div>
              </div>
            </div>

            <div className="card span6">
              <h2>Quick Facts</h2>
              <div className="row">
                {quickFacts.map((item) => <div className="badge" key={item.label}>{item.label}: {item.value}</div>)}
              </div>
            </div>

            <div className="card span6">
              <h2>Coverage</h2>
              <div className="row">
                {coverageFacts.map((item) => <div className="badge" key={item.label}>{item.label}: {item.value}</div>)}
              </div>
            </div>

            <div className="span6">
              <BarList title="Current rating histogram" items={ratingHistogram} emptyText="No rating data." />
            </div>
            <div className="span6">
              <Heatmap
                byMonth={stats.activity.heatmap.byMonth}
                title="Watch timeline (exact + estimated fallback)"
                emptyText="No watch dates found in the export."
                footerText={`${formatInt(exactEntries)} exact entries, ${formatInt(estimatedEntries)} estimated fallback rows.`}
              />
            </div>
            <div className="span6">
              <BarList title="Top watched release years (unique films)" items={topReleaseYears} emptyText="No watched release years." />
            </div>
            <div className="span6">
              <BarList title="Top watched decades (unique films)" items={topDecades} emptyText="No watched decades." />
            </div>

            <div className="card">
              <h2>2) Share</h2>
              <div className="row">
                <button className="btn primary" onClick={async () => { await navigator.clipboard.writeText(stats.shareText.long); showToast("Copied"); }}>
                  Copy summary
                </button>
                <button className="btn primary" onClick={downloadShareCard}>
                  Download share card PNG
                </button>
              </div>
              <div style={{ marginTop: 12 }}>
                <ShareCard
                  stats={stats}
                  label={label}
                  labels={{
                    generated: "Generated",
                    badge: "Badge",
                    watched: "Watched films",
                    rated: "Current ratings",
                    meanRating: "Current mean",
                    median: "Current median",
                    longestStreak: "Best streak",
                    commitment: "Commitment",
                    topWords: "Top words",
                    oneLine: "One line",
                    na: "n/a",
                    titleSuffix: "taste report",
                  }}
                />
              </div>
            </div>

            <div className="card">
              <h2>3) AI Roast / Praise</h2>
              <div className="row">
                <div>
                  <div className="small">Mode</div>
                  <select value={mode} onChange={(e) => setMode(e.target.value as "praise" | "roast")}>
                    <option value="roast">Roast</option>
                    <option value="praise">Praise</option>
                  </select>
                </div>
                <div>
                  <div className="small">Intensity</div>
                  <select value={roastLevel} onChange={(e) => setRoastLevel(Number(e.target.value) as 1 | 2 | 3)}>
                    <option value={1}>Mild</option>
                    <option value={2}>Normal</option>
                    <option value={3}>Savage</option>
                  </select>
                </div>
                <div>
                  <div className="small">Provider</div>
                  <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
                    <option value="default">Default (DeepSeek)</option>
                    <option value="openai_compat">DeepSeek / GPT / Doubao</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small">API key</div>
                  <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small">Base URL</div>
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com" />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small">Model</div>
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" />
                </div>
                <button className="btn primary" onClick={runAI} disabled={aiBusy}>
                  {aiBusy ? "Analyzing..." : "Generate"}
                </button>
              </div>
              <p className="small" style={{ marginTop: 10 }}>
                Default backend model is DeepSeek. Other models require your own API settings.
              </p>

              {aiBusy && (
                <div className="kpi" style={{ marginTop: 10 }}>
                  <div className="label">AI analysis progress</div>
                  <div className="bar" style={{ height: 14, marginTop: 8 }}><div style={{ width: `${aiProgress}%` }} /></div>
                  <div className="small" style={{ marginTop: 6 }}>
                    {aiProgress < 30 ? "Building full film dossier..." : aiProgress < 60 ? "Extracting patterns..." : aiProgress < 85 ? "Writing critique..." : "Final polishing..."}
                  </div>
                </div>
              )}

              {aiText && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h2>AI Output</h2>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", color: "var(--text)" }}>{aiText}</pre>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Toast text={toast} />
    </div>
  );
}
