import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  redirect: vi.fn(),
  set: vi.fn()
}));

vi.unmock("@/lib/flash-message");
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.delete,
    get: mocks.get,
    set: mocks.set
  }))
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  clearFlashMessage,
  getFlashMessage,
  redirectWithFlash,
  setFlashMessage
} from "./flash-message";

describe("flash messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a short-lived httpOnly message without putting it in a URL", async () => {
    await setFlashMessage("error", "로그인 정보가 올바르지 않습니다.");

    expect(mocks.set).toHaveBeenCalledWith(
      "reagent_flash",
      expect.not.stringContaining("로그인"),
      expect.objectContaining({ httpOnly: true, maxAge: 120, path: "/", sameSite: "lax" })
    );
  });

  it("round-trips a valid encoded message and rejects malformed values", async () => {
    const value = Buffer.from(JSON.stringify({ kind: "success", message: "저장되었습니다." }), "utf8")
      .toString("base64url");
    mocks.get.mockReturnValueOnce({ value }).mockReturnValueOnce({ value: "invalid" });

    await expect(getFlashMessage()).resolves.toEqual({ kind: "success", message: "저장되었습니다." });
    await expect(getFlashMessage()).resolves.toBeNull();
  });

  it("clears the cookie and redirects only to the clean path", async () => {
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });

    await expect(redirectWithFlash("/users", "success", "완료")).rejects.toThrow("REDIRECT:/users");
    await clearFlashMessage();

    expect(mocks.delete).toHaveBeenCalledWith("reagent_flash");
  });
});
