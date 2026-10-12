import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ImgflipError } from "../imgflip/client.js";
import type { CreatedMeme, TemplateType, TextBox } from "../imgflip/types.js";

export const templateTypeSchema = z
  .enum(["image", "gif", "both"])
  .default("image")
  .describe("Template kind: static images, animated GIFs, or both.");

export function toTemplateTypes(type: "image" | "gif" | "both"): TemplateType[] {
  return type === "both" ? ["image", "gif"] : [type];
}

export const boxSchema = z.object({
  text: z.string().describe("Text for this box. May be empty to skip a box."),
  x: z.number().int().min(0).optional().describe("Left edge in px. Give x, y, width and height together or none."),
  y: z.number().int().min(0).optional().describe("Top edge in px."),
  width: z.number().int().positive().optional().describe("Box width in px."),
  height: z.number().int().positive().optional().describe("Box height in px."),
  color: z.string().optional().describe("Text colour, e.g. '#ffffff'."),
  outline_color: z.string().optional().describe("Outline colour, e.g. '#000000'."),
});

export const watermarkSchema = {
  no_watermark: z.boolean().optional().describe("Remove the imgflip.com watermark. PREMIUM."),
  watermark_text: z
    .string()
    .optional()
    .describe("Custom watermark. Free accounts may only use 'imgflip.com' or 'made at imgflip.com'."),
  watermark_position: z.enum(["bottom-left", "bottom-right", "top-left", "top-right", "huge"]).optional(),
};

/** Coordinates only render reliably when all four are set. */
export function validateBoxes(boxes: TextBox[]): string | undefined {
  if (boxes.length === 0) return "Provide at least one text (via `texts` or `boxes`).";
  if (boxes.length > 20) return "Imgflip supports at most 20 boxes.";
  for (const [i, b] of boxes.entries()) {
    const coords = [b.x, b.y, b.width, b.height].filter((v) => v !== undefined).length;
    if (coords !== 0 && coords !== 4) return `Box ${i}: set all of x, y, width, height or none of them.`;
  }
  return undefined;
}

export function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export function errorResult(err: unknown): CallToolResult {
  let text: string;
  if (err instanceof ImgflipError) {
    text = `Imgflip ${err.endpoint} failed: ${err.message}`;
    if (err.kind === "premium") {
      text +=
        "\nThis feature needs an Imgflip API Premium subscription. Free alternatives: find_templates / list_templates to pick a template, then create_meme.";
    } else if (err.kind === "auth") {
      text += "\nCheck the Imgflip credentials configured for this MCP server.";
    }
  } else {
    text = `Unexpected error: ${(err as Error)?.message ?? String(err)}`;
  }
  return { isError: true, content: [{ type: "text", text }] };
}

const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;

/** Result for a created meme, optionally with the image inlined so the model can check it. */
export async function memeResult(
  meme: CreatedMeme,
  opts: { returnImage: boolean; fetchFn?: typeof fetch; extra?: Record<string, unknown> },
): Promise<CallToolResult> {
  const result = json({ ...meme, ...opts.extra });
  if (!opts.returnImage) return result;
  try {
    const res = await (opts.fetchFn ?? fetch)(meme.url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return result;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_INLINE_IMAGE_BYTES) return result;
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? guessMime(meme.url);
    result.content.push({ type: "image", data: buf.toString("base64"), mimeType });
  } catch {
    // The URL is still usable; the preview is best-effort.
  }
  return result;
}

function guessMime(url: string): string {
  if (url.endsWith(".gif")) return "image/gif";
  if (url.endsWith(".png")) return "image/png";
  return "image/jpeg";
}
