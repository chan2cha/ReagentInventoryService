import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  findUnique: vi.fn(),
  hashPassword: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
  userUpdate: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction
  }
}));

import { resetUserPassword, toggleUserActive } from "./actions";

async function expectRedirect(run: Promise<unknown>) {
  await expect(run).rejects.toMatchObject({
    digest: expect.stringContaining("/users;307;")
  });
}

describe("administrator session revocation writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "admin-1" });
    mocks.hashPassword.mockReturnValue("temporary-hash");
    mocks.transaction.mockImplementation(async (operation) => operation({
      user: { update: mocks.userUpdate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("increments the session version when an active account is disabled", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user-1", isActive: true });
    const data = new FormData();
    data.set("userId", "user-1");

    await expectRedirect(toggleUserActive(data));

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: false, sessionVersion: { increment: 1 } }
    });
  });

  it("increments the session version when an administrator resets a password", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user-1" });
    const data = new FormData();
    data.set("userId", "user-1");
    data.set("password", "temporary-password");

    await expectRedirect(resetUserPassword(data));

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "temporary-hash",
        mustChangePassword: true,
        sessionVersion: { increment: 1 }
      }
    });
  });
});
