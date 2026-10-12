import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createServer, type CreateServerOptions } from "../src/server.js";

export const GET_MEMES = JSON.parse(readFileSync(new URL("./fixtures/get_memes.json", import.meta.url), "utf8"));

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  params: URLSearchParams;
}

type Handler = (call: RecordedCall) => unknown | Response;

/** Fake fetch routing by endpoint name ("get_memes", "caption_image", ...) or full URL. */
export function mockFetch(routes: Record<string, Handler>) {
  const calls: RecordedCall[] = [];
  const fetchFn = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const parsed = new URL(url);
    const call: RecordedCall = {
      url,
      method: init.method ?? "GET",
      headers: (init.headers ?? {}) as Record<string, string>,
      params: init.body ? new URLSearchParams(String(init.body)) : parsed.searchParams,
    };
    calls.push(call);
    const handler = routes[url] ?? routes[parsed.pathname.replace(/^\//, "")] ?? routes[parsed.host];
    if (!handler) return new Response("not found", { status: 404 });
    const out = await handler(call);
    return out instanceof Response ? out : Response.json(out);
  }) as typeof fetch;
  return { fetchFn, calls };
}

export const ok = (data: unknown) => ({ success: true, data });
export const fail = (error_message: string) => ({ success: false, error_message });

export const PREMIUM_ERROR = "Your account must have an active API Premium subscription to use this endpoint";

/** Connects an MCP client to a fresh server over an in-memory transport. */
export async function connect(options: CreateServerOptions) {
  const server = createServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

export function textOf(result: unknown): string {
  const content = (result as CallToolResult).content;
  return content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n");
}

export function jsonOf<T = any>(result: unknown): T {
  return JSON.parse(textOf(result)) as T;
}
