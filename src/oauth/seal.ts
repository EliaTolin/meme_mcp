import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Authenticated encryption (AES-256-GCM) for self-contained OAuth artefacts: client IDs,
 * authorization codes and tokens carry their own state, so the server needs no storage.
 */
export class Sealer {
  private readonly key: Buffer;
  private readonly macKey: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) throw new Error("OAUTH_SECRET must be at least 32 characters.");
    this.key = Buffer.from(hkdfSync("sha256", secret, "imgflip-meme-mcp", "seal", 32));
    this.macKey = Buffer.from(hkdfSync("sha256", secret, "imgflip-meme-mcp", "mac", 32));
  }

  seal(payload: object): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
  }

  open<T>(token: string): T | undefined {
    try {
      const raw = Buffer.from(token, "base64url");
      if (raw.length < 29) return undefined;
      const decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
      return JSON.parse(json) as T;
    } catch {
      return undefined;
    }
  }

  mac(value: string): string {
    return createHmac("sha256", this.macKey).update(value).digest("base64url");
  }

  verifyMac(value: string, mac: string): boolean {
    const expected = Buffer.from(this.mac(value));
    const given = Buffer.from(mac);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
