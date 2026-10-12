import { describe, expect, it } from "vitest";
import { ImgflipClient, ImgflipError } from "../src/imgflip/client.js";
import { credentialsFromEnv, credentialsFromHeaders } from "../src/config.js";
import { fail, GET_MEMES, mockFetch, ok, PREMIUM_ERROR } from "./helpers.js";

const created = ok({ url: "https://i.imgflip.com/abc.jpg", page_url: "https://imgflip.com/i/abc" });

describe("ImgflipClient", () => {
  it("get_memes is an unauthenticated GET with the type filter", async () => {
    const { fetchFn, calls } = mockFetch({ get_memes: () => GET_MEMES });
    const client = new ImgflipClient({ fetch: fetchFn, credentials: { kind: "apiKey", apiKey: "k" } });

    const memes = await client.getMemes(["image", "gif"]);

    expect(memes.length).toBe(100);
    expect(memes[0]).toMatchObject({ id: "181913649", name: "Drake Hotline Bling", box_count: 2 });
    expect(calls[0].method).toBe("GET");
    expect(calls[0].params.get("type")).toBe("image,gif");
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  it("sends username/password as form params and encodes boxes", async () => {
    const { fetchFn, calls } = mockFetch({ caption_image: () => created });
    const client = new ImgflipClient({ fetch: fetchFn, credentials: { kind: "password", username: "u", password: "p&w" } });

    await client.captionImage({
      template_id: "181913649",
      boxes: [{ text: "no" }, { text: "sì, è così", x: 1, y: 2, width: 3, height: 4, color: "#fff" }],
      no_watermark: false,
    });

    const p = calls[0].params;
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(p.get("username")).toBe("u");
    expect(p.get("password")).toBe("p&w");
    expect(p.get("template_id")).toBe("181913649");
    expect(p.get("boxes[0][text]")).toBe("no");
    expect(p.get("boxes[1][text]")).toBe("sì, è così");
    expect(p.get("boxes[1][width]")).toBe("3");
    expect(p.get("boxes[1][color]")).toBe("#fff");
    // Imgflip treats any non-empty value as true, so false must not be sent.
    expect(p.has("no_watermark")).toBe(false);
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  it("uses a Bearer header with an API key", async () => {
    const { fetchFn, calls } = mockFetch({ caption_image: () => created });
    const client = new ImgflipClient({ fetch: fetchFn, credentials: { kind: "apiKey", apiKey: "secret" } });

    await client.captionImage({ template_id: "1", boxes: [{ text: "a" }], no_watermark: true });

    expect(calls[0].headers.Authorization).toBe("Bearer secret");
    expect(calls[0].params.has("username")).toBe(false);
    expect(calls[0].params.get("no_watermark")).toBe("1");
  });

  it("classifies premium errors", async () => {
    const { fetchFn } = mockFetch({ search_memes: () => fail(PREMIUM_ERROR) });
    const client = new ImgflipClient({ fetch: fetchFn, credentials: { kind: "apiKey", apiKey: "k" } });

    const err = await client.searchMemes("drake").catch((e) => e);
    expect(err).toBeInstanceOf(ImgflipError);
    expect(err.kind).toBe("premium");
    expect(err.endpoint).toBe("search_memes");
  });

  it("fails before calling the API when credentials are missing", async () => {
    const { fetchFn, calls } = mockFetch({});
    const client = new ImgflipClient({ fetch: fetchFn });

    const err = await client.captionImage({ template_id: "1", boxes: [{ text: "a" }] }).catch((e) => e);
    expect(err.kind).toBe("auth");
    expect(calls).toHaveLength(0);
  });

  it("reports non-JSON responses", async () => {
    const { fetchFn } = mockFetch({ get_memes: () => new Response("<html>", { status: 502 }) });
    const err = await new ImgflipClient({ fetch: fetchFn }).getMemes().catch((e) => e);
    expect(err.kind).toBe("http");
    expect(err.message).toContain("502");
  });

  it("passes ai_meme and automeme parameters", async () => {
    const { fetchFn, calls } = mockFetch({ ai_meme: () => created, automeme: () => created });
    const client = new ImgflipClient({ fetch: fetchFn, credentials: { kind: "apiKey", apiKey: "k" } });

    await client.aiMeme({ model: "classic", prefix_text: "monday", template_id: "61579" });
    await client.automeme("i missed the bus");

    expect(Object.fromEntries(calls[0].params)).toEqual({ model: "classic", prefix_text: "monday", template_id: "61579" });
    expect(Object.fromEntries(calls[1].params)).toEqual({ text: "i missed the bus" });
  });
});

describe("credentials", () => {
  it("prefers the API key over username/password", () => {
    expect(credentialsFromEnv({ IMGFLIP_API_KEY: "k", IMGFLIP_USERNAME: "u", IMGFLIP_PASSWORD: "p" })).toEqual({
      kind: "apiKey",
      apiKey: "k",
    });
    expect(credentialsFromEnv({ IMGFLIP_USERNAME: "u", IMGFLIP_PASSWORD: "p" })).toEqual({
      kind: "password",
      username: "u",
      password: "p",
    });
    expect(credentialsFromEnv({ IMGFLIP_USERNAME: "u" })).toBeUndefined();
    expect(credentialsFromEnv({ IMGFLIP_API_KEY: "  " })).toBeUndefined();
  });

  it("reads per-request headers", () => {
    expect(credentialsFromHeaders({ "x-imgflip-username": "u", "x-imgflip-password": "p" })).toEqual({
      kind: "password",
      username: "u",
      password: "p",
    });
    expect(credentialsFromHeaders({ "x-imgflip-api-key": "k" })).toEqual({ kind: "apiKey", apiKey: "k" });
    expect(credentialsFromHeaders({})).toBeUndefined();
  });
});
