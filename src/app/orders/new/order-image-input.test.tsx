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
    expect(markup).not.toContain("required");
    expect(markup).toContain("JPG, PNG, WebP");
    expect(markup).toContain("최대 3MB");
    expect(markup).toContain("이미지 선택");
  });

  it("shows an existing image without marking it for deletion", () => {
    const markup = renderToStaticMarkup(<OrderImageInput existingImage={{
      fileName: "주문서.png",
      byteSize: 2048,
      href: "/api/orders/order-1/image"
    }} />);

    expect(markup).toContain("주문서.png");
    expect(markup).toContain('href="/api/orders/order-1/image"');
    expect(markup).toContain('name="removeImage"');
    expect(markup).toContain('value=""');
    expect(markup).toContain("삭제");
  });
});
