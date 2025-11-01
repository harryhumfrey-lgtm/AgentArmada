# Battleship Game Debugging Log

## Overview
This document chronicles the comprehensive debugging process undertaken to identify and fix critical bugs in the Battleship game, focusing on AI logic, state management, and race conditions.

---

## Bug #1: Ship Placement Collision Detection

### Problem
Ships could be placed overlapping each other during the setup phase. The collision detection in the placement logic was checking the wrong board state.

### Root Cause
In `src/components/PlacementGrid.tsx:29-32`, the code was checking `hoverCells` for collisions instead of checking the actual `board` state:

```typescript
// BEFORE (incorrect)
const hasCollision = hoverCells.some(
  (cell) => cell.state !== 'empty'
);
```

### Solution
Changed collision detection to check the actual board state:

```typescript
// AFTER (correct)
const hasCollision = hoverCells.some(
  (cell) => board[cell.row][cell.col].state !== 'empty'
);
```

### Impact
Players can no longer place ships on top of each other, ensuring valid game setups.

**File Modified:** `src/components/PlacementGrid.tsx:29-32`

---

## Bug #2: AI Memory Loss Between Turns

### Problem
The AI opponent was losing track of previous hits and making random shots instead of systematically hunting down ships. This made the AI significantly weaker than intended.

### Root Cause
In `src/App.tsx:134-179`, the `executeAiTurn` function was creating a **new AI instance** on every turn:

```typescript
// BEFORE (incorrect - creates new AI each turn)
const aiPlayer = new BattleshipAI();
```

This meant the AI lost all memory of:
- Previously fired shots
- Current target queue
- Tracked hits on unsunk ships
- Hunt/target mode state

### Solution
Moved the AI instance to component state so it persists across turns:

```typescript
// AFTER (correct - AI persists between turns)
const [aiPlayer] = useState(() => new BattleshipAI());
```

Added proper AI reset in the game reset handler:

```typescript
function handleReset() {
  // ... other reset logic ...
  aiPlayer.reset();  // Reset AI state when game resets
}
```

### Impact
The AI now maintains continuity between turns, making intelligent decisions based on accumulated knowledge. The AI properly:
- Remembers which cells it has already shot
- Continues targeting ships it has hit
- Switches between hunt and target modes appropriately

**Files Modified:**
- `src/App.tsx:40-42` (AI state declaration)
- `src/App.tsx:134-179` (executeAiTurn function)
- `src/App.tsx:183-198` (handleReset function)

---

## Bug #3: Race Condition in AI Turn Execution

### Problem
The `executeAiTurn` function could be called multiple times simultaneously, causing:
- Multiple shots fired in a single turn
- Corrupted game state
- AI shooting the same cell twice
- Premature game ending

### Root Cause
In `src/App.tsx:54-63`, the "Start Game" button and the post-shot AI trigger both called `executeAiTurn()` without checking if an AI turn was already in progress.

### Solution
Added `isAiTurn` state flag and guard clauses:

```typescript
// New state flag
const [isAiTurn, setIsAiTurn] = useState(false);

// Guard clause at start of executeAiTurn
async function executeAiTurn() {
  if (isAiTurn) return;  // Prevent concurrent execution
  setIsAiTurn(true);

  try {
    // ... AI logic ...
  } finally {
    setIsAiTurn(false);  // Always clear flag
  }
}
```

Added guards to prevent player actions during AI turn:

```typescript
function handlePlayerShot(row: number, col: number) {
  if (gamePhase !== 'playing' || isAiTurn) return;
  // ... shot logic ...
}
```

### Impact
- Only one AI turn executes at a time
- Game state remains consistent
- No duplicate shots
- Player cannot interfere during AI turn

**Files Modified:**
- `src/App.tsx:44` (isAiTurn state)
- `src/App.tsx:134-179` (executeAiTurn with guards)
- `src/App.tsx:206` (player shot guard)

---

## Bug #4: Missing Type Import

### Problem
TypeScript compilation was missing the `Coord` type import, which could cause build failures.

### Root Cause
`src/App.tsx:2` was importing types but missing `Coord`:

```typescript
// BEFORE (incomplete)
import { Board, Ship, GamePhase, PlacementShip } from './types';
```

### Solution
Added `Coord` to the import statement:

