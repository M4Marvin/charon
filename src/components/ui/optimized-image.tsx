import type { ImgHTMLAttributes } from "react";
import { transformBaseImageProps } from "@unpic/core/base";
import {
  DEFAULT_IMAGE_QUALITY,
  IMAGE_PRESETS,
  isImageQuality,
  isOptimizableImageSource,
  withImageParams,
  type ImagePreset,
  type ImageQuality,
} from "@/lib/image-optimization";

type CoreImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fetchpriority?: "high" | "low" | "auto";
  srcset?: string;
};

export type OptimizedImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "height" | "src" | "srcSet" | "width"
> & {
  src: string;
  alt: string;
  preset?: ImagePreset;
  width?: number;
  height?: number;
  sizes?: string;
  quality?: ImageQuality;
  priority?: boolean;
  unoptimized?: boolean;
};

const transformer = (
  src: string | URL,
  operations: { width?: number; quality?: number | string },
) => {
  if (typeof operations.width !== "number") return src.toString();
  const requestedQuality = Number(operations.quality ?? DEFAULT_IMAGE_QUALITY);
  const quality = isImageQuality(requestedQuality) ? requestedQuality : DEFAULT_IMAGE_QUALITY;
  return withImageParams(src.toString(), operations.width, quality);
};

export function getOptimizedImageProps({
  src,
  alt,
  preset = "card",
  width,
  height,
  sizes,
  quality = DEFAULT_IMAGE_QUALITY,
  priority = false,
  unoptimized = false,
  ...props
}: OptimizedImageProps): ImgHTMLAttributes<HTMLImageElement> {
  const dimensions = IMAGE_PRESETS[preset];
  const intrinsicWidth = width ?? dimensions.width;
  const intrinsicHeight = height ?? dimensions.height;
  const resolvedSizes = sizes ?? dimensions.sizes;
  const shouldOptimize = !unoptimized && isOptimizableImageSource(src);

  if (!shouldOptimize) {
    return {
      ...props,
      src,
      alt,
      width: intrinsicWidth,
      height: intrinsicHeight,
      sizes: resolvedSizes,
      loading: props.loading ?? (priority ? "eager" : "lazy"),
      decoding: props.decoding ?? "async",
      fetchPriority: props.fetchPriority ?? (priority ? "high" : "auto"),
      role: props.role ?? (alt === "" ? "presentation" : undefined),
    };
  }

  const transformed = transformBaseImageProps({
    ...props,
    src,
    alt,
    transformer,
    width: intrinsicWidth,
    height: intrinsicHeight,
    layout: "fixed",
    breakpoints: [...dimensions.breakpoints],
    sizes: resolvedSizes,
    operations: { quality },
    priority,
    unstyled: true,
  }) as CoreImageProps;

  const { fetchpriority, srcset, ...rest } = transformed;
  return {
    ...rest,
    srcSet: srcset,
    fetchPriority: props.fetchPriority ?? fetchpriority,
  } as ImgHTMLAttributes<HTMLImageElement>;
}

export function OptimizedImage(props: OptimizedImageProps) {
  return <img {...getOptimizedImageProps(props)} />;
}
