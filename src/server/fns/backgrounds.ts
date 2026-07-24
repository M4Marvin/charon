import { rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import type { Background } from "@/db/schema";
import {
  createBackground as repoCreate,
  deleteBackground as repoDelete,
  getBackground as repoGet,
  listBackgrounds as repoList,
} from "@/db/repositories/backgrounds";
import { getSession, isAdmin } from "@/server/session";
import {
  GetBackgroundInput,
  DeleteBackgroundInput,
  UploadBackgroundInput,
} from "@/server/schemas/background";
import {
  ensureUploadsDirs,
  diskPathFromStored,
  storedPathFromDiskComponents,
} from "@/server/uploads";

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
    const { user } = await getSession();
    if (!isAdmin(user)) throw new Error("Demo users cannot upload backgrounds.");

    await ensureUploadsDirs();
    const filename = `${randomUUID()}.png`;
    const storedPath = storedPathFromDiskComponents("backgrounds", filename);
    const filepath = diskPathFromStored(storedPath);

    const bytes = Buffer.from(data.fileBase64, "base64");
    await writeFile(filepath, bytes);

    return repoCreate({ name: data.name, path: storedPath });
  });

export const deleteBackground = createServerFn({ method: "POST" })
  .validator(DeleteBackgroundInput)
  .handler(async ({ data }): Promise<void> => {
    const { user } = await getSession();
    if (!isAdmin(user)) throw new Error("Demo users cannot delete backgrounds.");

    const bg = repoGet(data.id);

    try {
      await rm(diskPathFromStored(bg.path), { force: true });
    } catch {
      // File might already be gone; that's fine.
    }

    repoDelete(data.id);
  });
