import { ORDER_IMAGE_MAX_BYTES, isOrderImageContentType } from "@/domain/order-image";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE_IMAGE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff"
} as const;

const FILE_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

function jsonError(code: string, message: string, status: number) {
  return Response.json(
    { code, message },
    {
      status,
      headers: PRIVATE_IMAGE_HEADERS
    }
  );
}

function encodedFileName(fileName: string) {
  return encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function safeFileName(fileName: string, fallback: string) {
  const normalized = fileName
    .normalize("NFKC")
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim()
    .slice(0, 255);

  return normalized || fallback;
}

function contentDisposition(fileName: string, contentType: keyof typeof FILE_EXTENSION) {
  const fallback = `order-image.${FILE_EXTENSION[contentType]}`;
  const safeName = safeFileName(fileName, fallback);

  return `inline; filename="${fallback}"; filename*=UTF-8''${encodedFileName(safeName)}`;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return jsonError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
    }

    if (user.mustChangePassword) {
      return jsonError(
        "PASSWORD_CHANGE_REQUIRED",
        "비밀번호를 변경한 뒤 주문 이미지를 확인하세요.",
        403
      );
    }

    const { orderId } = await params;
    const image = await prisma.orderImage.findUnique({
      where: { orderId },
      select: {
        fileName: true,
        contentType: true,
        byteSize: true,
        data: true
      }
    });

    if (!image) {
      return jsonError(
        "ORDER_IMAGE_NOT_FOUND",
        "주문 이미지를 찾을 수 없습니다.",
        404
      );
    }

    if (
      !isOrderImageContentType(image.contentType) ||
      !Number.isSafeInteger(image.byteSize) ||
      image.byteSize < 1 ||
      image.byteSize > ORDER_IMAGE_MAX_BYTES ||
      image.data.byteLength !== image.byteSize
    ) {
      throw new Error("ORDER_IMAGE_DATA_INVALID");
    }

    const data = Uint8Array.from(image.data);

    return new Response(data, {
      headers: {
        ...PRIVATE_IMAGE_HEADERS,
        "Content-Disposition": contentDisposition(image.fileName, image.contentType),
        "Content-Length": String(image.byteSize),
        "Content-Type": image.contentType
      }
    });
  } catch (error) {
    console.error("[order-image] image read failed", error);
    return jsonError(
      "ORDER_IMAGE_READ_FAILED",
      "주문 이미지를 불러오지 못했습니다.",
      500
    );
  }
}
