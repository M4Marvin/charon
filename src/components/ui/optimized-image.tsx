import type { ComponentProps } from "react";
import { transformBaseImageProps } from "@unpic/core/base";
import {
  DEFAULT_IMAGE_QUALITY,
  IMAGE_PRESETS,
  IMAGE_WIDTHS,
  isImageQuality,
  isImageWidth,
  isOptimizableImageSource,
  withImageParams,
  type ImagePreset,
  type ImageQuality,
  type ImageWidth,
} from "@/lib/image-optimization";

type CoreImageProps = ComponentProps<"img"> & {
  fetchpriority?: "high" | "low" | "auto";
  srcset?: string;
};

export type OptimizedImageProps = Omit<
  ComponentProps<"img">,
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
  intrinsicSize?: boolean;
  unoptimized?: boolean;
};

const transformer = (
  src: string | URL,
  operations: { width?: number; quality?: number | string },
) => {
  if (typeof operations.width !== "number" || !isImageWidth(operations.width)) {
    return src.toString();
  }
  const requestedQuality = Number(operations.quality ?? DEFAULT_IMAGE_QUALITY);
  const quality = isImageQuality(requestedQuality) ? requestedQuality : DEFAULT_IMAGE_QUALITY;
  return withImageParams(src.toString(), operations.width, quality);
};

function nearestImageWidth(width: number): ImageWidth {
  if (isImageWidth(width)) return width;
  return IMAGE_WIDTHS.reduce((closest, candidate) =>
    Math.abs(candidate - width) < Math.abs(closest - width) ? candidate : closest,
  );
}

export function getOptimizedImageProps({
  src,
  alt,
  preset = "card",
  width,
  height,
  sizes,
  quality = DEFAULT_IMAGE_QUALITY,
  priority = false,
  intrinsicSize = true,
  unoptimized = false,
  ...props
}: OptimizedImageProps): ComponentProps<"img"> {
  const dimensions = IMAGE_PRESETS[preset];
  const intrinsicWidth = width ?? dimensions.width;
  const intrinsicHeight = height ?? dimensions.height;
  const transformWidth = nearestImageWidth(intrinsicWidth);
  const resolvedSizes = sizes ?? dimensions.sizes;
  const shouldOptimize = !unoptimized && isOptimizableImageSource(src);

  if (!shouldOptimize) {
    return {
      ...props,
      src,
      alt,
      width: intrinsicSize ? intrinsicWidth : undefined,
      height: intrinsicSize ? intrinsicHeight : undefined,
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
    width: transformWidth,
    height: intrinsicHeight,
    layout: "fixed",
    breakpoints: [...dimensions.breakpoints],
    sizes: resolvedSizes,
    operations: { quality },
    priority,
    unstyled: true,
  }) as CoreImageProps;

  const {
    fetchpriority,
    srcset,
    width: transformedWidth,
    height: transformedHeight,
    ...rest
  } = transformed;
  return {
    ...rest,
    srcSet: srcset,
    fetchPriority: props.fetchPriority ?? fetchpriority,
    width: intrinsicSize ? (width ?? transformedWidth) : undefined,
    height: intrinsicSize ? (height ?? transformedHeight) : undefined,
  } as ComponentProps<"img">;
}

export function OptimizedImage(props: OptimizedImageProps) {
  return <img {...getOptimizedImageProps(props)} />;
}
