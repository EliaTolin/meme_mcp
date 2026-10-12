# imgflip-meme-mcp

MCP server per creare meme con l'[API di Imgflip](https://imgflip.com/api). Dai una frase a Claude: lui cerca i template adatti, ti propone alcune opzioni (template + testi per ogni box) e crea quella che scegli.

<p align="center"><img src="docs/example-meme.jpg" alt="Meme Drake: no a cercare il template a mano, sì a chiederlo a Claude con imgflip-meme-mcp" width="360"></p>

## Come funziona

Il "ragionamento" lo fa il modello (Claude); l'MCP fornisce dati e azioni:

1. `find_templates` / `list_templates` restituiscono i ~100 template più popolari con, per quelli noti, **quando si usano** (`usage`) e **cosa va in ogni box** (`box_roles`), da un catalogo curato in `src/catalog.ts`.
2. Claude propone 3-5 opzioni con i testi già scritti.
3. `create_meme` crea il meme scelto, restituisce l'URL e l'immagine (così Claude può controllarla).

C'è anche un prompt MCP, `meme_from_sentence`, che avvia questo flusso.

## Strumenti

| Tool | Cosa fa | Account |
|---|---|---|
| `list_templates` | Template popolari con note d'uso | gratis |
| `find_templates` | Ricerca per concetto/emozione (IT/EN) sui popolari | gratis |
| `get_template` | Dettagli di un template (popolari gratis, altri via Premium) | gratis / Premium |
| `create_meme` | Crea il meme da template + testi | gratis |
| `search_templates` | Ricerca nell'intero database (1M+ template) | Premium |
| `create_gif_meme` | Meme su GIF animata | Premium |
| `automeme` | Imgflip sceglie il template e usa il tuo testo | Premium |
| `ai_meme` | Imgflip genera anche i testi | Premium |

Con un account gratuito i tool Premium rispondono con un errore chiaro che suggerisce l'alternativa gratuita. Anche la rimozione del watermark (`no_watermark`) è Premium.

## Autenticazione

Variabili d'ambiente (vedi `.env.example`):

- `IMGFLIP_API_KEY`: metodo consigliato, la key si crea dalle API Settings di Imgflip;
- oppure `IMGFLIP_USERNAME` + `IMGFLIP_PASSWORD`: credenziali dell'account (metodo storico, ancora funzionante).

Se ci sono entrambi i metodi, vince l'API key. Senza credenziali si possono consultare i template, ma non creare meme.

## Installazione

```bash
npm install
npm run build
```

### Claude Code

```bash
claude mcp add imgflip \
  -e IMGFLIP_USERNAME=tuo_username -e IMGFLIP_PASSWORD=tua_password \
  -- node /percorso/assoluto/dist/stdio.js
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "imgflip": {
      "command": "node",
      "args": ["/percorso/assoluto/dist/stdio.js"],
      "env": { "IMGFLIP_USERNAME": "tuo_username", "IMGFLIP_PASSWORD": "tua_password" }
    }
  }
}
```

### Server HTTP (Streamable HTTP, stateless)

```bash
PORT=3000 npm run start:http      # endpoint: http://localhost:3000/mcp, health: /health
```

Le credenziali Imgflip arrivano **per richiesta** negli header `X-Imgflip-Api-Key`, oppure `X-Imgflip-Username` + `X-Imgflip-Password`, così ogni utente usa il proprio account.

Se imposti `MCP_AUTH_TOKEN`, il server richiede `Authorization: Bearer <token>` e, in assenza di header, usa le credenziali delle variabili d'ambiente. Senza token le credenziali d'ambiente **non** vengono mai usate via HTTP: altrimenti chiunque conosca l'URL creerebbe meme con il tuo account.

## Test

```bash
npm test                 # unit + integrazione (fetch mockato, MCP in-memory e via HTTP)
npm run build && IMGFLIP_USERNAME=... IMGFLIP_PASSWORD=... npm run test:live   # API reale, crea 1 meme
npm run inspect          # MCP Inspector
```

Nota: i meme creati sono pubblici tramite URL (non elencati) e Imgflip può cancellare quelli con pochissime visualizzazioni.
