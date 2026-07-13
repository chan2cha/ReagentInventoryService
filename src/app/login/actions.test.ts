import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  findUnique: vi.fn(),
  verifyLoginPassword: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ createSession: mocks.createSession }));
vi.mock("@/lib/password", () => ({
  verifyLoginPassword: mocks.verifyLoginPassword
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } }
}));

import { login } from "./actions";

async function captureRedirect(data: FormData) {
  try {
    await login(data);
  } catch (error) {
    return typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : "";
  }

  throw new Error("Expected login redirect");
}

function credentials() {
  const data = new FormData();
  data.set("loginId", "unknown-user");
  data.set("password", "submitted-password");
  return data;
}

describe("login credential failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyLoginPassword.mockReturnValue(false);
  });

  it("verifies a dummy hash before rejecting an unknown account", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const digest = await captureRedirect(credentials());

    expect(mocks.verifyLoginPassword).toHaveBeenCalledOnce();
    expect(mocks.verifyLoginPassword).toHaveBeenCalledWith("submitted-password", undefined);
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(digest).toContain("/login;307;");
  });

  it("uses the same failure response after verifying an inactive account", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "inactive-user",
      isActive: false,
      mustChangePassword: false,
      sessionVersion: 7,
      passwordHash: "stored-password-hash"
    });

    const digest = await captureRedirect(credentials());

    expect(mocks.verifyLoginPassword).toHaveBeenCalledOnce();
    expect(mocks.verifyLoginPassword).toHaveBeenCalledWith(
      "submitted-password",
      "stored-password-hash"
    );
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(digest).toContain("/login;307;");
  });

  it("binds a successful session to the user's current session version", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "active-user",
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 7,
      passwordHash: "stored-password-hash"
    });
    mocks.verifyLoginPassword.mockReturnValue(true);

    const digest = await captureRedirect(credentials());

    expect(mocks.createSession).toHaveBeenCalledWith("active-user", 7);
    expect(digest).toContain("/;307;");
  });
});
