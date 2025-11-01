export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

export interface Cell {
  state: CellState;
  shipId?: number;
}

export type Board = Cell[][];

export interface Ship {
  id: number;
  length: number;
  hits: number;
  sunk: boolean;
  placed?: boolean;
}

export interface Coord {
  row: number;
  col: number;
}

export type GamePhase = 'setup' | 'playing' | 'ended';

export interface PlacementShip {
  id: number;
  name: string;
  length: number;
  placed: boolean;
}
