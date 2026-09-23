// @vitest-environment node
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  assertImagePixelCount,
  decodeImageBase64,
  isAvifMetadata,
  validatePngDimensions,
  validateUploadedImage,
} from "@/server/image-limits";

describe("image limits", () => {
  it("rejects malformed Base64 before decoding", () => {
    expect(() => decodeImageBase64("not-base64!")).toThrow("Invalid image data");
    expect(() => decodeImageBase64("a")).toThrow("Invalid image data");
  });

  it("enforces the pixel budget", () => {
    expect(() => assertImagePixelCount(8_192, 8_192)).not.toThrow();
    expect(() => assertImagePixelCount(8_193, 8_192)).toThrow(
      "Image dimensions exceed the allowed limit",
    );
    expect(() => assertImagePixelCount(8_000, 8_000, 4, "ushort")).toThrow(
      "Image dimensions exceed the allowed limit",
    );
    expect(() => assertImagePixelCount(8_000, 8_000, 4, "uchar", 2)).toThrow(
      "Image dimensions exceed the allowed limit",
    );

    const pngHeader = new Uint8Array(24);
    new DataView(pngHeader.buffer).setUint32(16, 8_193);
    new DataView(pngHeader.buffer).setUint32(20, 8_192);
    expect(() => validatePngDimensions(pngHeader)).toThrow(
      "Image dimensions exceed the allowed limit",
    );
  });

  it("rejects image data that only has valid metadata headers", async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();

    await expect(validateUploadedImage(png.subarray(0, 40))).rejects.toThrow("Invalid image data");
  });

  it("rejects active SVG uploads", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><script>alert(1)</script></svg>',
    );
    await expect(validateUploadedImage(svg)).rejects.toThrow("Unsupported image format");
  });

  it("recognizes AVIF reported through HEIF metadata", async () => {
    const avif = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "red" },
    })
      .avif()
      .toBuffer();
    const metadata = await validateUploadedImage(avif);
    expect(isAvifMetadata(metadata)).toBe(true);
  });
});
