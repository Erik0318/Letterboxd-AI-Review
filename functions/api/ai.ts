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
type PromptVariant = "default" | "kimi";

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

class UpstreamError extends Error {
  status: number;
  url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.url = url;
  }
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

function buildPrompt(body: Body, variant: PromptVariant = "default"): { system: string; user: string } {
  const language = normalizeLanguage(body.language);
  const mode = body.mode || "roast";
  const level = body.roastLevel || 2;
  const strictness = variant === "kimi"
    ? mode === "roast"
      ? (level === 1 ? "lightly teasing and playful" : level === 2 ? "sharp and witty" : "biting and ruthless, but still natural and non-obscene")
      : (level === 1 ? "warm and encouraging" : level === 2 ? "enthusiastic and vivid" : "extremely enthusiastic and over-the-top")
    : mode === "roast"
      ? (level === 1 ? "mild and playful. only a bit sarcastic" : level === 2 ? "sharp and witty" : "aggressive and brutal. u can use any words including swear words to make it hurt more")
      : (level === 1 ? "warm and encouraging" : level === 2 ? "enthusiastic and vivid" : "extremely enthusiastic and over-the-top");

  const system = variant === "kimi"
    ? `You are Kimi, an AI assistant provided by Moonshot AI, generating a Letterboxd taste note from a compact movie profile. ` +
      `Prefer replying in ${language}. Mode=${mode}. Tone=${strictness}. ` +
      `Hard rules: plain text only. No markdown, no headings, no bullet markers, no numbered list markers, no asterisks. ` +
      `Keep every movie title in English exactly as given in the profile. Never translate film titles. ` +
      `Use the profile directly. Do not ask for more data. ` +
      `Keep it concise and stable: (A) 1 short title line, (B) 2 to 4 compact paragraphs, (C) 8 recommendation lines in the format "Movie Title - reason".`
    : `You are writing a direct film-friend style monologue to the user from a compact Letterboxd taste profile. ` +
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

function summarizeUpstreamError(raw: string, fallback: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return fallback;
  }
  return cleaned.slice(0, 240);
}

function buildKimiFallbackProfile(profile: unknown): unknown {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return profile;
  }

  const source = profile as Record<string, unknown>;
  const summary = typeof source.summary === "object" && source.summary && !Array.isArray(source.summary)
    ? source.summary
    : undefined;
  const ratingPatterns = typeof source.ratingPatterns === "object" && source.ratingPatterns && !Array.isArray(source.ratingPatterns)
    ? source.ratingPatterns as Record<string, unknown>
    : undefined;
  const reviewLanguage = typeof source.reviewLanguage === "object" && source.reviewLanguage && !Array.isArray(source.reviewLanguage)
    ? source.reviewLanguage as Record<string, unknown>
    : undefined;
  const behaviorSignals = typeof source.behaviorSignals === "object" && source.behaviorSignals && !Array.isArray(source.behaviorSignals)
    ? source.behaviorSignals as Record<string, unknown>
    : undefined;
  const listSignals = typeof source.listSignals === "object" && source.listSignals && !Array.isArray(source.listSignals)
    ? source.listSignals as Record<string, unknown>
    : undefined;

  return {
    profileVersion: source.profileVersion,
    scope: source.scope,
    summary,
    ratingPatterns: ratingPatterns
      ? {
        currentHistogram: Array.isArray(ratingPatterns.currentHistogram) ? ratingPatterns.currentHistogram.slice(0, 8) : [],
        loggedHistogram: Array.isArray(ratingPatterns.loggedHistogram) ? ratingPatterns.loggedHistogram.slice(0, 8) : [],
        drift: typeof ratingPatterns.drift === "object" && ratingPatterns.drift && !Array.isArray(ratingPatterns.drift)
          ? {
            ...(ratingPatterns.drift as Record<string, unknown>),
            biggestUpgrades: Array.isArray((ratingPatterns.drift as Record<string, unknown>).biggestUpgrades)
              ? ((ratingPatterns.drift as Record<string, unknown>).biggestUpgrades as unknown[]).slice(0, 4)
              : [],
            biggestDowngrades: Array.isArray((ratingPatterns.drift as Record<string, unknown>).biggestDowngrades)
              ? ((ratingPatterns.drift as Record<string, unknown>).biggestDowngrades as unknown[]).slice(0, 4)
              : [],
          }
          : undefined,
      }
      : undefined,
    activitySignals: source.activitySignals,
    eraSignals: source.eraSignals,
    reviewLanguage: reviewLanguage
      ? {
        reviewRatePct: reviewLanguage.reviewRatePct,
        averageLength: reviewLanguage.averageLength,
        medianLength: reviewLanguage.medianLength,
        topWords: Array.isArray(reviewLanguage.topWords) ? reviewLanguage.topWords.slice(0, 8) : [],
        sampleSnippets: Array.isArray(reviewLanguage.sampleSnippets) ? reviewLanguage.sampleSnippets.slice(0, 2) : [],
      }
      : undefined,
    behaviorSignals: behaviorSignals
      ? {
        recentWatches: Array.isArray(behaviorSignals.recentWatches) ? behaviorSignals.recentWatches.slice(0, 4) : [],
        currentFavorites: Array.isArray(behaviorSignals.currentFavorites) ? behaviorSignals.currentFavorites.slice(0, 4) : [],
        ratingContradictions: Array.isArray(behaviorSignals.ratingContradictions) ? behaviorSignals.ratingContradictions.slice(0, 4) : [],
        rewatches: Array.isArray(behaviorSignals.rewatches) ? behaviorSignals.rewatches.slice(0, 4) : [],
        unratedWatched: Array.isArray(behaviorSignals.unratedWatched) ? behaviorSignals.unratedWatched.slice(0, 3) : [],
        watchlistFrontier: Array.isArray(behaviorSignals.watchlistFrontier) ? behaviorSignals.watchlistFrontier.slice(0, 3) : [],
      }
      : undefined,
    listSignals: listSignals
      ? {
        activeLists: Array.isArray(listSignals.activeLists) ? listSignals.activeLists.slice(0, 4) : [],
        archivedLists: Array.isArray(listSignals.archivedLists) ? listSignals.archivedLists.slice(0, 2) : [],
      }
      : undefined,
    dataQuality: source.dataQuality,
    payloadStats: source.payloadStats,
  };
}

