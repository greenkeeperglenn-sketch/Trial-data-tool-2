import React, { useState, useEffect } from 'react';
import { Plus, Minus, Shuffle, Lock, Trash2, Wand2 } from 'lucide-react';

const TrialLayoutEditor = ({
  config,
  gridLayout,
  orientation,
  onLayoutChange,
  onOrientationChange,
  onFinalize,
  onBack
}) => {
  const [localGridLayout, setLocalGridLayout] = useState(gridLayout);
  const [localOrientation, setLocalOrientation] = useState(orientation);

  // Treatment colors (up to 17 treatments A-Q)
  const treatmentColors = {
    0: '#FF6B6B', 1: '#4ECDC4', 2: '#45B7D1', 3: '#FFA07A',
    4: '#95E1D3', 5: '#F38181', 6: '#AA96DA', 7: '#FCBAD3',
    8: '#FFD93D', 9: '#6BCF7F', 10: '#FF85A2', 11: '#5DADE2',
    12: '#F8B739', 13: '#A78BFA', 14: '#34D399', 15: '#FB923C',
    16: '#EC4899'
  };

  // Initialize with empty plots if no layout exists
  useEffect(() => {
    if (localGridLayout.length === 0) {
      generateEmptyLayout();
    }
  }, []);

  // Generate empty layout (all plots unassigned)
  const generateEmptyLayout = () => {
    const grid = [];
    for (let block = 0; block < config.numBlocks; block++) {
      const row = [];
      for (let plotIdx = 0; plotIdx < config.numTreatments; plotIdx++) {
        row.push({
          id: `B${block + 1}-P${plotIdx + 1}`,
          block: block + 1,
          treatment: null, // Unassigned
          treatmentName: null,
          isBlank: false
        });
      }
      grid.push(row);
    }

    setLocalGridLayout(grid);
    onLayoutChange(grid);
  };

  // Get available treatments for a specific block (not yet assigned)
  const getAvailableTreatments = (blockIdx) => {
    const block = localGridLayout[blockIdx];
    if (!block) return [...Array(config.numTreatments).keys()];

    const usedTreatments = new Set(
      block
        .filter(plot => !plot.isBlank && plot.treatment !== null)
        .map(plot => plot.treatment)
    );

    return [...Array(config.numTreatments).keys()].filter(t => !usedTreatments.has(t));
  };

  // Assign treatment to a plot
  const assignTreatment = (blockIdx, plotIdx, treatmentIdx) => {
    const newGrid = [...localGridLayout];
    newGrid[blockIdx] = [...newGrid[blockIdx]];

    if (treatmentIdx === null || treatmentIdx === '') {
      // Clear assignment
      newGrid[blockIdx][plotIdx] = {
        ...newGrid[blockIdx][plotIdx],
        treatment: null,
        treatmentName: null
      };
    } else {
      const tIdx = parseInt(treatmentIdx, 10);
      newGrid[blockIdx][plotIdx] = {
        ...newGrid[blockIdx][plotIdx],
        treatment: tIdx,
        treatmentName: config.treatments[tIdx]
      };
    }

    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
  };

  // Auto-fill all empty plots with random treatments (RCBD style)
  const autoFillAll = () => {
    const newGrid = localGridLayout.map((block, blockIdx) => {
      // Get treatments already assigned in this block
      const assignedTreatments = new Set(
        block
          .filter(plot => !plot.isBlank && plot.treatment !== null)
          .map(plot => plot.treatment)
      );

      // Get unassigned treatments
      const unassignedTreatments = [...Array(config.numTreatments).keys()]
        .filter(t => !assignedTreatments.has(t));

      // Shuffle unassigned treatments
      const shuffled = [...unassignedTreatments].sort(() => Math.random() - 0.5);

      let shuffleIdx = 0;
      return block.map(plot => {
        if (plot.isBlank) return plot;
        if (plot.treatment !== null) return plot; // Already assigned

        // Assign next shuffled treatment
        const treatmentIdx = shuffled[shuffleIdx++];
        if (treatmentIdx === undefined) return plot; // No more treatments

        return {
          ...plot,
          treatment: treatmentIdx,
          treatmentName: config.treatments[treatmentIdx]
        };
      });
    });

    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
  };

  // Clear all assignments
  const clearAll = () => {
    const newGrid = localGridLayout.map(block =>
      block.map(plot => ({
        ...plot,
        treatment: plot.isBlank ? null : null,
        treatmentName: null
      }))
    );

    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
  };

  // Clear single block
  const clearBlock = (blockIdx) => {
    const newGrid = [...localGridLayout];
    newGrid[blockIdx] = newGrid[blockIdx].map(plot => ({
      ...plot,
      treatment: plot.isBlank ? null : null,
      treatmentName: null
    }));

    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
  };

  // Add blank plot to block
  const addBlankToBlock = (blockIdx, position) => {
    const newGrid = [...localGridLayout];
    const blank = {
      id: `BLANK-${Date.now()}`,
      isBlank: true,
      block: blockIdx + 1,
      treatment: null,
      treatmentName: null
    };
    newGrid[blockIdx] = [...newGrid[blockIdx]];
    newGrid[blockIdx].splice(position, 0, blank);

    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
  };

  // Remove blank plot
  const removeBlank = (blockIdx, plotIdx) => {
    const newGrid = [...localGridLayout];
    newGrid[blockIdx] = newGrid[blockIdx].filter((_, idx) => idx !== plotIdx);

    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
  };

  // Check if all treatments are assigned in all blocks
  const isComplete = () => {
    return localGridLayout.every(block => {
      const nonBlankPlots = block.filter(p => !p.isBlank);
      const assignedCount = nonBlankPlots.filter(p => p.treatment !== null).length;
      return assignedCount >= config.numTreatments;
    });
  };

  // Count assigned treatments per block
  const getBlockProgress = (blockIdx) => {
    const block = localGridLayout[blockIdx];
    if (!block) return { assigned: 0, total: config.numTreatments };
    const nonBlankPlots = block.filter(p => !p.isBlank);
    const assigned = nonBlankPlots.filter(p => p.treatment !== null).length;
    return { assigned, total: config.numTreatments };
  };

  // Rotate compass
  const rotateCompass = (degrees) => {
    const newOrientation = (localOrientation + degrees + 360) % 360;
    setLocalOrientation(newOrientation);
    onOrientationChange(newOrientation);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Field Layout Builder</h1>
          <p className="text-gray-600">Assign treatments to plots using the dropdown on each cell</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
        >
          Back to Setup
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow mb-4 flex gap-3 flex-wrap items-center">
        <button
          onClick={autoFillAll}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded transition"
          title="Randomly assign all unassigned plots"
        >
          <Wand2 size={18} />
          Auto-fill (Randomize)
        </button>

        <button
          onClick={clearAll}
          className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
          title="Clear all treatment assignments"
        >
          <Trash2 size={18} />
          Clear All
        </button>

        <div className="flex-1" />

        <button
          onClick={onFinalize}
          disabled={!isComplete()}
          className={`flex items-center gap-2 px-4 py-2 rounded transition ${
            isComplete()
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={isComplete() ? 'Lock layout and start data entry' : 'Assign all treatments first'}
        >
          <Lock size={18} /> Finalize & Lock Layout
        </button>
      </div>

      {/* Field Map with Compass */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-700">
              Field Map (Each row = 1 Block)
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Click dropdown to assign treatment. Each treatment can only be used once per block.
            </p>
          </div>

          {/* Compass Control */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-semibold text-gray-600">ORIENTATION</div>

            {/* Compass Display */}
            <div className="relative w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full shadow-lg border-4 border-blue-300">
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ transform: `rotate(${localOrientation}deg)` }}
              >
                <div className="absolute top-1 left-1/2 -translate-x-1/2">
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-red-600"></div>
                  <div className="text-[10px] font-bold text-red-600 text-center">N</div>
                </div>
                <div className="w-1.5 h-1.5 bg-gray-800 rounded-full"></div>
              </div>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => rotateCompass(-5)}
                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition"
              >
                -5°
              </button>
              <span className="px-2 py-1 text-xs font-mono bg-gray-100 rounded">{localOrientation}°</span>
              <button
                onClick={() => rotateCompass(5)}
                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition"
              >
                +5°
              </button>
            </div>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="space-y-4">
          {localGridLayout.map((block, blockIdx) => {
            const progress = getBlockProgress(blockIdx);
            const availableTreatments = getAvailableTreatments(blockIdx);

            return (
              <div key={blockIdx} className="border rounded-lg p-3 bg-gray-50">
                {/* Block Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-700">Block {blockIdx + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      progress.assigned >= progress.total
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {progress.assigned}/{progress.total} assigned
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => clearBlock(blockIdx)}
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-100 rounded transition"
                      title="Clear this block"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => addBlankToBlock(blockIdx, block.length)}
                      className="text-xs px-2 py-1 text-green-600 hover:bg-green-100 rounded transition flex items-center gap-1"
                      title="Add blank space"
                    >
                      <Plus size={12} /> Blank
                    </button>
                  </div>
                </div>

                {/* Block Plots */}
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(block.length + 1, 12)}, minmax(0, 1fr))` }}>
                  {block.map((plot, plotIdx) => (
                    <div
                      key={plot.id}
                      className={`
                        rounded-lg shadow transition-all min-h-[70px] flex flex-col items-center justify-center p-1
                        ${plot.isBlank
                          ? 'bg-gray-200 border-2 border-dashed border-gray-400'
                          : plot.treatment !== null
                            ? 'text-white'
                            : 'bg-white border-2 border-gray-300'
                        }
                      `}
                      style={{
                        backgroundColor: !plot.isBlank && plot.treatment !== null
                          ? treatmentColors[plot.treatment]
                          : undefined,
                      }}
                    >
                      {plot.isBlank ? (
                        <button
                          onClick={() => removeBlank(blockIdx, plotIdx)}
                          className="w-full h-full flex items-center justify-center hover:bg-red-200 rounded transition"
                          title="Remove blank"
                        >
                          <Minus size={16} className="text-gray-500" />
                        </button>
                      ) : (
                        <>
                          {/* Treatment Letter Display */}
                          {plot.treatment !== null && (
                            <div className="text-xl font-bold mb-1">
                              {String.fromCharCode(65 + plot.treatment)}
                            </div>
                          )}

                          {/* Dropdown Selector */}
                          <select
                            value={plot.treatment !== null ? plot.treatment : ''}
                            onChange={(e) => assignTreatment(blockIdx, plotIdx, e.target.value)}
                            className={`
                              w-full text-xs rounded px-1 py-0.5 cursor-pointer
                              ${plot.treatment !== null
                                ? 'bg-white/20 text-white border-white/30'
                                : 'bg-white text-gray-700 border-gray-300'
                              } border
                            `}
                          >
                            <option value="">-- Select --</option>
                            {/* Show current treatment if assigned */}
                            {plot.treatment !== null && (
                              <option value={plot.treatment}>
                                {String.fromCharCode(65 + plot.treatment)} - {config.treatments[plot.treatment]}
                              </option>
                            )}
                            {/* Show available treatments */}
                            {availableTreatments.map(tIdx => (
                              <option key={tIdx} value={tIdx}>
                                {String.fromCharCode(65 + tIdx)} - {config.treatments[tIdx]}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add plot button */}
                  <button
                    onClick={() => addBlankToBlock(blockIdx, block.length)}
                    className="min-h-[70px] rounded-lg border-2 border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50 transition flex items-center justify-center"
                    title="Add blank space"
                  >
                    <Plus size={20} className="text-gray-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Treatment Legend */}
        <div className="mt-6 p-4 bg-gray-50 rounded border">
          <h4 className="font-medium mb-3">Treatment Legend:</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {config.treatments.map((treatment, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-sm shadow"
                  style={{ backgroundColor: treatmentColors[idx] }}
                >
                  {String.fromCharCode(65 + idx)}
                </div>
                <span className="text-sm truncate">{treatment}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
          <h4 className="font-medium mb-2 text-blue-800">How to use:</h4>
          <ul className="text-sm space-y-1 text-blue-700">
            <li>1. Click the dropdown on each plot to assign a treatment</li>
            <li>2. Treatments disappear from the list once assigned (per block)</li>
            <li>3. Use <strong>Auto-fill</strong> to randomly assign all remaining plots</li>
            <li>4. Use <strong>Clear All</strong> to start over</li>
            <li>5. Click <strong>Finalize</strong> when all treatments are assigned</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TrialLayoutEditor;
