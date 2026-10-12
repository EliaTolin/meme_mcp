import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { credentialsFromEnv } from "../src/config.js";
import { jsonOf, textOf } from "./helpers.js";

/**
 * End-to-end against the real Imgflip API through the built stdio binary (run `npm run build` first).
 * Creates one real meme on the configured account.
 */
const hasCredentials = credentialsFromEnv() !== undefined;

async function stdioClient() {
  const client = new Client({ name: "live-test", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: ["dist/stdio.js"], env: process.env as Record<string, string> }),
  );
  return client;
}

describe.skipIf(!hasCredentials)("live Imgflip via stdio", () => {
  it("finds templates, creates a meme and reports Premium status", async () => {
    const client = await stdioClient();
    try {
      const found = jsonOf(
        await client.callTool({ name: "find_templates", arguments: { query: "preferire una cosa invece di un'altra" } }),
      );
      expect(found.count).toBeGreaterThan(0);
      const drake = found.templates.find((t: any) => t.id === "181913649");
      expect(drake).toBeDefined();

      const created = (await client.callTool({
        name: "create_meme",
        arguments: {
          template_id: drake.id,
          texts: ["Testare l'MCP a mano", "Farlo con vitest"],
          uppercase: true,
        },
      })) as CallToolResult;
      expect(created.isError, textOf(created)).toBeFalsy();
      const meme = jsonOf(created);
      expect(meme.url).toMatch(/^https:\/\/i\.imgflip\.com\/\w+\.jpg$/);
      expect(created.content.some((c) => c.type === "image")).toBe(true);
      console.log("Created:", meme.url);

      const search = (await client.callTool({ name: "search_templates", arguments: { query: "drake" } })) as CallToolResult;
      console.log("search_templates:", search.isError ? textOf(search).split("\n")[0] : "Premium OK");
    } finally {
      await client.close();
    }
  });
});

it("stdio server starts without credentials and still lists templates", async () => {
  const env = { ...process.env } as Record<string, string>;
  delete env.IMGFLIP_API_KEY;
  delete env.IMGFLIP_USERNAME;
  delete env.IMGFLIP_PASSWORD;
  const client = new Client({ name: "live-test", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ["dist/stdio.js"], env, stderr: "pipe" }));
  try {
    const data = jsonOf(await client.callTool({ name: "list_templates", arguments: { limit: 3 } }));
    expect(data.templates).toHaveLength(3);
  } finally {
    await client.close();
  }
});

