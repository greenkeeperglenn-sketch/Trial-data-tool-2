import React, { useState, useRef, useEffect } from 'react';
import piexif from 'piexifjs';

const ImageryAnalyzer = ({
  gridLayout,
  config,
  assessmentDates,
  currentDateObj,
  selectedAssessmentType,
  onSelectAssessmentType,
  onBulkUpdateData,
  onPhotosChange,
  onAssessmentDatesChange
}) => {
  // Auto-detect grid dimensions from trial setup
  const trialRows = gridLayout?.length || 4;
  const trialCols = gridLayout?.[0]?.length || 4;

  const [imageSrc, setImageSrc] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileDate, setFileDate] = useState(null);
  const [showDateConfirmation, setShowDateConfirmation] = useState(false);
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
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageOrientation, setImageOrientation] = useState(0);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const originalImageRef = useRef(null); // Store original high-res image
  const imageWorkerRef = useRef(null);

  // Cleanup memory on unmount
  useEffect(() => {
    return () => {
      // Clear image references to allow garbage collection
      if (originalImageRef.current) {
        originalImageRef.current.src = '';
        originalImageRef.current = null;
      }
      if (imageRef.current) {
        imageRef.current.src = '';
        imageRef.current = null;
      }
      // Revoke blob URLs if used
      if (imageSrc && typeof imageSrc === 'string' && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
      // Terminate worker
      if (imageWorkerRef.current) {
        imageWorkerRef.current.terminate();
      }
    };
  }, [imageSrc]);

  // Initialize Web Worker
  useEffect(() => {
    try {
      imageWorkerRef.current = new Worker(
        new URL('../utils/imageProcessingWorker.js', import.meta.url)
      );
    } catch (error) {
      console.error('Failed to create Web Worker:', error);
    }

    return () => {
      if (imageWorkerRef.current) {
        imageWorkerRef.current.terminate();
      }
    };
  }, []);

  // Input validation
  const validateInputs = () => {
    const errors = [];

    if (!gridLayout || !Array.isArray(gridLayout)) {
      errors.push('Grid layout is invalid');
    }

    if (!imageSrc) {
      errors.push('No image uploaded');
    }

    if (!fileDate) {
      errors.push('No date selected');
    }

    if (rows < 1 || cols < 1) {
      errors.push('Rows and columns must be at least 1');
    }

    if (rows > 50 || cols > 50) {
      errors.push('Grid too large (max 50×50)');
    }

    // Check corners form a reasonable quadrilateral
    if (corners.length === 4) {
      const [tl, tr, br, bl] = corners;
      const minDistance = 50;
      if (
        Math.hypot(tr.x - tl.x, tr.y - tl.y) < minDistance ||
        Math.hypot(br.x - bl.x, br.y - bl.y) < minDistance ||
        Math.hypot(bl.x - tl.x, bl.y - tl.y) < minDistance ||
        Math.hypot(br.x - tr.x, br.y - tr.y) < minDistance
      ) {
        errors.push('Grid corners are too close together (minimum 50px apart)');
      }
    }

    return errors;
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    setUploadedFile(file);

    // Start image loading immediately (non-blocking) - show preview ASAP
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Store the original full-resolution image
        originalImageRef.current = img;

        // Downsample for display only to prevent canvas crashes
        const MAX_WIDTH = 2000;
        const MAX_HEIGHT = 2000;

        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.floor(width * scale);
          height = Math.floor(height * scale);

          // Create downsampled version for DISPLAY only
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(img, 0, 0, width, height);

          // Create new image from downsampled canvas for display
          const downsampledImg = new Image();
          downsampledImg.onload = () => {
            imageRef.current = downsampledImg;
            setImageSrc(tempCanvas.toDataURL('image/jpeg', 0.9));
            initializeCorners(downsampledImg.width, downsampledImg.height);
          };
          downsampledImg.src = tempCanvas.toDataURL('image/jpeg', 0.9);
        } else {
          imageRef.current = img;
          setImageSrc(event.target.result);
          initializeCorners(width, height);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Extract EXIF date in parallel (doesn't block image display)
    let dateStr = null;

    try {
      if (file.type.includes('image')) {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        try {
          const exif = piexif.load(data);
          if (exif.Exif && exif.Exif[piexif.ExifIFD.DateTimeOriginal]) {
            const exifDate = exif.Exif[piexif.ExifIFD.DateTimeOriginal];
            const dateArray = String.fromCharCode.apply(null, exifDate).split(' ')[0].split(':');
            dateStr = `${dateArray[0]}-${dateArray[1]}-${dateArray[2]}`;
          }
        } catch (exifError) {
          // EXIF extraction failed, fall back to file date
          console.warn('Could not extract EXIF date:', exifError);
        }
      }
    } catch (e) {
      console.warn('Could not read file for EXIF extraction');
    }

    // Fallback to file modified date if EXIF not found
    if (!dateStr) {
      const modifiedDate = new Date(file.lastModified);
      dateStr = modifiedDate.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    setFileDate(dateStr);
    setShowDateConfirmation(true); // Always show date confirmation for user verification
  };

  const initializeCorners = (w, h) => {
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

  // Perspective transformation moved to Web Worker (imageProcessingWorker.js)
  // This was previously synchronous and blocked the main thread

  // Calculate plot corners helper function
  const calculatePlotCorners = (row, col, rows, cols, tl, tr, br, bl) => {
    const rowT = row / rows;
    const rowB = (row + 1) / rows;
    const colL = col / cols;
    const colR = (col + 1) / cols;

    const topLeftX = tl.x + (tr.x - tl.x) * colL;
    const topLeftY = tl.y + (tr.y - tl.y) * colL;
    const topRightX = tl.x + (tr.x - tl.x) * colR;
    const topRightY = tl.y + (tr.y - tl.y) * colR;

    const bottomLeftX = bl.x + (br.x - bl.x) * colL;
    const bottomLeftY = bl.y + (br.y - bl.y) * colL;
    const bottomRightX = bl.x + (br.x - bl.x) * colR;
    const bottomRightY = bl.y + (br.y - bl.y) * colR;

    return {
      tl: {
        x: topLeftX + (bottomLeftX - topLeftX) * rowT,
        y: topLeftY + (bottomLeftY - topLeftY) * rowT
      },
      tr: {
        x: topRightX + (bottomRightX - topRightX) * rowT,
        y: topRightY + (bottomRightY - topRightY) * rowT
      },
      br: {
        x: topRightX + (bottomRightX - topRightX) * rowB,
        y: topRightY + (bottomRightY - topRightY) * rowB
      },
      bl: {
        x: topLeftX + (bottomLeftX - topLeftX) * rowB,
        y: topLeftY + (bottomLeftY - topLeftY) * rowB
      }
    };
  };

  // Commit grid and extract plot images with async processing using Web Worker
  const commitGrid = async () => {
    // Validate inputs first
    const errors = validateInputs();
    if (errors.length > 0) {
      alert('Cannot process image:\n\n' + errors.join('\n'));
      return;
    }

    if (!imageWorkerRef.current) {
      alert('Image processor not ready. Please refresh the page.');
      return;
    }

    try {
      setProcessing(true);
      setProgress(0);

      const originalImage = originalImageRef.current;
      const displayImage = imageRef.current;
      const [tl, tr, br, bl] = corners;

      // Calculate scale factor between display image and original image
      const scaleFactor = originalImage.width / displayImage.width;

      // Get image data from original for worker processing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImage.width;
      tempCanvas.height = originalImage.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(originalImage, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, originalImage.width, originalImage.height);

      const extractedPlots = [];
      const plotImages = {};
      const plotProcessingPromises = [];

      // Count total non-blank plots
      let totalPlots = 0;
      gridLayout.forEach(row => {
        row.forEach(plot => {
          if (!plot.isBlank) totalPlots++;
        });
      });

      let processedPlots = 0;

      // Queue all plot extractions to worker
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const layoutPlot = gridLayout[row]?.[col];
          const plotId = layoutPlot?.id || `${row + 1}-${col + 1}`;

          if (!layoutPlot?.isBlank) {
            const plotCorners = calculatePlotCorners(row, col, rows, cols, tl, tr, br, bl);
            const messageId = `${row}-${col}`;

            const promise = new Promise((resolve) => {
              const handleMessage = (event) => {
                if (event.data.messageId === messageId && event.data.plotId === plotId) {
                  imageWorkerRef.current.removeEventListener('message', handleMessage);

                  if (event.data.success) {
                    const photoKey = `${fileDate}_${plotId}`;
                    plotImages[photoKey] = event.data.imageData;

                    extractedPlots.push({
                      id: plotId,
                      row: row + 1,
                      col: col + 1,
                      imageData: event.data.imageData,
                      isBlank: false
                    });

                    processedPlots++;
                    setProgress(Math.round((processedPlots / totalPlots) * 100));
                  } else {
                    console.error(`Failed to process plot ${plotId}:`, event.data.error);
                  }

                  resolve();
                }
              };

              imageWorkerRef.current.addEventListener('message', handleMessage);
              imageWorkerRef.current.postMessage({
                imageData,
                width: originalImage.width,
                height: originalImage.height,
                plotCorners,
                targetSize: 800,
                scaleFactor,
                plotId,
                messageId
              });
            });

            plotProcessingPromises.push(promise);
          }
        }
      }

      // Wait for all plots to be processed
      await Promise.all(plotProcessingPromises);

      // Sort extracted plots by row and column for consistent order
      extractedPlots.sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });

      setPlots(extractedPlots);
      setCommitted(true);
      setProcessing(false);

      // Create assessment date if it doesn't exist
      createAssessmentDateIfNeeded(fileDate);

      // Immediately apply images to the field map
      applyImagesToFieldMap(plotImages);
    } catch (error) {
      console.error('Error processing images:', error);
      setProcessing(false);
      alert('Error processing images. The image may be too large. Try a smaller image or contact support.');
    }
  };

  // Create assessment date entry if it doesn't exist
  const createAssessmentDateIfNeeded = (dateStr) => {
    if (!onAssessmentDatesChange || !config) return;

    // Check if date already exists
    const dateExists = assessmentDates?.some(d => d.date === dateStr);

    if (!dateExists) {
      // Create new date entry with empty assessments
      const newDate = {
        date: dateStr,
        assessments: {}
      };

      // Initialize each assessment type
      config.assessmentTypes.forEach(type => {
        const assessmentData = {};
        gridLayout.forEach(row => {
          row.forEach(plot => {
            if (!plot.isBlank) {
              assessmentData[plot.id] = { value: '', entered: false };
            }
          });
        });
        newDate.assessments[type.name] = assessmentData;
      });

      // Add to assessment dates
      onAssessmentDatesChange([...(assessmentDates || []), newDate]);
    }
  };

  // Apply extracted plot images to field map
  const applyImagesToFieldMap = (plotImages) => {
    if (!onPhotosChange || Object.keys(plotImages).length === 0) {
      return;
    }

    // Call onPhotosChange - it expects a function that takes current state
    onPhotosChange(currentPhotos => {
      const updatedPhotos = { ...currentPhotos };

      Object.entries(plotImages).forEach(([key, imageData]) => {
        // Each key is "date_plotId", store as array with single image
        updatedPhotos[key] = [imageData];
      });

      return updatedPhotos;
    });
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

        {/* Date Confirmation Dialog - shown first after upload */}
        {imageSrc && showDateConfirmation && fileDate && (
          <div className="mt-6">
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 shadow-lg">
              <div className="flex items-start gap-3 mb-4">
                <div className="text-yellow-600 text-2xl">📅</div>
                <div className="flex-1">
                  <h3 className="font-bold text-yellow-900 text-lg mb-2">Confirm Image Date</h3>
                  <p className="text-sm text-yellow-800 mb-4">
                    We detected this date from the image file. Please confirm or adjust if incorrect:
                  </p>

                  <div className="space-y-4">
                    {/* Auto-detected date */}
                    <div className="bg-white rounded-lg p-4 border-2 border-yellow-300">
                      <p className="text-xs text-gray-600 mb-1">Auto-detected from file:</p>
                      <p className="text-xl font-bold text-gray-900">{fileDate}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(fileDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>

                    {/* Manual date override */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Or select a different date:
                      </label>
                      <input
                        type="date"
                        value={fileDate}
                        onChange={(e) => setFileDate(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-lg"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowDateConfirmation(false)}
                      className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-semibold"
                    >
                      ✓ Confirm Date: {fileDate}
                    </button>
                    <button
                      onClick={() => {
                        setImageSrc(null);
                        setFileDate(null);
                        setShowDateConfirmation(false);
                      }}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {imageSrc && !showDateConfirmation && (
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

            {/* Compass/Orientation Tool */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-amber-900 mb-1">Image Orientation</p>
                  <p className="text-sm text-amber-700">Rotate to match field compass direction</p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Compass Display */}
                  <div className="relative w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full shadow-lg border-4 border-blue-300">
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ transform: `rotate(${imageOrientation}deg)` }}
                    >
                      {/* North Arrow */}
                      <div className="absolute top-0.5 left-1/2 -translate-x-1/2">
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-red-600"></div>
                        <div className="text-xs font-bold text-red-600 text-center">N</div>
                      </div>
                      {/* South Marker */}
                      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                        <div className="text-xs text-gray-500">S</div>
                      </div>
                      {/* East Marker */}
                      <div className="absolute right-0.5 top-1/2 -translate-y-1/2">
                        <div className="text-xs text-gray-500">E</div>
                      </div>
                      {/* West Marker */}
                      <div className="absolute left-0.5 top-1/2 -translate-y-1/2">
                        <div className="text-xs text-gray-500">W</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Rotation Display */}
                    <div className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded text-center">
                      {imageOrientation}°
                    </div>

                    {/* Rotation Controls */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setImageOrientation((imageOrientation - 5 + 360) % 360)}
                        className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition"
                        title="Rotate -5°"
                      >
                        ↺ 5°
                      </button>
                      <button
                        onClick={() => setImageOrientation((imageOrientation + 5) % 360)}
                        className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition"
                        title="Rotate +5°"
                      >
                        ↻ 5°
                      </button>
                    </div>
                    <button
                      onClick={() => setImageOrientation(0)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded transition"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
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

            {/* File Date and Image Info */}
            {fileDate && imageRef.current && !showDateConfirmation && (
              <div className="bg-purple-50 border border-purple-200 text-purple-800 p-3 rounded">
                <p className="font-medium">Image Date: {fileDate}</p>
                <p className="text-sm">
                  Display Size: {imageRef.current.width} × {imageRef.current.height}px
                  {originalImageRef.current && (
                    <> | Original: {originalImageRef.current.width} × {originalImageRef.current.height}px</>
                  )}
                </p>
                {originalImageRef.current && (originalImageRef.current.width > 2000 || originalImageRef.current.height > 2000) && (
                  <p className="text-xs mt-1">✓ Original high-res image preserved for extraction (800×800px plots)</p>
                )}
                <button
                  onClick={() => setShowDateConfirmation(true)}
                  className="mt-2 text-xs underline hover:text-purple-900"
                >
                  Change date
                </button>
              </div>
            )}

            {/* Commit Button */}
            {!committed && !processing && (
              <button
                onClick={commitGrid}
                className="w-full px-6 py-4 bg-emerald-600 text-white text-lg font-semibold rounded-lg hover:bg-emerald-700 transition"
              >
                🚀 Commit Images to Field Map
              </button>
            )}

            {/* Processing Indicator */}
            {processing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-blue-800">Processing images with perspective correction...</p>
                  <span className="text-blue-600 font-bold">{progress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-blue-600 mt-2">Applying perspective transformation to straighten each plot...</p>
              </div>
            )}

            {/* Results after committing */}
            {committed && plots.length > 0 && (
              <div className="space-y-4 mt-6">
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded">
                  <p className="font-bold text-lg">✅ Images Extracted & Stored!</p>
                  <p className="text-sm">Extracted {plots.filter(p => !p.isBlank).length} plot images for date: {fileDate}</p>
                  <p className="text-xs mt-2">✓ Images have been automatically added to the field map</p>
                </div>

                {/* Extracted Plot Images Preview */}
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Extracted Plot Images ({plots.length} plots)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {plots.filter(p => !p.isBlank).slice(0, 20).map(plot => (
                      <div key={plot.id} className="bg-gray-50 rounded border overflow-hidden">
                        <img
                          src={plot.imageData}
                          alt={plot.id}
                          className="w-full aspect-square object-cover"
                        />
                        <div className="p-2 text-center">
                          <div className="font-medium text-sm">{plot.id}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {plots.filter(p => !p.isBlank).length > 20 && (
                    <p className="text-xs text-gray-500 mt-3">
                      Showing first 20 of {plots.filter(p => !p.isBlank).length} plots...
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded">
                  <p className="font-medium">📸 Next Steps:</p>
                  <ol className="text-sm mt-2 space-y-1 list-decimal list-inside">
                    <li>Go to the Field Map view</li>
                    <li>Navigate to date: {fileDate}</li>
                    <li>Click the camera icon on any plot to see the extracted image</li>
                  </ol>
                </div>

                {/* Reset Button */}
                <button
                  onClick={() => {
                    setCommitted(false);
                    setPlots([]);
                  }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  ↺ Process Another Image
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
