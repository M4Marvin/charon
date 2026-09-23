export const IMAGE_WIDTHS = [
  48, 64, 96, 112, 128, 192, 256, 320, 340, 384, 480, 512, 640, 768, 960, 1024, 1200, 1280, 1536,
  1920, 2560,
] as const;

export const IMAGE_QUALITIES = [60, 70, 80, 90] as const;
export const DEFAULT_IMAGE_QUALITY = 80;

export type ImageWidth = (typeof IMAGE_WIDTHS)[number];
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];
export type ImagePreset = keyof typeof IMAGE_PRESETS;

export const IMAGE_PRESETS = {
  avatar: {
    width: 48,
    height: 48,
    sizes: "48px",
    breakpoints: [48, 64, 96, 128],
  },
  thumbnail: {
    width: 112,
    height: 112,
    sizes: "112px",
    breakpoints: [96, 128, 192, 256],
  },
  card: {
    width: 320,
    height: 320,
    sizes: "(min-width: 1536px) 300px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
    breakpoints: [192, 256, 320, 384, 480, 512, 640],
  },
  portrait: {
    width: 340,
    height: 453,
    sizes: "(min-width: 1024px) 340px, (min-width: 768px) 45vw, 92vw",
    breakpoints: [320, 480, 640, 768, 960, 1280],
  },
  scene: {
    width: 480,
    height: 270,
    sizes: "(min-width: 1536px) 420px, (min-width: 1024px) 30vw, 45vw",
    breakpoints: [320, 480, 640, 768, 960, 1024],
  },
  background: {
    width: 1920,
    height: 1080,
    sizes: "100vw",
    breakpoints: [640, 960, 1280, 1920, 2560],
  },
  lightbox: {
    width: 1200,
    height: 900,
    sizes: "(min-width: 640px) 640px, 90vw",
    breakpoints: [640, 960, 1280, 1920],
  },
} as const;

const OPTIMIZABLE_IMAGE_PATH =
  /^\/api\/(?:characters\/[^/]+\/avatar|personas\/[^/]+\/icon|backgrounds\/[^/]+\/image)$/;

export function isOptimizableImageSource(src: string): boolean {
  try {
    const url = new URL(src, "http://charon.local");
    return url.origin === "http://charon.local" && OPTIMIZABLE_IMAGE_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

export function isImageWidth(value: number): value is ImageWidth {
  return IMAGE_WIDTHS.includes(value as ImageWidth);
}

export function isImageQuality(value: number): value is ImageQuality {
  return IMAGE_QUALITIES.includes(value as ImageQuality);
}

export function withImageParams(
  src: string,
  width: ImageWidth,
  quality: ImageQuality = DEFAULT_IMAGE_QUALITY,
): string {
  if (!isOptimizableImageSource(src)) return src;

  const absolute = /^[a-z][a-z\d+.-]*:/i.test(src);
  const url = new URL(src, "http://charon.local");
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality));
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

export function withImageVersion(src: string, storedPath: string | null | undefined): string {
  if (!isOptimizableImageSource(src) || !storedPath) return src;

  const version = storedPath.split(/[\\/]/).at(-1);
  if (!version) return src;

  const absolute = /^[a-z][a-z\d+.-]*:/i.test(src);
  const url = new URL(src, "http://charon.local");
  url.searchParams.set("v", version);
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}
