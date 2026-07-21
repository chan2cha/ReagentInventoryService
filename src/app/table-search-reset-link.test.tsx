import { describe, expect, it, vi } from "vitest";

vi.mock("./progress-link", () => ({
  ProgressLink: () => null
}));

import { clearTableSearchControls } from "./table-search-reset-link";

describe("clearTableSearchControls", () => {
  it("clears visible search, date, and select controls", () => {
    const controls = [
      { value: "reagent" },
      { value: "2026-07-01" },
      { value: "2026-07-21" },
      { value: "NORMAL" }
    ];
    const querySelectorAll = vi.fn(() => controls);
    const form = { querySelectorAll } as unknown as HTMLFormElement;

    clearTableSearchControls(form);

    expect(querySelectorAll).toHaveBeenCalledWith(
      'input:not([type="hidden"]), select'
    );
    expect(controls.map((control) => control.value)).toEqual(["", "", "", ""]);
  });
});
