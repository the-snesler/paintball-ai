import type {
  CompletedGalleryItem,
  ImageScorecard,
  ReferenceImage,
  StoredEditorSession,
  StoredImageRecord,
} from "~/types";
import { createThumbnailBlob } from "./imageProcessing";

const DB_NAME = "studio-image-gallery";
const DB_VERSION = 4;

const STORES = {
  images: "images",
  references: "references",
  sessions: "sessions",
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

      // Editor sessions store (v3)
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const sessionStore = db.createObjectStore(STORES.sessions, { keyPath: "id" });
        sessionStore.createIndex("by_gallery_item", "sourceGalleryItemId", { unique: false });
      }

      // v4: no schema change required; `embedding` and `embeddingModelId` are
      // optional fields on existing records. Bumping the version allows future
      // additions to hook the upgrade path.
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

export async function updateImageScorecard(
  id: string,
  scorecard: ImageScorecard | undefined
): Promise<StoredImageRecord | null> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readwrite");
    const store = transaction.objectStore(STORES.images);
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const record = getRequest.result as StoredImageRecord | undefined;
      if (!record) {
        resolve(null);
        return;
      }

      const nextRecord: StoredImageRecord = { ...record };
      if (scorecard) {
        nextRecord.scorecard = scorecard;
      } else {
        delete nextRecord.scorecard;
      }

      store.put(nextRecord);
      transaction.oncomplete = () => resolve(nextRecord);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  });
}

export const PAGE_SIZE = 30;

export async function getImagesPaginated(
  limit: number,
  offset: number
): Promise<StoredImageRecord[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readonly");
    const store = transaction.objectStore(STORES.images);
    const index = store.index("byCreatedAt");
    const raw: Array<StoredImageRecord | LegacyStoredImageRecord> = [];
    let skipped = 0;

    const request = index.openCursor(null, "prev");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || raw.length >= limit) {
        void (async () => {
          try {
            const normalized = await Promise.all(raw.map((r) => normalizeStoredImageRecord(db, r)));
            resolve(normalized);
          } catch (e) {
            reject(e);
          }
        })();
        return;
      }
      if (skipped < offset) {
        skipped++;
        cursor.continue();
        return;
      }
      raw.push(cursor.value as StoredImageRecord | LegacyStoredImageRecord);
      cursor.continue();
    };
  });
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

export async function updateImageEmbedding(
  id: string,
  embedding: number[],
  embeddingModelId: string
): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readwrite");
    const store = transaction.objectStore(STORES.images);
    const getReq = store.get(id);

    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const record = getReq.result as StoredImageRecord | undefined;
      if (!record) {
        // Image was deleted between embedding start and finish — drop silently.
        resolve();
        return;
      }
      record.embedding = embedding;
      record.embeddingModelId = embeddingModelId;
      store.put(record);
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function updateImageCharacters(id: string, characterIds: string[]): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readwrite");
    const store = transaction.objectStore(STORES.images);
    const getReq = store.get(id);

    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const record = getReq.result as StoredImageRecord | undefined;
      if (!record) {
        resolve();
        return;
      }
      record.characterIds = characterIds.length > 0 ? characterIds : undefined;
      store.put(record);
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function updateImageFavorite(id: string, isFavorite: boolean): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readwrite");
    const store = transaction.objectStore(STORES.images);
    const getReq = store.get(id);

    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const record = getReq.result as StoredImageRecord | undefined;
      if (!record) {
        resolve();
        return;
      }
      record.isFavorite = isFavorite;
      store.put(record);
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getEmbeddingCounts(
  modelId: string | null
): Promise<{ total: number; indexed: number }> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readonly");
    const store = transaction.objectStore(STORES.images);
    const request = store.openCursor();

    let total = 0;
    let indexed = 0;

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve({ total, indexed });
        return;
      }
      const record = cursor.value as StoredImageRecord;
      total++;
      if (
        record.embedding &&
        record.embedding.length > 0 &&
        (!modelId || record.embeddingModelId === modelId)
      ) {
        indexed++;
      }
      cursor.continue();
    };
  });
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
  const record: { id: string; blob: Blob; name: string; sourceGalleryItemId?: string } = {
    id: image.id,
    blob: image.blob,
    name: image.name,
  };
  if (image.sourceGalleryItemId) record.sourceGalleryItemId = image.sourceGalleryItemId;
  store.put(record);

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
            const record = request.result as
              | { id: string; blob: Blob; name: string; sourceGalleryItemId?: string }
              | undefined;

            if (!record) {
              requestResolve(null);
              return;
            }

            requestResolve({
              id: record.id,
              blob: record.blob,
              name: record.name,
              url: URL.createObjectURL(record.blob),
              sourceGalleryItemId: record.sourceGalleryItemId,
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

export async function deleteReferenceImagesByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await initDB();

  const transaction = db.transaction(STORES.references, "readwrite");
  const store = transaction.objectStore(STORES.references);
  for (const id of ids) store.delete(id);

  await awaitTransaction(transaction, undefined);
}

export async function getAllReferenceImages(): Promise<Omit<ReferenceImage, "url">[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.references, "readonly");
    const request = transaction.objectStore(STORES.references).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(
        request.result as { id: string; blob: Blob; name: string; sourceGalleryItemId?: string }[]
      );
  });
}

