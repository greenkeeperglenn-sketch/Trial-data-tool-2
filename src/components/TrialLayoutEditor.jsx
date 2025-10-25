import React, { useState, useEffect } from 'react';
import { Plus, Minus, Shuffle, Lock } from 'lucide-react';

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
  const [draggedItem, setDraggedItem] = useState(null);
  const [touchStartPos, setTouchStartPos] = useState(null);

  // Treatment colors (up to 17 treatments A-Q)
  const treatmentColors = {
    0: '#FF6B6B', 1: '#4ECDC4', 2: '#45B7D1', 3: '#FFA07A',
    4: '#95E1D3', 5: '#F38181', 6: '#AA96DA', 7: '#FCBAD3',
    8: '#FFD93D', 9: '#6BCF7F', 10: '#FF85A2', 11: '#5DADE2',
    12: '#F8B739', 13: '#A78BFA', 14: '#34D399', 15: '#FB923C',
    16: '#EC4899'
  };

  // Generate initial RCBD layout if empty
  useEffect(() => {
    if (localGridLayout.length === 0) {
      generateInitialLayout();
    }
  }, []);

  const generateInitialLayout = () => {
    const grid = [];
    for (let block = 0; block < config.numBlocks; block++) {
      const row = [];
      const treatments = [...Array(config.numTreatments).keys()];
      const shuffled = [...treatments].sort(() => Math.random() - 0.5);
      
      shuffled.forEach(treatmentIdx => {
        row.push({
          id: `B${block + 1}-T${treatmentIdx}`,
          block: block + 1,
          treatment: treatmentIdx,
          treatmentName: config.treatments[treatmentIdx],
          isBlank: false
        });
      });
      grid.push(row);
    }
    
    setLocalGridLayout(grid);
    onLayoutChange(grid);
  };

  // Randomize all blocks
  const randomizeAllBlocks = () => {
    const newGrid = localGridLayout.map(row => {
      const nonBlanks = row.filter(p => !p.isBlank);
      const treatments = nonBlanks.map(p => p.treatment);
      const shuffled = [...treatments].sort(() => Math.random() - 0.5);
      
      let treatmentIdx = 0;
      return row.map(plot => {
        if (plot.isBlank) return plot;
        return {
          ...plot,
          treatment: shuffled[treatmentIdx++],
          treatmentName: config.treatments[shuffled[treatmentIdx - 1]]
        };
      });
    });
    
    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
  };

  // Randomize single block
  const randomizeBlock = (blockIdx) => {
    const newGrid = [...localGridLayout];
    const row = newGrid[blockIdx];
    const nonBlanks = row.filter(p => !p.isBlank);
    const treatments = nonBlanks.map(p => p.treatment);
    const shuffled = [...treatments].sort(() => Math.random() - 0.5);
    
    let treatmentIdx = 0;
    newGrid[blockIdx] = row.map(plot => {
      if (plot.isBlank) return plot;
      return {
        ...plot,
        treatment: shuffled[treatmentIdx++],
        treatmentName: config.treatments[shuffled[treatmentIdx - 1]]
      };
    });
    
    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
  };

  // Add blank plot
  const addBlankToBlock = (blockIdx, position) => {
    const newGrid = [...localGridLayout];
    const blank = {
      id: `BLANK-${Date.now()}`,
      isBlank: true,
      block: blockIdx + 1
    };
    newGrid[blockIdx].splice(position, 0, blank);

    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
  };

  // Add blank to all rows (for equal layout)
  const addBlankToAllRows = () => {
    const newGrid = localGridLayout.map((row, blockIdx) => {
      const blank = {
        id: `BLANK-${Date.now()}-${blockIdx}`,
        isBlank: true,
        block: blockIdx + 1
      };
      return [...row, blank];
    });

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

  // Drag handlers (mouse)
  const handleDragStart = (e, blockIdx, plotIdx) => {
    setDraggedItem({ blockIdx, plotIdx });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetBlockIdx, targetPlotIdx) => {
    e.preventDefault();
    if (!draggedItem) return;

    // Only allow swapping within same block
    if (draggedItem.blockIdx !== targetBlockIdx) {
      alert('Cannot move plots between blocks! Drag within the same row only.');
      setDraggedItem(null);
      return;
    }

    const newGrid = [...localGridLayout];
    const block = [...newGrid[targetBlockIdx]];
    const temp = block[draggedItem.plotIdx];
    block[draggedItem.plotIdx] = block[targetPlotIdx];
    block[targetPlotIdx] = temp;
    newGrid[targetBlockIdx] = block;

    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
    setDraggedItem(null);
  };

  // Touch handlers (iPad/mobile)
  const handleTouchStart = (e, blockIdx, plotIdx, plot) => {
    if (plot.isBlank) return;

    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    setDraggedItem({ blockIdx, plotIdx });

    // Visual feedback
    e.currentTarget.style.opacity = '0.5';
  };

  const handleTouchMove = (e) => {
    e.preventDefault(); // Prevent scrolling while dragging
  };

  const handleTouchEnd = (e, targetBlockIdx, targetPlotIdx) => {
    if (!draggedItem || !touchStartPos) {
      // Reset visual feedback
      if (e.currentTarget) e.currentTarget.style.opacity = '1';
      return;
    }

    const touch = e.changedTouches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    // Reset visual feedback
    e.currentTarget.style.opacity = '1';

    // Find the target plot element
    let targetElement = element;
    let targetBlock = null;
    let targetPlot = null;

    // Walk up the DOM to find data attributes
    while (targetElement && !targetBlock) {
      if (targetElement.dataset && targetElement.dataset.blockidx !== undefined) {
        targetBlock = parseInt(targetElement.dataset.blockidx);
        targetPlot = parseInt(targetElement.dataset.plotidx);
        break;
      }
      targetElement = targetElement.parentElement;
    }

    if (targetBlock === null || targetPlot === null) {
      setDraggedItem(null);
      setTouchStartPos(null);
      return;
    }

    // Only allow swapping within same block
    if (draggedItem.blockIdx !== targetBlock) {
      alert('Cannot move plots between blocks! Drag within the same row only.');
      setDraggedItem(null);
      setTouchStartPos(null);
      return;
    }

    // Swap plots
    const newGrid = [...localGridLayout];
    const block = [...newGrid[targetBlock]];
    const temp = block[draggedItem.plotIdx];
    block[draggedItem.plotIdx] = block[targetPlot];
    block[targetPlot] = temp;
    newGrid[targetBlock] = block;

    setLocalGridLayout(newGrid);
    onLayoutChange(newGrid);
    setDraggedItem(null);
    setTouchStartPos(null);
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
          <p className="text-gray-600">Arrange your trial plots</p>
        </div>
        <button 
          onClick={onBack} 
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
        >
          ← Back to Setup
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow mb-4 flex gap-4 flex-wrap items-center">
        <button
          onClick={randomizeAllBlocks}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded transition"
        >
          <Shuffle size={20} />
          Randomize All Blocks
        </button>

        <button
          onClick={addBlankToAllRows}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition"
          title="Add one blank plot to the end of each row"
        >
          <Plus size={20} />
          Add Blank to All Rows
        </button>

        <button
          onClick={onFinalize}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition ml-auto"
        >
          <Lock size={20} /> Finalize & Lock Layout
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
              Plots resize to fit screen width
            </p>
          </div>
          
          {/* Compass Control */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-semibold text-gray-600">ORIENTATION</div>
            
            {/* Compass Display */}
            <div className="relative w-24 h-24 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full shadow-lg border-4 border-blue-300">
              <div 
                className="absolute inset-0 flex items-center justify-center"
                style={{ transform: `rotate(${localOrientation}deg)` }}
              >
                {/* North Arrow */}
                <div className="absolute top-1 left-1/2 -translate-x-1/2">
                  <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[16px] border-b-red-600"></div>
                  <div className="text-xs font-bold text-red-600 text-center mt-0.5">N</div>
                </div>
                
                {/* South */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                  <div className="text-xs font-semibold text-gray-600 mb-0.5">S</div>
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[12px] border-t-gray-600"></div>
                </div>
                
                {/* East */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <div className="text-xs font-semibold text-gray-600">E</div>
                </div>
                
                {/* West */}
                <div className="absolute left-1 top-1/2 -translate-y-1/2">
                  <div className="text-xs font-semibold text-gray-600">W</div>
                </div>
                
                {/* Center Dot */}
                <div className="w-2 h-2 bg-gray-800 rounded-full"></div>
              </div>
            </div>
            
            {/* Rotation Display */}
            <div className="text-sm font-mono text-gray-700 bg-gray-100 px-3 py-1 rounded">
              {localOrientation}°
            </div>
            
            {/* Rotation Controls */}
            <div className="flex gap-1">
              <button
                onClick={() => rotateCompass(-5)}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm rounded transition"
                title="Rotate -5°"
              >
                ↺ 5°
              </button>
              <button
                onClick={() => rotateCompass(5)}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm rounded transition"
                title="Rotate +5°"
              >
                ↻ 5°
              </button>
            </div>
            <button
              onClick={() => {
                setLocalOrientation(0);
                onOrientationChange(0);
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Reset to North
            </button>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="space-y-3">
          {localGridLayout.map((block, blockIdx) => (
            <div key={blockIdx} className="flex items-start gap-2">
              {/* Block Label */}
              <div className="flex-shrink-0 w-24 text-right pr-2 sticky left-0 bg-white z-10">
                <div className="text-sm font-semibold text-gray-700">
                  Block {blockIdx + 1}
                </div>
                <div className="flex gap-1 justify-end mt-1">
                  <button
                    onClick={() => randomizeBlock(blockIdx)}
                    className="p-1 bg-purple-100 hover:bg-purple-200 rounded transition"
                    title="Randomize this block"
                  >
                    <Shuffle size={12} className="text-purple-600" />
                  </button>
                  <button
                    onClick={() => addBlankToBlock(blockIdx, block.length)}
                    className="p-1 bg-green-100 hover:bg-green-200 rounded transition"
                    title="Add blank to end"
                  >
                    <Plus size={12} className="text-green-600" />
                  </button>
                </div>
              </div>

              {/* Block Plots - Responsive grid */}
              <div className="grid gap-1 flex-1" style={{ gridTemplateColumns: `repeat(${block.length + 1}, minmax(0, 1fr))` }}>
                {block.map((plot, plotIdx) => (
                  <div
                    key={plot.id}
                    data-blockidx={blockIdx}
                    data-plotidx={plotIdx}
                    draggable={!plot.isBlank}
                    onDragStart={(e) => handleDragStart(e, blockIdx, plotIdx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, blockIdx, plotIdx)}
                    onTouchStart={(e) => handleTouchStart(e, blockIdx, plotIdx, plot)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={(e) => handleTouchEnd(e, blockIdx, plotIdx)}
                    className={`
                      aspect-square rounded-lg shadow-md transition-all flex items-center justify-center
                      ${plot.isBlank
                        ? 'bg-gray-100 border-2 border-dashed border-gray-300'
                        : 'cursor-move hover:shadow-xl hover:scale-105 touch-none'
                      }
                    `}
                    style={{
                      backgroundColor: plot.isBlank ? undefined : treatmentColors[plot.treatment],
                    }}
                  >
                    {plot.isBlank ? (
                      <button
                        onClick={() => removeBlank(blockIdx, plotIdx)}
                        className="w-full h-full flex items-center justify-center hover:bg-red-100 rounded-lg transition group"
                      >
                        <Minus 
                          className="text-gray-400 group-hover:text-red-500 transition"
                          style={{ width: 'min(24px, 40%)', height: 'min(24px, 40%)' }}
                        />
                      </button>
                    ) : (
                      <div className="text-black font-bold text-center" style={{ fontSize: 'min(1.5rem, 6vw)' }}>
                        {String.fromCharCode(65 + plot.treatment)}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Quick add blank at end */}
                <button
                  onClick={() => addBlankToBlock(blockIdx, block.length)}
                  className="aspect-square rounded-lg hover:border-green-500 hover:bg-green-50 transition border-2 border-dashed border-gray-300 flex items-center justify-center group"
                >
                  <Plus 
                    className="text-gray-400 group-hover:text-green-600"
                    style={{ width: 'min(24px, 40%)', height: 'min(24px, 40%)' }}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded">
          <h4 className="font-medium mb-2">Instructions:</h4>
          <ul className="text-sm space-y-1 text-gray-700">
            <li>• <strong>Each row = 1 complete block</strong> containing all treatments (plots resize to fit)</li>
            <li>• <strong>Compass:</strong> Adjust field orientation in 5° increments</li>
            <li>• <strong>Drag & Drop:</strong> Swap plots within the same row only (works on desktop and iPad)</li>
            <li>• <strong>Randomize:</strong> Use shuffle button on each block or randomize all</li>
            <li>• <strong>Add Blanks:</strong> Use "Add Blank to All Rows" button for equal layout, or click + on individual rows</li>
            <li>• <strong>Remove Blanks:</strong> Click − on any blank space</li>
            <li>• <strong>Finalize:</strong> Lock layout when ready to start data entry</li>
          </ul>
        </div>

        {/* Treatment Legend */}
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-3">Treatment Legend:</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {config.treatments.map((treatment, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-black font-bold shadow"
                  style={{ backgroundColor: treatmentColors[idx] }}
                >
                  {String.fromCharCode(65 + idx)}
                </div>
                <span className="text-sm">{treatment}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialLayoutEditor;
