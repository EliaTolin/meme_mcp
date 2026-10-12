import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TextBox } from "../imgflip/types.js";
import type { ToolContext } from "../server.js";
import { boxSchema, errorResult, memeResult, validateBoxes, watermarkSchema } from "./shared.js";

const captionInput = {
  template_id: z.string().min(1).describe("Template ID from list_templates / find_templates / search_templates."),
  texts: z
    .array(z.string())
    .max(20)
    .optional()
    .describe("Text for each box, in box order (see box_roles). Simplest option; use `boxes` for positioning/colours."),
  boxes: z.array(boxSchema).max(20).optional().describe("Full box control. Overrides `texts`."),
  uppercase: z
    .boolean()
    .default(false)
    .describe("Uppercase all text (classic Impact style). Imgflip does not do it automatically."),
  font: z.string().optional().describe("'impact' (default), 'arial' or any Google Font name."),
  max_font_size: z.number().int().min(8).max(200).optional().describe("Max font size in px (default 50)."),
  ...watermarkSchema,
};

interface CaptionArgs {
  template_id: string;
  texts?: string[];
  boxes?: TextBox[];
  uppercase: boolean;
}

function buildBoxes(args: CaptionArgs): TextBox[] {
  const boxes: TextBox[] = args.boxes ?? (args.texts ?? []).map((text) => ({ text }));
  return args.uppercase ? boxes.map((b) => ({ ...b, text: b.text.toUpperCase() })) : boxes;
}

/** Non-blocking hint when the number of texts does not match the template. */
async function boxCountWarning(ctx: ToolContext, templateId: string, count: number): Promise<string | undefined> {
  try {
    const t = await ctx.templates.findPopularById(templateId);
    if (t && t.box_count !== count) {
      return `Template "${t.name}" has ${t.box_count} default boxes but ${count} were given; check the result.`;
    }
  } catch {
    // Template lookup is only advisory.
  }
  return undefined;
}

export function registerCreateTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "create_meme",
    {
      title: "Create a meme",
      description:
        "Caption an image template and return the meme URL (free with any Imgflip account). Give one text per box in " +
        "the order of the template's box_roles. Keep texts short and punchy. By default the generated image is also " +
        "returned so you can check it before showing it to the user.",
      inputSchema: {
        ...captionInput,
        return_image: z.boolean().default(true).describe("Also return the generated image inline."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      const boxes = buildBoxes(args);
      const invalid = validateBoxes(boxes);
      if (invalid) return errorResult(new Error(invalid));
      try {
        const [meme, warning] = await Promise.all([
          ctx.client.captionImage({
            template_id: args.template_id,
            boxes,
            font: args.font,
            max_font_size: args.max_font_size,
            no_watermark: args.no_watermark,
            watermark_text: args.watermark_text,
            watermark_position: args.watermark_position,
          }),
          boxCountWarning(ctx, args.template_id, boxes.length),
        ]);
        return memeResult(meme, {
          returnImage: args.return_image,
          fetchFn: ctx.fetchFn,
          extra: { template_id: args.template_id, texts: boxes.map((b) => b.text), ...(warning && { warning }) },
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    "create_gif_meme",
    {
      title: "Create an animated GIF meme (Premium)",
      description:
        "PREMIUM. Caption an animated GIF template (find one with list_templates/find_templates type='gif'). Same " +
        "inputs as create_meme.",
      inputSchema: {
        ...captionInput,
        watermark_position: z.enum(["bottom-left", "bottom-right", "top-left", "top-right"]).optional(),
        return_image: z.boolean().default(false).describe("Also return the GIF inline (can be large)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      const boxes = buildBoxes(args);
      const invalid = validateBoxes(boxes);
      if (invalid) return errorResult(new Error(invalid));
      try {
        const meme = await ctx.client.captionGif({
          template_id: args.template_id,
          boxes,
          font: args.font,
          max_font_size: args.max_font_size,
          no_watermark: args.no_watermark,
          watermark_text: args.watermark_text,
          watermark_position: args.watermark_position,
        });
        return memeResult(meme, {
          returnImage: args.return_image,
          fetchFn: ctx.fetchFn,
          extra: { template_id: args.template_id, texts: boxes.map((b) => b.text) },
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
