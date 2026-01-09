import type { CompletedGalleryItem, ReferenceImage, StoredImageRecord } from '~/types';

const DB_NAME = 'studio-image-gallery';
const DB_VERSION = 1;

const STORES = {
  images: 'images',
  references: 'references',
} as const;

let dbInstance: IDBDatabase | null = null;

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
        const imageStore = db.createObjectStore(STORES.images, { keyPath: 'id' });
        imageStore.createIndex('byCreatedAt', 'createdAt', { unique: false });
        imageStore.createIndex('byModel', 'modelId', { unique: false });
      }

      // Reference images store
      if (!db.objectStoreNames.contains(STORES.references)) {
        db.createObjectStore(STORES.references, { keyPath: 'id' });
      }
    };
  });
}

// Image operations
export async function saveImage(
  image: Omit<StoredImageRecord, 'id'>
): Promise<StoredImageRecord> {
  const db = await initDB();
  const id = crypto.randomUUID();
  const record: StoredImageRecord = { ...image, id };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, 'readwrite');
    const store = transaction.objectStore(STORES.images);
    const request = store.add(record);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(record);
  });
}

export async function getImages(
  limit: number = 50,
  offset: number = 0
): Promise<StoredImageRecord[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, 'readonly');
    const store = transaction.objectStore(STORES.images);
    const index = store.index('byCreatedAt');
    const images: StoredImageRecord[] = [];
    let skipped = 0;

    // Open cursor in reverse order (newest first)
    const request = index.openCursor(null, 'prev');

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        if (skipped < offset) {
          skipped++;
          cursor.continue();
        } else if (images.length < limit) {
          images.push(cursor.value);
          cursor.continue();
        } else {
          resolve(images);
        }
      } else {
        resolve(images);
      }
    };
  });
}

export async function getAllImages(): Promise<StoredImageRecord[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, 'readonly');
    const store = transaction.objectStore(STORES.images);
    const index = store.index('byCreatedAt');
    const request = index.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Reverse to get newest first
      resolve(request.result.reverse());
    };
  });
}

export async function getImageById(id: string): Promise<StoredImageRecord | null> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, 'readonly');
    const store = transaction.objectStore(STORES.images);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deleteImage(id: string): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, 'readwrite');
    const store = transaction.objectStore(STORES.images);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getImageCount(): Promise<number> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.images, 'readonly');
    const store = transaction.objectStore(STORES.images);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Reference image operations
export async function saveReferenceImage(
  image: Omit<ReferenceImage, 'url'>
): Promise<ReferenceImage> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.references, 'readwrite');
    const store = transaction.objectStore(STORES.references);
    const request = store.add({ id: image.id, blob: image.blob, name: image.name });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve({
        ...image,
        url: URL.createObjectURL(image.blob),
      });
    };
  });
}

export async function deleteReferenceImage(id: string): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.references, 'readwrite');
    const store = transaction.objectStore(STORES.references);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Helper to convert stored record to display record with Object URL
export function toDisplayImage(stored: StoredImageRecord): CompletedGalleryItem {
  return {
    ...stored,
    status: 'completed',
    url: URL.createObjectURL(stored.blob),
  };
}

// Helper to revoke Object URL when no longer needed
export function revokeImageUrl(image: CompletedGalleryItem | ReferenceImage): void {
  URL.revokeObjectURL(image.url);
}
