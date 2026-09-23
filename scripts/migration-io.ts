import { open } from "node:fs/promises";

import { MAX_IMAGE_BYTES } from "@/server/image-limits";

/** Read a migration input without allocating past the upload/migration ceiling. */
export async function readMigrationFile(
  filePath: string,
  maxBytes = MAX_IMAGE_BYTES,
): Promise<Buffer> {
  const handle = await open(filePath, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new Error("Migration source is not a regular file");
    }
    if (stats.size > maxBytes) {
      throw new Error("Migration file exceeds the allowed size limit");
    }

    const bytes = Buffer.allocUnsafe(stats.size);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (result.bytesRead === 0) {
        throw new Error("Migration source changed while reading");
      }
      offset += result.bytesRead;
    }

    // Catch a file that grew after stat() without allocating the full new size.
    const extra = Buffer.allocUnsafe(1);
    const result = await handle.read(extra, 0, 1, bytes.length);
    if (result.bytesRead > 0) {
      throw new Error("Migration file exceeds the allowed size limit");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}
