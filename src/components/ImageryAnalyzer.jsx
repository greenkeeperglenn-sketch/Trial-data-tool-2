import React, { useState, useEffect, useRef, useCallback } from 'react';

const loadOpenCvScript = () => {
  if (document.getElementById('opencv-script')) {
    return;
  }

  const script = document.createElement('script');
  script.id = 'opencv-script';
  script.src = 'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js';
  script.async = true;
  document.body.appendChild(script);
};

const calculateGreenCoverage = (imageData, sensitivity) => {
  const data = imageData.data;
  let totalPixels = 0;
  let greenPixels = 0;

  const hueMin = 35 - sensitivity;
  const hueMax = 85 + sensitivity;
  const satMin = 20;
  const valMin = 20;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    const s = max === 0 ? 0 : (delta / max) * 100;
    const v = (max / 255) * 100;

    if (delta !== 0) {
      if (max === r) {
        h = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        h = 60 * (((b - r) / delta) + 2);
      } else {
        h = 60 * (((r - g) / delta) + 4);
      }
    }

    if (h < 0) h += 360;

    if (h >= hueMin && h <= hueMax && s >= satMin && v >= valMin) {
      greenPixels++;
    }

    totalPixels++;
  }

  return totalPixels === 0 ? 0 : (greenPixels / totalPixels) * 100;
};

const detectGridDimensions = (corners) => {
  if (corners.length < 4) {
    return { rows: 0, cols: 0 };
  }

  const sortedByY = [...corners].sort((a, b) => a.y - b.y);
  const rowTolerance = 50;
  const rowGroups = [];
  let currentRow = [sortedByY[0]];

  for (let i = 1; i < sortedByY.length; i++) {
    if (Math.abs(sortedByY[i].y - currentRow[0].y) < rowTolerance) {
      currentRow.push(sortedByY[i]);
    } else {
      rowGroups.push(currentRow);
      currentRow = [sortedByY[i]];
    }
  }
  rowGroups.push(currentRow);

  const sortedByX = [...corners].sort((a, b) => a.x - b.x);
  const colTolerance = 50;
  const colGroups = [];
  let currentCol = [sortedByX[0]];

  for (let i = 1; i < sortedByX.length; i++) {
    if (Math.abs(sortedByX[i].x - currentCol[0].x) < colTolerance) {
      currentCol.push(sortedByX[i]);
    } else {
      colGroups.push(currentCol);
      currentCol = [sortedByX[i]];
    }
  }
  colGroups.push(currentCol);

  const detectedRows = Math.max(1, rowGroups.length - 1);
  const detectedCols = Math.max(1, colGroups.length - 1);

  return { rows: detectedRows, cols: detectedCols };
};

const initializeGridCorners = (corners) => {
  if (corners.length < 4) return [];

  const allX = corners.map(corner => corner.x);
  const allY = corners.map(corner => corner.y);

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const topLeft = corners.reduce((closest, corner) => {
    const dist = Math.hypot(corner.x - minX, corner.y - minY);
    const closestDist = Math.hypot(closest.x - minX, closest.y - minY);
    return dist < closestDist ? corner : closest;
  }, corners[0]);

  const topRight = corners.reduce((closest, corner) => {
    const dist = Math.hypot(corner.x - maxX, corner.y - minY);
    const closestDist = Math.hypot(closest.x - maxX, closest.y - minY);
    return dist < closestDist ? corner : closest;
  }, corners[0]);

  const bottomLeft = corners.reduce((closest, corner) => {
    const dist = Math.hypot(corner.x - minX, corner.y - maxY);
    const closestDist = Math.hypot(closest.x - minX, closest.y - maxY);
    return dist < closestDist ? corner : closest;
  }, corners[0]);

  const bottomRight = corners.reduce((closest, corner) => {
    const dist = Math.hypot(corner.x - maxX, corner.y - maxY);
    const closestDist = Math.hypot(closest.x - maxX, closest.y - maxY);
    return dist < closestDist ? corner : closest;
  }, corners[0]);

  return [
    { ...topLeft, label: 'TL' },
    { ...topRight, label: 'TR' },
    { ...bottomRight, label: 'BR' },
    { ...bottomLeft, label: 'BL' }
  ];
};

