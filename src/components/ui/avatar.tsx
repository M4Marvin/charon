import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";

import { getOptimizedImageProps } from "@/components/ui/optimized-image";
import type { ImageQuality } from "@/lib/image-optimization";
import { cn } from "#/lib/utils.ts";

type AvatarImageStatus = "idle" | "loading" | "loaded" | "error";
type AvatarImageState = {
  src: string | null;
  status: AvatarImageStatus;
};
type AvatarImageContextValue = {
  state: AvatarImageState;
  setState: React.Dispatch<React.SetStateAction<AvatarImageState>>;
};

const AvatarImageContext = React.createContext<AvatarImageContextValue | null>(null);

function Avatar({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg";
}) {
  const [imageState, setImageState] = React.useState<AvatarImageState>({
    src: null,
    status: "idle",
  });

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className,
      )}
      {...props}
    >
      <AvatarImageContext.Provider value={{ state: imageState, setState: setImageState }}>
        {children}
      </AvatarImageContext.Provider>
    </AvatarPrimitive.Root>
  );
}

type AvatarImageProps = React.ComponentProps<"img"> & {
  priority?: boolean;
  quality?: ImageQuality;
  unoptimized?: boolean;
};

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(function AvatarImage(
  { className, priority, quality, unoptimized, src, width, height, onLoad, onError, ...props },
  ref,
) {
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null);
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const context = React.useContext(AvatarImageContext);
  const setImageState = context?.setState;
  const normalizedSrc = src || null;

  React.useEffect(() => {
    if (!setImageState) return;
    setImageState({ src: normalizedSrc, status: normalizedSrc ? "loading" : "idle" });
    return () => {
      setImageState((current) =>
        current.src === normalizedSrc ? { src: null, status: "idle" } : current,
      );
    };
  }, [setImageState, normalizedSrc]);

  if (!src) return null;

  const imageProps = getOptimizedImageProps({
    ...props,
    src,
    alt: props.alt ?? "",
    width: width == null ? undefined : Number(width),
    height: height == null ? undefined : Number(height),
    preset: "avatar",
    priority,
    quality,
    unoptimized,
  });
  const visible = loadedSrc === src && failedSrc !== src;

  return (
    <img
      ref={ref}
      data-slot="avatar-image"
      className={cn(
        "absolute inset-0 z-10 aspect-square size-full rounded-full object-cover",
        !visible && "opacity-0",
        className,
      )}
      {...imageProps}
      onLoad={(event) => {
        setLoadedSrc(src);
        setImageState?.({ src: normalizedSrc, status: "loaded" });
        onLoad?.(event);
      }}
      onError={(event) => {
        setFailedSrc(src);
        setImageState?.({ src: normalizedSrc, status: "error" });
        onError?.(event);
      }}
    />
  );
});

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  const context = React.useContext(AvatarImageContext);
  if (context?.state.status === "loaded" && context.state.src !== null) return null;

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className,
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge };
