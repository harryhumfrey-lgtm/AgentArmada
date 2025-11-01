import { Board } from '../types';
import { BOARD_SIZE } from '../utils/boardUtils';

interface PlacementGridProps {
  board: Board;
  onCellClick: (row: number, col: number) => void;
  onCellHover: (row: number, col: number) => void;
  onHoverEnd: () => void;
  previewCells: Set<string>;
  isValidPlacement: boolean;
  selectedShipId: number | null;
  isHorizontal: boolean;
}

export function PlacementGrid({
  board,
  onCellClick,
  onCellHover,
  onHoverEnd,
  previewCells,
  isValidPlacement,
  selectedShipId,
  isHorizontal,
}: PlacementGridProps) {
  function getCellClass(row: number, col: number): string {
    const cell = board[row][col];
    const cellKey = `${row},${col}`;
    const isPreview = previewCells.has(cellKey);
    const baseClass = 'w-8 h-8 border border-gray-400 transition-colors';

    if (isPreview) {
      return `${baseClass} ${
        isValidPlacement ? 'bg-green-400' : 'bg-red-400'
      } ${selectedShipId !== null ? 'cursor-pointer' : ''}`;
    }

    if (cell.state === 'ship') {
      return `${baseClass} bg-green-600 hover:bg-green-700`;
    }

    return `${baseClass} bg-gray-100 ${
      selectedShipId !== null ? 'hover:bg-blue-100 cursor-pointer' : 'hover:bg-gray-200'
    }`;
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-4 mb-3">
        <h2 className="text-xl font-bold">Your Fleet</h2>
      </div>
      <div
        className="inline-grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        }}
        onMouseLeave={onHoverEnd}
      >
        {board.map((row, rowIndex) =>
          row.map((_, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={getCellClass(rowIndex, colIndex)}
              onMouseEnter={() => onCellHover(rowIndex, colIndex)}
              onClick={() => onCellClick(rowIndex, colIndex)}
            />
          ))
        )}
      </div>
    </div>
  );
}
