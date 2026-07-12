import { validateHeaderValue } from "node:http";
import { describe, expect, it } from "vitest";
import { buildActionMessageUrl } from "./action-message-url";

describe("buildActionMessageUrl", () => {
  it.each(["success", "error"] as const)("creates a header-safe %s URL without changing the message", (kind) => {
    const message = "재고 수량과 이력이 반영되었습니다.";
    const url = buildActionMessageUrl("/lots", kind, message);

    expect(() => validateHeaderValue("x-action-redirect", `${url};push`)).not.toThrow();
    expect(new URL(url, "http://localhost").searchParams.get(kind)).toBe(message);
  });

  it("preserves an existing query string", () => {
    expect(buildActionMessageUrl("/lots?page=2", "success", "완료"))
      .toBe("/lots?page=2&success=%EC%99%84%EB%A3%8C");
  });
});
