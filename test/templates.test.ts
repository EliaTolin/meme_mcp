import { describe, expect, it } from "vitest";
import { TEMPLATE_GUIDES } from "../src/catalog.js";
import { ImgflipClient } from "../src/imgflip/client.js";
import { enrich, rankTemplates, TemplateService, tokenize } from "../src/templates.js";
import { GET_MEMES, mockFetch } from "./helpers.js";

const templates = GET_MEMES.data.memes.map((t: any) => enrich({ ...t, id: String(t.id) }));
const topNames = (query: string, n = 3) => rankTemplates(templates, query).slice(0, n).map((t) => t.name);

describe("rankTemplates", () => {
  it.each([
    ["choosing one thing instead of another, preference", "Drake Hotline Bling"],
    ["hard decision between two options, dilemma", "Two Buttons"],
    ["pretending everything is fine while it is on fire", "This Is Fine"],
    ["tutto va a fuoco ma faccio finta che vada tutto bene", "This Is Fine"],
    ["il piano si ritorce contro", "Gru's Plan"],
    ["tentazione e distrazione da una cosa nuova", "Distracted Boyfriend"],
    ["la riunione col capo al lavoro", "Boardroom Meeting Suggestion"],
    ["surprised by the obvious consequence", "Surprised Pikachu"],
  ])("%s -> %s", (query, expected) => {
    expect(topNames(query)).toContain(expected);
  });

  it("matches template names directly", () => {
    expect(topNames("drake", 2)).toEqual(expect.arrayContaining(["Drake Hotline Bling"]));
  });

  it("returns nothing for stopword-only or unrelated queries", () => {
    expect(rankTemplates(templates, "il the di")).toEqual([]);
    expect(rankTemplates(templates, "xyzzyqwerty")).toEqual([]);
  });

  it("tokenizes Italian accents and stopwords", () => {
    expect(tokenize("Perché è così difficile?")).toEqual(["perche", "cosi", "difficile"]);
  });
});

describe("catalog", () => {
  it("box roles match the live box_count for every curated popular template", () => {
    const mismatches = templates
      .filter((t: any) => t.box_roles && t.box_roles.length !== t.box_count)
      .map((t: any) => `${t.name}: ${t.box_roles.length} roles vs ${t.box_count} boxes`);
    expect(mismatches).toEqual([]);
  });

  it("every curated entry has usage and tags", () => {
    for (const [id, guide] of Object.entries(TEMPLATE_GUIDES)) {
      expect(guide.usage, id).toBeTruthy();
      expect(guide.tags.length, id).toBeGreaterThan(0);
    }
  });
});

describe("TemplateService", () => {
  it("caches get_memes for an hour per type", async () => {
    let now = 0;
    const { fetchFn, calls } = mockFetch({ get_memes: () => GET_MEMES });
    const service = new TemplateService(new ImgflipClient({ fetch: fetchFn }), () => now);

    await service.popular();
    await service.popular();
    expect(calls).toHaveLength(1);

    await service.popular(["gif"]);
    expect(calls).toHaveLength(2);

    now = 60 * 60 * 1000 + 1;
    await service.popular();
    expect(calls).toHaveLength(3);
  });
});
