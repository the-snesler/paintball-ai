import type { GalleryItem } from "~/types";

export function getPromptKey(item: GalleryItem): string {
  return item.prompt.trim() || "Untitled prompt";
}

export function groupItemsByPrompt(items: GalleryItem[]): Map<string, GalleryItem[]> {
  const grouped = new Map<string, GalleryItem[]>();

  for (const item of items) {
    const key = getPromptKey(item);
    const existing = grouped.get(key) || [];
    grouped.set(key, [...existing, item]);
  }

  return grouped;
}

export function getFirstCreatedAt(items: GalleryItem[]): number {
  const firstCompleted = items.find((item) => item.status === "completed");
  return firstCompleted?.createdAt ?? Date.now();
}
