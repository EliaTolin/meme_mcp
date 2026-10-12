#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { credentialsFromEnv } from "./config.js";
import { createServer } from "./server.js";

const credentials = credentialsFromEnv();
if (!credentials) {
  // stdout is the MCP channel, so diagnostics go to stderr.
  console.error(
    "[imgflip-meme-mcp] No Imgflip credentials: template browsing works, creating memes will fail. " +
      "Set IMGFLIP_API_KEY or IMGFLIP_USERNAME + IMGFLIP_PASSWORD.",
  );
}

const server = createServer({ credentials });
await server.connect(new StdioServerTransport());
