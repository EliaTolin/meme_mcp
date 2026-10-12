import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ImgflipClient } from "../imgflip/client.js";
import type { Credentials } from "../imgflip/types.js";
import { errorPage, loginPage } from "./page.js";
import { Sealer } from "./seal.js";

const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_S = 30 * 24 * 60 * 60;
const CODE_TTL_S = 5 * 60;
const REQUEST_TTL_S = 15 * 60;
const MAX_FORM_BYTES = 64 * 1024;

type AuthMethod = "none" | "client_secret_post" | "client_secret_basic";

interface ClientPayload {
  t: "client";
  redirect_uris: string[];
  name?: string;
  auth: AuthMethod;
}
interface RequestPayload {
  t: "req";
  cid: string;
  redirect_uri: string;
  challenge: string;
  state?: string;
  scope?: string;
  exp: number;
}
interface CodePayload {
  t: "code";
  cid: string;
  redirect_uri: string;
  challenge: string;
  creds: Credentials;
  scope?: string;
  jti: string;
  exp: number;
}
interface TokenPayload {
  t: "access" | "refresh";
  cid: string;
  creds: Credentials;
  aud: string;
  scope?: string;
  exp: number;
}

export interface OAuthOptions {
  /** Secret used to encrypt every OAuth artefact; rotating it signs everyone out. */
  secret: string;
  /** Public origin of the server, e.g. https://mememcp.example.com */
  publicUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
}

/**
 * Stateless OAuth 2.1 authorization server for MCP clients such as claude.ai.
 *
 * The user signs in with their Imgflip credentials; these are encrypted into the access and
 * refresh tokens, so nothing is stored server-side. Client registration (RFC 7591) is stateless
 * too: the client_id is the sealed client metadata.
 */
export class OAuthServer {
  readonly issuer: string;
  readonly resource: string;
  private readonly sealer: Sealer;
  private readonly usedCodes = new Map<string, number>();
  private readonly now: () => number;

  constructor(private readonly options: OAuthOptions) {
    this.issuer = options.publicUrl.replace(/\/+$/, "");
    this.resource = `${this.issuer}/mcp`;
    this.sealer = new Sealer(options.secret);
    this.now = options.now ?? Date.now;
  }

  get resourceMetadataUrl(): string {
    return `${this.issuer}/.well-known/oauth-protected-resource/mcp`;
  }

  /** Value for WWW-Authenticate on 401 responses from the MCP endpoint. */
  challenge(error?: "invalid_token"): string {
    return `Bearer resource_metadata="${this.resourceMetadataUrl}"${error ? `, error="${error}"` : ""}`;
  }

  /** Imgflip credentials for a valid access token, otherwise undefined. */
  verifyAccessToken(token: string): Credentials | undefined {
    const p = this.sealer.open<TokenPayload>(token);
    if (!p || p.t !== "access" || p.aud !== this.resource || this.expired(p.exp)) return undefined;
    return p.creds;
  }

  /** Handles OAuth routes; returns false when the path is not an OAuth route. */
  async handle(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
    switch (path) {
      case "/.well-known/oauth-protected-resource":
      case "/.well-known/oauth-protected-resource/mcp":
        sendJson(res, 200, {
          resource: this.resource,
          authorization_servers: [this.issuer],
          bearer_methods_supported: ["header"],
          scopes_supported: ["meme"],
          resource_name: "Meme MCP (Imgflip)",
        });
        return true;
      case "/.well-known/oauth-authorization-server":
      case "/.well-known/openid-configuration":
        sendJson(res, 200, this.metadata());
        return true;
      case "/register":
        await this.register(req, res);
        return true;
      case "/authorize":
        if (req.method === "POST") await this.authorizeSubmit(req, res);
        else this.authorizePage(req, res);
        return true;
      case "/token":
        await this.token(req, res);
        return true;
      default:
        return false;
    }
  }

