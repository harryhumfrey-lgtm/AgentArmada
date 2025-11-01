import { PlacementShip } from '../types';
import { X, RotateCw } from 'lucide-react';

interface ShipDockProps {
  ships: PlacementShip[];
  onShipSelect: (shipId: number) => void;
  onShipRemove: (shipId: number) => void;
  selectedShipId: number | null;
  onToggleOrientation: () => void;
}

export function ShipDock({ ships, onShipSelect, onShipRemove, selectedShipId, onToggleOrientation }: ShipDockProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-3" style={{ width: '240px', marginTop: '52px' }}>
      <p className="text-xs text-gray-600 mb-2 text-center">
        Select ship, then place on grid
      </p>
      <div className="space-y-1 mb-2">
        {ships.map((ship) => {
          const isSelected = selectedShipId === ship.id;
          return (
            <div
              key={ship.id}
              onClick={() => !ship.placed && onShipSelect(ship.id)}
              className={`relative flex items-center gap-2 p-1.5 rounded border-2 transition-all ${
                ship.placed
                  ? 'bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed'
                  : isSelected
                  ? 'bg-blue-100 border-blue-500 cursor-pointer ring-2 ring-blue-300'
                  : 'bg-blue-50 border-blue-300 cursor-pointer hover:bg-blue-100 hover:border-blue-400'
              }`}
            >
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-800">{ship.name}</div>
              </div>
              {ship.placed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShipRemove(ship.id);
                  }}
                  className="p-1.5 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
                  aria-label={`Remove ${ship.name}`}
                  title="Remove from grid"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              )}
              <div className="flex flex-row gap-0.5">
                {Array.from({ length: ship.length }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 border ${
                      ship.placed
                        ? 'bg-gray-400 border-gray-500'
                        : isSelected
                        ? 'bg-blue-600 border-blue-700'
                        : 'bg-green-600 border-green-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={onToggleOrientation}
        disabled={selectedShipId === null}
        className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-sm rounded font-medium transition-colors ${
          selectedShipId !== null
            ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
        title={selectedShipId !== null ? "Rotate ship orientation" : "Select a ship to rotate"}
      >
        <RotateCw className="w-3.5 h-3.5" />
        Rotate
      </button>
    </div>
  );
}
