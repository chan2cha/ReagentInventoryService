import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AppError from "./error";

describe("AppError", () => {
  it("shows a generic retry message without exposing internal error details", () => {
    const error = Object.assign(new Error("postgresql://admin:secret@production.internal/inventory"), {
      digest: "private-error-digest"
    });

    const markup = renderToStaticMarkup(<AppError error={error} reset={vi.fn()} />);

    expect(markup).toContain("요청을 처리하지 못했습니다");
    expect(markup).toContain("다시 시도");
    expect(markup).not.toContain("데이터베이스");
    expect(markup).not.toContain(error.message);
    expect(markup).not.toContain(error.digest);
  });
});
