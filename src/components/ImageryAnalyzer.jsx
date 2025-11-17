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
  const imageRef = useRef(null);
  const originalImageRef = useRef(null);
  const imageWorkerRef = useRef(null);

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
      if (originalImageRef.current) {
        originalImageRef.current.src = '';
        originalImageRef.current = null;
      }
      if (imageRef.current) {
        imageRef.current.src = '';
        imageRef.current = null;
      }
    };
  }, [imageSrc]);

  // Handle image loading
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

    // Warn about very large files
    if (file.size > 35 * 1024 * 1024) {
      console.warn(`Large file detected: ${(file.size / 1024 / 1024).toFixed(2)}MB - this may take 1-2 minutes to load`);
    }

    // Set loading state immediately
    setLoading(true);
    setLoadError(null);
    setCommitted(false);
    setLoadProgress(10); // Initial progress

    // Allow UI to update before starting heavy processing
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      console.log(`Loading image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // Validate file signature (magic bytes) to ensure it's actually an image
      setLoadProgress(20); // Validating file
      const buffer = await file.slice(0, 12).arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Check for valid image signatures
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;

      if (!isJPEG && !isPNG) {
        console.error('Invalid file signature. First 12 bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
        setLoadError(`This file does not appear to be a valid JPEG or PNG image. The file may have the wrong extension or be corrupted. Detected bytes: ${Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16).toUpperCase()).join(' ')}`);
        setLoadProgress(0);
        setLoading(false);
        return;
      }

      console.log('File signature validated:', isJPEG ? 'JPEG' : 'PNG');
      setLoadProgress(30); // File validated

      // FAST: Create blob URL immediately (no need to convert to data URL first)
      const blobUrl = URL.createObjectURL(file);

      setLoadProgress(40); // Blob URL created

      // Load original high-res image for extraction
      const originalImg = new Image();

      // Add timeout for image loading (2 minutes for very large files)
      const timeoutDuration = file.size > 35 * 1024 * 1024 ? 120000 : 60000;
      console.log(`Setting image load timeout to ${timeoutDuration / 1000} seconds`);

      const loadTimeout = setTimeout(() => {
        if (!imageRef.current) {
          console.error(`Image loading timeout after ${timeoutDuration / 1000} seconds`);
          setLoadError(`Image loading timed out after ${timeoutDuration / 1000} seconds. The file is too large or complex for this browser. Please try:\n\n1. Compress the image to under 25MB\n2. Reduce resolution to 4000px max width\n3. Re-export as standard JPEG with lower quality\n4. Try a different browser (Chrome/Edge handle large images better)`);
          setLoadProgress(0);
          setLoading(false);
          URL.revokeObjectURL(blobUrl);
        }
      }, timeoutDuration);

      originalImg.onload = async () => {
        clearTimeout(loadTimeout);
        try {
          setLoadProgress(60); // Image loaded
          console.log('Original image loaded:', originalImg.width, originalImg.height);
          originalImageRef.current = originalImg;

          // Downsample for display if too large
          const maxDisplaySize = 1200;

          if (originalImg.width > maxDisplaySize || originalImg.height > maxDisplaySize) {
            console.log('Downsampling large image for display...');
            setLoadProgress(70); // Starting downsample

            // Use setTimeout to allow UI to update
            await new Promise(resolve => setTimeout(resolve, 50));

            try {
              const scale = Math.min(maxDisplaySize / originalImg.width, maxDisplaySize / originalImg.height);
              const displayCanvas = document.createElement('canvas');
              displayCanvas.width = Math.floor(originalImg.width * scale);
              displayCanvas.height = Math.floor(originalImg.height * scale);

              console.log(`Downsampling from ${originalImg.width}x${originalImg.height} to ${displayCanvas.width}x${displayCanvas.height}`);

              const ctx = displayCanvas.getContext('2d');
              if (!ctx) {
                throw new Error('Failed to get canvas context');
              }

              setLoadProgress(80); // Drawing to canvas
              ctx.drawImage(originalImg, 0, 0, displayCanvas.width, displayCanvas.height);

              setLoadProgress(90); // Converting to blob

              // Convert canvas to blob (MUCH more efficient than data URL for large images)
              displayCanvas.toBlob(
                (blob) => {
                  if (!blob) {
                    console.warn('Failed to create blob, using original image');
                    // Fallback: use original image directly
                    imageRef.current = originalImg;
                    setImageSrc(blobUrl);
                    setCorners([
                      { x: originalImg.width * 0.1, y: originalImg.height * 0.1, label: 'TL' },
                      { x: originalImg.width * 0.9, y: originalImg.height * 0.1, label: 'TR' },
                      { x: originalImg.width * 0.9, y: originalImg.height * 0.9, label: 'BR' },
                      { x: originalImg.width * 0.1, y: originalImg.height * 0.9, label: 'BL' }
                    ]);
                    setLoadProgress(100);
                    setLoading(false);
                    console.log('Display image ready (using original - blob creation failed)');
                    return;
                  }

                  const downsampledBlobUrl = URL.createObjectURL(blob);
                  console.log('Created downsampled blob:', (blob.size / 1024 / 1024).toFixed(2), 'MB');

                  const displayImgObj = new Image();
                  displayImgObj.onload = () => {
                    imageRef.current = displayImgObj;
                    setImageSrc(downsampledBlobUrl);

                    // Set corner positions based on display image size
                    setCorners([
                      { x: displayImgObj.width * 0.1, y: displayImgObj.height * 0.1, label: 'TL' },
                      { x: displayImgObj.width * 0.9, y: displayImgObj.height * 0.1, label: 'TR' },
                      { x: displayImgObj.width * 0.9, y: displayImgObj.height * 0.9, label: 'BR' },
                      { x: displayImgObj.width * 0.1, y: displayImgObj.height * 0.9, label: 'BL' }
                    ]);

                    setLoadProgress(100);
                    setLoading(false);
                    console.log('Display image ready (downsampled)');
                  };

                  displayImgObj.onerror = (e) => {
                    console.error('Failed to load downsampled blob image, using original instead:', e);
                    URL.revokeObjectURL(downsampledBlobUrl);
                    // Fallback: use original blob URL
                    imageRef.current = originalImg;
                    setImageSrc(blobUrl);
                    setCorners([
                      { x: originalImg.width * 0.1, y: originalImg.height * 0.1, label: 'TL' },
                      { x: originalImg.width * 0.9, y: originalImg.height * 0.1, label: 'TR' },
                      { x: originalImg.width * 0.9, y: originalImg.height * 0.9, label: 'BR' },
                      { x: originalImg.width * 0.1, y: originalImg.height * 0.9, label: 'BL' }
                    ]);
                    setLoadProgress(100);
                    setLoading(false);
                    console.log('Display image ready (using original after blob load error)');
                  };

                  displayImgObj.src = downsampledBlobUrl;
                },
                'image/jpeg',
                0.85
              );
            } catch (downsampleError) {
              console.error('Downsampling failed, using original image:', downsampleError);
              // Complete fallback: just use the original image
              imageRef.current = originalImg;
              setImageSrc(blobUrl);
              setCorners([
                { x: originalImg.width * 0.1, y: originalImg.height * 0.1, label: 'TL' },
                { x: originalImg.width * 0.9, y: originalImg.height * 0.1, label: 'TR' },
                { x: originalImg.width * 0.9, y: originalImg.height * 0.9, label: 'BR' },
                { x: originalImg.width * 0.1, y: originalImg.height * 0.9, label: 'BL' }
              ]);
              setLoadProgress(100);
              setLoading(false);
              console.log('Image ready (using original after downsample failure)');
            }
          } else {
            // Image is small enough to display directly
            setLoadProgress(90);
            imageRef.current = originalImg;
            setImageSrc(blobUrl);

            // Set corner positions based on image size
            setCorners([
              { x: originalImg.width * 0.1, y: originalImg.height * 0.1, label: 'TL' },
              { x: originalImg.width * 0.9, y: originalImg.height * 0.1, label: 'TR' },
              { x: originalImg.width * 0.9, y: originalImg.height * 0.9, label: 'BR' },
              { x: originalImg.width * 0.1, y: originalImg.height * 0.9, label: 'BL' }
            ]);

            setLoadProgress(100);
            setLoading(false);
            console.log('Image ready');
          }
        } catch (error) {
          console.error('Error processing image:', error);
          setLoadError(`Failed to process image: ${error.message}`);
          setLoadProgress(0);
          setLoading(false);
          URL.revokeObjectURL(blobUrl);
        }
      };

      originalImg.onerror = (error) => {
        clearTimeout(loadTimeout);
        console.error('Image load error:', error);
        console.error('File details:', {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: new Date(file.lastModified).toISOString()
        });

        // Try to provide more specific error message
        let errorMsg = 'Failed to load image. ';

        if (file.size > 30 * 1024 * 1024) {
          errorMsg += 'The file is very large (>30MB). Try compressing it or using a smaller resolution.';
        } else if (!file.type || file.type === 'application/octet-stream') {
          errorMsg += 'The file type could not be detected. Make sure it\'s a valid JPEG or PNG image.';
        } else {
          errorMsg += 'The file may be corrupted, have an incorrect extension, or use an unsupported encoding. Try re-exporting the image or converting it to standard JPEG format.';
        }

        setLoadError(errorMsg);
        setLoadProgress(0);
        setLoading(false);
        URL.revokeObjectURL(blobUrl);
      };

      originalImg.src = blobUrl;

      // Extract date from EXIF in parallel (non-blocking)
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

      // Fallback to file date
      if (!dateStr) {
        const modifiedDate = new Date(file.lastModified);
        dateStr = modifiedDate.toISOString().split('T')[0];
      }

      setFileDate(dateStr);
    } catch (error) {
      console.error('Error handling file upload:', error);
      alert('Error processing file.');
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

  // Main processing function
  const commitGrid = async () => {
    // Validate inputs
    const errors = validateInputs();
    if (errors.length > 0) {
      alert('Cannot process:\n\n' + errors.join('\n'));
      return;
    }

    if (!originalImageRef.current || !imageRef.current) {
      alert('Please upload an image first');
      return;
    }

    try {
      setProcessing(true);
      setProgress(0);

      const originalImage = originalImageRef.current;
      const displayImage = imageRef.current;
      const [tl, tr, br, bl] = corners;
      const scaleFactor = originalImage.width / displayImage.width;

      console.log('Processing with scale factor:', scaleFactor);

      // Get image data from original high-res image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImage.width;
      tempCanvas.height = originalImage.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(originalImage, 0, 0);
      const fullImageData = tempCtx.getImageData(0, 0, originalImage.width, originalImage.height);

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

      // Process each plot
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const layoutPlot = gridLayout[row]?.[col];
          if (!layoutPlot) continue;

          const plotId = layoutPlot.id || `${row + 1}-${col + 1}`;

          if (!layoutPlot.isBlank) {
            const plotCorners = calculatePlotCorners(row, col, rows, cols, tl, tr, br, bl);
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
                width: originalImage.width,
                height: originalImage.height,
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

      console.log(`Extracted ${Object.keys(plotImages).length} plots`);

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
      alert('Error processing images. The image may be too large or invalid. Please try again.');
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
                  if (originalImageRef.current) {
                    originalImageRef.current.src = '';
                    originalImageRef.current = null;
                  }
                  if (imageRef.current) {
                    imageRef.current.src = '';
                    imageRef.current = null;
                  }
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
