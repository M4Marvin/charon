import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import type { Background } from "@/db/schema";
import {
  createBackground as repoCreate,
  deleteBackground as repoDelete,
  getBackground as repoGet,
  listBackgrounds as repoList,
} from "@/db/repositories/backgrounds";
import { getSession, isDemoUsername } from "@/server/session";
import {
  GetBackgroundInput,
  DeleteBackgroundInput,
  UploadBackgroundInput,
} from "@/server/schemas/background";

const BACKGROUNDS_DIR = "data/backgrounds";

export type BackgroundListItem = Pick<Background, "id" | "name" | "path" | "createdAt">;

function ensureDir() {
  return mkdir(BACKGROUNDS_DIR, { recursive: true });
}

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
    if (isDemoUsername(user.username ?? "")) throw new Error("Demo users cannot upload backgrounds.");

    await ensureDir();
    const filename = `${randomUUID()}.png`;
    const filepath = join(BACKGROUNDS_DIR, filename);

    const bytes = Buffer.from(data.fileBase64, "base64");
    await writeFile(filepath, bytes);

    return repoCreate({ name: data.name, path: filepath });
  });

export const deleteBackground = createServerFn({ method: "POST" })
  .validator(DeleteBackgroundInput)
  .handler(async ({ data }): Promise<void> => {
    const { user } = await getSession();
    if (isDemoUsername(user.username ?? "")) throw new Error("Demo users cannot delete backgrounds.");

    const bg = repoGet(data.id);

    try {
      await rm(bg.path, { force: true });
    } catch {
      // File might already be gone; that's fine.
    }

    repoDelete(data.id);
  });
