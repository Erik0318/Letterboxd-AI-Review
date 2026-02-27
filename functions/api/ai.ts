export interface Env {
  // Optional KV binding for rate limiting
  RLKV?: KVNamespace;

  // OpenAI compatible default
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;

  // Gemini default
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;

  // Simple per IP per day limit, default 2
  AI_DAILY_LIMIT?: string;
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
  profileText?: string;
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {})
    }
  });
}

function getIp(req: Request): string {
  const h = req.headers.get("cf-connecting-ip");
  if (h) return h;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

function todayKey(): string {
  const d = new Date().toISOString().slice(0, 10);
  return d;
}

async function enforceRateLimit(env: Env, ip: string): Promise<{ ok: boolean; remaining: number }> {
  const limit = Number(env.AI_DAILY_LIMIT || "2");
  if (!env.RLKV) return { ok: true, remaining: limit };

  const key = `ai:${todayKey()}:${ip}`;
  const curRaw = await env.RLKV.get(key);
  const cur = curRaw ? Number(curRaw) : 0;
  if (cur >= limit) return { ok: false, remaining: 0 };
  const next = cur + 1;
  await env.RLKV.put(key, String(next), { expirationTtl: 172800 });
  return { ok: true, remaining: Math.max(0, limit - next) };
}

function buildPrompt(body: Body): { system: string; user: string } {
  const language = (body.language || "en").trim();
  const mode = body.mode || "roast";
  const level = body.roastLevel || 2;

  const strictness =
    level === 1 ? "mild, playful, never harsh" :
    level === 2 ? "direct, witty, a bit sharp, but not cruel" :
    "savage in tone, but still only about film taste and habits, no personal insults";

  const system =
    `You write as a film friend analysing Letterboxd stats. ` +
    `Output language: ${language}. ` +
    `Mode: ${mode}. Style: ${strictness}. ` +
    `Rules: keep it about film taste and viewing patterns. No slurs. No attacks on identity. ` +
    `Prefer evidence based remarks, referencing the provided stats. ` +
    `Format: (1) 3 sentence summary (2) 5 bullet evidence points (3) 1 line title for share (4) 10 recommendations logic placeholders, no need for movie names if unavailable.`;

  const user =
    `Here is the compact profile summary. Use it as evidence.\n\n` +
    (body.profileText || JSON.stringify(body.profile || {}, null, 2));

  return { system, user };
}

async function callOpenAICompat(args: {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const url = args.baseUrl.replace(/\/$/, "") + "/v1/chat/completions";
  const payload = {
    model: args.model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user }
    ],
    temperature: 0.9
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${args.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `OpenAI compatible error (${res.status})`;
    throw new Error(msg);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No text in model response.");
  return String(text);
}

async function callGemini(args: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const model = args.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const payload = {
    contents: [
      { role: "user", parts: [{ text: args.system + "\n\n" + args.user }] }
    ],
    generationConfig: { temperature: 0.9 }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini error (${res.status})`;
    throw new Error(msg);
  }
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
    let usedProvider: string = provider;
    let usedModel: string = "";
    let text = "";

    if (provider === "gemini" || (provider === "default" && (ctx.env.GEMINI_API_KEY || body.apiKey))) {
      const apiKey = body.apiKey || ctx.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API key.");
      const model = body.model || ctx.env.GEMINI_MODEL || "gemini-1.5-flash";
      usedProvider = "gemini";
      usedModel = model;
      text = await callGemini({ apiKey, model, system, user });
    } else {
      const apiKey = body.apiKey || ctx.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Missing OpenAI compatible API key.");
      const baseUrl = body.baseUrl || ctx.env.OPENAI_BASE_URL || "https://api.openai.com";
      const model = body.model || ctx.env.OPENAI_MODEL || "gpt-4o-mini";
      usedProvider = "openai_compat";
      usedModel = model;
      text = await callOpenAICompat({ apiKey, baseUrl, model, system, user });
    }

    return json({ text, provider: usedProvider, model: usedModel, remaining: rl.remaining }, { status: 200 });
  } catch (e: any) {
    return json({ error: e?.message || "AI error.", remaining: rl.remaining }, { status: 500 });
  }
};
