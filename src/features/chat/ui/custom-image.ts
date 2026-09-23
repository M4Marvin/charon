import { MAX_IMAGE_PIXELS, MAX_IMAGE_UPLOAD_BYTES } from "@/lib/image-optimization";

const MAX_DIM = 1280;

export function fileToDownscaledDataUrl(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return Promise.reject(
      new Error(`File too large (max ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)} MB).`),
    );
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0 ||
        width * height > MAX_IMAGE_PIXELS
      ) {
        reject(new Error("Image dimensions exceed the allowed limit"));
        return;
      }

      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height, 1);
      const outputWidth = Math.round(width * ratio);
      const outputHeight = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, outputWidth, outputHeight);

      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = outputType === "image/png" ? undefined : 0.85;
      resolve(canvas.toDataURL(outputType, quality as never));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