const ImageryAnalyzer = ({
  gridLayout,
  config,
  currentDateObj,
  selectedAssessmentType,
  onSelectAssessmentType,
  onBulkUpdateData
}) => {
  console.log('[ImageryAnalyzer] Component rendered!', { gridLayout, config, currentDateObj, selectedAssessmentType });
  const [imageSrc, setImageSrc] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [opencvReady, setOpencvReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [corners, setCorners] = useState([]);
  const [gridCorners, setGridCorners] = useState([]);
  const [draggingCorner, setDraggingCorner] = useState(null);
  const [rows, setRows] = useState(() => gridLayout.length || 0);
  const [cols, setCols] = useState(() => (gridLayout[0] ? gridLayout[0].length : 0));
  const [minArea, setMinArea] = useState(50);
  const [maxArea, setMaxArea] = useState(5000);
  const [markerColor, setMarkerColor] = useState('bright');
  const [greenSensitivity, setGreenSensitivity] = useState(35);
  const [committed, setCommitted] = useState(false);
  const [plots, setPlots] = useState([]);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [targetAssessmentType, setTargetAssessmentType] = useState(selectedAssessmentType);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadOpenCvScript();

    const checkInterval = setInterval(() => {
      if (window.cv && window.cv.Mat && !opencvReady) {
        setOpencvReady(true);
        clearInterval(checkInterval);
      }
    }, 200);

    return () => clearInterval(checkInterval);
  }, [opencvReady]);

  useEffect(() => {
    setTargetAssessmentType(selectedAssessmentType);
  }, [selectedAssessmentType]);

  useEffect(() => {
    if (!originalImage || !opencvReady) return;
    const timer = setTimeout(() => {
      processImage(originalImage);
    }, 200);
    return () => clearTimeout(timer);
  }, [originalImage, opencvReady, markerColor, minArea, maxArea]);

  useEffect(() => {
    if (gridCorners.length === 4 && rows > 0 && cols > 0 && originalImage && !committed) {
      drawGrid();
    }
  }, [gridCorners, rows, cols, committed, originalImage, draggingCorner, drawGrid]);
  const processImage = useCallback((img) => {
    if (!opencvReady || !window.cv) return;

    setIsProcessing(true);

    setTimeout(() => {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);

        const src = window.cv.imread(tempCanvas);
        const gray = new window.cv.Mat();
        const mask = new window.cv.Mat();

        if (markerColor === 'white') {
          window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
          window.cv.threshold(gray, mask, 200, 255, window.cv.THRESH_BINARY);
        } else {
          const hsv = new window.cv.Mat();
          window.cv.cvtColor(src, hsv, window.cv.COLOR_RGBA2RGB);
          window.cv.cvtColor(hsv, hsv, window.cv.COLOR_RGB2HSV);

          const low = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 100, 100, 0]);
          const high = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 255]);
          window.cv.inRange(hsv, low, high, mask);
          hsv.delete();
          low.delete();
          high.delete();
        }

        const kernel = window.cv.getStructuringElement(window.cv.MORPH_ELLIPSE, new window.cv.Size(5, 5));
        window.cv.morphologyEx(mask, mask, window.cv.MORPH_CLOSE, kernel);
        window.cv.morphologyEx(mask, mask, window.cv.MORPH_OPEN, kernel);

        const contours = new window.cv.MatVector();
        const hierarchy = new window.cv.Mat();
        window.cv.findContours(mask, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

        const detectedCorners = [];
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          const area = window.cv.contourArea(contour);
          if (area >= minArea && area <= maxArea) {
            const rect = window.cv.boundingRect(contour);
            detectedCorners.push({
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              area,
              rect
            });
          }
        }

        setCorners(detectedCorners);
        const { rows: detectedRows, cols: detectedCols } = detectGridDimensions(detectedCorners);
        if (detectedRows > 0 && detectedCols > 0) {
          setRows(detectedRows);
          setCols(detectedCols);
        }
        setGridCorners(initializeGridCorners(detectedCorners));

        src.delete();
        gray.delete();
        mask.delete();
        kernel.delete();
        contours.delete();
        hierarchy.delete();
      } catch (error) {
        console.error('Error processing image', error);
        setErrorMessage('Failed to process image: ' + error.message);
      }
      setIsProcessing(false);
    }, 200);
  }, [opencvReady, markerColor, minArea, maxArea]);

  const drawGrid = useCallback(() => {
    if (!originalImage || gridCorners.length !== 4) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0);

    const [topLeft, topRight, bottomRight, bottomLeft] = gridCorners;

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;

    for (let i = 0; i <= rows; i++) {
      const t = rows === 0 ? 0 : i / rows;
      const leftPoint = {
        x: topLeft.x + (bottomLeft.x - topLeft.x) * t,
        y: topLeft.y + (bottomLeft.y - topLeft.y) * t
      };
      const rightPoint = {
        x: topRight.x + (bottomRight.x - topRight.x) * t,
        y: topRight.y + (bottomRight.y - topRight.y) * t
      };
      ctx.beginPath();
      ctx.moveTo(leftPoint.x, leftPoint.y);
      ctx.lineTo(rightPoint.x, rightPoint.y);
      ctx.stroke();
    }

    for (let i = 0; i <= cols; i++) {
      const t = cols === 0 ? 0 : i / cols;
      const topPoint = {
        x: topLeft.x + (topRight.x - topLeft.x) * t,
        y: topLeft.y + (topRight.y - topLeft.y) * t
      };
      const bottomPoint = {
        x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * t,
        y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * t
      };
      ctx.beginPath();
      ctx.moveTo(topPoint.x, topPoint.y);
      ctx.lineTo(bottomPoint.x, bottomPoint.y);
      ctx.stroke();
    }

    gridCorners.forEach((corner, index) => {
      ctx.fillStyle = index === draggingCorner ? '#f97316' : '#ef4444';
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(corner.label, corner.x, corner.y);
    });

    ctx.fillStyle = 'rgba(250, 204, 21, 0.7)';
    corners.forEach(corner => {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [originalImage, gridCorners, rows, cols, draggingCorner, corners]);

  const handleFileUpload = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setErrorMessage('');
    setStatusMessage('');
    setCommitted(false);
    setPlots([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        setImageSrc(e.target.result);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const getMousePos = (canvas, evt) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (event) => {
    if (committed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getMousePos(canvas, event);
    const hitRadius = 25;
    for (let i = 0; i < gridCorners.length; i++) {
      const corner = gridCorners[i];
      const distance = Math.hypot(pos.x - corner.x, pos.y - corner.y);
      if (distance <= hitRadius) {
        setDraggingCorner(i);
        break;
      }
    }
  };

  const handleMouseMove = (event) => {
    if (draggingCorner === null || committed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getMousePos(canvas, event);
    setGridCorners(prev => prev.map((corner, index) => (
      index === draggingCorner ? { ...corner, x: pos.x, y: pos.y } : corner
    )));
  };

  const handleMouseUp = () => {
    setDraggingCorner(null);
  };

  const commitGrid = () => {
    if (!originalImage || gridCorners.length !== 4) {
      setErrorMessage('Please detect and adjust the grid corners before committing.');
      return;
    }
    if (rows <= 0 || cols <= 0) {
      setErrorMessage('Rows and columns must be greater than zero.');
      return;
    }
    if (!window.cv) {
      setErrorMessage('OpenCV has not finished loading.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    setTimeout(() => {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalImage.width;
        tempCanvas.height = originalImage.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(originalImage, 0, 0);

        const src = window.cv.imread(tempCanvas);
        const [topLeft, topRight, bottomRight, bottomLeft] = gridCorners;

        const width = Math.max(
          Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
          Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y)
        );
        const height = Math.max(
          Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y),
          Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y)
        );

        const srcTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
          topLeft.x, topLeft.y,
          topRight.x, topRight.y,
          bottomRight.x, bottomRight.y,
          bottomLeft.x, bottomLeft.y
        ]);
        const dstTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
          0, 0,
          width, 0,
          width, height,
          0, height
        ]);
        const M = window.cv.getPerspectiveTransform(srcTri, dstTri);
        const dsize = new window.cv.Size(width, height);
        const corrected = new window.cv.Mat();
        window.cv.warpPerspective(src, corrected, M, dsize, window.cv.INTER_LINEAR, window.cv.BORDER_CONSTANT, new window.cv.Scalar());

        const extractedPlots = [];
        let plotNumber = 1;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x0 = Math.round((c / cols) * width);
            const x1 = Math.round(((c + 1) / cols) * width);
            const y0 = Math.round((r / rows) * height);
            const y1 = Math.round(((r + 1) / rows) * height);
            const w = Math.max(1, x1 - x0);
            const h = Math.max(1, y1 - y0);

            const rect = new window.cv.Rect(x0, y0, w, h);
            const plot = corrected.roi(rect);
            const plotCanvas = document.createElement('canvas');
            plotCanvas.width = w;
            plotCanvas.height = h;
            window.cv.imshow(plotCanvas, plot);

            const ctx = plotCanvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, plotCanvas.width, plotCanvas.height);
            const coverage = calculateGreenCoverage(imageData, greenSensitivity);

            extractedPlots.push({
              id: plotNumber,
              row: r + 1,
              col: c + 1,
              image: plotCanvas.toDataURL('image/png'),
              greenCoverage: coverage
            });

            plot.delete();
            plotNumber++;
          }
        }

        setPlots(extractedPlots);
        setCommitted(true);
        setStatusMessage(`Extracted ${extractedPlots.length} plots. Review and apply to the trial.`);

        src.delete();
        srcTri.delete();
        dstTri.delete();
        M.delete();
        corrected.delete();
      } catch (error) {
        console.error('Error committing grid', error);
        setErrorMessage('Failed to analyze grid: ' + error.message);
      }
      setIsProcessing(false);
    }, 100);
  };

  const handleReprocess = () => {
    if (!originalImage) return;
    setCommitted(false);
    setPlots([]);
    setStatusMessage('');
    processImage(originalImage);
  };

  const downloadAll = () => {
    plots.forEach(plot => {
      const link = document.createElement('a');
      link.download = `plot-${plot.id}_coverage-${plot.greenCoverage.toFixed(1)}.png`;
      link.href = plot.image;
      link.click();
    });
  };

  const exportCSV = () => {
    let csv = 'Plot,Row,Column,Green Coverage (%)\n';
    plots.forEach(plot => {
      csv += `${plot.id},${plot.row},${plot.col},${plot.greenCoverage.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'turf-trial-imagery.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const averageCoverage = plots.length
    ? plots.reduce((sum, plot) => sum + plot.greenCoverage, 0) / plots.length
    : 0;

  const applyToTrial = () => {
    setStatusMessage('');

    if (!currentDateObj) {
      setErrorMessage('Add an assessment date in the trial before applying imagery results.');
      return;
    }

    if (!targetAssessmentType) {
      setErrorMessage('Choose an assessment type to receive the green coverage values.');
      return;
    }

    if (!currentDateObj.assessments || !currentDateObj.assessments[targetAssessmentType]) {
      setErrorMessage('The selected assessment type is not available for the chosen date.');
      return;
    }

    if (!gridLayout.length || !gridLayout[0]) {
      setErrorMessage('The trial layout is empty. Configure the layout before applying imagery.');
      return;
    }

    if (gridLayout.length !== rows || gridLayout[0].length !== cols) {
      setErrorMessage('Detected grid dimensions do not match the trial layout. Adjust rows/columns to match your trial design.');
      return;
    }

    const updates = {};
    let appliedCount = 0;

    plots.forEach(plot => {
      const layoutRow = gridLayout[plot.row - 1];
      const layoutPlot = layoutRow ? layoutRow[plot.col - 1] : null;
      if (layoutPlot && !layoutPlot.isBlank) {
        updates[layoutPlot.id] = plot.greenCoverage.toFixed(1);
        appliedCount++;
      }
    });

    if (Object.keys(updates).length === 0) {
      setErrorMessage('No plots were mapped to the layout. Verify that your grid matches the trial design.');
      return;
    }

    onBulkUpdateData(currentDateObj.date, targetAssessmentType, updates);
    setStatusMessage(`Applied coverage values to ${appliedCount} plots for ${targetAssessmentType} on ${currentDateObj.date}.`);
    setErrorMessage('');
  };

  return (
    <div className="space-y-4" style={{ minHeight: '400px', backgroundColor: '#f0f0f0', padding: '20px' }}>
      <div className="bg-white rounded-lg shadow p-6" style={{ border: '2px solid red' }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'red', fontSize: '24px' }}>Turf Trial Imagery Analyzer</h2>
            <p className="text-sm text-gray-600" style={{ color: 'blue' }}>
              Upload a drone image, align the plot grid, and automatically calculate green coverage for each plot.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <button
              onClick={handleReprocess}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 transition disabled:opacity-50"
              disabled={!originalImage}
            >
              Reprocess
            </button>
            {committed && plots.length > 0 && (
              <>
                <button
                  onClick={downloadAll}
                  className="px-4 py-2 rounded bg-slate-600 text-white text-sm hover:bg-slate-700 transition"
                >
                  Download Plots
                </button>
                <button
                  onClick={exportCSV}
                  className="px-4 py-2 rounded bg-slate-600 text-white text-sm hover:bg-slate-700 transition"
                >
                  Export CSV
                </button>
              </>
            )}
          </div>
        </div>

        {!opencvReady && (
          <div className="p-4 mb-4 rounded bg-yellow-50 text-yellow-700 text-sm">
            Loading OpenCV library… this may take a few seconds.
          </div>
        )}

        {statusMessage && (
          <div className="p-3 mb-4 rounded bg-emerald-50 text-emerald-700 text-sm">
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-3 mb-4 rounded bg-red-50 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
            isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
          } ${committed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (committed) return;
            const file = event.dataTransfer.files?.[0];
            handleFileUpload(file);
          }}
          onClick={() => {
            if (!committed) {
              fileInputRef.current?.click();
            }
          }}
        >
          <p className="text-lg font-medium">Drag & drop or click to upload a drone image</p>
          <p className="text-sm text-gray-500 mt-2">JPEG or PNG files are supported</p>
        </div>

        {imageSrc && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2 text-sm">
                Marker color
                <select
                  value={markerColor}
                  onChange={(event) => setMarkerColor(event.target.value)}
                  className="border rounded px-3 py-2"
                  disabled={committed}
                >
                  <option value="bright">Bright colors (default)</option>
                  <option value="white">White or light markers</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Rows detected
                <input
                  type="number"
                  min={1}
                  value={rows}
                  onChange={(event) => setRows(Number(event.target.value) || 0)}
                  className="border rounded px-3 py-2"
                  disabled={committed}
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Columns detected
                <input
                  type="number"
                  min={1}
                  value={cols}
                  onChange={(event) => setCols(Number(event.target.value) || 0)}
                  className="border rounded px-3 py-2"
                  disabled={committed}
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Green sensitivity ({greenSensitivity})
                <input
                  type="range"
                  min={10}
                  max={60}
                  value={greenSensitivity}
                  onChange={(event) => setGreenSensitivity(Number(event.target.value))}
                  disabled={isProcessing}
                />
              </label>
            </div>

            <details className="bg-gray-50 rounded-lg p-4 text-sm">
              <summary className="font-medium cursor-pointer">Advanced marker detection</summary>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2">
                  Min marker area
                  <input
                    type="number"
                    min={1}
                    value={minArea}
                    onChange={(event) => setMinArea(Number(event.target.value) || 1)}
                    className="border rounded px-3 py-2"
                    disabled={committed}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  Max marker area
                  <input
                    type="number"
                    min={minArea}
                    value={maxArea}
                    onChange={(event) => setMaxArea(Number(event.target.value) || minArea)}
                    className="border rounded px-3 py-2"
                    disabled={committed}
                  />
                </label>
              </div>
            </details>

            <div>
              <canvas
                ref={canvasRef}
                className="w-full max-h-[70vh] rounded border"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={commitGrid}
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition disabled:opacity-50"
                disabled={isProcessing || committed || !gridCorners.length}
              >
                Commit & Analyze
              </button>
              <button
                onClick={() => {
                  setCommitted(false);
                  setPlots([]);
                  setStatusMessage('Grid reset. Adjust corners and commit again.');
                }}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded hover:bg-slate-300 transition"
              >
                Reset Grid
              </button>
            </div>

            {isProcessing && (
              <div className="p-4 rounded bg-blue-50 text-blue-700 text-sm">
                Processing imagery…
              </div>
            )}
          </div>
        )}
      </div>

      {committed && plots.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold">Imagery results</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-2 text-sm">
              Apply to assessment type
              <select
                value={targetAssessmentType || ''}
                onChange={(event) => {
                  setTargetAssessmentType(event.target.value);
                  onSelectAssessmentType(event.target.value);
                }}
                className="border rounded px-3 py-2"
              >
                <option value="" disabled>Select assessment</option>
                {config.assessmentTypes.map(type => (
                  <option key={type.name} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="bg-emerald-50 text-emerald-700 rounded p-3 text-sm">
              Average coverage: {averageCoverage.toFixed(1)}%
            </div>
          </div>

          <button
            onClick={applyToTrial}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
          >
            Apply coverage to trial data
          </button>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plots.map(plot => (
              <button
                key={plot.id}
                type="button"
                onClick={() => setSelectedPlot(plot)}
                className="border rounded-lg overflow-hidden text-left bg-white shadow hover:shadow-lg transition"
              >
                <img src={plot.image} alt={`Plot ${plot.id}`} className="w-full aspect-square object-cover" />
                <div className="p-3 text-sm">
                  <div className="font-semibold">Plot {plot.id}</div>
                  <div className="text-gray-600">Row {plot.row}, Column {plot.col}</div>
                  <div className="mt-2 font-medium text-emerald-600">
                    {plot.greenCoverage.toFixed(1)}% green coverage
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedPlot && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPlot(null)}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-full overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b p-4">
              <div>
                <h4 className="text-lg font-semibold">Plot {selectedPlot.id}</h4>
                <p className="text-sm text-gray-600">
                  Row {selectedPlot.row}, Column {selectedPlot.col} – {selectedPlot.greenCoverage.toFixed(1)}% coverage
                </p>
              </div>
              <button
                className="text-sm px-3 py-1 rounded bg-slate-200 hover:bg-slate-300"
                onClick={() => setSelectedPlot(null)}
              >
                Close
              </button>
            </div>
            <img src={selectedPlot.image} alt={`Plot ${selectedPlot.id}`} className="w-full" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageryAnalyzer;
