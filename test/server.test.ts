import { describe, expect, it } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { connect, fail, GET_MEMES, jsonOf, mockFetch, ok, PREMIUM_ERROR, textOf } from "./helpers.js";

const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const creds = { kind: "password" as const, username: "u", password: "p" };

function api(extra: Record<string, any> = {}) {
  return mockFetch({
    get_memes: () => GET_MEMES,
    caption_image: () => ok({ url: "https://i.imgflip.com/abc.jpg", page_url: "https://imgflip.com/i/abc" }),
    "i.imgflip.com": () => new Response(PNG, { headers: { "content-type": "image/jpeg" } }),
    ...extra,
  });
}

describe("MCP server", () => {
  it("exposes all tools and the prompt", async () => {
    const client = await connect({ fetch: api().fetchFn });

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "ai_meme",
      "automeme",
      "create_gif_meme",
      "create_meme",
      "find_templates",
      "get_template",
      "list_templates",
      "search_templates",
    ]);
    expect(tools.find((t) => t.name === "list_templates")?.annotations?.readOnlyHint).toBe(true);

    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(["meme_from_sentence"]);
    const prompt = await client.getPrompt({ name: "meme_from_sentence", arguments: { sentence: "il lunedì" } });
    expect((prompt.messages[0].content as any).text).toContain('"il lunedì"');

    expect(client.getInstructions()).toContain("find_templates");
  });

  it("list_templates returns enriched, compact templates", async () => {
    const client = await connect({ fetch: api().fetchFn });
    const data = jsonOf(await client.callTool({ name: "list_templates", arguments: { only_described: true, limit: 5 } }));

    expect(data.count).toBe(5);
    expect(data.templates[0]).toMatchObject({
      id: "181913649",
      name: "Drake Hotline Bling",
      box_count: 2,
      box_roles: expect.any(Array),
    });
    expect(data.templates[0].width).toBeUndefined();
  });

  it("find_templates ranks by concept and hints on no match", async () => {
    const client = await connect({ fetch: api().fetchFn });

    const hit = jsonOf(await client.callTool({ name: "find_templates", arguments: { query: "everything is fine, denial" } }));
    expect(hit.templates[0].name).toBe("This Is Fine");

    const miss = jsonOf(await client.callTool({ name: "find_templates", arguments: { query: "qwertyuiop" } }));
    expect(miss.count).toBe(0);
    expect(miss.hint).toContain("search_templates");
  });

  it("get_template answers popular IDs without the Premium endpoint", async () => {
    const { fetchFn, calls } = api({ get_meme: () => fail(PREMIUM_ERROR) });
    const client = await connect({ credentials: creds, fetch: fetchFn });

    const data = jsonOf(await client.callTool({ name: "get_template", arguments: { template_id: "55311130" } }));
    expect(data).toMatchObject({ name: "This Is Fine", source: "popular", width: expect.any(Number) });
    expect(calls.some((c) => c.url.endsWith("/get_meme"))).toBe(false);

    const premium = (await client.callTool({ name: "get_template", arguments: { template_id: "999" } })) as CallToolResult;
    expect(premium.isError).toBe(true);
    expect(textOf(premium)).toContain("Premium");
  });

  it("create_meme captions the template and returns the image", async () => {
    const { fetchFn, calls } = api();
    const client = await connect({ credentials: creds, fetch: fetchFn });

    const result = (await client.callTool({
      name: "create_meme",
      arguments: { template_id: "181913649", texts: ["Deploy di lunedì", "Deploy di venerdì sera"], uppercase: true },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    const data = jsonOf(result);
    expect(data).toMatchObject({ url: "https://i.imgflip.com/abc.jpg", page_url: "https://imgflip.com/i/abc" });
    expect(data.texts).toEqual(["DEPLOY DI LUNEDÌ", "DEPLOY DI VENERDÌ SERA"]);
    expect(data.warning).toBeUndefined();

    const image = result.content.find((c) => c.type === "image") as any;
    expect(image).toMatchObject({ mimeType: "image/jpeg", data: PNG.toString("base64") });

    const caption = calls.find((c) => c.url.endsWith("/caption_image"))!;
    expect(caption.params.get("boxes[0][text]")).toBe("DEPLOY DI LUNEDÌ");
    expect(caption.params.get("username")).toBe("u");
  });

  it("create_meme warns on a box count mismatch and skips the image when asked", async () => {
    const client = await connect({ credentials: creds, fetch: api().fetchFn });

    const result = (await client.callTool({
      name: "create_meme",
      arguments: { template_id: "87743020", texts: ["only one"], return_image: false },
    })) as CallToolResult;

    expect(jsonOf(result).warning).toContain("3 default boxes");
    expect(result.content.some((c) => c.type === "image")).toBe(false);
  });

  it("create_meme still succeeds when the image preview cannot be fetched", async () => {
    const { fetchFn } = api({ "i.imgflip.com": () => new Response("", { status: 500 }) });
    const client = await connect({ credentials: creds, fetch: fetchFn });

    const result = (await client.callTool({
      name: "create_meme",
      arguments: { template_id: "181913649", texts: ["a", "b"] },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
  });

  it("create_meme validates input before calling Imgflip", async () => {
    const { fetchFn, calls } = api();
    const client = await connect({ credentials: creds, fetch: fetchFn });

    const empty = (await client.callTool({ name: "create_meme", arguments: { template_id: "1" } })) as CallToolResult;
    expect(empty.isError).toBe(true);

    const partial = (await client.callTool({
      name: "create_meme",
      arguments: { template_id: "1", boxes: [{ text: "a", x: 10 }] },
    })) as CallToolResult;
    expect(partial.isError).toBe(true);
    expect(textOf(partial)).toContain("x, y, width, height");

    expect(calls.some((c) => c.url.endsWith("/caption_image"))).toBe(false);
  });

  it("create_meme reports missing credentials", async () => {
    const client = await connect({ fetch: api().fetchFn });
    const result = (await client.callTool({
      name: "create_meme",
      arguments: { template_id: "181913649", texts: ["a", "b"] },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("IMGFLIP_USERNAME");
  });

  it.each([
    ["search_templates", { query: "boromir" }, "search_memes"],
    ["create_gif_meme", { template_id: "1", texts: ["a"] }, "caption_gif"],
    ["automeme", { text: "i missed the bus" }, "automeme"],
    ["ai_meme", { prefix_text: "monday" }, "ai_meme"],
  ])("%s explains Premium errors with a free alternative", async (tool, args, endpoint) => {
    const client = await connect({ credentials: creds, fetch: api({ [endpoint]: () => fail(PREMIUM_ERROR) }).fetchFn });

    const result = (await client.callTool({ name: tool, arguments: args })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`Imgflip ${endpoint} failed`);
    expect(textOf(result)).toContain("create_meme");
  });

  it("search_templates returns enriched results on Premium accounts", async () => {
    const memes = GET_MEMES.data.memes.slice(0, 3);
    const client = await connect({ credentials: creds, fetch: api({ search_memes: () => ok({ memes }) }).fetchFn });

    const data = jsonOf(await client.callTool({ name: "search_templates", arguments: { query: "drake", limit: 2 } }));
    expect(data.count).toBe(2);
    expect(data.templates[0]).toMatchObject({ name: "Drake Hotline Bling", usage: expect.any(String) });
  });

  it("ai_meme returns generated texts", async () => {
    const memeData = { url: "https://i.imgflip.com/x.jpg", page_url: "p", template_id: 61579, texts: ["a", "b"] };
    const { fetchFn, calls } = api({ ai_meme: () => ok(memeData) });
    const client = await connect({ credentials: creds, fetch: fetchFn });

    const result = await client.callTool({
      name: "ai_meme",
      arguments: { prefix_text: "monday", return_image: false },
    });
    expect(jsonOf(result)).toEqual(memeData);
    expect(calls.find((c) => c.url.endsWith("/ai_meme"))!.params.get("model")).toBe("openai");
  });
});
