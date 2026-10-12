import { TEMPLATE_GUIDES, type TemplateGuide } from "./catalog.js";
import type { ImgflipClient } from "./imgflip/client.js";
import type { Template, TemplateType } from "./imgflip/types.js";

export interface EnrichedTemplate extends Template {
  usage?: string;
  box_roles?: string[];
  tags?: string[];
}

export interface ScoredTemplate extends EnrichedTemplate {
  score: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

/** Popular templates from /get_memes, cached and enriched with the curated catalog. */
export class TemplateService {
  private cache = new Map<string, { at: number; templates: EnrichedTemplate[] }>();

  constructor(
    private readonly client: ImgflipClient,
    private readonly now: () => number = Date.now,
  ) {}

  async popular(type: TemplateType[] = ["image"]): Promise<EnrichedTemplate[]> {
    const key = [...type].sort().join(",");
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < CACHE_TTL_MS) return hit.templates;

    const templates = (await this.client.getMemes(type)).map((t) => enrich(t));
    this.cache.set(key, { at: this.now(), templates });
    return templates;
  }

  /** Looks the ID up among popular templates; returns undefined if absent. */
  async findPopularById(id: string): Promise<EnrichedTemplate | undefined> {
    const all = await this.popular(["image", "gif"]);
    return all.find((t) => t.id === id);
  }

  async find(query: string, opts: { type?: TemplateType[]; limit?: number } = {}): Promise<ScoredTemplate[]> {
    const templates = await this.popular(opts.type);
    return rankTemplates(templates, query).slice(0, opts.limit ?? 10);
  }
}

export function enrich(t: Template): EnrichedTemplate {
  const guide: TemplateGuide | undefined = TEMPLATE_GUIDES[t.id];
  if (!guide) return t;
  return { ...t, usage: guide.usage, box_roles: guide.boxes, tags: guide.tags };
}

const STOPWORDS = new Set([
  // English
  "a", "an", "the", "of", "to", "in", "on", "for", "and", "or", "is", "are", "be", "it", "my", "your",
  "i", "you", "me", "we", "with", "about", "that", "this", "when", "meme",
  // Italian
  "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "da", "del", "della", "dei", "che", "e",
  "ed", "o", "per", "con", "su", "non", "mi", "ti", "si", "ci", "quando", "come", "sono", "ho", "al", "alla",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function wordScore(queryWord: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w === queryWord) return 1;
    // Cheap stemming: "deciding" ~ "decision", "scelta" ~ "scelte".
    const n = Math.min(queryWord.length, w.length);
    if (n >= 4 && queryWord.slice(0, 4) === w.slice(0, 4)) best = Math.max(best, 0.5);
  }
  return best;
}

/**
 * Ranks templates by keyword overlap with name (×3), curated tags (×2) and usage (×1).
 * Templates without any match are dropped.
 */
export function rankTemplates(templates: EnrichedTemplate[], query: string): ScoredTemplate[] {
  const queryWords = tokenize(query);
  const normalizedQuery = tokenize(query).join(" ");
  if (queryWords.length === 0) return [];

  const scored = templates.map((t) => {
    const name = tokenize(t.name);
    const tags = tokenize((t.tags ?? []).join(" "));
    const usage = tokenize(t.usage ?? "");
    let score = 0;
    for (const q of queryWords) {
      score += 3 * wordScore(q, name) + 2 * wordScore(q, tags) + wordScore(q, usage);
    }
    if (normalizedQuery.length > 2 && name.join(" ").includes(normalizedQuery)) score += 5;
    for (const tag of t.tags ?? []) {
      const phrase = tokenize(tag).join(" ");
      if (phrase.includes(" ") && normalizedQuery.includes(phrase)) score += 2;
    }
    return { ...t, score: Math.round(score * 10) / 10 };
  });

  return scored.filter((t) => t.score > 0).sort((a, b) => b.score - a.score || (b.captions ?? 0) - (a.captions ?? 0));
}
