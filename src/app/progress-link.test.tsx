import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const linkStatus = vi.hoisted(() => ({ pending: false }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: linkStatus.pending })
}));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();

  return {
    ...actual,
    createPortal: (children: ReactNode) => children
  };
});

import { ProgressLink } from "./progress-link";

describe("ProgressLink", () => {
  afterEach(() => {
    linkStatus.pending = false;
    vi.unstubAllGlobals();
  });

  it("renders an ordinary link without loading feedback while idle", () => {
    const markup = renderToStaticMarkup(<ProgressLink href="/lots">재고 현황</ProgressLink>);

    expect(markup).toContain('href="/lots"');
    expect(markup).toContain("재고 현황");
    expect(markup).not.toContain('role="status"');
  });

  it("exposes polite status text and hides the decorative bar while pending", () => {
    linkStatus.pending = true;
    vi.stubGlobal("document", { body: {} });

    const markup = renderToStaticMarkup(<ProgressLink href="/lots">재고 현황</ProgressLink>);

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("화면을 불러오는 중입니다.");
  });
});
