import type { GalleryItem } from "~/types";
import { ImageCard } from "./ImageCard";
import { LoadingCard } from "./LoadingCard";

interface GalleryImageCardProps {
  item: GalleryItem;
  selectionDisabled?: boolean;
}

export function GalleryImageCard({ item, selectionDisabled }: GalleryImageCardProps) {
  if (item.status === "completed") {
    return <ImageCard image={item} selectionDisabled={selectionDisabled} />;
  }
  return <LoadingCard item={item} />;
}
