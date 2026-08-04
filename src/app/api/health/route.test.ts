import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findPolicy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    replacementPolicy: {
      findUnique: mocks.findPolicy,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DB 연결과 필수 정책 행이 정상이면 200을 반환한다", async () => {
    mocks.queryRaw.mockResolvedValue([{ value: 1 }]);
    mocks.findPolicy.mockResolvedValue({ id: "default" });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "healthy",
    });
  });

  it("필수 정책 행이 없으면 503을 반환한다", async () => {
    mocks.queryRaw.mockResolvedValue([{ value: 1 }]);
    mocks.findPolicy.mockResolvedValue(null);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      status: "unhealthy",
    });
  });

  it("DB 연결이 실패하면 503을 반환한다", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("DB unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(mocks.findPolicy).not.toHaveBeenCalled();
  });
});
