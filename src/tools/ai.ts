import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "../server.js";
import { errorResult, memeResult, watermarkSchema } from "./shared.js";

export function registerAiTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "automeme",
    {
      title: "Automeme (Premium)",
      description:
        "PREMIUM. Imgflip's neural network picks one of its top 2,048 templates for the text and captions it with that " +
        "exact text. Fast but less control than choosing a template yourself; works best with short, simple sentences.",
      inputSchema: {
        text: z.string().min(1).describe("Text to show on the meme; also used to choose the template."),
        no_watermark: watermarkSchema.no_watermark,
        return_image: z.boolean().default(true),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ text, no_watermark, return_image }) => {
      try {
        const meme = await ctx.client.automeme(text, { no_watermark });
        return memeResult(meme, { returnImage: return_image, fetchFn: ctx.fetchFn });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "ai_meme",
    {
      title: "AI-generated meme (Premium)",
      description:
        "PREMIUM. Imgflip writes the captions itself, from a topic (`prefix_text`) and optionally a template. Model " +
        "'openai' (default) supports the top ~94 popular templates; 'classic' only 48 and may produce vulgar text.",
      inputSchema: {
        prefix_text: z.string().max(64).optional().describe("Topic or seed text, max 64 characters."),
        template_id: z.string().optional().describe("Template to use; random if omitted."),
        model: z.enum(["openai", "classic"]).default("openai"),
        ...watermarkSchema,
        return_image: z.boolean().default(true),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ return_image, ...options }) => {
      try {
        const meme = await ctx.client.aiMeme(options);
        return memeResult(meme, { returnImage: return_image, fetchFn: ctx.fetchFn });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
