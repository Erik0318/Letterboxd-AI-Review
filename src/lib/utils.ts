export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function safeNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const normalised = s
    .replace("½", ".5")
    .replace(",", ".")
    .replace(/[^0-9.\-]/g, "");
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

export function toISODateOnly(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  // Letterboxd export dates are usually YYYY-MM-DD
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];

  // Attempt parse
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function groupBy<T>(arr: T[], keyFn: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = keyFn(item);
    (out[k] ||= []).push(item);
  }
  return out;
}

export function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stddev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const m = mean(nums)!;
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (!den) return null;
  return num / den;
}

export function formatInt(n: number): string {
  return n.toLocaleString("en-GB");
}

export function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dayKey(isoDate: string): string {
  return isoDate;
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}
