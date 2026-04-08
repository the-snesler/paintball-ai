import type { CompletedGalleryItem, ReferenceImage, StoredImageRecord } from "~/types";
import { createThumbnailBlob } from "./imageProcessing";

const DB_NAME = "studio-image-gallery";
const DB_VERSION = 2;

const STORES = {
  images: "images",
  references: "references",
} as const;

let dbInstance: IDBDatabase | null = null;

interface LegacyStoredImageRecord {
  id: string;
  blob: Blob;
  prompt: string;
  modelId: string;
  modelName: string;
  aspectRatio: StoredImageRecord["aspectRatio"];
  resolution: StoredImageRecord["resolution"];
  width: number;
  height: number;
  createdAt: number;
  referenceImageIds: string[];
  metadata: Record<string, unknown>;
}

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Images store
      if (!db.objectStoreNames.contains(STORES.images)) {
        const imageStore = db.createObjectStore(STORES.images, { keyPath: "id" });
        imageStore.createIndex("byCreatedAt", "createdAt", { unique: false });
        imageStore.createIndex("byModel", "modelId", { unique: false });
      }

      // Reference images store
      if (!db.objectStoreNames.contains(STORES.references)) {
        db.createObjectStore(STORES.references, { keyPath: "id" });
      }
    };
  });
}

// Resolves when the transaction commits, not just when the request succeeds.
// IndexedDB request.onsuccess fires before the transaction commits to disk;
// resolving on transaction.oncomplete prevents writes from being lost if the
// page is closed or reloaded mid-transaction.
function awaitTransaction<T>(transaction: IDBTransaction, value: T): Promise<T> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// Image operations
export async function saveImage(image: StoredImageRecord): Promise<StoredImageRecord> {
  const db = await initDB();

  const transaction = db.transaction(STORES.images, "readwrite");
  const store = transaction.objectStore(STORES.images);
  store.add(image);

  return awaitTransaction(transaction, image);
}

export async function getImages(
  limit: number = 50,
  offset: number = 0
): Promise<StoredImageRecord[]> {
  const all = await getAllImages();
  return all.slice(offset, offset + limit);
}

export async function getAllImages(): Promise<StoredImageRecord[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readonly");
    const store = transaction.objectStore(STORES.images);
    const index = store.index("byCreatedAt");
    const request = index.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const records = request.result.reverse() as Array<
        StoredImageRecord | LegacyStoredImageRecord
      >;

      void (async () => {
        try {
          const normalized = await Promise.all(
            records.map((record) => normalizeStoredImageRecord(db, record))
          );
          resolve(normalized);
        } catch (error) {
          reject(error);
        }
      })();
    };
  });
}

export async function getImageById(id: string): Promise<StoredImageRecord | null> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readonly");
    const store = transaction.objectStore(STORES.images);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const record = request.result as StoredImageRecord | LegacyStoredImageRecord | undefined;
      if (!record) {
        resolve(null);
        return;
      }

      void (async () => {
        try {
          const normalized = await normalizeStoredImageRecord(db, record);
          resolve(normalized);
        } catch (error) {
          reject(error);
        }
      })();
    };
  });
}

export async function deleteImage(id: string): Promise<void> {
  const db = await initDB();

  const transaction = db.transaction(STORES.images, "readwrite");
  const store = transaction.objectStore(STORES.images);
  store.delete(id);

  await awaitTransaction(transaction, undefined);
}

export async function getImageCount(): Promise<number> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readonly");
    const store = transaction.objectStore(STORES.images);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Reference image operations
export async function saveReferenceImage(
  image: Omit<ReferenceImage, "url">
): Promise<ReferenceImage> {
  const db = await initDB();

  const transaction = db.transaction(STORES.references, "readwrite");
  const store = transaction.objectStore(STORES.references);
  store.put({ id: image.id, blob: image.blob, name: image.name });

  return awaitTransaction(transaction, {
    ...image,
    url: URL.createObjectURL(image.blob),
  });
}

export async function getReferenceImagesByIds(ids: string[]): Promise<ReferenceImage[]> {
  if (ids.length === 0) return [];

  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.references, "readonly");
    const store = transaction.objectStore(STORES.references);
    const requests = ids.map(
      (id) =>
        new Promise<ReferenceImage | null>((requestResolve, requestReject) => {
          const request = store.get(id);

          request.onerror = () => requestReject(request.error);
          request.onsuccess = () => {
            const record = request.result as { id: string; blob: Blob; name: string } | undefined;

            if (!record) {
              requestResolve(null);
              return;
            }

            requestResolve({
              id: record.id,
              blob: record.blob,
              name: record.name,
              url: URL.createObjectURL(record.blob),
            });
          };
        })
    );

    Promise.all(requests)
      .then((images) => resolve(images.filter((img): img is ReferenceImage => img !== null)))
      .catch(reject);
  });
}

export async function deleteReferenceImage(id: string): Promise<void> {
  const db = await initDB();

  const transaction = db.transaction(STORES.references, "readwrite");
  const store = transaction.objectStore(STORES.references);
  store.delete(id);

  await awaitTransaction(transaction, undefined);
}

export async function importImage(record: StoredImageRecord): Promise<void> {
  const db = await initDB();

  const transaction = db.transaction(STORES.images, "readwrite");
  const store = transaction.objectStore(STORES.images);
  store.put(record);

  await awaitTransaction(transaction, undefined);
}

export async function getExistingImageIds(): Promise<Set<string>> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readonly");
    const store = transaction.objectStore(STORES.images);
    const request = store.getAllKeys();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(new Set(request.result as string[]));
  });
}

// Helper to convert stored record to display record with Object URL
export function toDisplayImage(stored: StoredImageRecord): CompletedGalleryItem {
  return {
    ...stored,
    status: "completed",
    originalUrl: URL.createObjectURL(stored.originalBlob),
    thumbnailUrl: URL.createObjectURL(stored.thumbnailBlob),
  };
}

// Helper to revoke Object URL when no longer needed
export function revokeImageUrl(image: CompletedGalleryItem | ReferenceImage): void {
  if ("thumbnailUrl" in image) {
    URL.revokeObjectURL(image.originalUrl);
    URL.revokeObjectURL(image.thumbnailUrl);
    return;
  }

  URL.revokeObjectURL(image.url);
}

async function normalizeStoredImageRecord(
  db: IDBDatabase,
  record: StoredImageRecord | LegacyStoredImageRecord
): Promise<StoredImageRecord> {
  if ("originalBlob" in record && "thumbnailBlob" in record) {
    return record;
  }

  const legacy = record as LegacyStoredImageRecord;
  const thumbnailBlob = await createThumbnailBlob(legacy.blob, 400);

  const normalized: StoredImageRecord = {
    id: legacy.id,
    originalBlob: legacy.blob,
    thumbnailBlob,
    prompt: legacy.prompt,
    modelId: legacy.modelId,
    modelName: legacy.modelName,
    aspectRatio: legacy.aspectRatio,
    resolution: legacy.resolution,
    width: legacy.width,
    height: legacy.height,
    createdAt: legacy.createdAt,
    referenceImageIds: legacy.referenceImageIds ?? [],
    metadata: legacy.metadata ?? {},
  };

  await persistMigratedImageRecord(db, normalized);
  return normalized;
}

async function persistMigratedImageRecord(
  db: IDBDatabase,
  record: StoredImageRecord
): Promise<void> {
  const transaction = db.transaction(STORES.images, "readwrite");
  const store = transaction.objectStore(STORES.images);
  store.put(record);

  await awaitTransaction(transaction, undefined);
}
