import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import Papa from 'papaparse';

function parseCSV(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

function norm(h) { return String(h || '').trim().toLowerCase(); }
function field(row, names) {
  const m = {};
  for (const k of Object.keys(row || {})) m[norm(k)] = row[k];
  for (const n of names) {
    const v = m[norm(n)];
    if (v !== undefined && String(v).trim() !== '') return String(v);
  }
  return null;
}
function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
function slug(url) {
  const m = String(url || '').match(/\/film\/([^/?#]+)\/?/i);
  return m?.[1]?.toLowerCase() || null;
}

const candidates = ['public/sample_data.zip', 'sample_data.zip'];
const samplePath = candidates.map((p) => path.resolve(p)).find((p) => fs.existsSync(p));
if (!samplePath) {
  console.error('sample_data.zip not found. Put it at public/sample_data.zip (preferred) or repo root.');
  process.exit(1);
}

const zipData = fs.readFileSync(samplePath);
const zip = await JSZip.loadAsync(zipData);
const files = Object.keys(zip.files).filter((f) => f.toLowerCase().endsWith('.csv'));
const tables = {};
for (const f of files) {
  const txt = await zip.file(f).async('string');
  tables[path.basename(f).toLowerCase()] = parseCSV(txt);
}

const map = new Map();
const watchedSet = new Set();
const ratingSet = new Set();
const reviewSet = new Set();
const commentsTexts = new Set((tables['comments.csv'] || []).map((r) => field(r, ['Comment', 'Text', 'Content'])).filter(Boolean));

function upsert(row, src, idx) {
  const k = slug(field(row, ['Letterboxd URI', 'URI', 'Link', 'URL']) || '') || `unknown:${src}:${idx}`;
  if (!map.has(k)) map.set(k, { key: k, watched: false, rating: null, reviews: [], timeline: [], fromRatings: false, fromReviews: false });
  return map.get(k);
}

(tables['watched.csv'] || []).forEach((r, i) => { const x = upsert(r, 'watched', i); x.watched = true; watchedSet.add(x.key); });
(tables['ratings.csv'] || []).forEach((r, i) => { const x = upsert(r, 'ratings', i); x.rating = Number(field(r, ['Rating', 'Rated', 'Stars'])); x.fromRatings = true; ratingSet.add(x.key); });
(tables['reviews.csv'] || []).forEach((r, i) => { const x = upsert(r, 'reviews', i); const txt = field(r, ['Review', 'Text', 'Content']); if (txt) x.reviews.push(txt); x.fromReviews = true; reviewSet.add(x.key); });
(tables['diary.csv'] || []).forEach((r, i) => { const x = upsert(r, 'diary', i); const wa = toDate(field(r, ['Watched Date', 'Watched', 'Date'])); const la = toDate(field(r, ['Logged Date', 'Logged', 'Diary Date'])); if (wa) x.timeline.push({ d: wa, est: false }); else if (la) x.timeline.push({ d: la, est: true }); });

const films = [...map.values()];
const assertions = [];
assertions.push(['time series must use watched_at when available', films.some((f) => f.timeline.some((t) => t.est === false))]);
assertions.push(['ratings must come from ratings.csv', films.filter((f) => f.rating !== null).every((f) => f.fromRatings)]);
assertions.push(['reviews must come from reviews.csv', films.filter((f) => f.reviews.length > 0).every((f) => f.fromReviews)]);
assertions.push(['comments.csv must not be treated as reviews', films.every((f) => f.reviews.every((txt) => !commentsTexts.has(txt)))]);

const onlyRatingNotWatched = [...ratingSet].filter((k) => !watchedSet.has(k)).length;
const onlyReviewNotWatched = [...reviewSet].filter((k) => !watchedSet.has(k)).length;

console.log('=== verify:sample debug summary ===');
console.log('samplePath:', samplePath);
console.log('recognized CSV:', files.join(', '));
console.log('filmsTotal:', films.length);
console.log('watched=true:', films.filter((f) => f.watched).length);
console.log('with timeline:', films.filter((f) => f.timeline.length > 0).length);
console.log('only-in-ratings not-in-watched:', onlyRatingNotWatched);
console.log('only-in-reviews not-in-watched:', onlyReviewNotWatched);
console.log('assertions:');
let failed = 0;
for (const [name, ok] of assertions) {
  console.log(` - ${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(2);
