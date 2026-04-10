import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";

interface MasonryGridProps {
  children: React.ReactNode;
}

export function MasonryGrid({ children }: MasonryGridProps) {
  return (
    <BalancedMasonryGrid frameWidth={200} gap={16} className="mt-1">
      {children}
    </BalancedMasonryGrid>
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
