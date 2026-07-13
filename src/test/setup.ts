import { vi } from "vitest";

vi.mock("@/lib/flash-message", async () => {
  const { redirect } = await vi.importActual<typeof import("next/navigation")>("next/navigation");

  return {
    clearFlashMessage: vi.fn(),
    getFlashMessage: vi.fn().mockResolvedValue(null),
    setFlashMessage: vi.fn(),
    redirectWithFlash: vi.fn(async (path: string) => redirect(path as never))
  };
});
