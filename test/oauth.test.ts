import { createHash, randomBytes } from "node:crypto";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { createMcpHttpServer } from "../src/http.js";
import { OAuthServer } from "../src/oauth/server.js";
import { Sealer } from "../src/oauth/seal.js";
import { fail, GET_MEMES, jsonOf, mockFetch, ok } from "./helpers.js";

const SECRET = "test-secret-that-is-long-enough-1234567890";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

let server: Server | undefined;
afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

async function freePort(): Promise<number> {
  const s = createNetServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address() as AddressInfo;
  await new Promise<void>((r) => s.close(() => r()));
  return port;
}

/** Fake Imgflip: valid accounts are alice/<account.password> and API key "good-key". */
const account = { password: "pw" };
afterEach(() => {
  account.password = "pw";
});

function imgflip() {
  return mockFetch({
    get_memes: () => GET_MEMES,
    caption_image: (call) => {
      const p = call.params;
      const valid =
        call.headers.Authorization === "Bearer good-key" || (p.get("username") === "alice" && p.get("password") === account.password);
      if (!valid) {
        return fail(call.headers.Authorization ? "Invalid API key" : "Invalid username/password combination");
      }
      if (!p.get("template_id")) return fail("No template_id specified");
      return ok({ url: "https://i.imgflip.com/abc.jpg", page_url: "https://imgflip.com/i/abc" });
    },
  });
}

async function start(extra: { authToken?: string; allowedRedirectHosts?: string[] } = {}) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const api = imgflip();
  const { allowedRedirectHosts, ...rest } = extra;
  server = createMcpHttpServer({
    ...rest,
    oauth: { secret: SECRET, publicUrl: base, allowedRedirectHosts },
    fetch: api.fetchFn,
  });
  await new Promise<void>((r) => server!.listen(port, "127.0.0.1", r));
  return { base, calls: api.calls };
}

const pkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};

async function register(base: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${base}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: "Claude", ...body }),
  });
  return { status: res.status, data: (await res.json()) as any };
}

/** Opens the login page and returns the sealed request field. */
async function loginRequest(base: string, clientId: string, challenge: string, extra: Record<string, string> = {}) {
  const url = new URL(`${base}/authorize`);
  const params = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "xyz",
    ...extra,
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { redirect: "manual" });
  const html = await res.text();
  return { res, html, request: html.match(/name="request" value="([^"]+)"/)?.[1] };
}

async function submitLogin(base: string, request: string, fields: Record<string, string>) {
  return fetch(`${base}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ request, ...fields }),
    redirect: "manual",
  });
}

async function tokenRequest(base: string, params: Record<string, string>, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(params),
  });
  return { status: res.status, data: (await res.json()) as any };
}

/** Full manual flow up to the authorization code. */
async function authorize(base: string, fields: Record<string, string> = { username: "alice", password: "pw" }) {
  const { data: client } = await register(base);
  const { verifier, challenge } = pkce();
  const { request } = await loginRequest(base, client.client_id, challenge);
  const res = await submitLogin(base, request!, fields);
  const location = new URL(res.headers.get("location")!);
  return { client, verifier, location, code: location.searchParams.get("code")! };
}

describe("OAuth discovery", () => {
  it("answers unauthenticated MCP requests with a 401 pointing to the metadata", async () => {
    const { base } = await start();
    const res = await fetch(`${base}/mcp`, { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`,
    );

    const prm = await (await fetch(`${base}/.well-known/oauth-protected-resource/mcp`)).json();
    expect(prm).toMatchObject({ resource: `${base}/mcp`, authorization_servers: [base] });

    const as = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
    expect(as).toMatchObject({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("still accepts X-Imgflip headers without OAuth", async () => {
    const { base } = await start();
    const client = new Client({ name: "t", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
        requestInit: { headers: { "X-Imgflip-Username": "alice", "X-Imgflip-Password": "pw" } },
      }),
    );
    const r = await client.callTool({ name: "create_meme", arguments: { template_id: "1", texts: ["a"], return_image: false } });
    expect(jsonOf(r).url).toBe("https://i.imgflip.com/abc.jpg");
    await client.close();
  });
});

