import { createHmac, timingSafeEqual } from "node:crypto";

type ProgressState = {
  dateKey: string;
  guesses: string[];
};

const COOKIE_NAME = "embeddingle_progress";

function cookieSecret(): string {
  return process.env.COOKIE_SIGNING_SECRET ?? "embeddingle-cookie-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", cookieSecret()).update(payload).digest("base64url");
}

export function encodeProgress(state: ProgressState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function decodeProgress(raw: string | undefined): ProgressState | null {
  if (!raw) {
    return null;
  }
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as ProgressState;
    if (!parsed.dateKey || !Array.isArray(parsed.guesses)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function progressCookieName(): string {
  return COOKIE_NAME;
}