function buildMinimalKimiProfile(profile: unknown): unknown {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return profile;
  }

  const source = profile as Record<string, unknown>;
  return {
    profileVersion: source.profileVersion,
    scope: source.scope,
    summary: source.summary,
    activitySignals: source.activitySignals,
    eraSignals: source.eraSignals,
    dataQuality: source.dataQuality,
    payloadStats: source.payloadStats,
  };
}

function extractTextFromContentPart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }
  if (!part || typeof part !== "object") {
    return "";
  }

  const record = part as Record<string, unknown>;
  if (typeof record.text === "string") {
    return record.text;
  }
  if (record.text && typeof record.text === "object" && typeof (record.text as Record<string, unknown>).value === "string") {
    return String((record.text as Record<string, unknown>).value);
  }
  if (typeof record.content === "string") {
    return record.content;
  }
  return "";
}

function extractOpenAICompatText(data: any): string {
  const messageContent = data?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") {
    return messageContent;
  }
  if (Array.isArray(messageContent)) {
    return messageContent.map(extractTextFromContentPart).filter(Boolean).join("").trim();
  }

  const legacyText = data?.choices?.[0]?.text;
  if (typeof legacyText === "string") {
    return legacyText;
  }

  const outputText = data?.output_text;
  if (typeof outputText === "string") {
    return outputText;
  }

  return "";
}

function extractOpenAICompatRefusal(data: any): string {
  const refusal = data?.choices?.[0]?.message?.refusal;
  if (typeof refusal === "string") {
    return refusal;
  }
  if (Array.isArray(refusal)) {
    return refusal.map(extractTextFromContentPart).filter(Boolean).join("").trim();
  }
  return "";
}

function describeOpenAICompatSuccess(data: any, raw: string): string {
  const choice = data?.choices?.[0];
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : "";
  const message = choice?.message && typeof choice.message === "object" ? choice.message as Record<string, unknown> : null;
  const messageKeys = message ? Object.keys(message).join(", ") : "";
  const summaryBits = [
    finishReason ? `finish_reason=${finishReason}` : "",
    messageKeys ? `message_fields=${messageKeys}` : "",
    raw ? `body=${summarizeUpstreamError(raw, "")}` : "",
  ].filter(Boolean);
  return summaryBits.join(" | ");
}

