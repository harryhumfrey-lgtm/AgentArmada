import { Board, Coord } from '../types';
import { BOARD_SIZE } from './boardUtils';

export class BattleshipAI {
  private shotsFired: Set<string>;
  private mode: 'hunt' | 'target';
  private targetQueue: Coord[];
  private lastHit: Coord | null;
  private hits: Coord[];
  private firstHit: Coord | null;
  private lastProbeDirection: 'vertical' | 'horizontal' | null;
  private remainingShipSizes: number[];
  private misses: Set<string>;

  constructor() {
    this.shotsFired = new Set();
    this.mode = 'hunt';
    this.targetQueue = [];
    this.lastHit = null;
    this.hits = [];
    this.firstHit = null;
    this.lastProbeDirection = null;
    this.remainingShipSizes = [5, 4, 3, 3, 2];
    this.misses = new Set();
  }

  private coordToKey(row: number, col: number): string {
    return `${row},${col}`;
  }

  private hasShot(row: number, col: number): boolean {
    return this.shotsFired.has(this.coordToKey(row, col));
  }

  private isValid(row: number, col: number): boolean {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  private getOrthogonalNeighbors(row: number, col: number): Coord[] {
    const neighbors: Coord[] = [];
    const directions = [
      [-1, 0],  // up
      [1, 0],   // down
      [0, -1],  // left
      [0, 1],   // right
    ];

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      if (this.isValid(newRow, newCol) && !this.hasShot(newRow, newCol)) {
        neighbors.push({ row: newRow, col: newCol });
      }
    }

    // Randomize order to avoid predictable patterns
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }

