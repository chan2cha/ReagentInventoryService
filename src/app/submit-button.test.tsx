import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const formStatus = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();

  return {
    ...actual,
    useFormStatus: () => ({ pending: formStatus.pending })
  };
});

import { SubmitButton } from "./submit-button";

describe("SubmitButton", () => {
  afterEach(() => {
    formStatus.pending = false;
  });

  it("keeps the normal label and remains enabled while idle", () => {
    const markup = renderToStaticMarkup(
      <form><SubmitButton className="primary-button">저장</SubmitButton></form>
    );

    expect(markup).toContain("저장");
    expect(markup).toContain('aria-busy="false"');
    expect(markup).not.toContain("disabled");
    expect(markup).not.toContain("submit-button-spinner");
  });

  it("disables itself and renders an accessible pending label", () => {
    formStatus.pending = true;

    const markup = renderToStaticMarkup(
      <form>
        <SubmitButton className="primary-button" pendingLabel="저장 중...">저장</SubmitButton>
      </form>
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("저장 중...");
    expect(markup).toContain("submit-button-spinner");
    expect(markup).toContain('aria-live="polite"');
  });
});
