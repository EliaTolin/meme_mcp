#!/usr/bin/env node
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { credentialsFromEnv, credentialsFromHeaders } from "./config.js";
import { ImgflipClient } from "./imgflip/client.js";
import { createServer } from "./server.js";
import { TemplateService } from "./templates.js";

export interface HttpOptions {
  /** When set, clients must send `Authorization: Bearer <authToken>`; also allows the env credentials fallback. */
  authToken?: string;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
}

const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Stateless Streamable HTTP endpoint at /mcp.
 *
 * Imgflip credentials come from the X-Imgflip-Api-Key or X-Imgflip-Username / X-Imgflip-Password headers.
 * Server env credentials are only used when the endpoint is protected by MCP_AUTH_TOKEN, otherwise anyone
 * who knows the URL could create memes on the owner's account.
 */
export function createMcpHttpServer(options: HttpOptions = {}): Server {
  const envCredentials = options.authToken ? credentialsFromEnv(options.env) : undefined;
  const templates = new TemplateService(new ImgflipClient({ fetch: options.fetch }));

  return createHttpServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/health") return send(res, 200, { ok: true });
    if (path !== "/mcp") return send(res, 404, { error: "Not found" });
    if (options.authToken && !checkToken(req, options.authToken)) {
      return send(res, 401, { error: "Unauthorized" });
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
      credentials: credentialsFromHeaders(req.headers) ?? envCredentials,
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

function checkToken(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
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

function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(payload));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = Number(process.env.PORT ?? 3000);
  const authToken = process.env.MCP_AUTH_TOKEN || undefined;
  createMcpHttpServer({ authToken }).listen(port, () => {
    console.error(`[imgflip-meme-mcp] HTTP listening on http://localhost:${port}/mcp${authToken ? " (token required)" : ""}`);
  });
}
