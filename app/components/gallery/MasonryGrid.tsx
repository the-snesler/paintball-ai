import { registerMasonry } from 'masonry-pf';

interface MasonryGridProps {
  children: React.ReactNode;
}

export function MasonryGrid({ children }: MasonryGridProps) {
  return (
    <div
      ref={registerMasonry}
      className="grid grid-rows-[masonry]  grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-1"
    >
      {children}
    </div>
  );
}
