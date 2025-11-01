import { Board } from '../types';
import { BOARD_SIZE } from '../utils/boardUtils';

interface GridProps {
  board: Board;
  isAiGrid: boolean;
  onCellClick?: (row: number, col: number) => void;
  disabled?: boolean;
  title: string;
  highlightCell?: { row: number; col: number } | null;
}

export function Grid({ board, isAiGrid, onCellClick, disabled, title, highlightCell }: GridProps) {
  function getCellClass(row: number, col: number): string {
    const cell = board[row][col];
    const baseClass = 'w-8 h-8 border border-gray-400 transition-colors';
    const isHighlighted = highlightCell && highlightCell.row === row && highlightCell.col === col;

    if (isHighlighted) {
      return `${baseClass} bg-yellow-400 border-yellow-600 border-4 animate-pulse`;
    }

    if (cell.state === 'hit') {
      return `${baseClass} bg-red-500`;
    }
    if (cell.state === 'miss') {
      return `${baseClass} bg-blue-300`;
    }
    if (cell.state === 'sunk') {
      return `${baseClass} bg-gray-700`;
    }
    if (cell.state === 'ship' && !isAiGrid) {
      return `${baseClass} bg-green-600`;
    }

    return `${baseClass} bg-gray-100 hover:bg-gray-200`;
  }

  function handleClick(row: number, col: number) {
    if (!disabled && onCellClick) {
      onCellClick(row, col);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div
        className="inline-grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((_, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              className={getCellClass(rowIndex, colIndex)}
              onClick={() => handleClick(rowIndex, colIndex)}
              disabled={disabled}
              aria-label={`Cell ${rowIndex}-${colIndex}`}
            />
          ))
        )}
      </div>
    </div>
  );
}