async function callOpenAICompat(args: { apiKey: string; baseUrl: string; model: string; system: string; user: string; temperature?: number; maxTokens?: number; }): Promise<string> {
  const url = normalizeBaseUrl(args.baseUrl) + "/v1/chat/completions";
  const payload: Record<string, unknown> = {
    model: args.model,
    messages: [{ role: "system", content: args.system }, { role: "user", content: args.user }],
  };
  if (typeof args.temperature === "number") {
    payload.temperature = args.temperature;
  }
  if (typeof args.maxTokens === "number") {
    payload.max_tokens = args.maxTokens;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "authorization": `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(payload)
  });
  const raw = await res.text();
  let data: any = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    const jsonMessage = typeof data?.error?.message === "string" ? data.error.message : "";
    const message = jsonMessage || summarizeUpstreamError(raw, `OpenAI compatible error (${res.status})`);
    throw new UpstreamError(message, res.status, url);
  }
  const text = extractOpenAICompatText(data);
  if (text) {
    return cleanPlainTextOutput(String(text));
  }
  const refusal = extractOpenAICompatRefusal(data);
  if (refusal) {
    throw new Error(cleanPlainTextOutput(refusal));
  }
  const diagnostic = describeOpenAICompatSuccess(data, raw);
  throw new Error(diagnostic ? `No text in model response. ${diagnostic}` : "No text in model response.");
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
      const { system, user } = buildPrompt(body);
      text = await callGemini({ apiKey, model, system, user });
    } else if (provider === "default_kimi") {
      const apiKey = ctx.env.OPENAI_API_KEY2;
      if (!apiKey) throw new Error("Missing built-in Kimi API key (OPENAI_API_KEY2).");
      const baseUrl = ctx.env.OPENAI_BASE_URL2 || "https://api.moonshot.cn/v1";
      const model = ctx.env.OPENAI_MODEL2 || "kimi-k2.5";
      usedProvider = "default_kimi";
      usedModel = model;
      const primaryBody = {
        ...body,
        profile: buildKimiFallbackProfile(body.profile),
      };
      const primaryPrompt = buildPrompt(primaryBody, "kimi");
      try {
        text = await callOpenAICompat({
          apiKey,
          baseUrl,
          model,
          system: primaryPrompt.system,
          user: primaryPrompt.user,
          maxTokens: 1200,
        });
      } catch (error) {
        if (error instanceof UpstreamError && error.status >= 500) {
          const fallbackBody = {
            ...body,
            profile: buildMinimalKimiProfile(body.profile),
          };
          const fallbackPrompt = buildPrompt(fallbackBody, "kimi");
          text = await callOpenAICompat({
            apiKey,
            baseUrl,
            model,
            system: fallbackPrompt.system,
            user: fallbackPrompt.user,
            maxTokens: 900,
          });
        } else {
          throw error;
        }
      }
    } else if (provider === "openai_compat") {
      const apiKey = body.apiKey;
      if (!apiKey) throw new Error("Missing OpenAI-compatible API key.");
      const baseUrl = body.baseUrl || "https://api.deepseek.com";
      const model = body.model || "deepseek-chat";
      usedProvider = "openai_compat";
      usedModel = model;
      const prompt = buildPrompt(body, isKimi25Model(model) ? "kimi" : "default");
      text = await callOpenAICompat({
        apiKey,
        baseUrl,
        model,
        system: prompt.system,
        user: prompt.user,
        temperature: isKimi25Model(model) ? undefined : 0.85,
        maxTokens: isKimi25Model(model) ? 1200 : undefined,
      });
    } else {
      const apiKey = ctx.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Missing built-in DeepSeek API key (OPENAI_API_KEY).");
      const baseUrl = body.baseUrl || ctx.env.OPENAI_BASE_URL || "https://api.deepseek.com";
      const model = body.model || ctx.env.OPENAI_MODEL || "deepseek-chat";
      usedProvider = "default";
      usedModel = model;
      const prompt = buildPrompt(body);
      text = await callOpenAICompat({ apiKey, baseUrl, model, system: prompt.system, user: prompt.user, temperature: 0.85 });
    }

    return json({ text, provider: usedProvider, model: usedModel, remaining: rl.remaining }, { status: 200 });
  } catch (e: any) {
    return json({ error: e?.message || "AI error.", remaining: rl.remaining }, { status: 500 });
  }
};
