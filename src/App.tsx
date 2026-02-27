import React, { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import Toast from "./components/Toast";
import { readLetterboxdExportZip, mergeTablesToFilms, FilmRecord } from "./lib/letterboxd";
import { computeStats, StatPack } from "./lib/stats";
import { BarList } from "./components/BarList";
import { Heatmap } from "./components/Heatmap";
import ShareCard from "./components/ShareCard";
import { formatInt, formatPct, round1 } from "./lib/utils";
import { toProfileSummary, summaryToText } from "./lib/profile";

type Provider = "default" | "openai_compat" | "gemini";

const LANGUAGE_PRESETS = [
  { code: "en", label: "English" },
  { code: "zh", label: "Chinese" },
  { code: "uk", label: "Ukrainian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" }
];

function ratingLabel(r: number): string {
  // 0.5 increments
  return String(r);
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmRecord[] | null>(null);
  const [stats, setStats] = useState<StatPack | null>(null);

  const [label, setLabel] = useState<string>("erikdev.cc");
  const [language, setLanguage] = useState<string>("en");
  const [languageOther, setLanguageOther] = useState<string>("");

  const [mode, setMode] = useState<"praise" | "roast">("roast");
  const [roastLevel, setRoastLevel] = useState<1 | 2 | 3>(2);

  const [provider, setProvider] = useState<Provider>("default");
  const [apiKey, setApiKey] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [model, setModel] = useState<string>("");

  const [aiText, setAiText] = useState<string>("");
  const [aiBusy, setAiBusy] = useState<boolean>(false);

  const shareRef = useRef<HTMLDivElement | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  const effectiveLanguage = useMemo(() => {
    if (language === "other") return (languageOther || "").trim() || "en";
    return language;
  }, [language, languageOther]);

  async function onUploadZip(f: File) {
    setAiText("");
    setStats(null);
    setFilms(null);
    setFileName(f.name);

    try {
      const tables = await readLetterboxdExportZip(f);
      const merged = mergeTablesToFilms(tables);
      setFilms(merged);
      const computed = computeStats(merged, label);
      setStats(computed);
      showToast("Import complete.");
    } catch (e: any) {
      console.error(e);
      showToast("Import failed. Check the ZIP format.");
    }
  }

  async function downloadShareCard() {
    const el = document.getElementById("shareCard");
    if (!el) return showToast("Share card not ready.");
    const canvas = await html2canvas(el as HTMLElement, { backgroundColor: null, scale: 2 });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "letterboxd-taste-card.png";
    a.click();
  }

  async function copySummary() {
    if (!stats) return;
    await navigator.clipboard.writeText(stats.shareText.long);
    showToast("Copied.");
  }

  async function runAI() {
    if (!stats) return;
    setAiBusy(true);
    setAiText("");

    const prof = toProfileSummary(stats, label);
    const textSummary = summaryToText(prof);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
          model: model || undefined,
          language: effectiveLanguage,
          mode,
          roastLevel,
          profile: prof,
          profileText: textSummary
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAiText(data?.error || "AI request failed.");
        return;
      }
      setAiText(String(data.text || ""));
    } catch (e: any) {
      console.error(e);
      setAiText("AI request failed. Check network and provider settings.");
    } finally {
      setAiBusy(false);
    }
  }

  const topDecades = stats?.releaseYears.decadeBuckets
    ? [...stats.releaseYears.decadeBuckets].sort((a, b) => b.count - a.count).slice(0, 8).map(d => ({ label: d.decade, value: d.count }))
    : [];

  const topReleaseYears = stats?.releaseYears.top
    ? stats.releaseYears.top.map(y => ({ label: String(y.year), value: y.count }))
    : [];

  const ratingHistogram = stats?.ratings.histogram
    ? stats.ratings.histogram.map(h => ({ label: ratingLabel(h.rating), value: h.count }))
    : [];

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <h1>Letterboxd Taste Report</h1>
          <div className="sub">ZIP import, local analysis, optional AI</div>
        </div>
        <div className="row">
          <a className="badge" href="https://letterboxd.com/" target="_blank" rel="noreferrer">Letterboxd</a>
          <button className="btn danger" onClick={() => window.location.reload()}>Reset</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>1. Import</h2>
          <div className="drop">
            <div className="row">
              <input
                type="file"
                accept=".zip"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUploadZip(f);
                }}
              />
              {fileName ? <span className="small">{fileName}</span> : <span className="small">Upload your Letterboxd export ZIP.</span>}
            </div>
            <div className="small">
              Everything is processed in your browser. Refresh clears all data.
            </div>
          </div>

          <div className="hr" />

          <div className="row">
            <div>
              <div className="small">Label on share card</div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Your name or handle" />
            </div>

            <div>
              <div className="small">Language</div>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGE_PRESETS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                <option value="other">Other (BCP 47)</option>
              </select>
            </div>

            {language === "other" && (
              <div>
                <div className="small">Other language code</div>
                <input value={languageOther} onChange={(e) => setLanguageOther(e.target.value)} placeholder="e.g. tr, pl, id" />
              </div>
            )}
          </div>

          {films && (
            <div className="row" style={{ marginTop: 10 }}>
              <span className="badge">{formatInt(films.length)} unique films merged</span>
              <span className="badge">Watched dates found: {formatInt(films.flatMap(f => f.watchedDates).length)}</span>
              <span className="badge">Reviews text samples: {formatInt(films.flatMap(f => f.reviewTextSamples).length)}</span>
            </div>
          )}
        </div>

        {stats && (
          <>
            <div className="card span3">
              <h2>Watched</h2>
              <div className="kpi">
                <div className="value">{formatInt(stats.totals.filmsWatched)}</div>
                <div className="hint">Unique films marked watched</div>
              </div>
            </div>

            <div className="card span3">
              <h2>Rated</h2>
              <div className="kpi">
                <div className="value">{formatInt(stats.totals.filmsRated)}</div>
                <div className="hint">Films with rating</div>
              </div>
            </div>

            <div className="card span3">
              <h2>Mean</h2>
              <div className="kpi">
                <div className="value">{stats.ratings.mean === null ? "n/a" : round1(stats.ratings.mean)}</div>
                <div className="hint">Average rating</div>
              </div>
            </div>

            <div className="card span3">
              <h2>Streak</h2>
              <div className="kpi">
                <div className="value">{formatInt(stats.activity.longestStreakDays)}</div>
                <div className="hint">Longest consecutive days</div>
              </div>
            </div>

            <div className="card span6">
              <h2>Quick facts</h2>
              <div className="row" style={{ alignItems: "stretch" }}>
                <div className="kpi" style={{ flex: 1 }}>
                  <div className="label">Unrated watched</div>
                  <div className="value">{formatInt(stats.totals.unratedWatched)}</div>
                  <div className="hint">Watched with no rating</div>
                </div>
                <div className="kpi" style={{ flex: 1 }}>
                  <div className="label">Commitment</div>
                  <div className="value">{formatPct(stats.fun.commitmentIndex)}</div>
                  <div className="hint">Rated / watched</div>
                </div>
                <div className="kpi" style={{ flex: 1 }}>
                  <div className="label">Taste volatility</div>
                  <div className="value">{stats.fun.tasteVolatilityIndex === null ? "n/a" : round1(stats.fun.tasteVolatilityIndex)}</div>
                  <div className="hint">Stddev of ratings</div>
                </div>
              </div>

              <div className="hr" />

              <div className="row">
                <span className="badge">Badge: {stats.fun.badge}</span>
                {stats.activity.busiestDay && <span className="badge">Busiest day: {stats.activity.busiestDay.day} ({stats.activity.busiestDay.count})</span>}
                {stats.activity.ratingDateCorrelation !== null && <span className="badge">Rating drift: {round1(stats.activity.ratingDateCorrelation)}</span>}
              </div>

              <p className="small" style={{ marginTop: 10 }}>
                Rating drift is correlation between rating and time. Positive means you rate higher recently. Negative means you got harsher.
              </p>
            </div>

            <div className="card span6">
              <h2>Top review words</h2>
              {stats.text.topWords.length === 0 ? (
                <p>No review text found in the export.</p>
              ) : (
                <>
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    {stats.text.topWords.slice(0, 20).map(w => (
                      <span key={w.word} className="badge">{w.word} ({w.count})</span>
                    ))}
                  </div>
                  <p className="small" style={{ marginTop: 10 }}>
                    This is a simple frequency list. Stopwords are removed. Multilingual text is supported but this is not sentiment analysis.
                  </p>
                </>
              )}
            </div>

            <div className="span6">
              <BarList title="Rating histogram" items={ratingHistogram} />
            </div>

            <div className="span6">
              <Heatmap byMonth={stats.activity.byMonth} />
            </div>

            <div className="span6">
              <BarList title="Top release years watched" items={topReleaseYears} />
            </div>

            <div className="span6">
              <BarList title="Top decades watched" items={topDecades} />
            </div>

            <div className="card">
              <h2>2. Share</h2>
              <div className="row">
                <button className="btn primary" onClick={copySummary}>Copy summary</button>
                <button className="btn primary" onClick={downloadShareCard}>Download share card PNG</button>
              </div>
              <div style={{ marginTop: 12 }} ref={shareRef}>
                <ShareCard stats={stats} label={label || "You"} />
              </div>
            </div>

            <div className="card">
              <h2>3. AI praise or roast</h2>
              <div className="row">
                <div>
                  <div className="small">Mode</div>
                  <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
                    <option value="roast">Roast</option>
                    <option value="praise">Praise</option>
                  </select>
                </div>

                <div>
                  <div className="small">Roast level</div>
                  <select value={roastLevel} onChange={(e) => setRoastLevel(Number(e.target.value) as any)}>
                    <option value={1}>Mild</option>
                    <option value={2}>Normal</option>
                    <option value={3}>Savage</option>
                  </select>
                </div>

                <div>
                  <div className="small">Provider</div>
                  <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
                    <option value="default">Default</option>
                    <option value="openai_compat">GPT / DeepSeek / Doubao (OpenAI compatible)</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small">API key (optional)</div>
                  <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Leave empty to use site default key" />
                </div>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small">Base URL (OpenAI compatible only)</div>
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Optional. Example: https://api.openai.com" />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small">Model (optional)</div>
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Optional. Example: gpt-4o-mini" />
                </div>

                <div>
                  <div className="small">AI calls</div>
                  <button className="btn primary" onClick={runAI} disabled={aiBusy}>{aiBusy ? "Running..." : "Generate"}</button>
                </div>
              </div>

              <p className="small" style={{ marginTop: 10 }}>
                Default AI uses your deployment settings. This app only sends a compact profile summary, not your full export.
              </p>

              {aiText && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h2>AI output</h2>
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
