import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession } from "./session-token";

const secret = "test-secret";

describe("session token", () => {
  it("round-trips a valid signed session", () => {
    const token = encodeSession({ userId: "user-1", expiresAt: 2_000 }, secret);
    expect(decodeSession(token, secret, 1_000)).toEqual({ userId: "user-1", expiresAt: 2_000 });
  });

  it("rejects expired and tampered sessions", () => {
    const token = encodeSession({ userId: "user-1", expiresAt: 2_000 }, secret);
    expect(decodeSession(token, secret, 2_000)).toBeNull();
    expect(decodeSession(`${token.slice(0, -1)}0`, secret, 1_000)).toBeNull();
    expect(decodeSession(token, "wrong-secret", 1_000)).toBeNull();
  });
});
