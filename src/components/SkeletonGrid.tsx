/**
 * Skeleton Grid Component
 *
 * Displays a loading skeleton that matches the exact layout of the main grid.
 * This prevents layout shift (CLS) when loading beat data.
 *
 * Layout: 10 rows × 16 columns = 160 cells
 * Styling: Matches the grid layout classes from App.tsx
 */

export function SkeletonGrid() {
  // Generate 160 skeleton cells (10 rows × 16 columns)
  const skeletonCells = Array.from({ length: 160 }, (_, i) => i);

  return (
    <div className="grid grid-cols-16 gap-1">
      {skeletonCells.map((index) => (
        <div
          key={index}
          data-testid="skeleton-pad"
          className="[rounded-[10px] aspect-2/1 h-[25px] w-full animate-pulse rounded bg-gray-800 p-2"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
