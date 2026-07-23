import type { ButtonHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateAllergen: "/allergens/update" }));
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

import { EditAllergenDialog } from "./edit-allergen-dialog";

describe("EditAllergenDialog", () => {
  it("keeps the editable fields in a dialog instead of the list row", () => {
    const markup = renderToStaticMarkup(
      <EditAllergenDialog allergen={{
        id: "allergen-1",
        code: "EGG-01",
        name: "계란",
        category: "식품성"
      }} />
    );

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('name="allergenId"');
    expect(markup).toContain('name="code"');
    expect(markup).toContain('value="EGG-01"');
    expect(markup).not.toContain('name="minStock"');
  });
});
