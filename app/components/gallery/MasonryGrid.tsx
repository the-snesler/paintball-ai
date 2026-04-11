import { Frame, useMasonryGrid } from "@masonry-grid/react";
import { BalancedMasonryGrid } from "@masonry-grid/vanilla";

interface MasonryGridProps {
  children: React.ReactNode;
}

export function MasonryGrid({ children }: MasonryGridProps) {
  const containerRef = useMasonryGrid<HTMLDivElement>({
    type: BalancedMasonryGrid,
  });

  return (
    <div
      ref={containerRef}
      className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-2 overflow-hidden md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-4"
    >
      {children}
    </div>
  );
}

export function MasonryFrame({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <Frame width={width} height={height}>
      {children}
    </Frame>
  );
}