/**
 * Delete reference images that aren't reachable from any image, editor session,
 * or the caller-supplied roots (typically character + style refs). Returns the
 * count of refs deleted.
 *
 * Reachability roots:
 *   - `images[].referenceImageIds`
 *   - `sessions[].sourceReferenceId / additionalReferenceIds / turns[].sourceReferenceId`
 *   - caller-supplied IDs (chars/styles live in settingsStore, not IndexedDB)
 *
 * Anything not in those sets is considered orphaned. Refs leak through paths
 * that save into the references store without ever attaching to a gallery item
 * (lightbox "Edit" sources, editor turn canvas snapshots, abandoned uploads),
 * so a periodic sweep is the only way to reclaim that space.
 */
export async function garbageCollectReferences(
  extraReachableIds: Iterable<string>
): Promise<number> {
  const db = await initDB();

  const reachable = new Set<string>(extraReachableIds);

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORES.images, "readonly");
    const request = transaction.objectStore(STORES.images).openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const record = cursor.value as StoredImageRecord | LegacyStoredImageRecord | undefined;
      if (record?.referenceImageIds) {
        for (const id of record.referenceImageIds) reachable.add(id);
      }
      cursor.continue();
    };
  });

  const sessions = await getAllSessions();
  for (const session of sessions) {
    if (session.sourceReferenceId) reachable.add(session.sourceReferenceId);
    for (const id of session.additionalReferenceIds) reachable.add(id);
    for (const turn of session.turns) {
      if (turn.sourceReferenceId) reachable.add(turn.sourceReferenceId);
    }
  }

  const allRefIds = await getExistingReferenceImageIds();
  const orphans: string[] = [];
  for (const id of allRefIds) if (!reachable.has(id)) orphans.push(id);

  if (orphans.length === 0) return 0;
  await deleteReferenceImagesByIds(orphans);
  return orphans.length;
}

export async function getExistingReferenceImageIds(): Promise<Set<string>> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.references, "readonly");
    const request = transaction.objectStore(STORES.references).getAllKeys();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(new Set(request.result as string[]));
  });
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
    isFavorite: stored.isFavorite ?? false,
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
    isFavorite: false,
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

// Editor session operations
/**
 * Upsert a session record. Returns the actual session ID used (which may differ
 * from `session.id` if an existing record was found for the same source image).
 * Callers should sync their local `currentSessionId` to the returned value.
 */
export async function upsertEditorSession(session: StoredEditorSession): Promise<string> {
  const db = await initDB();

  // Prefer reusing an existing session for the same source image to avoid
  // accumulating duplicate sessions across page loads.
  const existing = session.sourceGalleryItemId
    ? await getSessionByGalleryItemId(session.sourceGalleryItemId)
    : await getSessionById(session.id);

  const record: StoredEditorSession = {
    ...session,
    id: existing?.id ?? session.id,
    savedAt: Date.now(),
  };

  const transaction = db.transaction(STORES.sessions, "readwrite");
  transaction.objectStore(STORES.sessions).put(record);
  await awaitTransaction(transaction, undefined);
  return record.id;
}

export async function getSessionByGalleryItemId(
  galleryItemId: string
): Promise<StoredEditorSession | null> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.sessions, "readonly");
    const index = transaction.objectStore(STORES.sessions).index("by_gallery_item");
    const request = index.get(galleryItemId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as StoredEditorSession | undefined) ?? null);
  });
}

export async function getSessionById(id: string): Promise<StoredEditorSession | null> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.sessions, "readonly");
    const request = transaction.objectStore(STORES.sessions).get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as StoredEditorSession | undefined) ?? null);
  });
}

export async function deleteEditorSession(id: string): Promise<void> {
  const db = await initDB();

  const transaction = db.transaction(STORES.sessions, "readwrite");
  transaction.objectStore(STORES.sessions).delete(id);
  await awaitTransaction(transaction, undefined);
}

export async function getAllSessions(): Promise<StoredEditorSession[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.sessions, "readonly");
    const request = transaction.objectStore(STORES.sessions).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as StoredEditorSession[]);
  });
}

/** Find the first session that includes `imageId` as a source, turn reference, or turn output. */
export async function findSessionForImage(imageId: string): Promise<StoredEditorSession | null> {
  const sessions = await getAllSessions();
  return (
    sessions.find(
      (s) =>
        s.sourceGalleryItemId === imageId ||
        s.turns.some((t) => t.sourceItemId === imageId || t.itemIds.includes(imageId))
    ) ?? null
  );
}
