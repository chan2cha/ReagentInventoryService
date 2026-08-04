import { vi } from "vitest";

// 단위 테스트는 실제 DB에 연결하지 않지만 Prisma 모듈 생성에는 유효한 URL이 필요하다.
// 로컬 .env 파일의 존재 여부와 무관하게 테스트가 동일하게 수집되도록 더미 URL을 준다.
process.env.DATABASE_URL ??= "postgresql://unit_test:unit_test@127.0.0.1:5432/unit_test?schema=public";

vi.mock("@/lib/flash-message", async () => {
  const { redirect } = await vi.importActual<typeof import("next/navigation")>("next/navigation");

  return {
    clearFlashMessage: vi.fn(),
    getFlashMessage: vi.fn().mockResolvedValue(null),
    setFlashMessage: vi.fn(),
    redirectWithFlash: vi.fn(async (path: string) => redirect(path as never))
  };
});
