import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the correct password and rejects a wrong password", () => {
    const hash = hashPassword("secure-password");
    expect(verifyPassword("secure-password", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects malformed hashes", () => {
    expect(verifyPassword("password", "plain-text")).toBe(false);
    expect(verifyPassword("password", "pbkdf2:sha256:0:salt:hash")).toBe(false);
  });
});
