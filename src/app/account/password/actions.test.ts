import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  findUnique: vi.fn(),
  hashPassword: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  update: vi.fn(),
  verifyPassword: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  createSession: mocks.createSession,
  requireUser: mocks.requireUser
}));
vi.mock("@/lib/password", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique, update: mocks.update } }
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { changePassword } from "./actions";

describe("password-change session revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.findUnique.mockResolvedValue({ passwordHash: "old-hash" });
    mocks.verifyPassword.mockReturnValue(true);
    mocks.hashPassword.mockReturnValue("new-hash");
    mocks.update.mockResolvedValue({ id: "user-1", sessionVersion: 6 });
  });

  it("increments the version and replaces the current browser session", async () => {
    const data = new FormData();
    data.set("currentPassword", "current-password");
    data.set("newPassword", "new-password");
    data.set("confirmPassword", "new-password");

    await expect(changePassword(data)).rejects.toMatchObject({
      digest: expect.stringContaining("/;307;")
    });

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        passwordHash: "new-hash",
        mustChangePassword: false,
        sessionVersion: { increment: 1 }
      }),
      select: { id: true, sessionVersion: true }
    }));
    expect(mocks.createSession).toHaveBeenCalledWith("user-1", 6);
  });
});
