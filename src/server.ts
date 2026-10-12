import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ImgflipClient } from "./imgflip/client.js";
import type { Credentials } from "./imgflip/types.js";
import { TemplateService } from "./templates.js";
import { registerAiTools } from "./tools/ai.js";
import { registerCreateTools } from "./tools/create.js";
import { registerTemplateTools } from "./tools/templates.js";

export const SERVER_NAME = "imgflip-meme-mcp";
export const SERVER_VERSION = "0.1.0";

export interface ToolContext {
  client: ImgflipClient;
  templates: TemplateService;
  fetchFn?: typeof fetch;
}

export interface CreateServerOptions {
  credentials?: Credentials;
  fetch?: typeof fetch;
  /** Share one instance across servers (HTTP mode) so the template cache is reused. */
  templates?: TemplateService;
}

const INSTRUCTIONS = `Create memes with Imgflip.

Workflow for "make a meme about <sentence>":
1. Understand the joke's structure (comparison, choice, irony, escalation, denial...).
2. Call find_templates with 1-3 short concept queries (or list_templates) to get candidates with usage notes and box_roles.
3. Propose 3-5 options to the user: template name + the exact text for each box, following box_roles order. Do not create anything yet unless the user asked for it directly.
4. When the user picks one, call create_meme with template_id and texts, check the returned image, then share the url.

create_meme, list_templates, find_templates and get_template (popular IDs) are free. search_templates, create_gif_meme, automeme and ai_meme need Imgflip API Premium.
Write the captions in the language of the user's sentence. Keep each box short.`;

export function createServer(options: CreateServerOptions = {}): McpServer {
  const client = new ImgflipClient({ credentials: options.credentials, fetch: options.fetch });
  const ctx: ToolContext = {
    client,
    templates: options.templates ?? new TemplateService(new ImgflipClient({ fetch: options.fetch })),
    fetchFn: options.fetch,
  };

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: INSTRUCTIONS });
  registerTemplateTools(server, ctx);
  registerCreateTools(server, ctx);
  registerAiTools(server, ctx);
  registerPrompts(server);
  return server;
}

function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "meme_from_sentence",
    {
      title: "Meme from a sentence",
      description: "Find fitting templates for a sentence, propose options, then create the chosen meme.",
      argsSchema: {
        sentence: z.string().describe("What the meme should be about."),
        options: z.string().optional().describe("How many options to propose (default 4)."),
      },
    },
    ({ sentence, options }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `I want a meme about: "${sentence}".\n\n` +
              `Use find_templates (and list_templates if needed) to find suitable formats. Propose ${options || "4"} ` +
              "numbered options, each with the template name, why it fits, and the exact text for every box in " +
              "box_roles order. Write the captions in the same language as my sentence. Wait for my choice, then " +
              "create it with create_meme and show me the link.",
          },
        },
      ],
    }),
  );
}
