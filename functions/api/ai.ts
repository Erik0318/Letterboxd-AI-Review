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
type Body = {
  provider?: Provider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  language?: string;
  mode?: "praise" | "roast";
  roastLevel?: 1 | 2 | 3;
  profile?: unknown;
};

const json = (data: unknown, init?: ResponseInit) => new Response(JSON.stringify(data), { ...init, headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) } });
const getIp = (req: Request) => req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
const todayKey = () => new Date().toISOString().slice(0, 10);

function isBypassIp(env: Env, ip: string): boolean {
  const list = (env.AI_BYPASS_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(ip);
}

async function enforceRateLimit(env: Env, ip: string): Promise<{ ok: boolean; remaining: number; key: string; used: number }> {
  const limit = Number(env.AI_DAILY_LIMIT || "2");
  const key = `ai:${todayKey()}:${ip}`;
  if (isBypassIp(env, ip)) return { ok: true, remaining: 999999, key, used: 0 };
  if (!env.RLKV) return { ok: true, remaining: limit, key, used: 0 };
  const cur = Number((await env.RLKV.get(key)) || "0");
  if (cur >= limit) return { ok: false, remaining: 0, key, used: cur };
  const next = cur + 1;
  await env.RLKV.put(key, String(next), { expirationTtl: 172800 });
  return { ok: true, remaining: Math.max(0, limit - next), key, used: next };
}

function normalizeBaseUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? clean.slice(0, -3) : clean;
}

function buildPrompt(body: Body): { system: string; user: string } {
  const levelText = body.roastLevel === 1 ? "gentle" : body.roastLevel === 3 ? "sharp" : "balanced";
  const system = [
    "Return strict JSON only.",
    "No markdown, no bold markers, no code block.",
    "Build output in English JSON first, then include translated strings for target language.",
    "Every conclusion must have evidence that exists in profile metrics.",
    "If anomaly.importSpikeDetected=true, never use import date as binge evidence.",
    "Output schema: {title, styleLevel, conclusions:[{point,evidence}], narrative:[...], recommendations:[10 items], translated:{language,title,narrative,recommendations}}",
    `Mode=${body.mode || "roast"}, intensity=${levelText}.`
  ].join(" ");
  const user = `language=${body.language || "en"}\nprofile=${JSON.stringify(body.profile || {})}`;
  return { system, user };
}

async function callOpenAICompat(args: { apiKey: string; baseUrl: string; model: string; system: string; user: string }): Promise<string> {
  const res = await fetch(`${normalizeBaseUrl(args.baseUrl)}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify({ model: args.model, response_format: { type: "json_object" }, messages: [{ role: "system", content: args.system }, { role: "user", content: args.user }], temperature: 0.7 })
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI compatible error (${res.status})`);
  return String(data?.choices?.[0]?.message?.content || "");
}

async function callGemini(args: { apiKey: string; model: string; system: string; user: string }): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${args.system}\n${args.user}` }] }], generationConfig: { temperature: 0.7, responseMimeType: "application/json" } })
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Gemini error (${res.status})`);
  return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "");
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const ip = getIp(ctx.request);
  const rl = await enforceRateLimit(ctx.env, ip);
  if (!rl.ok) return json({ error: "Rate limit reached for today.", remaining: 0, rlKey: rl.key, used: rl.used }, { status: 429 });
  const body = (await ctx.request.json().catch(() => null)) as Body | null;
  if (!body) return json({ error: "Invalid JSON." }, { status: 400 });

  const provider = body.provider || "default";
  const { system, user } = buildPrompt(body);
  try {
    let text = "";
    let usedProvider = provider;
    let usedModel = "";
    if (provider === "gemini") {
      const apiKey = body.apiKey || ctx.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API key.");
      const model = body.model || ctx.env.GEMINI_MODEL || "gemini-1.5-flash";
      text = await callGemini({ apiKey, model, system, user });
      usedModel = model;
    } else {
      const apiKey = body.apiKey || ctx.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Missing OpenAI compatible API key.");
      const baseUrl = body.baseUrl || ctx.env.OPENAI_BASE_URL || "https://api.deepseek.com";
      const model = body.model || ctx.env.OPENAI_MODEL || "deepseek-chat";
      text = await callOpenAICompat({ apiKey, baseUrl, model, system, user });
      usedProvider = "openai_compat";
      usedModel = model;
    }
    return json({ text, provider: usedProvider, model: usedModel, remaining: rl.remaining, rlKey: rl.key, used: rl.used });
  } catch (e: any) {
    return json({ error: e?.message || "AI error.", remaining: rl.remaining, rlKey: rl.key, used: rl.used }, { status: 500 });
  }
};