    return neighbors;
  }

  private wouldExtendLine(target: Coord, line: Coord[]): boolean {
    // Check if shooting at target would extend the given line
    if (line.length < 1) return false;
    if (line.length === 1) {
      // Single hit - target is adjacent
      const hit = line[0];
      return (
        (target.row === hit.row && Math.abs(target.col - hit.col) === 1) ||
        (target.col === hit.col && Math.abs(target.row - hit.row) === 1)
      );
    }

    // Multiple hits - check if target extends the line
    return this.isHitExtendingLine(target, line);
  }

  private isHitExtendingLine(hit: Coord, line: Coord[]): boolean {
    // A hit extends a line if it's adjacent to at least one end of the line
    // and maintains the line's direction (horizontal or vertical)
    if (line.length < 2) return true; // Single hit "line" is always extended

    const isHorizontal = line.every(h => h.row === line[0].row);

    if (isHorizontal) {
      // Line is horizontal - hit must be in same row and adjacent to an end
      if (hit.row !== line[0].row) return false;
      const cols = line.map(h => h.col).sort((a, b) => a - b);
      return hit.col === cols[0] - 1 || hit.col === cols[cols.length - 1] + 1;
    } else {
      // Line is vertical - hit must be in same col and adjacent to an end
      if (hit.col !== line[0].col) return false;
      const rows = line.map(h => h.row).sort((a, b) => a - b);
      return hit.row === rows[0] - 1 || hit.row === rows[rows.length - 1] + 1;
    }
  }

  private findSunkShipHits(lastHit: Coord): Coord[] {
    // Ships are straight lines. Find the longest line containing the last hit.
    const allHitsIncludingLast = [...this.hits, lastHit];

    // Try to find a horizontal line through lastHit
    const horizontalHits = allHitsIncludingLast
      .filter(h => h.row === lastHit.row)
      .sort((a, b) => a.col - b.col);

    // Try to find a vertical line through lastHit
    const verticalHits = allHitsIncludingLast
      .filter(h => h.col === lastHit.col)
      .sort((a, b) => a.row - b.row);

    // Find the longest continuous line
    const horizontalLine = this.findContinuousHits(horizontalHits, 'horizontal');
    const verticalLine = this.findContinuousHits(verticalHits, 'vertical');

    // Return whichever line is longer and contains the last hit
    const horizontalContainsLast = horizontalLine.some(h =>
      h.row === lastHit.row && h.col === lastHit.col
    );
    const verticalContainsLast = verticalLine.some(h =>
      h.row === lastHit.row && h.col === lastHit.col
    );

    let sunkHits: Coord[];
    if (horizontalContainsLast && verticalContainsLast) {
      // Both contain it - choose the longer one
      sunkHits = horizontalLine.length > verticalLine.length ? horizontalLine : verticalLine;
    } else if (horizontalContainsLast) {
      sunkHits = horizontalLine;
    } else if (verticalContainsLast) {
      sunkHits = verticalLine;
    } else {
      // Single hit ship
      sunkHits = [lastHit];
    }

    console.log(`🎯 Found ${sunkHits.length} connected hits for sunk ship:`, sunkHits);
    return sunkHits;
  }

  private canPlaceShipAt(startRow: number, startCol: number, size: number, horizontal: boolean): boolean {
    // Check if a ship of given size can be placed at this position
    // without overlapping with any misses or already-shot squares
    for (let i = 0; i < size; i++) {
      const r = horizontal ? startRow : startRow + i;
      const c = horizontal ? startCol + i : startCol;

      if (!this.isValid(r, c)) return false;
      if (this.hasShot(r, c) && !this.hits.some(hit => hit.row === r && hit.col === c)) {
        // This position was shot and is a miss
        return false;
      }
    }

    return true;
  }

  private scoreDirectionFromHit(hitRow: number, hitCol: number, direction: 'up' | 'down' | 'left' | 'right'): number {
    // Score a direction based on how many remaining ships could fit
    // Returns the number of possible ship placements extending from this hit in this direction
    let score = 0;

    for (const shipSize of this.remainingShipSizes) {
      // For each ship size, check if it could fit extending in this direction from the hit
      let canFit = true;

      for (let i = 1; i < shipSize; i++) {
        let r = hitRow;
        let c = hitCol;

        if (direction === 'up') r -= i;
        else if (direction === 'down') r += i;
        else if (direction === 'left') c -= i;
        else if (direction === 'right') c += i;

        if (!this.isValid(r, c)) {
          canFit = false;
          break;
        }

        // Check if this cell has been shot and is NOT a hit
        if (this.hasShot(r, c)) {
          const isHit = this.hits.some(hit => hit.row === r && hit.col === c);
          if (!isHit) {
            canFit = false;
            break;
          }
        }
      }

      if (canFit) {
        score += shipSize; // Weight by ship size - larger ships more likely
      }
    }

    return score;
  }

  private calculateCellScore(row: number, col: number): number {
    let score = 0;

    // Count how many possible ship placements include this cell
    for (const shipSize of this.remainingShipSizes) {
      // Try horizontal placements
      for (let startCol = Math.max(0, col - shipSize + 1); startCol <= Math.min(BOARD_SIZE - shipSize, col); startCol++) {
        if (this.canPlaceShipAt(row, startCol, shipSize, true)) {
          score++;
        }
      }

      // Try vertical placements
      for (let startRow = Math.max(0, row - shipSize + 1); startRow <= Math.min(BOARD_SIZE - shipSize, row); startRow++) {
        if (this.canPlaceShipAt(startRow, col, shipSize, false)) {
          score++;
        }
      }
    }

    return score;
  }

  private getSmartHuntShot(): Coord {
    const cellScores: Array<{ coord: Coord; score: number }> = [];

    // Only check checkerboard pattern (every other square)
    // This is sufficient since the smallest ship is size 2
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        // Checkerboard pattern: only consider cells where (row + col) is even
        if ((row + col) % 2 !== 0) continue;

        if (!this.hasShot(row, col)) {
          const score = this.calculateCellScore(row, col);
          if (score > 0) {
            cellScores.push({ coord: { row, col }, score });
          }
        }
      }
    }

    // If no checkerboard squares available, check all remaining squares
    if (cellScores.length === 0) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (!this.hasShot(row, col)) {
            const score = this.calculateCellScore(row, col);
            if (score > 0) {
              cellScores.push({ coord: { row, col }, score });
            }
          }
        }
      }
    }

    if (cellScores.length === 0) {
      // Fallback: just find any unshot cell
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (!this.hasShot(row, col)) {
            return { row, col };
          }
        }
      }
      return { row: 0, col: 0 };
    }

    // Use weighted random selection based on scores
    // Higher scores = higher probability, but not guaranteed
    // This makes the AI unpredictable while still favoring good positions
    const totalScore = cellScores.reduce((sum, cell) => sum + cell.score, 0);
    let random = Math.random() * totalScore;

    for (const cell of cellScores) {
      random -= cell.score;
      if (random <= 0) {
        return cell.coord;
      }
    }

    // Fallback (shouldn't reach here, but just in case)
    return cellScores[Math.floor(Math.random() * cellScores.length)].coord;
  }

  getNextShot(): Coord {
    let shot: Coord;

    // If we have tracked hits, ALWAYS stay in target mode
    if (this.hits.length > 0) {
      this.mode = 'target';

      // If queue is empty, rebuild it
      if (this.targetQueue.length === 0) {
        this.rebuildTargetQueue();
      }

      if (this.targetQueue.length > 0) {
        shot = this.targetQueue.shift()!;
        console.log('🎯 Taking shot from queue:', shot, 'Queue remaining:', this.targetQueue.length);
      } else {
        // No valid targets found - check if remaining hits are actually invalid
        // (e.g., they were part of a sunk ship that we mis-identified)
        const validHits = this.hits.filter(hit => {
          const neighbors = this.getOrthogonalNeighbors(hit.row, hit.col);
          return neighbors.length > 0; // Keep hits that still have unexplored neighbors
        });

        if (validHits.length < this.hits.length) {
          console.log(`⚠️ Removing ${this.hits.length - validHits.length} stranded hits with no valid neighbors`);
          this.hits = validHits;
        }

        if (this.hits.length === 0) {
          // No valid hits remaining, switch to hunt mode
          console.log('🔍 All remaining hits were stranded - switching to hunt mode');
          this.mode = 'hunt';
          shot = this.getSmartHuntShot();
        } else {
          // Still have valid hits, take a hunt shot while keeping them tracked
          console.log('⚠️ No immediate targets for remaining hits. Taking smart hunt shot while keeping hits tracked');
          shot = this.getSmartHuntShot();
        }
      }
    } else {
      // No tracked hits - hunt mode
      this.mode = 'hunt';
      shot = this.getSmartHuntShot();
      console.log('🔍 Hunt mode - no hits tracked');
    }

    console.log('🎯 RETURNING SHOT (what will be taken/suggested):', shot);
    return shot;
  }

  private rebuildTargetQueue(): void {
    console.log('🔄 Rebuilding target queue. Current hits:', this.hits);

    // Find the longest line of continuous hits
    const rowGroups = new Map<number, Coord[]>();
    const colGroups = new Map<number, Coord[]>();

    for (const hit of this.hits) {
      if (!rowGroups.has(hit.row)) rowGroups.set(hit.row, []);
      if (!colGroups.has(hit.col)) colGroups.set(hit.col, []);
      rowGroups.get(hit.row)!.push(hit);
      colGroups.get(hit.col)!.push(hit);
    }

    let longestLine: { type: 'horizontal' | 'vertical', hits: Coord[] } | null = null;
    let longestLength = 0;

    // Find longest horizontal line
    for (const [row, hitsInRow] of rowGroups) {
      if (hitsInRow.length >= 2) {
        const sorted = hitsInRow.sort((a, b) => a.col - b.col);
        const continuous = this.findContinuousHits(sorted, 'horizontal');
        if (continuous.length > longestLength) {
          longestLength = continuous.length;
          longestLine = { type: 'horizontal', hits: continuous };
        }
      }
    }

    // Find longest vertical line
    for (const [col, hitsInCol] of colGroups) {
      if (hitsInCol.length >= 2) {
        const sorted = hitsInCol.sort((a, b) => a.row - b.row);
        const continuous = this.findContinuousHits(sorted, 'vertical');
        if (continuous.length > longestLength) {
          longestLength = continuous.length;
          longestLine = { type: 'vertical', hits: continuous };
        }
      }
    }

    // If we found a line, prioritize completing it
    if (longestLine) {
      console.log(`   Found ${longestLine.type} line with ${longestLine.hits.length} hits`);
      const { type, hits } = longestLine;

      if (type === 'horizontal') {
        const row = hits[0].row;
        const cols = hits.map(h => h.col).sort((a, b) => a - b);
        const minCol = cols[0];
        const maxCol = cols[cols.length - 1];

        // Try extending in both directions
        if (this.isValid(row, maxCol + 1) && !this.hasShot(row, maxCol + 1)) {
          this.targetQueue.push({ row, col: maxCol + 1 });
        }
        if (this.isValid(row, minCol - 1) && !this.hasShot(row, minCol - 1)) {
          this.targetQueue.push({ row, col: minCol - 1 });
        }
      } else {
        const col = hits[0].col;
        const rows = hits.map(h => h.row).sort((a, b) => a - b);
        const minRow = rows[0];
        const maxRow = rows[rows.length - 1];
        console.log(`   Vertical line: col=${col}, minRow=${minRow}, maxRow=${maxRow}`);

        // Try extending in both directions
        const downTarget = { row: maxRow + 1, col };
        const downValid = this.isValid(maxRow + 1, col);
        const downHasShot = this.hasShot(maxRow + 1, col);
        console.log(`   Down extension (${maxRow + 1},${col}): valid=${downValid}, hasShot=${downHasShot}`);
        if (downValid && !downHasShot) {
          this.targetQueue.push(downTarget);
        }

        const upTarget = { row: minRow - 1, col };
        const upValid = this.isValid(minRow - 1, col);
        const upHasShot = this.hasShot(minRow - 1, col);
        console.log(`   Up extension (${minRow - 1},${col}): valid=${upValid}, hasShot=${upHasShot}`);
        if (upValid && !upHasShot) {
          this.targetQueue.push(upTarget);
        }
      }

      console.log(`   Added ${this.targetQueue.length} targets to extend the line`);

      // If we couldn't extend the line, try perpendicular directions from each hit in the line
      if (this.targetQueue.length === 0) {
        console.log('   Cannot extend line further, trying perpendicular directions');
        const perpendicularTargets: Array<{ coord: Coord; score: number }> = [];

        for (const hit of hits) {
          if (type === 'horizontal') {
            // Line is horizontal, try vertical
            const upCoord = { row: hit.row - 1, col: hit.col };
            if (this.isValid(upCoord.row, upCoord.col) && !this.hasShot(upCoord.row, upCoord.col)) {
              const score = this.scoreDirectionFromHit(hit.row, hit.col, 'up');
              perpendicularTargets.push({ coord: upCoord, score });
            }
            const downCoord = { row: hit.row + 1, col: hit.col };
            if (this.isValid(downCoord.row, downCoord.col) && !this.hasShot(downCoord.row, downCoord.col)) {
              const score = this.scoreDirectionFromHit(hit.row, hit.col, 'down');
              perpendicularTargets.push({ coord: downCoord, score });
            }
          } else {
            // Line is vertical, try horizontal
            const leftCoord = { row: hit.row, col: hit.col - 1 };
            if (this.isValid(leftCoord.row, leftCoord.col) && !this.hasShot(leftCoord.row, leftCoord.col)) {
              const score = this.scoreDirectionFromHit(hit.row, hit.col, 'left');
              perpendicularTargets.push({ coord: leftCoord, score });
            }
            const rightCoord = { row: hit.row, col: hit.col + 1 };
            if (this.isValid(rightCoord.row, rightCoord.col) && !this.hasShot(rightCoord.row, rightCoord.col)) {
              const score = this.scoreDirectionFromHit(hit.row, hit.col, 'right');
              perpendicularTargets.push({ coord: rightCoord, score });
            }
          }
        }

        // Sort by score and add to queue
        perpendicularTargets.sort((a, b) => b.score - a.score);
        this.targetQueue.push(...perpendicularTargets.map(t => t.coord));
        console.log(`   Added ${this.targetQueue.length} perpendicular targets (scored)`);
      }
    }

    // If still no targets found, try neighbors of all hits (scored)
    if (this.targetQueue.length === 0) {
      console.log('   No line targets found, adding scored neighbors of all hits');
      const allNeighbors: Array<{ coord: Coord; score: number }> = [];

      for (const hit of this.hits) {
        const directions: Array<{ coord: Coord; direction: 'up' | 'down' | 'left' | 'right' }> = [
          { coord: { row: hit.row - 1, col: hit.col }, direction: 'up' },
          { coord: { row: hit.row + 1, col: hit.col }, direction: 'down' },
          { coord: { row: hit.row, col: hit.col - 1 }, direction: 'left' },
          { coord: { row: hit.row, col: hit.col + 1 }, direction: 'right' },
        ];

        for (const d of directions) {
          if (this.isValid(d.coord.row, d.coord.col) && !this.hasShot(d.coord.row, d.coord.col)) {
            // Check if already added
            const alreadyAdded = allNeighbors.some(n => n.coord.row === d.coord.row && n.coord.col === d.coord.col);
            if (!alreadyAdded) {
              const score = this.scoreDirectionFromHit(hit.row, hit.col, d.direction);
              allNeighbors.push({ coord: d.coord, score });
            }
          }
        }
      }

      allNeighbors.sort((a, b) => b.score - a.score);
      this.targetQueue.push(...allNeighbors.map(n => n.coord));
      console.log(`   Added ${this.targetQueue.length} scored neighbors`);
    }
  }

  private findAllLines(): Coord[][] {
    console.log(`🔍 findAllLines called with hits:`, this.hits);
    const lines: Coord[][] = [];

    // Find all horizontal lines
    const rowGroups = new Map<number, Coord[]>();
    for (const hit of this.hits) {
      if (!rowGroups.has(hit.row)) {
        rowGroups.set(hit.row, []);
      }
      rowGroups.get(hit.row)!.push(hit);
    }

    console.log(`   Row groups:`, Array.from(rowGroups.entries()));
    for (const [row, rowHits] of rowGroups.entries()) {
      if (rowHits.length >= 2) {
        const sorted = rowHits.sort((a, b) => a.col - b.col);
        const continuous = this.findContinuousHits(sorted, 'horizontal');
        console.log(`   Row ${row}: ${rowHits.length} hits, continuous line length: ${continuous.length}`);
        if (continuous.length >= 2) {
          lines.push(continuous);
        }
      }
    }

    // Find all vertical lines
    const colGroups = new Map<number, Coord[]>();
    for (const hit of this.hits) {
      if (!colGroups.has(hit.col)) {
        colGroups.set(hit.col, []);
      }
      colGroups.get(hit.col)!.push(hit);
    }

    console.log(`   Col groups:`, Array.from(colGroups.entries()));
    for (const [col, colHits] of colGroups.entries()) {
      if (colHits.length >= 2) {
        const sorted = colHits.sort((a, b) => a.row - b.row);
        const continuous = this.findContinuousHits(sorted, 'vertical');
        console.log(`   Col ${col}: ${colHits.length} hits, continuous line length: ${continuous.length}`);
        if (continuous.length >= 2) {
          lines.push(continuous);
        }
      }
    }

    console.log(`   findAllLines returning ${lines.length} lines:`, lines);
    return lines;
  }

  private canExtendLine(newHit: Coord): boolean {
    // Check if the new hit is adjacent to any existing hit in the same line
    for (const hit of this.hits) {
      if (hit.row === newHit.row && hit.col === newHit.col) continue; // Skip self

      // Check if adjacent horizontally
      if (hit.row === newHit.row && Math.abs(hit.col - newHit.col) === 1) {
        return true;
      }

      // Check if adjacent vertically
      if (hit.col === newHit.col && Math.abs(hit.row - newHit.row) === 1) {
        return true;
      }
    }

    return false;
  }

  private findContinuousHits(sortedHits: Coord[], direction: 'horizontal' | 'vertical'): Coord[] {
    if (sortedHits.length === 0) return [];

    const continuous: Coord[] = [sortedHits[0]];

    for (let i = 1; i < sortedHits.length; i++) {
      const prev = continuous[continuous.length - 1];
      const curr = sortedHits[i];

      if (direction === 'horizontal') {
        if (curr.col === prev.col + 1) {
          continuous.push(curr);
        } else {
          break;
        }
      } else {
        if (curr.row === prev.row + 1) {
          continuous.push(curr);
        } else {
          break;
        }
      }
    }

    return continuous;
  }

  reportResult(coord: Coord, result: 'hit' | 'miss' | 'sunk', sunkCoords?: Coord[]): void {
    this.shotsFired.add(this.coordToKey(coord.row, coord.col));

    if (result === 'hit') {
      console.log('✅ HIT at', coord);
      this.mode = 'target';
      this.lastHit = coord;
      this.hits.push(coord);

      // Only rebuild if this is the first hit or if we now have a line
      if (this.hits.length === 1) {
        // First hit - add neighbors prioritized by which directions could fit remaining ships
        console.log('   First hit - adding neighbors prioritized by ship sizes');
        this.targetQueue = [];

        const directions: Array<{ coord: Coord; direction: 'up' | 'down' | 'left' | 'right' }> = [
          { coord: { row: coord.row - 1, col: coord.col }, direction: 'up' },
          { coord: { row: coord.row + 1, col: coord.col }, direction: 'down' },
          { coord: { row: coord.row, col: coord.col - 1 }, direction: 'left' },
          { coord: { row: coord.row, col: coord.col + 1 }, direction: 'right' },
        ];

        const scoredNeighbors = directions
          .filter(d => this.isValid(d.coord.row, d.coord.col) && !this.hasShot(d.coord.row, d.coord.col))
          .map(d => ({
            coord: d.coord,
            score: this.scoreDirectionFromHit(coord.row, coord.col, d.direction)
          }))
          .sort((a, b) => b.score - a.score);

        console.log('   Neighbor scores:', scoredNeighbors.map(n => `(${n.coord.row},${n.coord.col}):${n.score}`).join(', '));
        this.targetQueue.push(...scoredNeighbors.map(n => n.coord));
      } else if (this.hits.length === 2) {
        // Second hit - check if they form a line and prioritize that direction
        const firstHit = this.hits[0];
        if (coord.row === firstHit.row) {
          // Horizontal line
          console.log('   Second hit forms horizontal line - prioritizing that direction');
          this.targetQueue = [];
          const cols = [firstHit.col, coord.col].sort((a, b) => a - b);
          const rightCell = { row: firstHit.row, col: cols[1] + 1 };
          const leftCell = { row: firstHit.row, col: cols[0] - 1 };

          console.log(`   Checking right extension ${JSON.stringify(rightCell)}: valid=${this.isValid(rightCell.row, rightCell.col)}, hasShot=${this.hasShot(rightCell.row, rightCell.col)}`);
          if (this.isValid(rightCell.row, rightCell.col) && !this.hasShot(rightCell.row, rightCell.col)) {
            this.targetQueue.push(rightCell);
          }

          console.log(`   Checking left extension ${JSON.stringify(leftCell)}: valid=${this.isValid(leftCell.row, leftCell.col)}, hasShot=${this.hasShot(leftCell.row, leftCell.col)}`);
          if (this.isValid(leftCell.row, leftCell.col) && !this.hasShot(leftCell.row, leftCell.col)) {
            this.targetQueue.push(leftCell);
          }

          console.log(`   Queue after second hit: ${this.targetQueue.length} targets`);
        } else if (coord.col === firstHit.col) {
          // Vertical line
          console.log('   Second hit forms vertical line - prioritizing that direction');
          this.targetQueue = [];
          const rows = [firstHit.row, coord.row].sort((a, b) => a - b);
          if (this.isValid(rows[1] + 1, firstHit.col) && !this.hasShot(rows[1] + 1, firstHit.col)) {
            this.targetQueue.push({ row: rows[1] + 1, col: firstHit.col });
          }
          if (this.isValid(rows[0] - 1, firstHit.col) && !this.hasShot(rows[0] - 1, firstHit.col)) {
            this.targetQueue.push({ row: rows[0] - 1, col: firstHit.col });
          }
        }
        // If they don't form a line (shouldn't happen with orthogonal movement), keep current queue
      } else {
        // Third+ hit - check if we found a better line to pursue
        console.log('   Additional hit - analyzing lines');

        // Find the best line (STRICTLY longest continuous line)
        const lines = this.findAllLines();
        const bestLine = lines.reduce((longest, current) =>
          current.length > longest.length ? current : longest  // Only switch if STRICTLY longer
        );

        console.log(`   Best line has ${bestLine.length} hits`);

        // Check if the new hit is part of the best line
        const isPartOfBestLine = bestLine.some(h =>
          h.row === coord.row && h.col === coord.col
        );

        // Also check if the new hit EXTENDS the best line (not just perpendicular to it)
        const isExtendingBestLine = isPartOfBestLine && this.isHitExtendingLine(coord, bestLine);

        if (isExtendingBestLine && bestLine.length >= 2) {
          // Clear queue and focus on extending this line
          console.log('   New hit extends best line - refocusing strategy');
          this.targetQueue = [];

          // Determine if line is horizontal or vertical
          const isHorizontal = bestLine.every(h => h.row === bestLine[0].row);

          if (isHorizontal) {
            const row = bestLine[0].row;
            const cols = bestLine.map(h => h.col).sort((a, b) => a - b);
            const minCol = cols[0];
            const maxCol = cols[cols.length - 1];

            if (this.isValid(row, maxCol + 1) && !this.hasShot(row, maxCol + 1)) {
              this.targetQueue.push({ row, col: maxCol + 1 });
            }
            if (this.isValid(row, minCol - 1) && !this.hasShot(row, minCol - 1)) {
              this.targetQueue.push({ row, col: minCol - 1 });
            }
          } else {
            const col = bestLine[0].col;
            const rows = bestLine.map(h => h.row).sort((a, b) => a - b);
            const minRow = rows[0];
            const maxRow = rows[rows.length - 1];

            if (this.isValid(maxRow + 1, col) && !this.hasShot(maxRow + 1, col)) {
              this.targetQueue.push({ row: maxRow + 1, col });
            }
            if (this.isValid(minRow - 1, col) && !this.hasShot(minRow - 1, col)) {
              this.targetQueue.push({ row: minRow - 1, col });
            }
          }

          console.log(`   Refocused queue has ${this.targetQueue.length} targets`);
        } else {
          console.log('   New hit does not extend best line - re-prioritizing queue');
          // The perpendicular hit might form a NEW line that should be prioritized
          // Recalculate lines to include the new hit
          const updatedLines = this.findAllLines();
          console.log(`   Found ${updatedLines.length} total lines after new hit`);

          // Find lines containing the new hit
          const newLines = updatedLines.filter(line =>
            line.some(h => h.row === coord.row && h.col === coord.col)
          );
          console.log(`   New hit (${coord.row},${coord.col}) is in ${newLines.length} lines:`, newLines);

          // Prioritize queue items that would extend any line containing the new hit
          const prioritized: Coord[] = [];
          const others: Coord[] = [];

          console.log(`   Current queue before prioritization:`, this.targetQueue);
          for (const target of this.targetQueue) {
            let shouldPrioritize = false;
            console.log(`   Checking target (${target.row},${target.col}) against ${newLines.length} lines`);
            for (const line of newLines) {
              const extendsLine = this.wouldExtendLine(target, line);
              console.log(`     wouldExtendLine((${target.row},${target.col}), line) = ${extendsLine}`, line);
              if (extendsLine) {
                console.log(`   ✓ Target (${target.row},${target.col}) would extend line:`, line);
                shouldPrioritize = true;
                break;
              }
            }
            if (shouldPrioritize) {
              prioritized.push(target);
            } else {
              console.log(`   ✗ Target (${target.row},${target.col}) does not extend any line`);
              others.push(target);
            }
          }

          this.targetQueue = [...prioritized, ...others];
          console.log(`   Re-prioritized: ${prioritized.length} priority, ${others.length} others`);
          console.log(`   New queue order:`, this.targetQueue);

          // If we didn't prioritize anything, we need to add line extensions to the queue
          if (prioritized.length === 0 && newLines.length > 0) {
            console.log('   No existing targets extend the line - adding line extensions');
            // Add extensions for each line containing the new hit
            for (const line of newLines) {
              const isHorizontal = line.every(h => h.row === line[0].row);

              if (isHorizontal) {
                const row = line[0].row;
                const cols = line.map(h => h.col).sort((a, b) => a - b);
                const minCol = cols[0];
                const maxCol = cols[cols.length - 1];

                const rightValid = this.isValid(row, maxCol + 1);
                const rightHasShot = this.hasShot(row, maxCol + 1);
                console.log(`   Right extension (${row},${maxCol + 1}): valid=${rightValid}, hasShot=${rightHasShot}`);
                if (rightValid && !rightHasShot) {
                  const target = { row, col: maxCol + 1 };
                  if (!this.targetQueue.some(t => t.row === target.row && t.col === target.col)) {
                    console.log(`   ✓ Adding right extension (${row},${maxCol + 1})`);
                    this.targetQueue.unshift(target);
                  } else {
                    console.log(`   ✗ Right extension already in queue`);
                  }
                }

                const leftValid = this.isValid(row, minCol - 1);
                const leftHasShot = this.hasShot(row, minCol - 1);
                console.log(`   Left extension (${row},${minCol - 1}): valid=${leftValid}, hasShot=${leftHasShot}`);
                if (leftValid && !leftHasShot) {
                  const target = { row, col: minCol - 1 };
                  if (!this.targetQueue.some(t => t.row === target.row && t.col === target.col)) {
                    console.log(`   ✓ Adding left extension (${row},${minCol - 1})`);
                    this.targetQueue.unshift(target);
                  } else {
                    console.log(`   ✗ Left extension already in queue`);
                  }
                }
              } else {
                const col = line[0].col;
                const rows = line.map(h => h.row).sort((a, b) => a - b);
                const minRow = rows[0];
                const maxRow = rows[rows.length - 1];

                if (this.isValid(maxRow + 1, col) && !this.hasShot(maxRow + 1, col)) {
                  const target = { row: maxRow + 1, col };
                  if (!this.targetQueue.some(t => t.row === target.row && t.col === target.col)) {
                    console.log(`   Adding down extension (${maxRow + 1},${col})`);
                    this.targetQueue.unshift(target);
                  }
                }
                if (this.isValid(minRow - 1, col) && !this.hasShot(minRow - 1, col)) {
                  const target = { row: minRow - 1, col };
                  if (!this.targetQueue.some(t => t.row === target.row && t.col === target.col)) {
                    console.log(`   Adding up extension (${minRow - 1},${col})`);
                    this.targetQueue.unshift(target);
                  }
                }
              }
            }
          }
        }
      }
    } else if (result === 'miss') {
      console.log('❌ MISS at', coord);
      this.misses.add(this.coordToKey(coord.row, coord.col));

      // If we have hits, check if remaining queue targets are still good
      if (this.hits.length > 0 && this.targetQueue.length > 0) {
        const lines = this.findAllLines();
        if (lines.length > 0) {
          // Check if any remaining target would extend a line
          const hasGoodTarget = this.targetQueue.some(target =>
            lines.some(line => this.wouldExtendLine(target, line))
          );

          if (!hasGoodTarget) {
            console.log('❌ Miss eliminated last line extension - rebuilding queue');
            this.targetQueue = [];
            this.rebuildTargetQueue();
          }
        }
      }
    } else if (result === 'sunk') {
      // If sunkCoords provided, use those; otherwise fall back to guessing
      let hitsToRemove: Coord[];

      if (sunkCoords && sunkCoords.length > 0) {
        // Game told us exactly which cells are sunk - use that information
        console.log(`🎯 Ship sunk! Game reports ${sunkCoords.length} cells marked as sunk:`, sunkCoords);

        // Only remove hits that match the sunk coordinates
        hitsToRemove = this.hits.filter(hit =>
          sunkCoords.some(sunkCoord =>
            sunkCoord.row === hit.row && sunkCoord.col === hit.col
          )
        );

        console.log(`🎯 Removing ${hitsToRemove.length} tracked hits that match sunk cells:`, hitsToRemove);
      } else {
        // Fall back to old guessing logic (for backwards compatibility)
        const sunkShipHits = this.findSunkShipHits(coord);
        let sunkShipSize = sunkShipHits.length;

        const maxRemainingShip = Math.max(...this.remainingShipSizes);
        if (sunkShipSize > maxRemainingShip) {
          console.log(`⚠️ Found ${sunkShipSize} hits in line, but max remaining ship is ${maxRemainingShip}`);
          console.log(`   This means multiple ships are adjacent. Using max ship size.`);
          sunkShipSize = maxRemainingShip;
        }

        hitsToRemove = sunkShipHits.slice(0, sunkShipSize);
        console.log(`🎯 Removing ${hitsToRemove.length} hits (guessed):`, hitsToRemove);
      }

      // Remove the ship from remaining sizes
      const sunkShipSize = hitsToRemove.length;
      const index = this.remainingShipSizes.indexOf(sunkShipSize);
      if (index > -1) {
        this.remainingShipSizes.splice(index, 1);
      }

      this.hits = this.hits.filter(hit =>
        !hitsToRemove.some(sunkHit =>
          sunkHit.row === hit.row && sunkHit.col === hit.col
        )
      );

      // After sinking a ship, rebuild the target queue if we still have hits
      if (this.hits.length > 0) {
        console.log(`🎯 Ship sunk! ${this.hits.length} unsunk hits remaining:`, this.hits);
        this.mode = 'target';
        this.targetQueue = [];
        this.rebuildTargetQueue();
      } else {
        console.log('🎯 Ship sunk! All ships accounted for');
        this.mode = 'hunt';
        this.targetQueue = [];
        this.lastHit = null;
        this.firstHit = null;
        this.lastProbeDirection = null;
      }
    }
  }

  reset(): void {
    this.shotsFired.clear();
    this.mode = 'hunt';
    this.targetQueue = [];
    this.lastHit = null;
    this.hits = [];
    this.firstHit = null;
    this.lastProbeDirection = null;
    this.remainingShipSizes = [5, 4, 3, 3, 2];
    this.misses.clear();
  }
}
