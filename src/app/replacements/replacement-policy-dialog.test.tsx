import type { ButtonHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateReplacementPolicy: "/replacements/policy" }));
vi.mock("../submit-button", () => ({
  SubmitButton: ({
    children,
    pendingLabel: _pendingLabel,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    pendingLabel?: string;
  }) => <button type="submit" {...props}>{children}</button>
}));

import { ReplacementPolicyDialog } from "./replacement-policy-dialog";

describe("ReplacementPolicyDialog", () => {
  it("renders replacement settings in a dialog with the current policy values", () => {
    const markup = renderToStaticMarkup(
      <ReplacementPolicyDialog detectionDays={60} minimumDeliveryShelfDays={180} />
    );

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain("교환 기준 설정");
    expect(markup).toContain('name="detectionDays"');
    expect(markup).toContain('value="60"');
    expect(markup).toContain('name="minimumDeliveryShelfDays"');
    expect(markup).toContain('value="180"');
  });
});
