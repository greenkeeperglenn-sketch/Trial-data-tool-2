import React, { useState, useRef, useEffect } from 'react';

const ImageryAnalyzer = ({
  gridLayout,
  config,
  currentDateObj,
  selectedAssessmentType,
  onSelectAssessmentType,
  onBulkUpdateData
}) => {
  // Auto-detect grid dimensions from trial setup
  const trialRows = gridLayout?.length || 4;
  const trialCols = gridLayout?.[0]?.length || 4;

  const [imageSrc, setImageSrc] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileDate, setFileDate] = useState(null);
  const [rows, setRows] = useState(trialRows);
  const [cols, setCols] = useState(trialCols);
  const [corners, setCorners] = useState([
    { x: 50, y: 50, label: 'TL' },
    { x: 750, y: 50, label: 'TR' },
    { x: 750, y: 550, label: 'BR' },
    { x: 50, y: 550, label: 'BL' }
  ]);
  const [draggingCorner, setDraggingCorner] = useState(null);
  const [committed, setCommitted] = useState(false);
  const [plots, setPlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(currentDateObj?.date || '');

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const handleFileUpload = (file) => {
    if (!file) return;

    // Store the file and extract date from metadata
    setUploadedFile(file);

    // Try to get date from file modified date
    const modifiedDate = new Date(file.lastModified);
    const dateStr = modifiedDate.toISOString().split('T')[0]; // YYYY-MM-DD
    setFileDate(dateStr);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setImageSrc(event.target.result);

        // Initialize corners based on image size
        const w = img.width;
        const h = img.height;
        setCorners([
          { x: w * 0.1, y: h * 0.1, label: 'TL' },
          { x: w * 0.9, y: h * 0.1, label: 'TR' },
          { x: w * 0.9, y: h * 0.9, label: 'BR' },
          { x: w * 0.1, y: h * 0.9, label: 'BL' }
        ]);

        // Reset committed state
        setCommitted(false);
        setPlots([]);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!imageSrc || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    // Set canvas size to match image
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw grid
    drawGrid(ctx);
  }, [imageSrc, corners, rows, cols]);

  const drawGrid = (ctx) => {
    if (corners.length < 4) return;

    const [tl, tr, br, bl] = corners;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.lineWidth = 2;

    // Draw vertical lines
    for (let i = 0; i <= cols; i++) {
      const t = i / cols;
      const topX = tl.x + (tr.x - tl.x) * t;
      const topY = tl.y + (tr.y - tl.y) * t;
      const bottomX = bl.x + (br.x - bl.x) * t;
      const bottomY = bl.y + (br.y - bl.y) * t;

      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(bottomX, bottomY);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const leftX = tl.x + (bl.x - tl.x) * t;
      const leftY = tl.y + (bl.y - tl.y) * t;
      const rightX = tr.x + (br.x - tr.x) * t;
      const rightY = tr.y + (br.y - tr.y) * t;

      ctx.beginPath();
      ctx.moveTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.stroke();
    }

    // Draw corner markers (EXTRA LARGE with visual feedback)
    corners.forEach((corner, idx) => {
      const isActive = draggingCorner === idx;

      if (isActive) {
        // ACTIVE STATE - Pulsing yellow square
        ctx.save();
        ctx.translate(corner.x, corner.y);
        ctx.rotate(Math.PI / 4); // Rotate 45 degrees

        // Outer glow
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.fillRect(-50, -50, 100, 100);

        // Main square
        ctx.fillStyle = 'rgba(255, 200, 0, 0.95)';
        ctx.fillRect(-35, -35, 70, 70);

        // Center
        ctx.fillStyle = 'white';
        ctx.fillRect(-12, -12, 24, 24);

        ctx.restore();

        // Label
        ctx.fillStyle = 'yellow';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 4;
        ctx.strokeText(corner.label + ' ⬅️', corner.x, corner.y + 60);
        ctx.fillText(corner.label + ' ⬅️', corner.x, corner.y + 60);
      } else {
        // NORMAL STATE - Large red circles
        // Outer circle (glow effect) - BIGGER
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 50, 0, 2 * Math.PI);
        ctx.fill();

        // Middle circle
        ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 35, 0, 2 * Math.PI);
        ctx.fill();

        // Inner circle (main marker) - BIGGER
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 25, 0, 2 * Math.PI);
        ctx.fill();

        // White center - BIGGER
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 12, 0, 2 * Math.PI);
        ctx.fill();

        // Label - BIGGER
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 4;
        ctx.strokeText(corner.label, corner.x, corner.y + 55);
        ctx.fillText(corner.label, corner.x, corner.y + 55);
      }
    });
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if clicking near a corner (even larger hit area for touch)
    const clickedCorner = corners.findIndex(corner => {
      const distance = Math.sqrt(Math.pow(corner.x - x, 2) + Math.pow(corner.y - y, 2));
      return distance < 60; // Increased to 60px for better touch support
    });

    if (clickedCorner >= 0) {
      setDraggingCorner(clickedCorner);
    }
  };

  const handleMouseMove = (e) => {
    if (draggingCorner === null) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setCorners(prev => {
      const newCorners = [...prev];
      newCorners[draggingCorner] = { ...newCorners[draggingCorner], x, y };
      return newCorners;
    });
  };

  const handleMouseUp = () => {
    setDraggingCorner(null);
  };

  // Touch event handlers for iPad/mobile
  const handleTouchStart = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    // Check if touching near a corner
    const clickedCorner = corners.findIndex(corner => {
      const distance = Math.sqrt(Math.pow(corner.x - x, 2) + Math.pow(corner.y - y, 2));
      return distance < 60;
    });

    if (clickedCorner >= 0) {
      setDraggingCorner(clickedCorner);
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (draggingCorner === null) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    setCorners(prev => {
      const newCorners = [...prev];
      newCorners[draggingCorner] = { ...newCorners[draggingCorner], x, y };
      return newCorners;
    });
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    setDraggingCorner(null);
  };

  // Calculate green coverage for a canvas context
  const calculateGreenCoverage = (ctx, x, y, width, height) => {
    const imageData = ctx.getImageData(x, y, width, height);
    const data = imageData.data;
    let totalPixels = 0;
    let greenPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      totalPixels++;

      // Simple green detection: green is higher than red and blue
      if (g > r && g > b && g > 50) {
        greenPixels++;
      }
    }

    return totalPixels === 0 ? 0 : (greenPixels / totalPixels) * 100;
  };

  // Commit grid and analyze plots
  const commitGrid = () => {
    if (!imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    const [tl, tr, br, bl] = corners;

    const extractedPlots = [];

    // Extract each plot
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate plot position using perspective transformation
        const rowT = row / rows;
        const rowB = (row + 1) / rows;
        const colL = col / cols;
        const colR = (col + 1) / cols;

        // Get corners of this plot
        const topLeftX = tl.x + (tr.x - tl.x) * colL;
        const topLeftY = tl.y + (tr.y - tl.y) * colL;
        const topRightX = tl.x + (tr.x - tl.x) * colR;
        const topRightY = tl.y + (tr.y - tl.y) * colR;

        const bottomLeftX = bl.x + (br.x - bl.x) * colL;
        const bottomLeftY = bl.y + (br.y - bl.y) * colL;
        const bottomRightX = bl.x + (br.x - bl.x) * colR;
        const bottomRightY = bl.y + (br.y - bl.y) * colR;

        // Interpolate for this specific plot row
        const plotTLX = topLeftX + (bottomLeftX - topLeftX) * rowT;
        const plotTLY = topLeftY + (bottomLeftY - topLeftY) * rowT;
        const plotTRX = topRightX + (bottomRightX - topRightX) * rowT;
        const plotTRY = topRightY + (bottomRightY - topRightY) * rowT;
        const plotBLX = topLeftX + (bottomLeftX - topLeftX) * rowB;
        const plotBLY = topLeftY + (bottomLeftY - topLeftY) * rowB;
        const plotBRX = topRightX + (bottomRightX - topRightX) * rowB;
        const plotBRY = topRightY + (bottomRightY - topRightY) * rowB;

        // Get bounding box for simplified extraction
        const minX = Math.min(plotTLX, plotTRX, plotBRX, plotBLX);
        const maxX = Math.max(plotTLX, plotTRX, plotBRX, plotBLX);
        const minY = Math.min(plotTLY, plotTRY, plotBRY, plotBLY);
        const maxY = Math.max(plotTLY, plotTRY, plotBRY, plotBLY);

        const plotWidth = maxX - minX;
        const plotHeight = maxY - minY;

        // Calculate green coverage for this plot
        const greenCoverage = calculateGreenCoverage(ctx, minX, minY, plotWidth, plotHeight);

        // Get plot ID from gridLayout
        const layoutPlot = gridLayout[row]?.[col];
        const plotId = layoutPlot?.id || `${row + 1}-${col + 1}`;

        extractedPlots.push({
          id: plotId,
          row: row + 1,
          col: col + 1,
          greenCoverage: greenCoverage,
          isBlank: layoutPlot?.isBlank || false
        });
      }
    }

    setPlots(extractedPlots);
    setCommitted(true);
  };

  // Apply green coverage values to trial data
  const applyToTrial = () => {
    if (!currentDateObj || !selectedDate || plots.length === 0) {
      alert('Please ensure you have an assessment date selected and plots committed.');
      return;
    }

    if (!selectedAssessmentType) {
      alert('Please select an assessment type to apply the data to.');
      return;
    }

    const updates = {};
    let appliedCount = 0;

    plots.forEach(plot => {
      if (!plot.isBlank) {
        updates[plot.id] = plot.greenCoverage.toFixed(1);
        appliedCount++;
      }
    });

    if (Object.keys(updates).length === 0) {
      alert('No plots to update.');
      return;
    }

    onBulkUpdateData(selectedDate, selectedAssessmentType, updates);
    alert(`Applied green coverage values to ${appliedCount} plots for ${selectedAssessmentType} on ${selectedDate}.`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Turf Trial Imagery Analyzer</h2>
          <p className="text-sm text-gray-600">
            Upload a drone image and manually align the plot grid.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition"
          >
            Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={(event) => handleFileUpload(event.target.files?.[0])}
            className="hidden"
          />
        </div>

        {!imageSrc && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center border-gray-300 bg-gray-50">
            <p className="text-lg font-medium">Drag & drop or click to upload a drone image</p>
            <p className="text-sm text-gray-500 mt-2">JPEG or PNG files are supported</p>
          </div>
        )}

        {imageSrc && (
          <div className="mt-6 space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded">
              <p className="font-medium">Grid Detected from Trial Setup:</p>
              <p className="text-sm">{rows} rows × {cols} columns (from your trial configuration)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2 text-sm">
                Rows
                <input
                  type="number"
                  min={1}
                  value={rows}
                  onChange={(e) => setRows(Number(e.target.value) || 1)}
                  className="border rounded px-3 py-2 bg-gray-50"
                  title="Auto-detected from trial setup. Override if needed."
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Columns
                <input
                  type="number"
                  min={1}
                  value={cols}
                  onChange={(e) => setCols(Number(e.target.value) || 1)}
                  className="border rounded px-3 py-2 bg-gray-50"
                  title="Auto-detected from trial setup. Override if needed."
                />
              </label>
            </div>

            <div className="bg-blue-50 text-blue-700 p-3 rounded text-sm">
              <p className="font-medium">Grid Alignment:</p>
              <p>Drag the red corner markers (TL, TR, BR, BL) to align the grid with your plots.</p>
            </div>

            <canvas
              ref={canvasRef}
              className="w-full border rounded cursor-crosshair"
              style={{ touchAction: 'none' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />

            {/* File Date Info */}
            {fileDate && (
              <div className="bg-purple-50 border border-purple-200 text-purple-800 p-3 rounded">
                <p className="font-medium">Image File Date: {fileDate}</p>
                <p className="text-sm">Detected from file properties</p>
              </div>
            )}

            {/* Commit Button */}
            {!committed && (
              <button
                onClick={commitGrid}
                className="w-full px-6 py-4 bg-emerald-600 text-white text-lg font-semibold rounded-lg hover:bg-emerald-700 transition"
              >
                🚀 Commit Grid & Analyze Plots
              </button>
            )}

            {/* Results after committing */}
            {committed && plots.length > 0 && (
              <div className="space-y-4 mt-6">
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded">
                  <p className="font-bold text-lg">✅ Analysis Complete!</p>
                  <p className="text-sm">Extracted {plots.filter(p => !p.isBlank).length} plots</p>
                </div>

                {/* Date Selector */}
                <div className="bg-white border rounded-lg p-4">
                  <label className="block text-sm font-medium mb-2">
                    Select Assessment Date to Apply Data
                  </label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full p-3 border rounded-lg text-lg"
                  >
                    <option value="">-- Select Date --</option>
                    {currentDateObj && <option value={currentDateObj.date}>{currentDateObj.date} (Current)</option>}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Image date: {fileDate || 'Unknown'}
                  </p>
                </div>

                {/* Assessment Type Selector */}
                {selectedAssessmentType && (
                  <div className="bg-white border rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">Apply to Assessment Type:</p>
                    <p className="text-lg font-bold text-blue-600">{selectedAssessmentType}</p>
                    <p className="text-xs text-gray-500 mt-1">Green coverage % will be applied</p>
                  </div>
                )}

                {/* Plot Results Summary */}
                <div className="bg-white border rounded-lg p-4 max-h-64 overflow-y-auto">
                  <h3 className="font-semibold mb-3">Plot Results ({plots.length} plots)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
                    {plots.filter(p => !p.isBlank).slice(0, 20).map(plot => (
                      <div key={plot.id} className="bg-gray-50 p-2 rounded border">
                        <div className="font-medium">{plot.id}</div>
                        <div className="text-green-600 font-bold">{plot.greenCoverage.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                  {plots.filter(p => !p.isBlank).length > 20 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Showing first 20 of {plots.filter(p => !p.isBlank).length} plots...
                    </p>
                  )}
                </div>

                {/* Apply Button */}
                <button
                  onClick={applyToTrial}
                  disabled={!selectedDate || !selectedAssessmentType}
                  className="w-full px-6 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📊 Apply Green Coverage to Trial Data
                </button>

                {/* Reset Button */}
                <button
                  onClick={() => {
                    setCommitted(false);
                    setPlots([]);
                  }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  ↺ Reset & Adjust Grid
                </button>
              </div>
            )}
          </div>
        )}

        {!imageSrc && (
          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">How to use:</h3>
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
              <li>Upload an aerial/drone image of your trial plots</li>
              <li>Adjust the number of rows and columns to match your trial layout</li>
              <li>Drag the corner markers to align the grid with your plots</li>
              <li>The green grid will overlay your plots for visual verification</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageryAnalyzer;
