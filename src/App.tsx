import { useState } from 'react';
import { Board, Ship, GamePhase, PlacementShip, Coord } from './types';
import {
  createEmptyBoard,
  createShips,
  placeShipsRandomly,
  processShot,
  allShipsSunk,
  canPlaceShip,
  placeShip,
  removeShip,
  BOARD_SIZE,
} from './utils/boardUtils';
import { BattleshipAI } from './utils/aiUtils';
import { Grid } from './components/Grid';
import { ShipDock } from './components/ShipDock';
import { PlacementGrid } from './components/PlacementGrid';
import { Ship as ShipIcon } from 'lucide-react';

function App() {
  const [playerBoard, setPlayerBoard] = useState<Board>(createEmptyBoard());
  const [aiBoard, setAiBoard] = useState<Board>(createEmptyBoard());
  const [playerShips, setPlayerShips] = useState<Ship[]>(createShips());
  const [aiShips, setAiShips] = useState<Ship[]>(createShips());
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [message, setMessage] = useState('Select ship, then place on grid');
  const [ai] = useState(() => new BattleshipAI());

  const [placementShips, setPlacementShips] = useState<PlacementShip[]>([
    { id: 0, name: 'Carrier', length: 5, placed: false },
    { id: 1, name: 'Battleship', length: 4, placed: false },
    { id: 2, name: 'Cruiser', length: 3, placed: false },
    { id: 3, name: 'Submarine', length: 3, placed: false },
    { id: 4, name: 'Destroyer', length: 2, placed: false },
  ]);
  const [selectedShipId, setSelectedShipId] = useState<number | null>(null);
  const [isHorizontal, setIsHorizontal] = useState(true);
  const [previewCells, setPreviewCells] = useState<Set<string>>(new Set());
  const [isValidPlacement, setIsValidPlacement] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);
  const [aiRecommendedShot, setAiRecommendedShot] = useState<{ row: number; col: number } | null>(null);
  const [isAiTurn, setIsAiTurn] = useState(false);

  function toggleTestMode() {
    if (isAiTurn) return;
    const newTestMode = !testMode;
    setTestMode(newTestMode);

    if (newTestMode && gamePhase === 'playing') {
      const recommendedShot = ai.getNextShot();
      console.log('💡 AI RECOMMENDATION (yellow square):', recommendedShot);
      setAiRecommendedShot(recommendedShot);
      setMessage('This is used to test the actions of the AI. The yellow square shows the AI\'s suggested next move. Click on any square to commit its next move');
    } else {
      setAiRecommendedShot(null);
      setMessage('Your turn! Click in Enemy Waters to fire');
    }
  }

  function handleAutoPlace() {
    const newBoard = createEmptyBoard();
    const newShips = createShips();
    placeShipsRandomly(newBoard, newShips);
    setPlayerBoard(newBoard);
    setPlayerShips(newShips);

    const newPlacementShips = placementShips.map(ship => ({
      ...ship,
      placed: true,
    }));
    setPlacementShips(newPlacementShips);
    setMessage('Ships placed! Click "Start Game" to begin');
  }


  function handleShipSelect(shipId: number) {
    setSelectedShipId(shipId);
    setIsHorizontal(true);
  }

  function handleShipRemove(shipId: number) {
    const newBoard = playerBoard.map(r => [...r]);
    removeShip(newBoard, shipId);
    setPlayerBoard(newBoard);

    const newPlacementShips = placementShips.map(ship =>
      ship.id === shipId ? { ...ship, placed: false } : ship
    );
    setPlacementShips(newPlacementShips);
    setMessage('Ship removed. Click to select and place it again');
  }

  function handleToggleOrientation() {
    setIsHorizontal(!isHorizontal);
  }

  function handleCellHover(row: number, col: number) {
    if (selectedShipId === null) return;

    const ship = placementShips.find(s => s.id === selectedShipId);
    if (!ship || ship.placed) return;

    const canPlace = canPlaceShip(playerBoard, row, col, ship.length, isHorizontal);
    setIsValidPlacement(canPlace);

    const cells = new Set<string>();
    if (isHorizontal) {
      for (let i = 0; i < ship.length; i++) {
        if (col + i < BOARD_SIZE) {
          cells.add(`${row},${col + i}`);
        }
      }
    } else {
      for (let i = 0; i < ship.length; i++) {
        if (row + i < BOARD_SIZE) {
          cells.add(`${row + i},${col}`);
        }
      }
    }
    setPreviewCells(cells);
  }

  function handleHoverEnd() {
    setPreviewCells(new Set());
  }

  function handleCellClick(row: number, col: number) {
    if (selectedShipId === null) return;

    const ship = placementShips.find(s => s.id === selectedShipId);
    if (!ship || ship.placed) return;

    const canPlace = canPlaceShip(playerBoard, row, col, ship.length, isHorizontal);

    if (!canPlace) {
      setMessage('Cannot place ship there!');
      return;
    }

    const newBoard = playerBoard.map(r => [...r]);
    placeShip(newBoard, row, col, ship.length, isHorizontal, selectedShipId);
    setPlayerBoard(newBoard);

    const newPlacementShips = placementShips.map(s =>
      s.id === selectedShipId ? { ...s, placed: true } : s
    );
    setPlacementShips(newPlacementShips);

    const allPlaced = newPlacementShips.every(s => s.placed);
    if (allPlaced) {
      setMessage('All ships placed! Click "Start Game" to begin');
    } else {
      setMessage('Select another ship to place');
    }

    setPreviewCells(new Set());
    setSelectedShipId(null);
    setIsHorizontal(true);
  }

  function handleStartGame() {
    const hasShips = playerBoard.some((row) =>
      row.some((cell) => cell.state === 'ship')
    );

    if (!hasShips) {
      setMessage('Place your ships first!');
      return;
    }

    const newAiBoard = createEmptyBoard();
    const newAiShips = createShips();
    placeShipsRandomly(newAiBoard, newAiShips);
    setAiBoard(newAiBoard);
    setAiShips(newAiShips);
    setGamePhase('playing');
    setMessage('Your turn! Click in Enemy Waters to fire');
    setTestMode(false);
    ai.reset();
  }

  function handleReset() {
    setPlayerBoard(createEmptyBoard());
    setAiBoard(createEmptyBoard());
    setPlayerShips(createShips());
    setAiShips(createShips());
    setGamePhase('setup');
    setTestMode(false);
    setShowEndGameModal(false);
    setWinner(null);
    setPlacementShips([
      { id: 0, name: 'Carrier', length: 5, placed: false },
      { id: 1, name: 'Battleship', length: 4, placed: false },
      { id: 2, name: 'Cruiser', length: 3, placed: false },
      { id: 3, name: 'Submarine', length: 3, placed: false },
      { id: 4, name: 'Destroyer', length: 2, placed: false },
    ]);
    setSelectedShipId(null);
    setIsHorizontal(true);
    setMessage('Select ship, then place on grid');
    ai.reset();
  }

  function handlePlayerShot(row: number, col: number) {
    if (gamePhase !== 'playing' || isAiTurn) return;

    const cell = aiBoard[row][col];
    if (cell.state === 'hit' || cell.state === 'miss' || cell.state === 'sunk') {
      setMessage('Already fired there! Pick another cell');
      return;
    }

    const newAiBoard = [...aiBoard.map((r) => [...r])];
    const newAiShips = [...aiShips];
    const result = processShot(newAiBoard, newAiShips, row, col);

    setAiBoard(newAiBoard);
    setAiShips(newAiShips);

    if (allShipsSunk(newAiShips)) {
      setGamePhase('ended');
      setWinner('player');
      setShowEndGameModal(true);
      setMessage('You win! All enemy ships destroyed!');
      return;
    }

    if (result === 'sunk') {
      setMessage('You sunk a ship! Keep firing');
    } else if (result === 'hit') {
      setMessage('Hit! Keep firing');
    } else {
      setMessage("Miss! AI's turn...");
    }

    if (testMode) {
      const recommendedShot = ai.getNextShot();
      setAiRecommendedShot(recommendedShot);
      setMessage('This is used to test the actions of the AI. The yellow square shows the AI\'s suggested next move. Click on any square to commit its next move');
    } else {
      setIsAiTurn(true);
      setTimeout(() => {
        executeAiTurn(newAiBoard, newAiShips);
        setIsAiTurn(false);
      }, 800);
    }
  }

  function handleManualAiShot(row: number, col: number) {
    if (!testMode || gamePhase !== 'playing') return;

    const cell = playerBoard[row][col];
    if (cell.state === 'hit' || cell.state === 'miss' || cell.state === 'sunk') {
      setMessage('AI already fired there! Pick another cell');
      return;
    }

    const newPlayerBoard = [...playerBoard.map((r) => [...r])];
    const newPlayerShips = [...playerShips];
    const result = processShot(newPlayerBoard, newPlayerShips, row, col);

    // If ship sunk, find which cells are now marked as 'sunk'
    const sunkCoords = result === 'sunk'
      ? newPlayerBoard.flatMap((rowCells, r) =>
          rowCells.map((cell, c) => cell.state === 'sunk' ? { row: r, col: c } : null)
            .filter((coord): coord is Coord => coord !== null)
        )
      : [];

    ai.reportResult({ row, col }, result, sunkCoords);

    setPlayerBoard(newPlayerBoard);
    setPlayerShips(newPlayerShips);

    if (allShipsSunk(newPlayerShips)) {
      setGamePhase('ended');
      setWinner('ai');
      setShowEndGameModal(true);
      setMessage('AI wins! All your ships destroyed!');
      setAiRecommendedShot(null);
      return;
    }

    let statusMessage = '';
    if (result === 'sunk') {
      statusMessage = 'Sunk! ';
    } else if (result === 'hit') {
      statusMessage = 'Hit! ';
    } else {
      statusMessage = 'Miss! ';
    }

    const nextRecommendedShot = ai.getNextShot();
    setAiRecommendedShot(nextRecommendedShot);
    setMessage(`${statusMessage}Click yellow square for next AI suggestion.`);
  }

  function executeAiTurn(currentAiBoard: Board, currentAiShips: Ship[]) {
    const shot = ai.getNextShot();
    const newPlayerBoard = [...playerBoard.map((r) => [...r])];
    const newPlayerShips = [...playerShips];
    const result = processShot(newPlayerBoard, newPlayerShips, shot.row, shot.col);

    // If ship sunk, find which cells are now marked as 'sunk'
    const sunkCoords = result === 'sunk'
      ? newPlayerBoard.flatMap((rowCells, r) =>
          rowCells.map((cell, c) => cell.state === 'sunk' ? { row: r, col: c } : null)
            .filter((coord): coord is Coord => coord !== null)
        )
      : [];

    ai.reportResult(shot, result, sunkCoords);

    setPlayerBoard(newPlayerBoard);
    setPlayerShips(newPlayerShips);

    if (allShipsSunk(newPlayerShips)) {
      setGamePhase('ended');
      setWinner('ai');
      setShowEndGameModal(true);
      setMessage('AI wins! All your ships destroyed!');
      return;
    }

    if (result === 'sunk') {
      setMessage('AI sunk your ship! Your turn');
    } else if (result === 'hit') {
      setMessage('AI hit your ship! Your turn');
    } else {
      setMessage('AI missed! Your turn');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Mobile Warning Banner */}
        <div className="md:hidden bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 mb-6 rounded">
          <p className="font-medium">Not optimized for mobile</p>
          <p className="text-sm">For the best experience, please view this game on a desktop or tablet device.</p>
        </div>

        <div className="text-center mb-8 relative">
          <div className="flex items-center justify-center gap-3 mb-2">
            <ShipIcon className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">Agent Armada</h1>
          </div>
          {gamePhase === 'playing' && (
            <button
              onClick={isAiTurn ? undefined : toggleTestMode}
              className={`absolute top-0 right-0 px-4 py-2 text-white rounded-lg font-semibold transition-colors ${
                testMode
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              } ${isAiTurn && !testMode ? 'cursor-not-allowed' : ''}`}
            >
              {testMode ? 'Exit Test Mode' : 'Test Mode'}
            </button>
          )}
          <p className="text-lg text-gray-600">{message}</p>
        </div>

        <div className="flex justify-center gap-3 mb-8 flex-wrap">
          {gamePhase === 'setup' && (
            <>
              <button
                onClick={handleAutoPlace}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Auto-place Ships
              </button>
              <button
                onClick={handleStartGame}
                disabled={!placementShips.every(s => s.placed)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Start Game
              </button>
            </>
          )}
          <button
            onClick={handleReset}
            disabled={gamePhase === 'setup' && !placementShips.some(s => s.placed)}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Reset Game
          </button>
        </div>

        {gamePhase === 'setup' ? (
          <div className="flex flex-wrap justify-center gap-8" style={{ alignItems: 'flex-start' }}>
            <ShipDock
              ships={placementShips}
              onShipSelect={handleShipSelect}
              onShipRemove={handleShipRemove}
              selectedShipId={selectedShipId}
              onToggleOrientation={handleToggleOrientation}
            />
            <PlacementGrid
              board={playerBoard}
              onCellClick={handleCellClick}
              onCellHover={handleCellHover}
              onHoverEnd={handleHoverEnd}
              previewCells={previewCells}
              isValidPlacement={isValidPlacement}
              selectedShipId={selectedShipId}
              isHorizontal={isHorizontal}
            />
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-12">
            {testMode ? (
              <Grid
                board={playerBoard}
                isAiGrid={false}
                disabled={false}
                onCellClick={handleManualAiShot}
                title="Your Fleet"
                highlightCell={aiRecommendedShot}
              />
            ) : (
              <>
                <Grid
                  board={playerBoard}
                  isAiGrid={false}
                  disabled={true}
                  title="Your Fleet"
                />
                <Grid
                  board={aiBoard}
                  isAiGrid={true}
                  onCellClick={handlePlayerShot}
                  disabled={gamePhase !== 'playing'}
                  title="Enemy Waters"
                />
              </>
            )}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-600">
          <p className="mb-2">
            <strong>Ships:</strong> 5 (Carrier), 4 (Battleship), 3 (Cruiser), 3
            (Submarine), 2 (Destroyer)
          </p>
          <p>
            <strong>Legend:</strong>{' '}
            <span className="inline-block w-4 h-4 bg-green-600 border border-gray-400 mx-1 align-middle"></span>
            Ship{' '}
            <span className="inline-block w-4 h-4 bg-red-500 border border-gray-400 mx-1 align-middle"></span>
            Hit{' '}
            <span className="inline-block w-4 h-4 bg-blue-300 border border-gray-400 mx-1 align-middle"></span>
            Miss{' '}
            <span className="inline-block w-4 h-4 bg-gray-700 border border-gray-400 mx-1 align-middle"></span>
            Sunk
            {testMode && (
              <>
                {' '}
                <span className="inline-block w-4 h-4 bg-yellow-400 border border-gray-400 mx-1 align-middle"></span>
                AI Suggestion
              </>
            )}
          </p>
        </div>
      </div>

      {showEndGameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <div className="mb-6">
              {winner === 'player' ? (
                <>
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-3xl font-bold text-green-600 mb-2">Victory!</h2>
                  <p className="text-lg text-gray-700">
                    Congratulations! You destroyed all enemy ships!
                  </p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">💥</div>
                  <h2 className="text-3xl font-bold text-red-600 mb-2">Defeat</h2>
                  <p className="text-lg text-gray-700">
                    The AI destroyed your entire fleet. Better luck next time!
                  </p>
                </>
              )}
            </div>
            <button
              onClick={() => {
                setShowEndGameModal(false);
                handleReset();
              }}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
