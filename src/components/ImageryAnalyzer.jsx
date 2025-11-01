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
  const [rows, setRows] = useState(trialRows);
  const [cols, setCols] = useState(trialCols);
  const [corners, setCorners] = useState([
    { x: 50, y: 50, label: 'TL' },
    { x: 750, y: 50, label: 'TR' },
    { x: 750, y: 550, label: 'BR' },
    { x: 50, y: 550, label: 'BL' }
  ]);
  const [draggingCorner, setDraggingCorner] = useState(null);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const handleFileUpload = (file) => {
    if (!file) return;

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
