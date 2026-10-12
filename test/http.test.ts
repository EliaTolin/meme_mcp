import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createMcpHttpServer, type HttpOptions } from "../src/http.js";
import { GET_MEMES, jsonOf, mockFetch, ok, textOf } from "./helpers.js";

let server: Server | undefined;
afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

async function start(options: Omit<HttpOptions, "fetch">) {
  const api = mockFetch({
    get_memes: () => GET_MEMES,
    caption_image: () => ok({ url: "https://i.imgflip.com/abc.jpg", page_url: "https://imgflip.com/i/abc" }),
  });
  server = createMcpHttpServer({ ...options, fetch: api.fetchFn });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  return { base, calls: api.calls };
}

async function mcpClient(base: string, headers: Record<string, string> = {}) {
  const client = new Client({ name: "http-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers } }));
  return client;
}

const createArgs = { template_id: "181913649", texts: ["a", "b"], return_image: false };

describe("HTTP transport", () => {
  it("serves tools and uses per-request credential headers", async () => {
    const { base, calls } = await start({});
    const client = await mcpClient(base, { "X-Imgflip-Username": "alice", "X-Imgflip-Password": "secret" });

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(8);

    const result = await client.callTool({ name: "create_meme", arguments: createArgs });
    expect(jsonOf(result).url).toBe("https://i.imgflip.com/abc.jpg");
    const caption = calls.find((c) => c.url.endsWith("/caption_image"))!;
    expect(caption.params.get("username")).toBe("alice");
    await client.close();
  });

  it("does not fall back to env credentials on an unprotected endpoint", async () => {
    const { base } = await start({ env: { IMGFLIP_USERNAME: "owner", IMGFLIP_PASSWORD: "pw" } });
    const client = await mcpClient(base);

    const result = (await client.callTool({ name: "create_meme", arguments: createArgs })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Missing Imgflip credentials");
    await client.close();
  });

  it("requires the token when MCP_AUTH_TOKEN is set and then uses env credentials", async () => {
    const { base, calls } = await start({ authToken: "t0k", env: { IMGFLIP_API_KEY: "owner-key" } });

    const denied = await fetch(`${base}/mcp`, { method: "POST", body: "{}" });
    expect(denied.status).toBe(401);
    await expect(mcpClient(base, { Authorization: "Bearer nope" })).rejects.toThrow();

    const client = await mcpClient(base, { Authorization: "Bearer t0k" });
    await client.callTool({ name: "create_meme", arguments: createArgs });
    expect(calls.find((c) => c.url.endsWith("/caption_image"))!.headers.Authorization).toBe("Bearer owner-key");
    await client.close();
  });

  it("answers health checks and rejects other methods/paths", async () => {
    const { base } = await start({});
    expect(await (await fetch(`${base}/health`)).json()).toEqual({ ok: true });
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    expect((await fetch(`${base}/mcp`)).status).toBe(405);
    expect((await fetch(`${base}/mcp`, { method: "POST", body: "{bad" })).status).toBe(400);
  });
});