```typescript
// AFTER (complete)
import { Board, Ship, GamePhase, PlacementShip, Coord } from './types';
```

### Impact
Project builds cleanly without type errors.

**File Modified:** `src/App.tsx:2`

---

## Bug #5: Incorrect Function Call

### Problem
In `src/utils/aiUtils.ts:823`, the `findAllLines()` method was being called with a parameter, but the method signature doesn't accept any parameters.

### Root Cause
```typescript
// BEFORE (incorrect - passing parameter to parameterless function)
const lines = this.findAllLines(this.hits);
```

The method signature is: `private findAllLines(): Coord[][]`

### Solution
Removed the erroneous parameter:

```typescript
// AFTER (correct)
const lines = this.findAllLines();
```

### Impact
AI line detection works correctly without runtime errors.

**File Modified:** `src/utils/aiUtils.ts:823`

---

## Bug #6: Ship Placement Failure Handling

### Problem
The `placeShipsRandomly` function had insufficient attempt limits and no error handling. If placement failed after 100 attempts, ships would remain unplaced, breaking the game.

### Root Cause
In `src/utils/boardUtils.ts:76-92`:
- Only 100 attempts per ship (too low for edge cases)
- No error logging
- Ships not marked as `placed` on success
- Silent failures could break game initialization

### Solution
Enhanced the placement logic:

```typescript
export function placeShipsRandomly(board: Board, ships: Ship[]): void {
  for (const ship of ships) {
    let placed = false;
    let attempts = 0;
    const maxAttempts = 1000;  // Increased from 100

    while (!placed && attempts < maxAttempts) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);

      if (canPlaceShip(board, row, col, ship.length, horizontal)) {
        placeShip(board, row, col, ship.length, horizontal, ship.id);
        ship.placed = true;  // Mark as placed
        placed = true;
      }
      attempts++;
    }

    if (!placed) {
      // Log error for debugging
      console.error(`Failed to place ship ${ship.id} with length ${ship.length} after ${maxAttempts} attempts`);
    }
  }
}
```

### Impact
- More reliable ship placement
- Better error visibility during development
- Proper state management for placed ships

**File Modified:** `src/utils/boardUtils.ts:76-99`

---

## Bug #7: Race Condition with Game Controls

### Problem
The "Test Mode" toggle and "Reset Game" button could be activated during the AI's turn, causing:
- State corruption
- Game phase inconsistencies
- Disrupted AI decision-making
- Board state conflicts

### Root Cause
In `src/App.tsx`, the `toggleTestMode` (line 46) and `handleReset` (line 183) functions had no guards against execution during AI turns.

### Solution
Added `isAiTurn` guards to both functions:

```typescript
function toggleTestMode() {
  if (isAiTurn) return;  // Block during AI turn
  const newTestMode = !testMode;
  setTestMode(newTestMode);
  // ...
}

function handleReset() {
  if (isAiTurn) return;  // Block during AI turn
  setPlayerBoard(createEmptyBoard());
  // ...
}
```

Added `disabled` state to the UI buttons:

```typescript
// Test Mode button
<button
  onClick={toggleTestMode}
  disabled={isAiTurn}
  className="... disabled:bg-gray-400 disabled:cursor-not-allowed"
>

// Reset button
<button
  onClick={handleReset}
  disabled={(gamePhase === 'setup' && !placementShips.some(s => s.placed)) || isAiTurn}
  className="... disabled:bg-gray-400 disabled:cursor-not-allowed"
>
```

### Impact
- Game state remains consistent during AI turns
- Visual feedback shows disabled state
- Prevents user-initiated state corruption
- Smoother game flow

**Files Modified:**
- `src/App.tsx:46-50` (toggleTestMode function)
- `src/App.tsx:183-198` (handleReset function)
- `src/App.tsx:351-359` (Test Mode button)
- `src/App.tsx:381-387` (Reset button)

---

## Stress Testing Recommendations

To ensure the game remains stable under various conditions, the following stress test scenarios were identified:

### 1. Rapid Interaction
- Click cells rapidly during AI turn
- Spam the same cell multiple times
- Try to interact with both boards simultaneously

### 2. Edge Case Ship Placements
- Place all ships adjacent to each other
- Place ships only in corners
- Place ships only along edges
- Mix horizontal and vertical ships in tight spaces

