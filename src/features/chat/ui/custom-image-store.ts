// IndexedDB persistence for per-chat custom images.
//
// Custom images are base64 data URLs (downscaled to 1280px, but still ~100KB-2MB
// each). Storing them in localStorage blew the ~5MB quota: every state change
// re-wrote the whole store, and once full, `setItem` threw QuotaExceededError
// synchronously — crashing keystroke drafts and aborting message sends.
//
// IndexedDB has no practical quota and writes are async, so they never block UI
// and never throw into the store.

const DB_NAME = "charon";
const STORE_NAME = "custom-images";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCustomImages(): Promise<Record<string, string>> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const [keys, values] = await Promise.all([
    requestToPromise(store.getAllKeys() as IDBRequest<IDBValidKey[]>),
    requestToPromise(store.getAll() as IDBRequest<string[]>),
  ]);
  const result: Record<string, string> = {};
  keys.forEach((key, index) => {
    result[String(key)] = values[index];
  });
  return result;
}

export async function setCustomImageInDb(chatId: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(dataUrl, chatId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCustomImageFromDb(chatId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(chatId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
