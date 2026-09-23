import sharp from "sharp";

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 100_000_000;
export const MAX_IMAGE_DECODED_BYTES = 256 * 1024 * 1024;

export const MAX_IMAGE_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;

export type ImageMetadata = {
  format?: string;
  mediaType?: string;
  compression?: string;
  width?: number;
  height?: number;
  pages?: number;
  channels?: number;
  depth?: number | string;
};

export function decodeImageBase64(value: string): Buffer {
  if (!value || value.length > MAX_IMAGE_BASE64_LENGTH || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error("Invalid image data");
  }
  if (value.length % 4 === 1) throw new Error("Invalid image data");

  const bytes = Buffer.from(value, "base64");
  const normalizedInput = value.replace(/=+$/, "");
  const normalizedOutput = bytes.toString("base64").replace(/=+$/, "");
  if (bytes.length > MAX_IMAGE_BYTES || normalizedInput !== normalizedOutput) {
    throw new Error("Invalid image data");
  }
  return bytes;
}

export function assertImagePixelCount(
  width: number,
  height: number,
  channels = 4,
  depth: number | string = 8,
): void {
  const pixels = width * height;
  const bytesPerSample =
    typeof depth === "number"
      ? Math.ceil(depth / 8)
      : depth === "short" || depth === "ushort"
        ? 2
        : depth === "int" || depth === "uint" || depth === "float"
          ? 4
          : depth === "double" || depth === "complex" || depth === "dpcomplex"
            ? 8
            : 1;
  const decodedBytes = pixels * channels * bytesPerSample;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(decodedBytes) ||
    width <= 0 ||
    height <= 0 ||
    pixels > MAX_IMAGE_PIXELS ||
    decodedBytes > MAX_IMAGE_DECODED_BYTES
  ) {
    throw new Error("Image dimensions exceed the allowed limit");
  }
}

export function validatePngDimensions(bytes: Uint8Array): void {
  if (bytes.length < 24) throw new Error("Invalid PNG data");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assertImagePixelCount(view.getUint32(16), view.getUint32(20));
}

export function isAvifMetadata(metadata: ImageMetadata): boolean {
  return (
    metadata.format === "avif" ||
    (metadata.format === "heif" && metadata.mediaType === "image/avif")
  );
}

export function isUnsafeImageMetadata(metadata: ImageMetadata): boolean {
  return metadata.format === "svg";
}

export function isSupportedRasterMetadata(metadata: ImageMetadata): boolean {
  return (
    ["jpeg", "png", "webp", "tiff", "gif"].includes(metadata.format ?? "") ||
    isAvifMetadata(metadata)
  );
}

export async function validateUploadedImage(bytes: Uint8Array): Promise<ImageMetadata> {
  const metadata = await sharp(bytes, {
    failOn: "error",
    limitInputPixels: MAX_IMAGE_PIXELS,
    sequentialRead: true,
  }).metadata();

  if (isUnsafeImageMetadata(metadata) || !isSupportedRasterMetadata(metadata)) {
    throw new Error("Unsupported image format");
  }
  if (metadata.width !== undefined && metadata.height !== undefined) {
    assertImagePixelCount(metadata.width, metadata.height, metadata.channels, metadata.depth);
  }
  return metadata;
}