### 3. UI Control Spam
- Rapidly toggle test mode on/off
- Click reset at various game phases
- Toggle test mode while AI is thinking

### 4. Extreme Game States
- Sink all AI ships as quickly as possible
- Let AI sink most player ships before ending
- Create scenarios with multiple ships in close proximity

### 5. State Transitions
- Reset immediately after shots
- Start multiple games in rapid succession
- Switch between test mode during various game phases

---

## Summary of Fixes

| Bug # | Issue | Location | Fix Type |
|-------|-------|----------|----------|
| 1 | Ship placement collision detection | PlacementGrid.tsx:29-32 | Logic fix |
| 2 | AI memory loss between turns | App.tsx:40-42, 134-179 | State management |
| 3 | Race condition in AI turns | App.tsx:44, 134-179, 206 | Concurrency control |
| 4 | Missing type import | App.tsx:2 | Import statement |
| 5 | Incorrect function call | aiUtils.ts:823 | Function signature |
| 6 | Ship placement failure handling | boardUtils.ts:76-99 | Error handling |
| 7 | Game control race conditions | App.tsx:46-50, 183-198, 351-387 | Guard clauses + UI |

---

## Verification

All fixes have been verified through:
1. ✅ TypeScript compilation (`npm run build`)
2. ✅ Code review of state management
3. ✅ Logic flow analysis
4. ✅ Race condition analysis

The game now has robust error handling, proper state management, and protection against race conditions.

---

## AI Development Process (Pre-Debugging)

Before encountering the bugs documented above, we went through an extensive process to develop and refine the AI behavior:

### Phase 1: Initial AI Implementation
Created the `BattleshipAI` class in `src/utils/aiUtils.ts` with fundamental capabilities:
- Random shot selection for unexplored cells
- Basic hit tracking
- Simple target queue for adjacent cells after a hit

### Phase 2: Hunt/Target Mode Implementation
Enhanced the AI with two distinct behavioral modes:
- **Hunt Mode**: Strategic searching using probability-based targeting
- **Target Mode**: Activated after hitting a ship, systematically explores adjacent cells to find ship orientation and sink it

### Phase 3: Probability Density Mapping
Implemented sophisticated probability calculations:
- Created a heat map of the board based on remaining ship sizes
- Each cell's probability calculated by counting how many ships could potentially occupy it
- Weighted by ship size and configuration (horizontal vs vertical)
- Prioritized high-probability cells during hunt mode

### Phase 4: Sunk Ship Tracking
Added intelligence to recognize when ships are destroyed:
- `checkIfShipSunk()` method to detect complete ship eliminations
- Cleanup of target queue when ships sink
- Removal of dead-end targets that were part of sunken ships

### Phase 5: Line Detection and Extension
Implemented pattern recognition for multi-hit sequences:
- `findAllLines()` to identify linear hit patterns (2+ consecutive hits)
- Line extension logic to continue along discovered ship orientations
- Priority system: extend known lines before exploring new adjacent cells

### Phase 6: Smart Target Selection
Refined target queue prioritization:
- Adjacent cells to recent hits get highest priority
- Line extensions prioritized over isolated adjacents
- Elimination of already-shot cells from consideration
- Consideration of board boundaries

### Phase 7: Shot History and Validation
Added comprehensive tracking and validation:
- `firedShots` Set to prevent duplicate shots
- Validation checks before every shot
- Fallback to random valid shots if target queue is exhausted

### Phase 8: Reset Functionality
Implemented proper state cleanup:
- `reset()` method to clear all AI state
- Preparation for new games without memory contamination
- Clean slate for probability calculations

### Testing and Observation
Throughout development, we:
- Tested AI behavior in various game states
- Observed strategic decision-making
- Verified probability calculations
- Ensured proper mode transitions
- Validated target queue management

**Result**: A sophisticated AI that uses probability theory, pattern recognition, and strategic decision-making to provide challenging gameplay.

---

## Future Improvements

While not bugs, these enhancements could improve the game:
- Difficulty levels for AI (easy/medium/hard)
- Animation improvements
- Sound effects
- Game statistics tracking
- Save/load functionality using Supabase
- Multiplayer mode
