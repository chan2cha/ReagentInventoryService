import type { ButtonHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ createWarehouse: "/warehouses/create" }));
vi.mock("../submit-button", () => ({
  SubmitButton: ({ children, pendingLabel: _pendingLabel, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; pendingLabel?: string }) => (
    <button type="submit" {...props}>{children}</button>
  )
}));

import { CreateWarehouseDialog } from "./create-warehouse-dialog";

describe("CreateWarehouseDialog", () => {
  it("provides warehouse registration through a dialog", () => {
    const markup = renderToStaticMarkup(<CreateWarehouseDialog />);

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('name="code"');
    expect(markup).toContain('name="name"');
  });
});