  private metadata() {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/authorize`,
      token_endpoint: `${this.issuer}/token`,
      registration_endpoint: `${this.issuer}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      scopes_supported: ["meme"],
    };
  }

  // --- Dynamic client registration (RFC 7591) ---

  private async register(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "invalid_request" });
    let body: Record<string, unknown>;
    try {
      body = JSON.parse((await readBody(req)).toString("utf8"));
    } catch {
      return sendJson(res, 400, { error: "invalid_client_metadata", error_description: "Body must be JSON." });
    }

    const uris = body.redirect_uris;
    if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10 || !uris.every(isAllowedRedirectUri)) {
      return sendJson(res, 400, {
        error: "invalid_redirect_uri",
        error_description: "redirect_uris must be https URLs (or http on localhost).",
      });
    }
    const requested = body.token_endpoint_auth_method;
    const auth: AuthMethod =
      requested === "client_secret_post" || requested === "client_secret_basic" ? requested : "none";
    const name = typeof body.client_name === "string" ? body.client_name.slice(0, 100) : undefined;

    const clientId = this.sealer.seal({ t: "client", redirect_uris: uris, name, auth } satisfies ClientPayload);
    sendJson(res, 201, {
      client_id: clientId,
      client_id_issued_at: Math.floor(this.now() / 1000),
      ...(auth !== "none" && { client_secret: this.sealer.mac(clientId), client_secret_expires_at: 0 }),
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: auth,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "meme",
    });
  }

  // --- Authorization endpoint ---

  private authorizePage(req: IncomingMessage, res: ServerResponse) {
    const q = new URL(req.url ?? "/", this.issuer).searchParams;
    const clientId = q.get("client_id") ?? "";
    const client = this.client(clientId);
    if (!client) return sendHtml(res, 400, errorPage("Unknown client. Remove the connector and add it again."));

    const redirectUri = q.get("redirect_uri") ?? (client.redirect_uris.length === 1 ? client.redirect_uris[0] : "");
    if (!client.redirect_uris.includes(redirectUri)) {
      return sendHtml(res, 400, errorPage("The redirect URI does not match the registered client."));
    }
    // From here on errors go back to the client.
    const state = q.get("state") ?? undefined;
    if (q.get("response_type") !== "code") {
      return redirect(res, redirectUri, { error: "unsupported_response_type", state, iss: this.issuer });
    }
    const challenge = q.get("code_challenge");
    if (!challenge || q.get("code_challenge_method") !== "S256") {
      return redirect(res, redirectUri, {
        error: "invalid_request",
        error_description: "PKCE with S256 is required.",
        state,
        iss: this.issuer,
      });
    }
    const resource = q.get("resource");
    if (resource && !this.isOwnResource(resource)) {
      return redirect(res, redirectUri, { error: "invalid_target", state, iss: this.issuer });
    }

    const request = this.sealer.seal({
      t: "req",
      cid: clientId,
      redirect_uri: redirectUri,
      challenge,
      state,
      scope: q.get("scope") ?? undefined,
      exp: this.expiresIn(REQUEST_TTL_S),
    } satisfies RequestPayload);
    sendHtml(res, 200, loginPage({ request, clientName: client.name }), redirectUri);
  }

  private async authorizeSubmit(req: IncomingMessage, res: ServerResponse) {
    const form = new URLSearchParams((await readBody(req)).toString("utf8"));
    const request = form.get("request") ?? "";
    const r = this.sealer.open<RequestPayload>(request);
    if (!r || r.t !== "req" || this.expired(r.exp) || !this.client(r.cid)) {
      return sendHtml(res, 400, errorPage("This sign-in link has expired. Start the connection again from your client."));
    }
    const clientName = this.client(r.cid)?.name;
    const page = (error: string, username?: string) =>
      sendHtml(res, 200, loginPage({ request, clientName, error, username }), r.redirect_uri);

    const apiKey = form.get("api_key")?.trim();
    const username = form.get("username")?.trim();
    const password = form.get("password") ?? "";
    let creds: Credentials;
    if (apiKey) creds = { kind: "apiKey", apiKey };
    else if (username && password) creds = { kind: "password", username, password };
    else return page("Enter an API key, or your username and password.", username);

    try {
      const valid = await new ImgflipClient({ credentials: creds, fetch: this.options.fetch }).verifyCredentials();
      if (!valid) {
        return page(creds.kind === "apiKey" ? "Imgflip rejected this API key." : "Wrong Imgflip username or password.", username);
      }
    } catch {
      return page("Could not reach Imgflip to check your credentials. Please try again.", username);
    }

    const code = this.sealer.seal({
      t: "code",
      cid: r.cid,
      redirect_uri: r.redirect_uri,
      challenge: r.challenge,
      creds,
      scope: r.scope,
      jti: randomUUID(),
      exp: this.expiresIn(CODE_TTL_S),
    } satisfies CodePayload);
    redirect(res, r.redirect_uri, { code, state: r.state, iss: this.issuer });
  }

  // --- Token endpoint ---

  private async token(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "invalid_request" });
    const raw = (await readBody(req)).toString("utf8");
    const form = (req.headers["content-type"] ?? "").includes("application/json")
      ? new URLSearchParams(Object.entries(safeJson(raw)).map(([k, v]) => [k, String(v)]))
      : new URLSearchParams(raw);

    const basic = parseBasicAuth(req.headers.authorization);
    const clientId = basic?.id ?? form.get("client_id") ?? "";
    const client = this.client(clientId);
    if (!client) return sendJson(res, 401, { error: "invalid_client" });
    if (client.auth !== "none") {
      const secret = basic?.secret ?? form.get("client_secret") ?? "";
      if (!this.sealer.verifyMac(clientId, secret)) return sendJson(res, 401, { error: "invalid_client" });
    }

    const grant = form.get("grant_type");
    if (grant === "authorization_code") {
      const c = this.sealer.open<CodePayload>(form.get("code") ?? "");
      if (!c || c.t !== "code" || this.expired(c.exp) || c.cid !== clientId || this.usedCodes.has(c.jti)) {
        return sendJson(res, 400, { error: "invalid_grant", error_description: "Invalid or expired code." });
      }
      if (form.get("redirect_uri") && form.get("redirect_uri") !== c.redirect_uri) {
        return sendJson(res, 400, { error: "invalid_grant", error_description: "redirect_uri mismatch." });
      }
      const verifier = form.get("code_verifier") ?? "";
      if (createHash("sha256").update(verifier).digest("base64url") !== c.challenge) {
        return sendJson(res, 400, { error: "invalid_grant", error_description: "PKCE verification failed." });
      }
      this.markUsed(c.jti, c.exp);
      return this.issueTokens(res, clientId, c.creds, c.scope);
    }
    if (grant === "refresh_token") {
      const t = this.sealer.open<TokenPayload>(form.get("refresh_token") ?? "");
      if (!t || t.t !== "refresh" || this.expired(t.exp) || t.cid !== clientId || t.aud !== this.resource) {
        return sendJson(res, 400, { error: "invalid_grant", error_description: "Invalid or expired refresh token." });
      }
      return this.issueTokens(res, clientId, t.creds, t.scope);
    }
    sendJson(res, 400, { error: "unsupported_grant_type" });
  }

  private issueTokens(res: ServerResponse, cid: string, creds: Credentials, scope?: string) {
    const base = { cid, creds, aud: this.resource, scope };
    sendJson(res, 200, {
      access_token: this.sealer.seal({ ...base, t: "access", exp: this.expiresIn(ACCESS_TTL_S) } satisfies TokenPayload),
      token_type: "Bearer",
      expires_in: ACCESS_TTL_S,
      refresh_token: this.sealer.seal({ ...base, t: "refresh", exp: this.expiresIn(REFRESH_TTL_S) } satisfies TokenPayload),
      scope: scope ?? "meme",
    });
  }

  // --- Helpers ---

  private client(clientId: string): ClientPayload | undefined {
    const c = this.sealer.open<ClientPayload>(clientId);
    return c?.t === "client" ? c : undefined;
  }

  private isOwnResource(resource: string): boolean {
    const normalized = resource.replace(/\/+$/, "");
    return normalized === this.resource || normalized === this.issuer;
  }

  private expiresIn(seconds: number): number {
    return Math.floor(this.now() / 1000) + seconds;
  }

  private expired(exp: number): boolean {
    return Math.floor(this.now() / 1000) >= exp;
  }

  /** Single-use codes; one process is enough since codes live five minutes. */
  private markUsed(jti: string, exp: number) {
    const nowS = Math.floor(this.now() / 1000);
    for (const [id, e] of this.usedCodes) if (e <= nowS) this.usedCodes.delete(id);
    this.usedCodes.set(jti, exp);
  }
}

function isAllowedRedirectUri(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

function parseBasicAuth(header: string | undefined): { id: string; secret: string } | undefined {
  const m = header?.match(/^Basic\s+(.+)$/i);
  if (!m) return undefined;
  const decoded = Buffer.from(m[1], "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i < 0) return undefined;
  return { id: decodeURIComponent(decoded.slice(0, i)), secret: decodeURIComponent(decoded.slice(i + 1)) };
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_FORM_BYTES) throw new Error("Request body too large.");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res
    .writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" })
    .end(JSON.stringify(payload));
}

function sendHtml(res: ServerResponse, status: number, html: string, redirectUri?: string) {
  // form-action must allow the redirect that follows the form submission.
  const formAction = ["'self'", redirectUri ? new URL(redirectUri).origin : ""].filter(Boolean).join(" ");
  res
    .writeHead(status, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action ${formAction}; frame-ancestors 'none'; base-uri 'none'`,
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    })
    .end(html);
}

function redirect(res: ServerResponse, uri: string, params: Record<string, string | undefined>) {
  const url = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  res.writeHead(302, { Location: url.toString(), "Cache-Control": "no-store" }).end();
}
