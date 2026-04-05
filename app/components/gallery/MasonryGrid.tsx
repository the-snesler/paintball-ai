import { registerMasonry } from "masonry-pf";

interface MasonryGridProps {
  children: React.ReactNode;
}

export function MasonryGrid({ children }: MasonryGridProps) {
  return (
    <div
      ref={registerMasonry}
      className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] grid-rows-[masonry] gap-4"
    >
      {children}
    </div>
  );
}
