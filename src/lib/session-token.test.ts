import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession } from "./session-token";

const secret = "test-secret";

describe("session token", () => {
  it("round-trips a valid signed session", () => {
    const token = encodeSession({ userId: "user-1", sessionVersion: 3, expiresAt: 2_000 }, secret);
    expect(decodeSession(token, secret, 1_000)).toEqual({
      userId: "user-1",
      sessionVersion: 3,
      expiresAt: 2_000
    });
  });

  it("rejects expired and tampered sessions", () => {
    const token = encodeSession({ userId: "user-1", sessionVersion: 1, expiresAt: 2_000 }, secret);
    expect(decodeSession(token, secret, 2_000)).toBeNull();
    expect(decodeSession(`${token.slice(0, -1)}0`, secret, 1_000)).toBeNull();
    expect(decodeSession(token, "wrong-secret", 1_000)).toBeNull();
  });

  it("rejects legacy and invalid session versions", () => {
    const legacyToken = encodeSession({
      userId: "user-1",
      expiresAt: 2_000
    } as never, secret);
    const invalidToken = encodeSession({
      userId: "user-1",
      sessionVersion: 0,
      expiresAt: 2_000
    }, secret);

    expect(decodeSession(legacyToken, secret, 1_000)).toBeNull();
    expect(decodeSession(invalidToken, secret, 1_000)).toBeNull();
  });
});
