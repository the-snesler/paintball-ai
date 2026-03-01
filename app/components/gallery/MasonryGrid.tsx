import { registerMasonry } from 'masonry-pf';

interface MasonryGridProps {
  children: React.ReactNode;
}

export function MasonryGrid({ children }: MasonryGridProps) {
  return (
    <div
      ref={registerMasonry}
      className="grid grid-rows-[masonry] grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 mt-1"
    >
      {children}
    </div>
  );
}
