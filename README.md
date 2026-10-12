# imgflip-meme-mcp

An MCP server for making memes with the [Imgflip API](https://imgflip.com/api). Give Claude a sentence: it finds fitting templates, proposes a few options (template + text for every box) and creates the one you pick.

<p align="center"><img src="docs/example-meme.jpg" alt="Drake meme: no to scrolling for the right meme template, yes to asking Claude with imgflip-meme-mcp" width="360"></p>

## How it works

The model (Claude) does the reasoning; the MCP server provides data and actions:

1. `find_templates` / `list_templates` return the ~100 most popular templates. For well-known formats they include **when to use them** (`usage`) and **what goes in each box** (`box_roles`), from a curated catalog in `src/catalog.ts`.
2. Claude proposes 3-5 options with the captions already written.
3. `create_meme` captions the chosen template and returns the URL plus the image, so Claude can check it.

The `meme_from_sentence` MCP prompt starts this flow.

## Tools

| Tool | What it does | Account |
|---|---|---|
| `list_templates` | Popular templates with usage notes | free |
| `find_templates` | Search popular templates by concept/emotion (English or Italian) | free |
| `get_template` | Details for a template (popular IDs free, others via Premium) | free / Premium |
| `create_meme` | Caption a template | free |
| `search_templates` | Search the full database (1M+ templates) | Premium |
| `create_gif_meme` | Caption an animated GIF | Premium |
| `automeme` | Imgflip picks the template for your text | Premium |
| `ai_meme` | Imgflip writes the captions too | Premium |

On a free account the Premium tools return a clear error that points to the free alternative. Removing the watermark (`no_watermark`) is also Premium.

## Authentication

Environment variables (see `.env.example`):

- `IMGFLIP_API_KEY`: recommended; create a key in Imgflip's API Settings.
- or `IMGFLIP_USERNAME` + `IMGFLIP_PASSWORD`: your account credentials (the legacy method, still supported).

If both are set, the API key wins. Without credentials you can browse templates but not create memes.

## Installation

```bash
npm install
npm run build
```

### Claude Code

```bash
claude mcp add imgflip \
  -e IMGFLIP_USERNAME=your_username -e IMGFLIP_PASSWORD=your_password \
  -- node /absolute/path/dist/stdio.js
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "imgflip": {
      "command": "node",
      "args": ["/absolute/path/dist/stdio.js"],
      "env": { "IMGFLIP_USERNAME": "your_username", "IMGFLIP_PASSWORD": "your_password" }
    }
  }
}
```

### HTTP server (Streamable HTTP, stateless)

```bash
PORT=3000 npm run start:http      # endpoint: http://localhost:3000/mcp, health: /health
```

Imgflip credentials are sent **per request** in the `X-Imgflip-Api-Key` header, or `X-Imgflip-Username` + `X-Imgflip-Password`, so each user uses their own account.

If you set `MCP_AUTH_TOKEN`, the server requires `Authorization: Bearer <token>` and, when no credential headers are sent, falls back to the credentials in the environment. Without a token, environment credentials are **never** used over HTTP; otherwise anyone who knows the URL could create memes on your account.

## Usage

Ask in plain language, e.g. *"Make a meme about deploying on Friday evening"*. Claude searches the templates, proposes numbered options such as:

1. **This Is Fine**: "Deploying on Friday at 6pm" / "This is fine"
2. **Drake**: "Deploying on Monday morning" / "Deploying on Friday at 6:59pm"

Reply with your pick and it creates the meme and shares the link.

## Tests

```bash
npm test                 # unit + integration (mocked fetch, in-memory and HTTP MCP clients)
npm run build && IMGFLIP_USERNAME=... IMGFLIP_PASSWORD=... npm run test:live   # real API, creates 1 meme
npm run inspect          # MCP Inspector
```

Note: created memes are public via their URL (unlisted), and Imgflip may delete images with very few views.
