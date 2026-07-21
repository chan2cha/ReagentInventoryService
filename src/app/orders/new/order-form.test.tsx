import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ createOrder: "/orders/new" }));
vi.mock("@/app/progress-link", () => ({
  ProgressLink: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
  }) => <a {...props}>{children}</a>
}));
vi.mock("../../submit-button", () => ({
  SubmitButton: ({
    children,
    pendingLabel: _pendingLabel,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    pendingLabel?: string;
  }) => <button type="submit" {...props}>{children}</button>
}));

import { OrderForm } from "./order-form";

describe("OrderForm", () => {
  it("uses searchable client and reagent controls while preserving submitted IDs", () => {
    const markup = renderToStaticMarkup(
      <OrderForm
        allergens={[{ id: "allergen-1", code: "R-001", name: "난백" }]}
        clients={[{
          id: "client-1",
          name: "서울병원",
          region: "서울 강남구",
          manager: "김담당",
          deliveryDepartment: "진단검사의학과"
        }]}
      />
    );

    expect(markup).not.toContain("<select");
    expect(markup).toContain("거래처명, 지역, 담당자, 납품과 검색");
    expect(markup).toContain("시약 코드 또는 시약명 검색");
    expect(markup).toMatch(/type="hidden" name="clientId" value=""/);
    expect(markup).toMatch(/type="hidden" name="allergenId" value=""/);
    expect(markup.indexOf('name="allergenId"')).toBeLessThan(markup.indexOf('name="quantity"'));
    expect(markup).toContain('name="image"');
  });
});
