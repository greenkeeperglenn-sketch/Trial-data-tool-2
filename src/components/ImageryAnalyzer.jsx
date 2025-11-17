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
  // Log mount and props to help debug blank-screen issues
  try {
    // eslint-disable-next-line no-console
    console.log('[ImageryAnalyzer] mount', { gridLayout: !!gridLayout, config: !!config, assessmentDatesLength: assessmentDates?.length });
  } catch (e) {
    // swallow logging errors
  }
  // Auto-detect grid dimensions from trial setup
  const trialRows = gridLayout?.length || 4;
  const trialCols = gridLayout?.[0]?.length || 4;

  // STATE
  const [imageSrc, setImageSrc] = useState(null);
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
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [committed, setCommitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);

  // Refs (required for canvas, file input, and worker)
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null); // Preview image (low-res, max 800px)
  const imageWorkerRef = useRef(null);
  const fileRef = useRef(null); // Store the original file for later high-res processing

  // Initialize Web Worker
  useEffect(() => {
    imageWorkerRef.current = new Worker(
      new URL('../utils/imageProcessingWorker.js', import.meta.url),
      { type: 'module' }
    );

    return () => {
      imageWorkerRef.current?.terminate();
    };
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
      if (imageRef.current) {
        imageRef.current.src = '';
        imageRef.current = null;
      }
    };
  }, [imageSrc]);

  // Handle image loading - NEW APPROACH: Load low-res preview immediately
  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/i)) {
      setLoadError('Invalid file type. Please upload a JPEG or PNG image.');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setLoadError('File too large. Maximum size is 50MB. Please compress your image and try again.');
      return;
    }

    // Store the original file for later high-res processing
    fileRef.current = file;

    // Set loading state immediately
    setLoading(true);
    setLoadError(null);
    setCommitted(false);
    setLoadProgress(10);

    console.log(`Loading preview: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    try {
      // Validate file signature (magic bytes)
      setLoadProgress(20);
      const buffer = await file.slice(0, 12).arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;

      if (!isJPEG && !isPNG) {
        setLoadError(`Invalid image file. Detected bytes: ${Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16).toUpperCase()).join(' ')}`);
        setLoadProgress(0);
        setLoading(false);
        return;
      }

      console.log('File validated:', isJPEG ? 'JPEG' : 'PNG');
      setLoadProgress(40);

      // Create a low-resolution preview for grid alignment (max 800px)
      // This loads almost instantly, even for 36MB+ files!
      const previewMaxSize = 800;

      const blobUrl = URL.createObjectURL(file);
      const previewImg = new Image();

      previewImg.onload = async () => {
        try {
          console.log(`Creating preview from ${previewImg.width}x${previewImg.height}`);
          setLoadProgress(60);

          // Calculate preview size
          const scale = Math.min(previewMaxSize / previewImg.width, previewMaxSize / previewImg.height, 1);
          const previewCanvas = document.createElement('canvas');
          previewCanvas.width = Math.floor(previewImg.width * scale);
          previewCanvas.height = Math.floor(previewImg.height * scale);

          console.log(`Preview size: ${previewCanvas.width}x${previewCanvas.height}`);
          setLoadProgress(70);

          const ctx = previewCanvas.getContext('2d');
          if (!ctx) {
            throw new Error('Failed to get canvas context');
          }

          // Draw downsampled preview
          ctx.drawImage(previewImg, 0, 0, previewCanvas.width, previewCanvas.height);
          setLoadProgress(85);

          // Convert to blob
          previewCanvas.toBlob(
            (blob) => {
              if (!blob) {
                throw new Error('Failed to create preview blob');
              }

              const previewBlobUrl = URL.createObjectURL(blob);
              console.log(`Preview created: ${(blob.size / 1024).toFixed(1)}KB`);

              const displayImg = new Image();
              displayImg.onload = () => {
                imageRef.current = displayImg;
                setImageSrc(previewBlobUrl);

                // Set initial corner positions
                setCorners([
                  { x: displayImg.width * 0.1, y: displayImg.height * 0.1, label: 'TL' },
                  { x: displayImg.width * 0.9, y: displayImg.height * 0.1, label: 'TR' },
                  { x: displayImg.width * 0.9, y: displayImg.height * 0.9, label: 'BR' },
                  { x: displayImg.width * 0.1, y: displayImg.height * 0.9, label: 'BL' }
                ]);

                setLoadProgress(100);
                setLoading(false);
                console.log('✓ Preview ready - align your grid!');
              };

              displayImg.onerror = (e) => {
                console.error('Failed to load preview blob:', e);
                setLoadError('Failed to create preview image');
                setLoading(false);
                URL.revokeObjectURL(previewBlobUrl);
              };

              displayImg.src = previewBlobUrl;
            },
            'image/jpeg',
            0.80
          );

          // Clean up temporary blob URL
          URL.revokeObjectURL(blobUrl);
        } catch (error) {
          console.error('Error creating preview:', error);
          setLoadError(`Failed to create preview: ${error.message}`);
          setLoadProgress(0);
          setLoading(false);
          URL.revokeObjectURL(blobUrl);
        }
      };

      previewImg.onerror = (error) => {
        console.error('Preview load error:', error);
        setLoadError('Failed to load image preview. The file may be corrupted.');
        setLoadProgress(0);
        setLoading(false);
        URL.revokeObjectURL(blobUrl);
      };

      previewImg.src = blobUrl;

      // Extract date from EXIF in parallel
      let dateStr = null;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const exif = piexif.load(data);
        if (exif.Exif && exif.Exif[piexif.ExifIFD.DateTimeOriginal]) {
          const exifDate = exif.Exif[piexif.ExifIFD.DateTimeOriginal];
          const dateArray = String.fromCharCode.apply(null, exifDate).split(' ')[0].split(':');
          dateStr = `${dateArray[0]}-${dateArray[1]}-${dateArray[2]}`;
        }
      } catch (e) {
        console.warn('Could not extract EXIF date');
      }

      if (!dateStr) {
        const modifiedDate = new Date(file.lastModified);
        dateStr = modifiedDate.toISOString().split('T')[0];
      }

      setFileDate(dateStr);
    } catch (error) {
      console.error('Error handling file upload:', error);
      setLoadError('Error processing file.');
      setLoading(false);
    }
  };

  // Draw image and grid on canvas
  useEffect(() => {
    if (!imageSrc || !canvasRef.current || !imageRef.current) {
      console.log('Cannot draw yet:', { 
        imageSrc: !!imageSrc, 
        canvas: !!canvasRef.current, 
        image: !!imageRef.current 
      });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    console.log('Drawing canvas:', img.width, 'x', img.height);

    // Set canvas size to match image
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw grid overlay
    drawGrid(ctx, img.width, img.height);
  }, [imageSrc, corners, rows, cols]);

  const drawGrid = (ctx, width, height) => {
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

    // Draw corner markers
    corners.forEach((corner, idx) => {
      const isActive = draggingCorner === idx;

      if (isActive) {
        // Active state - yellow
        ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 30, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(corner.label, corner.x, corner.y);
      } else {
        // Normal state - red
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 25, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(corner.label, corner.x, corner.y);
      }
    });
  };

  // Mouse handlers for corner dragging
  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const clickedCorner = corners.findIndex(corner => {
      const distance = Math.sqrt(Math.pow(corner.x - x, 2) + Math.pow(corner.y - y, 2));
      return distance < 40;
    });

    if (clickedCorner >= 0) {
      setDraggingCorner(clickedCorner);
    }
  };

  const handleMouseMove = (e) => {
    if (draggingCorner === null || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
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

  // Helper: Calculate corner positions for a specific plot in the grid
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

  // Helper: Create assessment date if it doesn't exist
  const createAssessmentDateIfNeeded = (dateStr) => {
    if (!assessmentDates.find(d => d.date === dateStr)) {
      const newDate = {
        id: Date.now().toString(),
        date: dateStr,
        type: selectedAssessmentType || config.assessmentTypes[0]?.name || 'General'
      };
      onAssessmentDatesChange([...assessmentDates, newDate]);
    }
  };

  // Helper: Apply extracted plot images to field map
  const applyImagesToFieldMap = (plotImages) => {
    // Update photos
    onPhotosChange(prevPhotos => ({
      ...prevPhotos,
      ...plotImages
    }));
  };

  // Validate inputs before processing
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
      errors.push('Grid too large (max 50x50)');
    }

    // Check corners form a reasonable quadrilateral
    const [tl, tr, br, bl] = corners;
    const minDistance = 30;
    if (
      Math.hypot(tr.x - tl.x, tr.y - tl.y) < minDistance ||
      Math.hypot(br.x - bl.x, br.y - bl.y) < minDistance ||
      Math.hypot(bl.x - tl.x, bl.y - tl.y) < minDistance ||
      Math.hypot(br.x - tr.x, br.y - tr.y) < minDistance
    ) {
      errors.push('Grid corners are too close together - please adjust the corners');
    }

    return errors;
  };

  // Main processing function - NOW loads high-res image when extracting
  const commitGrid = async () => {
    // Validate inputs
    const errors = validateInputs();
    if (errors.length > 0) {
      alert('Cannot process:\n\n' + errors.join('\n'));
      return;
    }

    if (!fileRef.current || !imageRef.current) {
      alert('Please upload an image first');
      return;
    }

    try {
      setProcessing(true);
      setProgress(0);

      const displayImage = imageRef.current;
      const [tl, tr, br, bl] = corners;

      console.log('Loading high-resolution image from file...');
      console.log('Original file size:', (fileRef.current.size / 1024 / 1024).toFixed(2), 'MB');

      // Load the high-resolution image from the stored file
      const highResBlobUrl = URL.createObjectURL(fileRef.current);
      const highResImage = new Image();

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('High-res image load timeout (60s). File may be too large.'));
        }, 60000);

        highResImage.onload = () => {
          clearTimeout(timeout);
          console.log('✓ High-res image loaded:', highResImage.width, 'x', highResImage.height);
          resolve();
        };

        highResImage.onerror = (err) => {
          clearTimeout(timeout);
          reject(new Error('Failed to load high-resolution image'));
        };

        highResImage.src = highResBlobUrl;
      });

      // Calculate scale factor between preview and high-res
      const scaleFactor = highResImage.width / displayImage.width;
      console.log('Scale factor (high-res / preview):', scaleFactor.toFixed(2));

      // Scale corner coordinates from preview to high-res
      const scaledCorners = {
        tl: { x: tl.x * scaleFactor, y: tl.y * scaleFactor },
        tr: { x: tr.x * scaleFactor, y: tr.y * scaleFactor },
        br: { x: br.x * scaleFactor, y: br.y * scaleFactor },
        bl: { x: bl.x * scaleFactor, y: bl.y * scaleFactor }
      };

      console.log('Scaled corners to high-res:', scaledCorners);

      // Get image data from high-res image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = highResImage.width;
      tempCanvas.height = highResImage.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(highResImage, 0, 0);
      const fullImageData = tempCtx.getImageData(0, 0, highResImage.width, highResImage.height);

      // Clean up blob URL
      URL.revokeObjectURL(highResBlobUrl);

      const plotImages = {};
      const plotProcessingPromises = [];

      // Count total plots to process
      let totalPlots = 0;
      gridLayout.forEach(row => {
        row.forEach(plot => {
          if (!plot.isBlank) totalPlots++;
        });
      });

      let processedPlots = 0;

      // Process each plot using scaled coordinates
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const layoutPlot = gridLayout[row]?.[col];
          if (!layoutPlot) continue;

          const plotId = layoutPlot.id || `${row + 1}-${col + 1}`;

          if (!layoutPlot.isBlank) {
            // Calculate plot corners using SCALED coordinates
            const plotCorners = calculatePlotCorners(
              row, col, rows, cols,
              scaledCorners.tl, scaledCorners.tr, scaledCorners.br, scaledCorners.bl
            );
            const messageId = `${row}-${col}`;

            const promise = new Promise((resolve) => {
              const handleMessage = (event) => {
                if (event.data.messageId === messageId && event.data.plotId === plotId) {
                  imageWorkerRef.current.removeEventListener('message', handleMessage);

                  if (event.data.success) {
                    const photoKey = `${fileDate}_${plotId}`;
                    plotImages[photoKey] = event.data.imageData;
                    processedPlots++;
                    setProgress(Math.round((processedPlots / totalPlots) * 100));
                  } else {
                    console.error('Plot extraction failed:', event.data.error);
                  }
                  resolve();
                }
              };

              imageWorkerRef.current.addEventListener('message', handleMessage);
              imageWorkerRef.current.postMessage({
                pixelData: fullImageData.data,
                width: highResImage.width,
                height: highResImage.height,
                plotCorners,
                targetSize: 600,
                scaleFactor: 1, // Already scaled in plotCorners
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

      console.log(`✓ Extracted ${Object.keys(plotImages).length} plots from high-res image`);

      // Apply results
      createAssessmentDateIfNeeded(fileDate);
      applyImagesToFieldMap(plotImages);

      setCommitted(true);
      setProcessing(false);
      setProgress(100);

      alert(`✓ Successfully extracted ${Object.keys(plotImages).length} plot images!\n\nDate: ${fileDate}\nImages have been added to the trial.`);
    } catch (error) {
      console.error('Error processing images:', error);
      setProcessing(false);
      setProgress(0);
      alert(`Error processing images: ${error.message}\n\nPlease try again or use a smaller image.`);
    }
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

        {/* Upload Button */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className={`px-4 py-2 rounded text-white text-sm transition ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {loading ? 'Loading...' : 'Upload Image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={(event) => handleFileUpload(event.target.files?.[0])}
            className="hidden"
          />
        </div>

        {/* Loading State */}
        {loading && !imageSrc && (
          <div className="border-2 border-blue-300 rounded-lg p-8 text-center bg-blue-50">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
              <p className="text-lg font-medium text-blue-900">Loading image...</p>
              <p className="text-sm text-blue-700">Please wait while we process your image</p>

              {/* Progress Bar */}
              <div className="w-full max-w-md">
                <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-3 transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-blue-700 mt-2">
                  {loadProgress}% complete
                  {loadProgress === 40 && ' - Decoding image (this may take 30-120 seconds for large files)...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {loadError && !loading && (
          <div className="border-2 border-red-300 rounded-lg p-6 bg-red-50">
            <div className="flex items-start space-x-3">
              <svg className="h-6 w-6 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-medium text-red-900">Error loading image</p>
                <p className="text-sm text-red-700 mt-1">{loadError}</p>
                <button
                  onClick={() => {
                    setLoadError(null);
                    fileInputRef.current?.click();
                  }}
                  className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
                >
                  Try Another Image
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No Image State */}
        {!imageSrc && !loading && !loadError && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center border-gray-300 bg-gray-50">
            <p className="text-lg font-medium">Drag & drop or click to upload a drone image</p>
            <p className="text-sm text-gray-500 mt-2">JPEG or PNG files are supported (max 50MB)</p>
          </div>
        )}

        {/* Image Loaded State */}
        {imageSrc && (
          <div className="mt-6 space-y-4">
            {/* Grid size inputs */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-medium text-green-900 mb-3">Grid Configuration</p>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-2 text-sm">
                  Rows
                  <input
                    type="number"
                    min={1}
                    value={rows}
                    onChange={(e) => setRows(Number(e.target.value) || 1)}
                    className="border rounded px-3 py-2 bg-white"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  Columns
                  <input
                    type="number"
                    min={1}
                    value={cols}
                    onChange={(e) => setCols(Number(e.target.value) || 1)}
                    className="border rounded px-3 py-2 bg-white"
                  />
                </label>
              </div>
              <p className="text-xs text-green-700 mt-2">From trial setup: {trialRows}×{trialCols}</p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium">📍 Alignment Instructions:</p>
              <p className="mt-1">Drag the red corner circles (TL, TR, BR, BL) to align the grid with your plots.</p>
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              className="w-full border-2 border-gray-300 rounded cursor-crosshair bg-white"
              style={{ touchAction: 'none' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            {/* Image info */}
            {fileDate && imageRef.current && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
                <p><strong>Image Date:</strong> {fileDate}</p>
                <p><strong>Size:</strong> {imageRef.current.width} × {imageRef.current.height}px</p>
              </div>
            )}

            {/* Processing Progress */}
            {processing && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="font-medium text-yellow-900 mb-2">Processing plots...</p>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-4 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-yellow-700 mt-2 text-center">{progress}% complete</p>
              </div>
            )}

            {/* Success Message */}
            {committed && !processing && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="font-medium text-green-900">✓ Processing complete!</p>
                <p className="text-sm text-green-700 mt-1">Plot images have been added to the trial.</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={commitGrid}
              disabled={processing || committed}
              className={`w-full px-6 py-3 font-semibold rounded-lg transition ${
                processing || committed
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {processing ? 'Processing...' : committed ? '✓ Completed' : '✓ Extract Plot Images'}
            </button>

            {/* Reset Button */}
            {committed && (
              <button
                onClick={() => {
                  setCommitted(false);
                  setProgress(0);
                  setImageSrc(null);
                  setFileDate(null);
                  setLoadError(null);
                  setLoading(false);
                  setLoadProgress(0);
                  if (imageRef.current) {
                    imageRef.current.src = '';
                    imageRef.current = null;
                  }
                  fileRef.current = null;
                }}
                className="w-full px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition"
              >
                Process Another Image
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageryAnalyzer;
