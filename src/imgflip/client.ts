import type {
  AiMemeOptions,
  CaptionOptions,
  CreatedMeme,
  Credentials,
  Template,
  TemplateType,
  TextBox,
} from "./types.js";

export const IMGFLIP_API_BASE = "https://api.imgflip.com";

export class ImgflipError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly kind: "api" | "http" | "auth" | "premium" = "api",
  ) {
    super(message);
    this.name = "ImgflipError";
  }
}

type Params = Record<string, string | number | undefined>;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error_message?: string;
}

export interface ImgflipClientOptions {
  credentials?: Credentials;
  fetch?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

export class ImgflipClient {
  private readonly credentials?: Credentials;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: ImgflipClientOptions = {}) {
    this.credentials = options.credentials;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.baseUrl = options.baseUrl ?? IMGFLIP_API_BASE;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  get hasCredentials(): boolean {
    return this.credentials !== undefined;
  }

  /** Free, no auth: the ~100 most captioned templates of the last 30 days. */
  async getMemes(type: TemplateType[] = ["image"]): Promise<Template[]> {
    const data = await this.request<{ memes: Template[] }>("get_memes", "GET", { type: type.join(",") }, false);
    return data.memes.map(normalizeTemplate);
  }

  /**
   * Checks the credentials without side effects: Imgflip validates them before the template,
   * so captioning without a template_id fails with an auth error only when they are wrong.
   */
  async verifyCredentials(): Promise<boolean> {
    try {
      await this.request("caption_image", "POST", {});
      return true;
    } catch (err) {
      if (err instanceof ImgflipError && err.kind === "auth") return false;
      if (err instanceof ImgflipError && err.kind === "api") return true;
      throw err;
    }
  }

  /** Premium. */
  async searchMemes(query: string, opts: { type?: TemplateType[]; includeNsfw?: boolean } = {}): Promise<Template[]> {
    const data = await this.request<{ memes: Template[] }>("search_memes", "POST", {
      query,
      type: (opts.type ?? ["image"]).join(","),
      include_nsfw: opts.includeNsfw ? 1 : 0,
    });
    return data.memes.map(normalizeTemplate);
  }

  /** Premium. */
  async getMeme(templateId: string): Promise<Template> {
    const data = await this.request<{ meme: Template }>("get_meme", "POST", { template_id: templateId });
    return normalizeTemplate(data.meme);
  }

  /** Free (no_watermark and custom watermark_text are Premium). */
  async captionImage(options: CaptionOptions): Promise<CreatedMeme> {
    return this.request<CreatedMeme>("caption_image", "POST", captionParams(options));
  }

  /** Premium. */
  async captionGif(options: CaptionOptions): Promise<CreatedMeme> {
    return this.request<CreatedMeme>("caption_gif", "POST", captionParams(options));
  }

  /** Premium. */
  async automeme(text: string, opts: { no_watermark?: boolean } = {}): Promise<CreatedMeme> {
    return this.request<CreatedMeme>("automeme", "POST", { text, no_watermark: flag(opts.no_watermark) });
  }

  /** Premium. */
  async aiMeme(options: AiMemeOptions = {}): Promise<CreatedMeme> {
    return this.request<CreatedMeme>("ai_meme", "POST", {
      model: options.model,
      template_id: options.template_id,
      prefix_text: options.prefix_text,
      no_watermark: flag(options.no_watermark),
      watermark_text: options.watermark_text,
      watermark_position: options.watermark_position,
    });
  }

  private async request<T>(endpoint: string, method: "GET" | "POST", params: Params, auth = true): Promise<T> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") body.append(key, String(value));
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (auth) {
      if (!this.credentials) {
        throw new ImgflipError(
          "Missing Imgflip credentials: set IMGFLIP_API_KEY, or IMGFLIP_USERNAME and IMGFLIP_PASSWORD.",
          endpoint,
          "auth",
        );
      }
      if (this.credentials.kind === "apiKey") {
        headers.Authorization = `Bearer ${this.credentials.apiKey}`;
      } else {
        body.append("username", this.credentials.username);
        body.append("password", this.credentials.password);
      }
    }

    let url = `${this.baseUrl}/${endpoint}`;
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(this.timeoutMs) };
    if (method === "GET") {
      const qs = body.toString();
      if (qs) url += `?${qs}`;
    } else {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      init.body = body.toString();
    }

    let res: Response;
    try {
      res = await this.fetchFn(url, init);
    } catch (err) {
      throw new ImgflipError(`Could not reach Imgflip: ${(err as Error).message}`, endpoint, "http");
    }

    let json: ApiResponse<T>;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch {
      throw new ImgflipError(`Invalid response from Imgflip (HTTP ${res.status}).`, endpoint, "http");
    }

    if (!json.success || json.data === undefined) {
      const message = json.error_message ?? `Unknown Imgflip error (HTTP ${res.status}).`;
      throw new ImgflipError(message, endpoint, classifyError(message));
    }
    return json.data;
  }
}

function captionParams(o: CaptionOptions): Params {
  const params: Params = {
    template_id: o.template_id,
    font: o.font,
    max_font_size: o.max_font_size,
    no_watermark: flag(o.no_watermark),
    watermark_text: o.watermark_text,
    watermark_position: o.watermark_position,
  };
  o.boxes.forEach((box, i) => {
    for (const key of Object.keys(box) as (keyof TextBox)[]) {
      params[`boxes[${i}][${key}]`] = box[key];
    }
  });
  return params;
}

// Imgflip treats any non-empty value as true, so "false" must be omitted entirely.
function flag(value: boolean | undefined): string | undefined {
  return value ? "1" : undefined;
}

function classifyError(message: string): ImgflipError["kind"] {
  const m = message.toLowerCase();
  if (m.includes("premium")) return "premium";
  if (m.includes("username") || m.includes("password") || m.includes("api key") || m.includes("unauthorized")) {
    return "auth";
  }
  return "api";
}

function normalizeTemplate(t: Template): Template {
  return { ...t, id: String(t.id) };
}
