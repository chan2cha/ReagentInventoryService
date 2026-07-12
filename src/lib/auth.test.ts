import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  decodeSession: vi.fn(),
  findFirst: vi.fn(),
  isRoleAllowed: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/access", () => ({ isRoleAllowed: mocks.isRoleAllowed }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: mocks.findFirst
    }
  }
}));
vi.mock("@/lib/session-token", () => ({
  decodeSession: mocks.decodeSession,
  encodeSession: vi.fn()
}));

import { requirePageRole, requireRole, requireUser } from "./auth";

const forcedChangeUser = {
  id: "user-1",
  loginId: "forced-change-user",
  email: null,
  name: "강제 변경 사용자",
  role: "ADMIN" as const,
  mustChangePassword: true
};

describe("forced password change authorization", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "auth-test-secret";

    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: "valid-session" }))
    });
    mocks.decodeSession.mockReturnValue({
      userId: forcedChangeUser.id,
      expiresAt: Date.now() + 60_000
    });
    mocks.findFirst.mockResolvedValue(forcedChangeUser);
    mocks.isRoleAllowed.mockReturnValue(true);
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  it("allows the authenticated user lookup used by password change", async () => {
    await expect(requireUser()).resolves.toEqual(forcedChangeUser);
  });

  it("blocks direct operational action authorization", async () => {
    await expect(requireRole(["ADMIN"])).rejects.toThrow("PASSWORD_CHANGE_REQUIRED");
  });

  it("redirects protected role pages to password change", async () => {
    await expect(requirePageRole(["ADMIN"])).rejects.toThrow(
      "REDIRECT:/account/password"
    );
  });

  it("rejects a weak or placeholder session secret in production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "replace-with-a-long-random-secret");

    await expect(requireUser()).rejects.toThrow(
      "AUTH_SECRET must be a non-placeholder secret of at least 32 characters in production."
    );
    expect(mocks.decodeSession).not.toHaveBeenCalled();
  });
});