describe("OAuth flow with the official MCP SDK client", () => {
  class TestProvider implements OAuthClientProvider {
    info?: OAuthClientInformationMixed;
    saved?: OAuthTokens;
    verifier = "";
    authUrl?: URL;
    get redirectUrl() {
      return REDIRECT;
    }
    get clientMetadata() {
      return { client_name: "SDK test", redirect_uris: [REDIRECT], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
    }
    clientInformation() {
      return this.info;
    }
    saveClientInformation(info: OAuthClientInformationMixed) {
      this.info = info;
    }
    tokens() {
      return this.saved;
    }
    saveTokens(tokens: OAuthTokens) {
      this.saved = tokens;
    }
    redirectToAuthorization(url: URL) {
      this.authUrl = url;
    }
    saveCodeVerifier(v: string) {
      this.verifier = v;
    }
    codeVerifier() {
      return this.verifier;
    }
  }

  it("discovers, registers, signs in and creates a meme with the user's account", async () => {
    const { base, calls } = await start();
    const provider = new TestProvider();
    const url = new URL(`${base}/mcp`);

    const first = new Client({ name: "sdk", version: "1" });
    await expect(first.connect(new StreamableHTTPClientTransport(url, { authProvider: provider }))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(provider.info?.client_id).toBeTruthy();
    expect(`${provider.authUrl!.origin}${provider.authUrl!.pathname}`).toBe(`${base}/authorize`);

    // The "browser": open the login page and submit the user's Imgflip credentials.
    const page = await fetch(provider.authUrl!);
    const request = (await page.text()).match(/name="request" value="([^"]+)"/)![1];
    const res = await submitLogin(base, request, { username: "alice", password: "pw" });
    expect(res.status).toBe(302);
    const code = new URL(res.headers.get("location")!).searchParams.get("code")!;

    const transport = new StreamableHTTPClientTransport(url, { authProvider: provider });
    await transport.finishAuth(code);
    expect(provider.saved?.access_token).toBeTruthy();
    expect(provider.saved?.refresh_token).toBeTruthy();

    const client = new Client({ name: "sdk", version: "1" });
    await client.connect(transport);
    const r = await client.callTool({ name: "create_meme", arguments: { template_id: "1", texts: ["a"], return_image: false } });
    expect(jsonOf(r).url).toBe("https://i.imgflip.com/abc.jpg");
    const caption = calls.filter((c) => c.url.endsWith("/caption_image")).at(-1)!;
    expect(caption.params.get("username")).toBe("alice");
    await client.close();
  });
});

describe("authorization endpoint", () => {
  it("re-renders the form on wrong credentials and keeps the request valid", async () => {
    const { base } = await start();
    const { data: client } = await register(base);
    const { request, res, html } = await loginRequest(base, client.client_id, pkce().challenge);
    expect(res.status).toBe(200);
    expect(html).toContain("<strong>Claude</strong>");
    expect(res.headers.get("content-security-policy")).toContain("form-action 'self' https://claude.ai");
    expect(res.headers.get("x-frame-options")).toBe("DENY");

    const wrong = await submitLogin(base, request!, { username: "alice", password: "nope" });
    expect(wrong.status).toBe(200);
    expect(await wrong.text()).toContain("Wrong Imgflip username or password.");

    const badKey = await submitLogin(base, request!, { api_key: "bad" });
    expect(await badKey.text()).toContain("Imgflip rejected this API key.");

    const empty = await submitLogin(base, request!, {});
    expect(await empty.text()).toContain("Enter an API key");

    const good = await submitLogin(base, request!, { api_key: "good-key" });
    expect(good.status).toBe(302);
    const location = new URL(good.headers.get("location")!);
    expect(location.origin + location.pathname).toBe(REDIRECT);
    expect(location.searchParams.get("state")).toBe("xyz");
    expect(location.searchParams.get("iss")).toBe(base);
  });

  it("escapes the client name", async () => {
    const { base } = await start();
    const { data: client } = await register(base, { client_name: '<script>alert(1)</script>' });
    const { html } = await loginRequest(base, client.client_id, pkce().challenge);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("rejects unknown clients and unregistered redirect URIs without redirecting", async () => {
    const { base } = await start();
    const unknown = await loginRequest(base, "forged", pkce().challenge);
    expect(unknown.res.status).toBe(400);

    const { data: client } = await register(base);
    const evil = await loginRequest(base, client.client_id, pkce().challenge, { redirect_uri: "https://evil.example/cb" });
    expect(evil.res.status).toBe(400);
    expect(evil.res.headers.get("location")).toBeNull();
  });

  it("requires PKCE S256 and a matching resource", async () => {
    const { base } = await start();
    const { data: client } = await register(base);

    const plain = await loginRequest(base, client.client_id, "abc", { code_challenge_method: "plain" });
    expect(plain.res.status).toBe(302);
    expect(new URL(plain.res.headers.get("location")!).searchParams.get("error")).toBe("invalid_request");

    const other = await loginRequest(base, client.client_id, pkce().challenge, { resource: "https://other.example/mcp" });
    expect(new URL(other.res.headers.get("location")!).searchParams.get("error")).toBe("invalid_target");

    const own = await loginRequest(base, client.client_id, pkce().challenge, { resource: `${base}/mcp` });
    expect(own.res.status).toBe(200);
  });

  it("rejects forged or tampered login requests", async () => {
    const { base } = await start();
    const res = await submitLogin(base, "tampered", { username: "alice", password: "pw" });
    expect(res.status).toBe(400);
  });
});

describe("registration", () => {
  it("only accepts Claude or loopback redirect URIs", async () => {
    const { base } = await start();
    expect((await register(base, { redirect_uris: ["http://evil.example/cb"] })).status).toBe(400);
    // Phishing / open redirect: an attacker-controlled https callback named "Claude".
    expect((await register(base, { redirect_uris: ["https://evil.example/cb"] })).status).toBe(400);
    expect((await register(base, { redirect_uris: ["https://claude.ai.evil.example/cb"] })).status).toBe(400);
    expect((await register(base, { redirect_uris: ["https://user:pw@claude.ai/cb"] })).status).toBe(400);
    expect((await register(base, { redirect_uris: ["https://claude.com/api/mcp/auth_callback"] })).status).toBe(201);
    expect((await register(base, { redirect_uris: ["javascript:alert(1)"] })).status).toBe(400);
    expect((await register(base, { redirect_uris: [] })).status).toBe(400);
    expect((await register(base, { redirect_uris: ["http://localhost:6274/callback"] })).status).toBe(201);
  });
});

describe("redirect allowlist", () => {
  it("can be configured, and invalidates clients registered for hosts no longer allowed", async () => {
    const { base } = await start({ allowedRedirectHosts: ["meme-client.example"] });
    expect((await register(base, { redirect_uris: ["https://meme-client.example/cb"] })).status).toBe(201);
    expect((await register(base, { redirect_uris: [REDIRECT] })).status).toBe(400);
    await new Promise<void>((r) => server!.close(() => r()));

    // A client_id sealed for evil.example (e.g. under an older config) is rejected and never redirected to.
    const forged = new Sealer(SECRET).seal({ t: "client", redirect_uris: ["https://evil.example/cb"], auth: "none" });
    const { base: base2 } = await start();
    const res = await loginRequest(base2, forged, pkce().challenge, { redirect_uri: "https://evil.example/cb", response_type: "bad" });
    expect(res.res.status).toBe(400);
    expect(res.res.headers.get("location")).toBeNull();
  });

  it("shows where the user will be sent back to", async () => {
    const { base } = await start();
    const { data: client } = await register(base, { client_name: "Claude" });
    const { html } = await loginRequest(base, client.client_id, pkce().challenge);
    expect(html).toContain("you will return to <strong>claude.ai</strong>");
  });
});

describe("token endpoint", () => {
  it("exchanges a code once, with PKCE, then refreshes", async () => {
    const { base } = await start();
    const { client, verifier, code } = await authorize(base);
    const exchange = { grant_type: "authorization_code", code, code_verifier: verifier, client_id: client.client_id, redirect_uri: REDIRECT };

    const badPkce = await tokenRequest(base, { ...exchange, code_verifier: "wrong" });
    expect(badPkce).toMatchObject({ status: 400, data: { error: "invalid_grant" } });

    const tokens = await tokenRequest(base, exchange);
    expect(tokens.status).toBe(200);
    expect(tokens.data).toMatchObject({ token_type: "Bearer", expires_in: 3600 });

    const replay = await tokenRequest(base, exchange);
    expect(replay).toMatchObject({ status: 400, data: { error: "invalid_grant" } });

    const refreshed = await tokenRequest(base, {
      grant_type: "refresh_token",
      refresh_token: tokens.data.refresh_token,
      client_id: client.client_id,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.data.access_token).toBeTruthy();

    // Changing the Imgflip password ends the session at the next refresh.
    account.password = "new-password";
    const revoked = await tokenRequest(base, {
      grant_type: "refresh_token",
      refresh_token: refreshed.data.refresh_token,
      client_id: client.client_id,
    });
    expect(revoked).toMatchObject({ status: 400, data: { error: "invalid_grant" } });
    account.password = "pw";

    // An access token is not a refresh token.
    const wrongType = await tokenRequest(base, { grant_type: "refresh_token", refresh_token: tokens.data.access_token, client_id: client.client_id });
    expect(wrongType.status).toBe(400);
  });

  it("binds codes to the client that requested them", async () => {
    const { base } = await start();
    const { verifier, code } = await authorize(base);
    const { data: other } = await register(base);
    const res = await tokenRequest(base, { grant_type: "authorization_code", code, code_verifier: verifier, client_id: other.client_id });
    expect(res.data.error).toBe("invalid_grant");
  });

  it("requires the client secret for confidential clients", async () => {
    const { base } = await start();
    const { data: client } = await register(base, { token_endpoint_auth_method: "client_secret_basic" });
    expect(client.client_secret).toBeTruthy();
    const { verifier, challenge } = pkce();
    const { request } = await loginRequest(base, client.client_id, challenge);
    const res = await submitLogin(base, request!, { username: "alice", password: "pw" });
    const code = new URL(res.headers.get("location")!).searchParams.get("code")!;
    const params = { grant_type: "authorization_code", code, code_verifier: verifier, client_id: client.client_id };

    expect((await tokenRequest(base, params)).status).toBe(401);
    const basic = Buffer.from(`${encodeURIComponent(client.client_id)}:${encodeURIComponent(client.client_secret)}`).toString("base64");
    const ok = await tokenRequest(base, params, { Authorization: `Basic ${basic}` });
    expect(ok.status).toBe(200);
  });

  it("rejects invalid bearer tokens on the MCP endpoint with invalid_token", async () => {
    const { base } = await start();
    const res = await fetch(`${base}/mcp`, { method: "POST", headers: { Authorization: "Bearer garbage" }, body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('error="invalid_token"');
  });

  it("keeps MCP_AUTH_TOKEN working next to OAuth", async () => {
    const { base, calls } = await start({ authToken: "static-token" });
    const client = new Client({ name: "t", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
        requestInit: { headers: { Authorization: "Bearer static-token", "X-Imgflip-Api-Key": "good-key" } },
      }),
    );
    await client.callTool({ name: "create_meme", arguments: { template_id: "1", texts: ["a"], return_image: false } });
    expect(calls.find((c) => c.url.endsWith("/caption_image") && c.params.get("template_id"))!.headers.Authorization).toBe(
      "Bearer good-key",
    );
    await client.close();
  });
});

describe("token lifetimes", () => {
  it("expires access tokens after an hour", () => {
    let now = 1_000_000_000_000;
    const oauth = new OAuthServer({ secret: SECRET, publicUrl: "https://meme.example", now: () => now });
    const sealer = new Sealer(SECRET);
    const token = sealer.seal({
      t: "access",
      cid: "c",
      creds: { kind: "apiKey", apiKey: "k" },
      aud: "https://meme.example/mcp",
      exp: Math.floor(now / 1000) + 3600,
    });
    expect(oauth.verifyAccessToken(token)).toEqual({ kind: "apiKey", apiKey: "k" });
    now += 3600 * 1000;
    expect(oauth.verifyAccessToken(token)).toBeUndefined();
  });

  it("rejects tokens for another resource or sealed with another secret", () => {
    const oauth = new OAuthServer({ secret: SECRET, publicUrl: "https://meme.example" });
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = { t: "access", cid: "c", creds: { kind: "apiKey", apiKey: "k" }, exp };
    expect(oauth.verifyAccessToken(new Sealer(SECRET).seal({ ...payload, aud: "https://other.example/mcp" }))).toBeUndefined();
    expect(
      oauth.verifyAccessToken(new Sealer("another-secret-that-is-long-enough-12345").seal({ ...payload, aud: "https://meme.example/mcp" })),
    ).toBeUndefined();
  });

  it("refuses short secrets", () => {
    expect(() => new Sealer("short")).toThrow("at least 32");
  });
});
