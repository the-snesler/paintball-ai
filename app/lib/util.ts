import type { AspectRatio } from "~/types";

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function formatRelativeDate(createdAt: number): string {
  const now = Date.now();
  const delta = Math.max(0, now - createdAt);
  const day = 24 * 60 * 60 * 1000;
  const minute = 60 * 1000;
  const hour = 60 * minute;

  if (delta < 30) {
    return "Just now";
  } else if (delta < minute) {
    return Math.floor(delta / 1000) + " seconds ago";
  } else if (delta < 2 * minute) {
    return "1 minute ago";
  } else if (delta < hour) {
    return Math.floor(delta / minute) + " minutes ago";
  } else if (Math.floor(delta / hour) == 1) {
    return "1 hour ago";
  } else if (delta < day) {
    return Math.floor(delta / hour) + " hours ago";
  } else if (delta < day * 2) {
    return "Yesterday";
  }

  return new Date(createdAt).toLocaleDateString("en-US");
}
export function getAspectRatioValue(aspectRatio: AspectRatio | null): number {
  if (!aspectRatio) {
    return 1;
  }

  const [first, second] = aspectRatio.split(":");
  return parseFloat(first) / parseFloat(second);
}
