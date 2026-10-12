export type Credentials =
  | { kind: "apiKey"; apiKey: string }
  | { kind: "password"; username: string; password: string };

export type TemplateType = "image" | "gif";

export interface Template {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  box_count: number;
  captions?: number;
}

export interface TextBox {
  text: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  outline_color?: string;
}

export type WatermarkPosition = "bottom-left" | "bottom-right" | "top-left" | "top-right" | "huge";

export interface CaptionOptions {
  template_id: string;
  boxes: TextBox[];
  font?: string;
  max_font_size?: number;
  no_watermark?: boolean;
  watermark_text?: string;
  watermark_position?: WatermarkPosition;
}

export interface CreatedMeme {
  url: string;
  page_url: string;
  template_id?: number | string;
  texts?: string[];
}

export interface AiMemeOptions {
  model?: "openai" | "classic";
  template_id?: string;
  prefix_text?: string;
  no_watermark?: boolean;
  watermark_text?: string;
  watermark_position?: WatermarkPosition;
}
