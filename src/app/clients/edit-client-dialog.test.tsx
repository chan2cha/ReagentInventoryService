import type { ButtonHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateClient: "/clients/update" }));
vi.mock("../submit-button", () => ({
  SubmitButton: ({ children, pendingLabel: _pendingLabel, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; pendingLabel?: string }) => (
    <button type="submit" {...props}>{children}</button>
  )
}));

import { EditClientDialog } from "./edit-client-dialog";

describe("EditClientDialog", () => {
  it("keeps client edits in a dialog instead of a list row", () => {
    const markup = renderToStaticMarkup(
      <EditClientDialog client={{
        id: "client-1",
        name: "Sample Client",
        region: "Seoul",
        manager: "Manager",
        deliveryDepartment: "Laboratory",
        memo: "Note"
      }} />
    );

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('name="clientId"');
    expect(markup).toContain('name="managerName"');
    expect(markup).toContain('name="deliveryDepartment"');
  });
});
