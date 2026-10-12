#!/usr/bin/env node
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { credentialsFromEnv, credentialsFromHeaders } from "./config.js";
import { ImgflipClient } from "./imgflip/client.js";
import type { Credentials } from "./imgflip/types.js";
import { OAuthServer } from "./oauth/server.js";
import { createServer } from "./server.js";
import { TemplateService } from "./templates.js";

export interface HttpOptions {
  /** When set, clients may send `Authorization: Bearer <authToken>` to use the env credentials. */
  authToken?: string;
  /** Enables the OAuth login flow (needed by claude.ai connectors). */
  oauth?: { secret: string; publicUrl: string; allowedRedirectHosts?: string[] };
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
}

const MAX_BODY_BYTES = 1024 * 1024;

type Auth = { ok: true; credentials?: Credentials } | { ok: false; challenge?: string };

/**
 * Stateless Streamable HTTP endpoint at /mcp.
 *
 * Imgflip credentials are resolved per request, in order:
 * 1. an OAuth access token (the user signed in with their Imgflip account, e.g. from claude.ai);
 * 2. `Authorization: Bearer <MCP_AUTH_TOKEN>`: the server's env credentials;
 * 3. the X-Imgflip-Api-Key or X-Imgflip-Username / X-Imgflip-Password headers.
 * Env credentials are never used without the token, otherwise anyone who knows the URL could
 * create memes on the owner's account. With OAuth enabled, unauthenticated requests get a 401
 * that points clients to the login flow.
 */
export function createMcpHttpServer(options: HttpOptions = {}): Server {
  const envCredentials = options.authToken ? credentialsFromEnv(options.env) : undefined;
  const templates = new TemplateService(new ImgflipClient({ fetch: options.fetch }));
  const oauth = options.oauth && new OAuthServer({ ...options.oauth, fetch: options.fetch });

  function authenticate(req: IncomingMessage): Auth {
    const headerCredentials = credentialsFromHeaders(req.headers);
    const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer && (oauth || options.authToken)) {
      const fromToken = oauth?.verifyAccessToken(bearer);
      if (fromToken) return { ok: true, credentials: fromToken };
      if (options.authToken && tokenMatches(bearer, options.authToken)) {
        return { ok: true, credentials: headerCredentials ?? envCredentials };
      }
      return { ok: false, challenge: oauth?.challenge("invalid_token") };
    }
    if (options.authToken) return { ok: false, challenge: oauth?.challenge() };
    if (headerCredentials) return { ok: true, credentials: headerCredentials };
    if (oauth) return { ok: false, challenge: oauth.challenge() };
    return { ok: true };
  }

  return createHttpServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/health") return send(res, 200, { ok: true });
    if (oauth) {
      try {
        if (await oauth.handle(req, res, path)) return;
      } catch (err) {
        if (!res.headersSent) return send(res, 400, { error: "invalid_request", error_description: (err as Error).message });
        return;
      }
    }
    if (path !== "/mcp") return send(res, 404, { error: "Not found" });

    const auth = authenticate(req);
    if (!auth.ok) {
      const headers = auth.challenge ? { "WWW-Authenticate": auth.challenge } : undefined;
      return send(res, 401, { error: "Unauthorized" }, headers);
    }
    if (req.method !== "POST") {
      // Stateless mode: no SSE stream (GET) or session to delete (DELETE).
      return send(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
    }

    let body: unknown;
    try {
      body = await readJson(req);
    } catch (err) {
      return send(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: (err as Error).message }, id: null });
    }

    const server = createServer({
      credentials: auth.credentials,
      fetch: options.fetch,
      templates,
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) {
        send(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: (err as Error).message }, id: null });
      }
    }
  });
}

function tokenMatches(bearer: string, token: string): boolean {
  const given = Buffer.from(bearer);
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large.");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function send(res: ServerResponse, status: number, payload: unknown, headers?: Record<string, string>) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers }).end(JSON.stringify(payload));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = Number(process.env.PORT ?? 3000);
  const authToken = process.env.MCP_AUTH_TOKEN || undefined;
  const { OAUTH_SECRET: secret, PUBLIC_URL: publicUrl } = process.env;
  if (Boolean(secret) !== Boolean(publicUrl)) {
    console.error("[imgflip-meme-mcp] OAuth needs both OAUTH_SECRET and PUBLIC_URL; OAuth is disabled.");
  }
  const allowedRedirectHosts = process.env.OAUTH_REDIRECT_HOSTS?.split(",").map((h) => h.trim()).filter(Boolean);
  const oauth = secret && publicUrl ? { secret, publicUrl, allowedRedirectHosts } : undefined;
  createMcpHttpServer({ authToken, oauth }).listen(port, () => {
    const modes = [authToken && "token", oauth && `OAuth at ${publicUrl}`].filter(Boolean).join(", ");
    console.error(`[imgflip-meme-mcp] HTTP listening on http://localhost:${port}/mcp${modes ? ` (${modes})` : ""}`);
  });
}
