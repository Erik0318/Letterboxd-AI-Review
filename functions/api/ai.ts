export interface Env {
  RLKV?: KVNamespace;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AI_DAILY_LIMIT?: string;
  AI_BYPASS_IPS?: string;
}

type Provider = "default" | "openai_compat" | "gemini";
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
  const language = (body.language || "en").trim();
  const mode = body.mode || "roast";
  const level = body.roastLevel || 2;
  const strictness = level === 1 ? "mild and playful" : level === 2 ? "sharp and witty" : "aggressive but still respectful";

  const system =
    `You are writing a direct film-friend style monologue to the user. ` +
    `Output ONLY in ${language}. Mode=${mode}. Tone=${strictness}. ` +
    `Hard rules: no markdown headings, no numbered template, no system-style wording, no fluff. ` +
    `Use concrete references to the uploaded film list patterns (rating contradictions, era preference, rewatches, unrated behavior, review language). ` +
    `Structure: (A) 1 short title line, (B) 3 compact paragraphs speaking directly to the user, (C) 8 bullet recommendations with specific movie names and one-line reason.`;

  const user = `Full Letterboxd dossier JSON:\n${JSON.stringify(body.profile || {}, null, 2)}`;
  return { system, user };
}

function normalizeBaseUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/$/, "");
  return clean.endsWith("/v1") ? clean.slice(0, -3) : clean;
}

async function callOpenAICompat(args: { apiKey: string; baseUrl: string; model: string; system: string; user: string; }): Promise<string> {
  const url = normalizeBaseUrl(args.baseUrl) + "/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${args.apiKey}` },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: "system", content: args.system }, { role: "user", content: args.user }],
      temperature: 0.85
    })
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI compatible error (${res.status})`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No text in model response.");
  return String(text);
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
  return String(text);
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
      const apiKey = body.apiKey || ctx.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API key.");
      const model = body.model || ctx.env.GEMINI_MODEL || "gemini-1.5-flash";
      usedProvider = "gemini";
      usedModel = model;
      text = await callGemini({ apiKey, model, system, user });
    } else {
      const apiKey = body.apiKey || ctx.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Missing OpenAI compatible API key.");
      const baseUrl = body.baseUrl || ctx.env.OPENAI_BASE_URL || "https://api.deepseek.com";
      const model = body.model || ctx.env.OPENAI_MODEL || "deepseek-chat";
      usedProvider = "openai_compat";
      usedModel = model;
      text = await callOpenAICompat({ apiKey, baseUrl, model, system, user });
    }

    return json({ text, provider: usedProvider, model: usedModel, remaining: rl.remaining }, { status: 200 });
  } catch (e: any) {
    return json({ error: e?.message || "AI error.", remaining: rl.remaining }, { status: 500 });
  }
};
