import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { onRequestPost as handleAiRequest } from "./functions/api/ai";
import { onRequestGet as handleHealthRequest } from "./functions/api/health";
import { defineConfig, loadEnv, type Plugin } from "vite";

function toHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function sendWebResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

function pagesFunctionsDevBridge(mode: string): Plugin {
  // Reuse the Pages Functions handlers in local Vite dev so /api/* works on npm run dev.
  const env = loadEnv(mode, process.cwd(), "");
  const runtimeEnv = {
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_API_KEY2: env.OPENAI_API_KEY2,
    OPENAI_BASE_URL: env.OPENAI_BASE_URL,
    OPENAI_BASE_URL2: env.OPENAI_BASE_URL2,
    OPENAI_MODEL: env.OPENAI_MODEL,
    OPENAI_MODEL2: env.OPENAI_MODEL2,
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    GEMINI_MODEL: env.GEMINI_MODEL,
    AI_DAILY_LIMIT: env.AI_DAILY_LIMIT,
    AI_BYPASS_IPS: env.AI_BYPASS_IPS,
  };

  return {
    name: "pages-functions-dev-bridge",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.method) {
          next();
          return;
        }

        const url = new URL(req.url, "http://localhost:5173");
        const method = req.method.toUpperCase();

        try {
          if (url.pathname === "/api/health" && method === "GET") {
            const response = await handleHealthRequest({
              request: new Request(url.toString(), { method, headers: toHeaders(req) }),
              env: runtimeEnv,
            } as never);
            await sendWebResponse(res, response);
            return;
          }

          if (url.pathname === "/api/ai" && method === "POST") {
            const body = await readRequestBody(req);
            const response = await handleAiRequest({
              request: new Request(url.toString(), {
                method,
                headers: toHeaders(req),
                body,
              }),
              env: runtimeEnv,
            } as never);
            await sendWebResponse(res, response);
            return;
          }
        } catch (error) {
          if (error instanceof Error) {
            server.ssrFixStacktrace(error);
          }
          res.statusCode = 500;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : "Local API bridge failed.",
          }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), pagesFunctionsDevBridge(mode)],
  server: { port: 5173 },
}));
