export interface Env {
  RLKV?: KVNamespace;
  OPENAI_API_KEY?: string;
  OPENAI_API_KEY2?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_BASE_URL2?: string;
  OPENAI_MODEL?: string;
  OPENAI_MODEL2?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AI_DAILY_LIMIT?: string;
  AI_BYPASS_IPS?: string;
}

type Provider = "default" | "default_kimi" | "openai_compat" | "gemini";
type Mode = "praise" | "roast";

type Body = {
  provider?: Provider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  language?: string;
  mode?: Mode;
  roastLevel?: 1 | 2 | 3;
  profile?: unknown;
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) }
  });
}

function getIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function todayKey(): string { return new Date().toISOString().slice(0, 10); }

function normalizeLanguage(value: string | undefined): string {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 80) || "English";
}

function isBypassIp(env: Env, ip: string): boolean {
  const raw = env.AI_BYPASS_IPS || "";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(ip) || ip === "5.34.216.81";
}

async function enforceRateLimit(env: Env, ip: string): Promise<{ ok: boolean; remaining: number }> {
  const limit = Number(env.AI_DAILY_LIMIT || "2");
  if (isBypassIp(env, ip)) return { ok: true, remaining: 999999 };
  if (!env.RLKV) return { ok: true, remaining: limit };
  const key = `ai:${todayKey()}:${ip}`;
  const cur = Number((await env.RLKV.get(key)) || "0");
  if (cur >= limit) return { ok: false, remaining: 0 };
  const next = cur + 1;
  await env.RLKV.put(key, String(next), { expirationTtl: 172800 });
  return { ok: true, remaining: Math.max(0, limit - next) };
}

function buildPrompt(body: Body): { system: string; user: string } {
  const language = normalizeLanguage(body.language);
  const mode = body.mode || "roast";
  const level = body.roastLevel || 2;
  const strictness = mode === "roast"
    ? (level === 1 ? "mild and playful. only a bit sarcastic" : level === 2 ? "sharp and witty" : "aggressive and brutal. u can use any words including swear words to make it hurt more")
    : (level === 1 ? "warm and encouraging" : level === 2 ? "enthusiastic and vivid" : "extremely enthusiastic and over-the-top");

  const system =
    `You are writing a direct film-friend style monologue to the user from a compact Letterboxd taste profile. ` +
    `Output ONLY in ${language}. Mode=${mode}. Tone=${strictness}. ` +
    `Hard rules: plain text only. No markdown headings, no numbered template, no bullet markers, no asterisks, no bold markers, no system-style wording, no fluff. ` +
    `Every movie title you mention must stay in English exactly as given in the profile. Never translate or localize film titles. ` +
    `Use concrete references to the profile's patterns and representative titles (rating contradictions, era preference, rewatches, unrated behavior, review language). ` +
    `Treat the payload as already curated: do not ask for raw rows or missing data. ` +
    `Structure: (A) 1 short title line, (B) some compact paragraphs speaking directly to the user, (C) 8 separate recommendation lines formatted as "Movie Title - reason" with no bullets or numbering.`;

  const user = `Compact Letterboxd taste profile JSON:\n${JSON.stringify(body.profile || {})}`;
  return { system, user };
}

function isKimi25Model(model: string): boolean {
  return model.trim().toLowerCase() === "kimi-k2.5";
}

function cleanPlainTextOutput(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*[*•-]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBaseUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/$/, "");
  return clean.endsWith("/v1") ? clean.slice(0, -3) : clean;
}

async function callOpenAICompat(args: { apiKey: string; baseUrl: string; model: string; system: string; user: string; temperature?: number; }): Promise<string> {
  const url = normalizeBaseUrl(args.baseUrl) + "/v1/chat/completions";
  const payload: Record<string, unknown> = {
    model: args.model,
    messages: [{ role: "system", content: args.system }, { role: "user", content: args.user }],
  };
  if (typeof args.temperature === "number") {
    payload.temperature = args.temperature;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${args.apiKey}` },
    body: JSON.stringify(payload)
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI compatible error (${res.status})`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No text in model response.");
  return cleanPlainTextOutput(String(text));
}

async function callGemini(args: { apiKey: string; model: string; system: string; user: string; }): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${args.system}\n\n${args.user}` }] }], generationConfig: { temperature: 0.85 } })
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Gemini error (${res.status})`);
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
  if (!text) throw new Error("No text in model response.");
  return cleanPlainTextOutput(String(text));
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const ip = getIp(ctx.request);
  const rl = await enforceRateLimit(ctx.env, ip);
  if (!rl.ok) return json({ error: "Rate limit reached for today.", remaining: 0 }, { status: 429 });

  const body = (await ctx.request.json().catch(() => null)) as Body | null;
  if (!body) return json({ error: "Invalid JSON." }, { status: 400 });

  const { system, user } = buildPrompt(body);
  const provider = (body.provider || "default") as Provider;

  try {
    let usedProvider = provider;
    let usedModel = "";
    let text = "";

    if (provider === "gemini") {
      const apiKey = body.apiKey;
      if (!apiKey) throw new Error("Missing Gemini API key.");
      const model = body.model || ctx.env.GEMINI_MODEL || "gemini-1.5-flash";
      usedProvider = "gemini";
      usedModel = model;
      text = await callGemini({ apiKey, model, system, user });
    } else if (provider === "default_kimi") {
      const apiKey = ctx.env.OPENAI_API_KEY2;
      if (!apiKey) throw new Error("Missing built-in Kimi API key (OPENAI_API_KEY2).");
      const baseUrl = ctx.env.OPENAI_BASE_URL2 || "https://api.moonshot.cn/v1";
      const model = ctx.env.OPENAI_MODEL2 || "kimi-k2.5";
      usedProvider = "default_kimi";
      usedModel = model;
      text = await callOpenAICompat({ apiKey, baseUrl, model, system, user });
    } else if (provider === "openai_compat") {
      const apiKey = body.apiKey;
      if (!apiKey) throw new Error("Missing OpenAI-compatible API key.");
      const baseUrl = body.baseUrl || "https://api.deepseek.com";
      const model = body.model || "deepseek-chat";
      usedProvider = "openai_compat";
      usedModel = model;
      text = await callOpenAICompat({
        apiKey,
        baseUrl,
        model,
        system,
        user,
        temperature: isKimi25Model(model) ? undefined : 0.85,
      });
    } else {
      const apiKey = ctx.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Missing built-in DeepSeek API key (OPENAI_API_KEY).");
      const baseUrl = body.baseUrl || ctx.env.OPENAI_BASE_URL || "https://api.deepseek.com";
      const model = body.model || ctx.env.OPENAI_MODEL || "deepseek-chat";
      usedProvider = "default";
      usedModel = model;
      text = await callOpenAICompat({ apiKey, baseUrl, model, system, user, temperature: 0.85 });
    }

    return json({ text, provider: usedProvider, model: usedModel, remaining: rl.remaining }, { status: 200 });
  } catch (e: any) {
    return json({ error: e?.message || "AI error.", remaining: rl.remaining }, { status: 500 });
  }
};
