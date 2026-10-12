import type { IncomingHttpHeaders } from "node:http";
import type { Credentials } from "./imgflip/types.js";

type Env = Record<string, string | undefined>;

/** API key wins over username/password when both are present. */
export function credentialsFromEnv(env: Env = process.env): Credentials | undefined {
  return pickCredentials(env.IMGFLIP_API_KEY, env.IMGFLIP_USERNAME, env.IMGFLIP_PASSWORD);
}

/** Per-request credentials for the HTTP transport. */
export function credentialsFromHeaders(headers: IncomingHttpHeaders): Credentials | undefined {
  const one = (name: string) => {
    const v = headers[name];
    return Array.isArray(v) ? v[0] : v;
  };
  return pickCredentials(one("x-imgflip-api-key"), one("x-imgflip-username"), one("x-imgflip-password"));
}

function pickCredentials(apiKey?: string, username?: string, password?: string): Credentials | undefined {
  if (apiKey?.trim()) return { kind: "apiKey", apiKey: apiKey.trim() };
  if (username?.trim() && password) return { kind: "password", username: username.trim(), password };
  return undefined;
}
