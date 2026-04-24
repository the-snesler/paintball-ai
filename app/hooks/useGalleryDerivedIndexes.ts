import { useGalleryStore } from "~/stores/galleryStore";
import { getPromptKey } from "~/lib/galleryGrouping";
import type { CompletedGalleryItem, GalleryItem } from "~/types";

const EMPTY_ITEMS: GalleryItem[] = [];
const EMPTY_COMPLETED_ITEMS: CompletedGalleryItem[] = [];

interface GalleryDerivedIndexes {
  itemById: Map<string, GalleryItem>;
  completedItems: CompletedGalleryItem[];
  itemsByPrompt: Map<string, GalleryItem[]>;
  completedItemsByPrompt: Map<string, CompletedGalleryItem[]>;
  childItemsByParentId: Map<string, CompletedGalleryItem[]>;
  inFlightCount: number;
  getItemById: (id: string | null | undefined) => GalleryItem | null;
  getPromptGroup: (key: string) => GalleryItem[];
  getPromptGroupForItem: (item: GalleryItem | null | undefined) => GalleryItem[];
  getChildItems: (parentId: string | null | undefined) => CompletedGalleryItem[];
}

let cachedItems: GalleryItem[] | null = null;
let cachedIndexes: GalleryDerivedIndexes | null = null;

function pushToMapValue<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}

function buildGalleryDerivedIndexes(items: GalleryItem[]): GalleryDerivedIndexes {
  if (cachedItems === items && cachedIndexes) {
    return cachedIndexes;
  }

  const itemById = new Map<string, GalleryItem>();
  const completedItems: CompletedGalleryItem[] = [];
  const itemsByPrompt = new Map<string, GalleryItem[]>();
  const completedItemsByPrompt = new Map<string, CompletedGalleryItem[]>();
  const childItemsByParentId = new Map<string, CompletedGalleryItem[]>();
  let inFlightCount = 0;

  for (const item of items) {
    itemById.set(item.id, item);
    pushToMapValue(itemsByPrompt, getPromptKey(item), item);

    if (item.status === "pending" || item.status === "generating" || item.status === "waiting") {
      inFlightCount += 1;
    }

    if (item.status !== "completed") {
      continue;
    }

    completedItems.push(item);
    pushToMapValue(completedItemsByPrompt, getPromptKey(item), item);

    for (const parentId of item.parentGalleryItemIds ?? []) {
      pushToMapValue(childItemsByParentId, parentId, item);
    }
  }

  cachedItems = items;
  cachedIndexes = {
    itemById,
    completedItems,
    itemsByPrompt,
    completedItemsByPrompt,
    childItemsByParentId,
    inFlightCount,
    getItemById: (id) => (id ? (itemById.get(id) ?? null) : null),
    getPromptGroup: (key) => itemsByPrompt.get(key) ?? EMPTY_ITEMS,
    getPromptGroupForItem: (item) =>
      item ? (itemsByPrompt.get(getPromptKey(item)) ?? EMPTY_ITEMS) : EMPTY_ITEMS,
    getChildItems: (parentId) =>
      parentId
        ? (childItemsByParentId.get(parentId) ?? EMPTY_COMPLETED_ITEMS)
        : EMPTY_COMPLETED_ITEMS,
  };

  return cachedIndexes;
}

export function useGalleryDerivedIndexes(): GalleryDerivedIndexes {
  const items = useGalleryStore((s) => s.items);
  return buildGalleryDerivedIndexes(items);
}
