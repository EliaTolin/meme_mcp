import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { enrich, type EnrichedTemplate } from "../templates.js";
import type { ToolContext } from "../server.js";
import { errorResult, json, templateTypeSchema, toTemplateTypes } from "./shared.js";

/** Compact shape for lists: keeps the token cost of 100 templates low. */
function summary(t: EnrichedTemplate & { score?: number }) {
  return {
    id: t.id,
    name: t.name,
    box_count: t.box_count,
    ...(t.usage && { usage: t.usage }),
    ...(t.box_roles && { box_roles: t.box_roles }),
    ...(t.score !== undefined && { score: t.score }),
    url: t.url,
  };
}

export function registerTemplateTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "list_templates",
    {
      title: "List popular meme templates",
      description:
        "List the ~100 most popular Imgflip templates (free, no Premium needed). Each entry has id, name, box_count " +
        "(number of text boxes) and, for well-known formats, `usage` (when the joke fits) and `box_roles` (what goes in " +
        "each box, in order). Use this to pick the best formats for a sentence when find_templates is too narrow.",
      inputSchema: {
        type: templateTypeSchema,
        only_described: z
          .boolean()
          .default(false)
          .describe("Only return templates that have curated usage notes."),
        limit: z.number().int().min(1).max(100).default(100),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ type, only_described, limit }) => {
      try {
        let templates = await ctx.templates.popular(toTemplateTypes(type));
        if (only_described) templates = templates.filter((t) => t.usage);
        return json({ count: Math.min(templates.length, limit), templates: templates.slice(0, limit).map(summary) });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "find_templates",
    {
      title: "Find templates for an idea",
      description:
        "Keyword search over the popular templates and their curated usage notes (free). Pass a short query describing " +
        "the joke's structure or emotion in English or Italian (e.g. 'choice between two options', 'pretending everything " +
        "is fine', 'plan backfires'), not the literal sentence. Results are ranked by score. Search with several " +
        "different queries if needed, or fall back to list_templates.",
      inputSchema: {
        query: z.string().min(1).describe("Concept, structure or emotion of the joke."),
        type: templateTypeSchema,
        limit: z.number().int().min(1).max(30).default(8),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, type, limit }) => {
      try {
        const results = await ctx.templates.find(query, { type: toTemplateTypes(type), limit });
        return json({
          query,
          count: results.length,
          templates: results.map(summary),
          ...(results.length === 0 && {
            hint: "No keyword match. Try other words, call list_templates, or search_templates (Premium) for the full database.",
          }),
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "get_template",
    {
      title: "Get template details",
      description:
        "Details for one template ID: name, image url, size, box_count and usage notes. Popular templates are answered " +
        "for free; other IDs fall back to Imgflip's Premium get_meme endpoint.",
      inputSchema: { template_id: z.string().min(1).describe("Imgflip template ID, e.g. '181913649'.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ template_id }) => {
      try {
        const popular = await ctx.templates.findPopularById(template_id);
        if (popular) return json({ ...popular, source: "popular" });
        const template = await ctx.client.getMeme(template_id);
        return json({ ...enrich(template), source: "get_meme" });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "search_templates",
    {
      title: "Search all templates (Premium)",
      description:
        "PREMIUM. Search Imgflip's full database of 1M+ user-uploaded templates by name. Use when the user wants a " +
        "specific template that is not among the popular ones. The database is uncurated: prefer results with many " +
        "captions.",
      inputSchema: {
        query: z.string().min(1).describe("Template name or keywords, e.g. 'Boromir lord of the rings'."),
        type: templateTypeSchema,
        include_nsfw: z.boolean().default(false),
        limit: z.number().int().min(1).max(50).default(15),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, type, include_nsfw, limit }) => {
      try {
        const results = await ctx.client.searchMemes(query, { type: toTemplateTypes(type), includeNsfw: include_nsfw });
        const templates = results.slice(0, limit).map((t) => ({ ...summary(enrich(t)), captions: t.captions }));
        return json({ query, count: templates.length, templates });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
