import { describe, expect, it } from "vitest";
import {
  ORDER_IMAGE_MAX_BYTES,
  orderImageMetadataError,
  parseOrderImageUpload,
  parseOrderImageUploads
} from "./order-image";

describe("order image upload", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0x00], "order.jpg"],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "order.png"],
    ["image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "order.webp"]
  ])("accepts a valid %s signature", async (type, bytes, name) => {
    const file = new File([new Uint8Array(bytes as number[])], name as string, { type: type as string });

    await expect(parseOrderImageUpload(file)).resolves.toMatchObject({
      fileName: name,
      contentType: type,
      byteSize: bytes.length
    });
  });

  it("treats the browser's empty file value as no optional attachment", async () => {
    await expect(parseOrderImageUpload(new File([], ""))).resolves.toBeNull();
    await expect(parseOrderImageUpload(new File([], "placeholder", { type: "application/octet-stream" })))
      .resolves.toBeNull();
  });

  it("rejects unsupported types and oversized files from metadata", () => {
    expect(orderImageMetadataError({ name: "order.svg", size: 10, type: "image/svg+xml" }))
      .toBe("ORDER_IMAGE_TYPE_INVALID");
    expect(orderImageMetadataError({
      name: "order.jpg",
      size: ORDER_IMAGE_MAX_BYTES + 1,
      type: "image/jpeg"
    })).toBe("ORDER_IMAGE_SIZE_INVALID");
  });

  it("rejects a MIME type whose file signature does not match", async () => {
    const file = new File([new Uint8Array([0x3c, 0x73, 0x76, 0x67])], "fake.jpg", {
      type: "image/jpeg"
    });

    await expect(parseOrderImageUpload(file)).rejects.toThrow("ORDER_IMAGE_SIGNATURE_INVALID");
  });

  it("normalizes an untrusted display filename without using its path", async () => {
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff])],
      "C:\\fake\\\u202E  주문\r\n사진.jpg",
      { type: "image/jpeg" }
    );

    await expect(parseOrderImageUpload(file)).resolves.toMatchObject({
      fileName: "주문사진.jpg"
    });
  });

  it("rejects a manipulated request containing multiple images", async () => {
    const first = new File([new Uint8Array([0xff, 0xd8, 0xff])], "first.jpg", {
      type: "image/jpeg"
    });
    const second = new File([new Uint8Array([0xff, 0xd8, 0xff])], "second.jpg", {
      type: "image/jpeg"
    });

    await expect(parseOrderImageUploads([first, second]))
      .rejects.toThrow("ORDER_IMAGE_MULTIPLE_FILES");
  });
});
