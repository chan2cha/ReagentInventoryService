import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ORDER_IMAGE_ACCEPT } from "@/domain/order-image";
import { OrderImageInput } from "./order-image-input";

describe("OrderImageInput", () => {
  it("renders one optional image input with the supported formats and limit guidance", () => {
    const markup = renderToStaticMarkup(<OrderImageInput />);

    expect(markup).toContain('name="image"');
    expect(markup).toContain('type="file"');
    expect(markup).toContain(`accept="${ORDER_IMAGE_ACCEPT}"`);
    expect(markup).toContain("JPG, PNG, WebP");
    expect(markup).toContain("최대 3MB");
    expect(markup).toContain("이미지 선택");
  });
});
