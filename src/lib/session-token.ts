import { createHmac, timingSafeEqual } from "crypto";

export type SessionPayload = {
  userId: string;
  sessionVersion: number;
  expiresAt: number;
};

function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function encodeSession(payload: SessionPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function decodeSession(value: string, secret: string, now = Date.now()): SessionPayload | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;

  const expected = sign(body, secret);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (
      !payload.userId ||
      !Number.isSafeInteger(payload.sessionVersion) ||
      payload.sessionVersion < 1 ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= now
    ) return null;
    return payload;
  } catch {
    return null;
  }
}
