import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import type { Background } from "@/db/schema";
import {
  createBackground as repoCreate,
  deleteBackground as repoDelete,
  getBackground as repoGet,
  listBackgrounds as repoList,
} from "@/db/repositories/backgrounds";
import { getSession } from "@/server/session";
import {
  GetBackgroundInput,
  DeleteBackgroundInput,
  UploadBackgroundInput,
} from "@/server/schemas/background";
import {
  ensureUploadsDirs,
  diskPathFromStored,
  storedPathFromDiskComponents,
  writePrivateFileAtomic,
} from "@/server/uploads";
import { decodeImageBase64, validateUploadedImage } from "@/server/image-limits";
import { invalidateStoredImageCache } from "@/server/image-optimizer";

export type BackgroundListItem = Pick<Background, "id" | "name" | "path" | "createdAt">;

export const listBackgrounds = createServerFn({ method: "GET" }).handler(
  async (): Promise<BackgroundListItem[]> => {
    await getSession();
    return repoList();
  },
);

export const getBackground = createServerFn({ method: "GET" })
  .validator(GetBackgroundInput)
  .handler(async ({ data }): Promise<Background> => {
    await getSession();
    return repoGet(data.id);
  });

export const uploadBackground = createServerFn({ method: "POST" })
  .validator(UploadBackgroundInput)
  .handler(async ({ data }): Promise<Background> => {
    await getSession();

    await ensureUploadsDirs();
    const filename = `${randomUUID()}.png`;
    const storedPath = storedPathFromDiskComponents("backgrounds", filename);
    const filepath = diskPathFromStored(storedPath);

    const bytes = decodeImageBase64(data.fileBase64);
    await validateUploadedImage(bytes);
    try {
      await writePrivateFileAtomic(filepath, bytes);
    } catch (error) {
      await rm(filepath, { force: true }).catch(() => {});
      throw error;
    }

    try {
      return repoCreate({ name: data.name, path: storedPath });
    } catch (error) {
      await rm(filepath, { force: true }).catch(() => {});
      throw error;
    }
  });

export const deleteBackground = createServerFn({ method: "POST" })
  .validator(DeleteBackgroundInput)
  .handler(async ({ data }): Promise<void> => {
    await getSession();

    const bg = repoGet(data.id);
    repoDelete(data.id);

    await invalidateStoredImageCache(bg.path).catch(() => {});
    try {
      await rm(diskPathFromStored(bg.path), { force: true });
    } catch {
      // File might already be gone; that's fine.
    }
  });
