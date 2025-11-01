import { Board, Cell, Ship, Coord } from '../types';

export const BOARD_SIZE = 10;
export const SHIP_LENGTHS = [5, 4, 3, 3, 2];

export function createEmptyBoard(): Board {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() =>
      Array(BOARD_SIZE)
        .fill(null)
        .map(() => ({ state: 'empty' as const }))
    );
}

export function createShips(): Ship[] {
  return SHIP_LENGTHS.map((length, index) => ({
    id: index,
    length,
    hits: 0,
    sunk: false,
    placed: false,
  }));
}

export function canPlaceShip(
  board: Board,
  row: number,
  col: number,
  length: number,
  horizontal: boolean
): boolean {
  if (horizontal) {
    if (col + length > BOARD_SIZE) return false;
    for (let i = 0; i < length; i++) {
      if (board[row][col + i].state !== 'empty') return false;
    }
  } else {
    if (row + length > BOARD_SIZE) return false;
    for (let i = 0; i < length; i++) {
      if (board[row + i][col].state !== 'empty') return false;
    }
  }
  return true;
}

export function placeShip(
  board: Board,
  row: number,
  col: number,
  length: number,
  horizontal: boolean,
  shipId: number
): void {
  if (horizontal) {
    for (let i = 0; i < length; i++) {
      board[row][col + i] = { state: 'ship', shipId };
    }
  } else {
    for (let i = 0; i < length; i++) {
      board[row + i][col] = { state: 'ship', shipId };
    }
  }
}

export function removeShip(board: Board, shipId: number): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col].shipId === shipId) {
        board[row][col] = { state: 'empty' };
      }
    }
  }
}

export function placeShipsRandomly(board: Board, ships: Ship[]): void {
  for (const ship of ships) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 100) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);

      if (canPlaceShip(board, row, col, ship.length, horizontal)) {
        placeShip(board, row, col, ship.length, horizontal, ship.id);
        placed = true;
      }
      attempts++;
    }
  }
}

export function processShot(
  board: Board,
  ships: Ship[],
  row: number,
  col: number
): 'hit' | 'miss' | 'sunk' {
  const cell = board[row][col];

  if (cell.state === 'ship') {
    cell.state = 'hit';
    const ship = ships.find((s) => s.id === cell.shipId);
    if (ship) {
      ship.hits++;
      if (ship.hits === ship.length) {
        ship.sunk = true;
        markShipAsSunk(board, cell.shipId!);
        return 'sunk';
      }
    }
    return 'hit';
  } else {
    cell.state = 'miss';
    return 'miss';
  }
}

function markShipAsSunk(board: Board, shipId: number): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col].shipId === shipId) {
        board[row][col].state = 'sunk';
      }
    }
  }
}

export function allShipsSunk(ships: Ship[]): boolean {
  return ships.every((ship) => ship.sunk);
}
