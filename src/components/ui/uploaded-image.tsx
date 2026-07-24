import { Image as UnpicImage, type ImageProps } from "@unpic/react";
import { uploadsUrl } from "@/lib/uploads-url";

type UploadedImageProps = Omit<ImageProps, "src"> & {
  storedPath: string | null | undefined;
};

export function UploadedImage({ storedPath, ...rest }: UploadedImageProps) {
  const src = uploadsUrl(storedPath);
  if (!src) return null;
  return <UnpicImage {...({ src, loading: "lazy", ...rest } as ImageProps)} />;
}
