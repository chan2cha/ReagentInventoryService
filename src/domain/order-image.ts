export const ORDER_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const ORDER_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export const ORDER_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export type OrderImageContentType = (typeof ORDER_IMAGE_CONTENT_TYPES)[number];

export type OrderImageUpload = {
  fileName: string;
  contentType: OrderImageContentType;
  byteSize: number;
  data: Uint8Array<ArrayBuffer>;
};

type FileMetadata = {
  name: string;
  size: number;
  type: string;
};

function normalizedFileName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isOrderImageContentType(value: string): value is OrderImageContentType {
  return (ORDER_IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

export function orderImageMetadataError(file: FileMetadata): string | null {
  const fileName = normalizedFileName(file.name);
  
  if (!fileName || fileName.length > 255) {
    return "ORDER_IMAGE_NAME_INVALID";
  }

  if (!Number.isSafeInteger(file.size) || file.size > ORDER_IMAGE_MAX_BYTES) {
    return "ORDER_IMAGE_SIZE_INVALID";
  }

  if (file.type&&!isOrderImageContentType(file.type)) {
    
    return "ORDER_IMAGE_TYPE_INVALID";
  }

  return null;
}

function matches(data: Uint8Array, expected: readonly number[], offset = 0) {
  return expected.every((value, index) => data[offset + index] === value);
}

function hasValidSignature(contentType: OrderImageContentType, data: Uint8Array) {
  if (contentType === "image/jpeg") {
    return data.length >= 3 && matches(data, [0xff, 0xd8, 0xff]);
  }

  if (contentType === "image/png") {
    return data.length >= 8 && matches(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  return (
    data.length >= 12 &&
    matches(data, [0x52, 0x49, 0x46, 0x46]) &&
    matches(data, [0x57, 0x45, 0x42, 0x50], 8)
  );
}

export async function parseOrderImageUpload(
  value: FormDataEntryValue | null
): Promise<OrderImageUpload | null> {

  if (value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    throw new Error("ORDER_IMAGE_FILE_INVALID");
  }

  if (value.size === 0) {
    return null;
  }

  const metadataError = orderImageMetadataError(value);
  if (metadataError) {
    throw new Error(metadataError);
  }

  const contentType = value.type as OrderImageContentType;
  const data = new Uint8Array(await value.arrayBuffer());

  if (data.byteLength !== value.size) {
    throw new Error("ORDER_IMAGE_SIZE_INVALID");
  }

  if (!hasValidSignature(contentType, data)) {
    throw new Error("ORDER_IMAGE_SIGNATURE_INVALID");
  }

  return {
    fileName: normalizedFileName(value.name),
    contentType,
    byteSize: data.byteLength,
    data
  };
}

export async function parseOrderImageUploads(
  values: FormDataEntryValue[]
): Promise<OrderImageUpload | null> {
  const populated = values.filter((value) => (
    typeof value === "string" || value.size !== 0
  ));

  if (populated.length > 1) {
    throw new Error("ORDER_IMAGE_MULTIPLE_FILES");
  }

  return parseOrderImageUpload(populated[0] ?? null);
}
