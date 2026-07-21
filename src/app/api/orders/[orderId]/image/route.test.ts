import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findUnique: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orderImage: {
      findUnique: mocks.findUnique
    }
  }
}));

import { GET } from "./route";

const user = {
  id: "user-1",
  loginId: "viewer",
  email: null,
  name: "조회 사용자",
  role: "VIEWER" as const,
  mustChangePassword: false
};

const image = {
  fileName: "주문서.jpg",
  contentType: "image/jpeg",
  byteSize: 5,
  data: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0x00])
};

function request(orderId = "order-1") {
  return GET(
    new Request(`http://localhost/api/orders/${orderId}/image`),
    { params: Promise.resolve({ orderId }) }
  );
}

async function json(response: Response) {
  return await response.json() as { code: string; message: string };
}

describe("GET /api/orders/[orderId]/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.findUnique.mockResolvedValue(image);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an unauthenticated request before querying image data", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await request();

    expect(response.status).toBe(401);
    expect(await json(response)).toEqual({
      code: "UNAUTHENTICATED",
      message: "로그인이 필요합니다."
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a session that still requires a password change", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...user, mustChangePassword: true });

    const response = await request();

    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("serves an image to an authenticated viewer with private security headers", async () => {
    const response = await request();

    expect(response.status).toBe(200);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      select: {
        fileName: true,
        contentType: true,
        byteSize: true,
        data: true
      }
    });
    expect(Array.from(new Uint8Array(await response.arrayBuffer())))
      .toEqual(Array.from(image.data));
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("content-length")).toBe("5");
    expect(response.headers.get("content-disposition")).toContain(
      "inline; filename=\"order-image.jpg\"; filename*=UTF-8''"
    );
    expect(response.headers.get("content-disposition")).toContain(
      "%EC%A3%BC%EB%AC%B8%EC%84%9C.jpg"
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("returns 404 when the order has no image", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await request("order-without-image");

    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({ code: "ORDER_IMAGE_NOT_FOUND" });
  });

  it.each([
    ["application/octet-stream", image.byteSize],
    ["image/jpeg", image.byteSize + 1]
  ])("does not serve invalid stored image metadata (%s)", async (contentType, byteSize) => {
    mocks.findUnique.mockResolvedValue({ ...image, contentType, byteSize });

    const response = await request();

    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({
      code: "ORDER_IMAGE_READ_FAILED",
      message: "주문 이미지를 불러오지 못했습니다."
    });
  });

  it("returns a generic 500 response when the image query fails", async () => {
    mocks.findUnique.mockRejectedValue(new Error("database credentials leaked here"));

    const response = await request();

    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({
      code: "ORDER_IMAGE_READ_FAILED",
      message: "주문 이미지를 불러오지 못했습니다."
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });

  it("keeps stored control characters out of Content-Disposition", async () => {
    mocks.findUnique.mockResolvedValue({
      ...image,
      fileName: "..\\proof\"\r\nX-Test: injected.jpg"
    });

    const response = await request();
    const disposition = response.headers.get("content-disposition") ?? "";

    expect(response.status).toBe(200);
    expect(disposition).toContain("filename=\"order-image.jpg\"");
    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
  });
});
