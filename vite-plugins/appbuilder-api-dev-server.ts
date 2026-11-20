import type { Plugin } from "vite";
import { loadEnv } from "vite";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import type { IncomingMessage, ServerResponse } from "http";

type Handler = (
  req: IncomingMessage & { body?: unknown; query?: Record<string, string> },
  res: ServerResponse & {
    status: (n: number) => ServerResponse;
    json: (b: unknown) => void;
  },
) => Promise<unknown> | unknown;

function wrapRes(res: ServerResponse) {
  const r = res as ServerResponse & {
    status: (n: number) => ServerResponse;
    json: (b: unknown) => void;
  };
  r.status = (n: number) => {
    r.statusCode = n;
    return r;
  };
  r.json = (b: unknown) => {
    if (!r.headersSent) {
      r.setHeader("Content-Type", "application/json");
    }
    r.end(JSON.stringify(b));
  };
  return r;
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function resolveApiFile(urlPath: string): { file: string; query: Record<string, string> } | null {
  const u = new URL(urlPath, "http://local");
  const pathname = u.pathname.replace(/\/$/, "") || "/";
  const query: Record<string, string> = {};
  u.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  const rel = pathname.replace(/^\/api\/?/, "");
  if (!rel) return null;

  const parts = rel.split("/").filter(Boolean);
  const root = path.resolve(process.cwd(), "api");

  const exact = path.join(root, ...parts) + ".ts";
  if (fs.existsSync(exact)) return { file: exact, query };

  if (parts.length >= 2) {
    const id = parts[parts.length - 1];
    const nested = path.join(root, ...parts.slice(0, -1), "[id].ts");
    if (fs.existsSync(nested)) {
      query.id = id;
      return { file: nested, query };
    }
  }

  const indexFile = path.join(root, ...parts, "index.ts");
  if (fs.existsSync(indexFile)) return { file: indexFile, query };

  return null;
}

export function appbuilderApiDevServer(): Plugin {
  return {
    name: "appbuilder-api-dev-server",
    configureServer(server) {
      const env = loadEnv("development", process.cwd(), "");
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        const resolved = resolveApiFile(req.url.split("?")[0] + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""));
        if (!resolved) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Not found" }));
          return;
        }

        try {
          const mod = await import(pathToFileURL(resolved.file).href + `?t=${Date.now()}`);
          const handler = (mod.default ?? mod.handler) as Handler;
          const wrapped = wrapRes(res);
          const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
          const qReq = Object.assign(req, { body, query: resolved.query }) as IncomingMessage & {
            body?: unknown;
            query?: Record<string, string>;
          };
          await handler(qReq, wrapped);
          if (!res.writableEnded) res.end();
        } catch (err) {
          console.error(err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
          }
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }));
        }
      });
    },
  };
}
