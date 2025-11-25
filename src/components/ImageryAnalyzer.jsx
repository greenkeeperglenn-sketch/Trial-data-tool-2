import React, { useState, useRef, useEffect } from 'react';
import piexif from 'piexifjs';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { uploadPlotImage } from '../services/storage';

const ImageryAnalyzer = ({
  trialId,
  gridLayout,
  config,
  assessmentDates,
  currentDateObj,
  selectedAssessmentType,
  photos,
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

  // MINIMAL STATE - JUST WHAT WE NEED
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
  const [loading, setLoading] = useState(false);

  // Batch upload state
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadComplete, setUploadComplete] = useState(false);

  // Refs (required for canvas and file input)
  const fileInputRef = useRef(null);
  const batchFileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const cornersRef = useRef(corners); // Keep corners in ref for fast access during drag
  const animationFrameRef = useRef(null);

  // Keep cornersRef in sync
  useEffect(() => {
    cornersRef.current = corners;
  }, [corners]);

  // Cleanup blob URLs and animation frame on unmount
  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [imageSrc]);

  // SIMPLE: Just handle image loading
  const handleFileUpload = async (file) => {
    if (!file) return;

    try {
      setLoading(true);

      // FAST: Create blob URL immediately (no need to convert to data URL first)
      const blobUrl = URL.createObjectURL(file);

      const img = new Image();
      img.onload = () => {
        console.log('Image loaded successfully:', img.width, img.height);
        imageRef.current = img;
        // Use blob URL instead of data URL - much faster for large files
        setImageSrc(blobUrl);

        // Set corner positions based on image size
        setCorners([
          { x: img.width * 0.1, y: img.height * 0.1, label: 'TL' },
          { x: img.width * 0.9, y: img.height * 0.1, label: 'TR' },
          { x: img.width * 0.9, y: img.height * 0.9, label: 'BR' },
          { x: img.width * 0.1, y: img.height * 0.9, label: 'BL' }
        ]);

        setLoading(false);
      };

      img.onerror = (error) => {
        console.error('Image load error:', error);
        URL.revokeObjectURL(blobUrl);
        setLoading(false);
        alert('Failed to load image. Please try another file.');
      };

      img.src = blobUrl;

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

    // Draw corner markers - BIGGER for easier grabbing
    corners.forEach((corner, idx) => {
      const isActive = draggingCorner === idx;
      const radius = isActive ? 50 : 45; // Much bigger corners

      // Draw outer ring for better visibility
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, radius + 4, 0, 2 * Math.PI);
      ctx.stroke();

      if (isActive) {
        // Active state - yellow
        ctx.fillStyle = 'rgba(255, 255, 0, 0.95)';
      } else {
        // Normal state - red
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
      }

      ctx.beginPath();
      ctx.arc(corner.x, corner.y, radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(corner.label, corner.x, corner.y);
    });
  };

  // Mouse handlers for corner dragging - optimized with requestAnimationFrame
  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Larger hit area (70px) for easier grabbing
    const clickedCorner = cornersRef.current.findIndex(corner => {
      const distance = Math.sqrt(Math.pow(corner.x - x, 2) + Math.pow(corner.y - y, 2));
      return distance < 70;
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

    // Update ref immediately for smooth drawing
    const newCorners = [...cornersRef.current];
    newCorners[draggingCorner] = { ...newCorners[draggingCorner], x, y };
    cornersRef.current = newCorners;

    // Use requestAnimationFrame to batch canvas redraws
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      // Directly redraw canvas without triggering React state
      if (canvasRef.current && imageRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = imageRef.current;

        // Clear and redraw
        ctx.drawImage(img, 0, 0);
        drawGridDirect(ctx, cornersRef.current);
      }
    });
  };

  const handleMouseUp = () => {
    // Sync state with ref when drag ends
    if (draggingCorner !== null) {
      setCorners([...cornersRef.current]);
    }
    setDraggingCorner(null);
  };

  // Direct draw function that takes corners as parameter (for fast updates)
  const drawGridDirect = (ctx, cornerPositions) => {
    if (cornerPositions.length < 4) return;

    const [tl, tr, br, bl] = cornerPositions;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.lineWidth = 2;

    // Vertical lines
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

    // Horizontal lines
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

    // Draw corners - bigger
    cornerPositions.forEach((corner, idx) => {
      const isActive = draggingCorner === idx;
      const radius = isActive ? 50 : 45;

      ctx.strokeStyle = 'white';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, radius + 4, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = isActive ? 'rgba(255, 255, 0, 0.95)' : 'rgba(255, 0, 0, 0.9)';
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, radius, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(corner.label, corner.x, corner.y);
    });
  };

  // Extract individual plot images from the grid
  const handleExtractPlots = async () => {
    if (!imageRef.current || !canvasRef.current || !fileDate) {
      alert('Missing required data. Please ensure image is loaded and has a date.');
      return;
    }

    if (!gridLayout || gridLayout.length === 0) {
      alert('No grid layout available. Please set up your trial first.');
      return;
    }

    try {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      const [tl, tr, br, bl] = corners;

      // Check if date exists in assessmentDates, if not prompt to create it
      const dateExists = assessmentDates.some(d => d.date === fileDate);
      if (!dateExists) {
        const shouldCreateDate = window.confirm(
          `The date ${fileDate} doesn't exist in your assessment dates. Would you like to add it?`
        );

        if (shouldCreateDate) {
          // Create new assessment date
          const newDate = { date: fileDate, assessments: {} };

          // Initialize all assessment types for all plots
          config.assessmentTypes.forEach(type => {
            newDate.assessments[type.name] = {};
            gridLayout.flat().forEach(plot => {
              if (!plot.isBlank) {
                newDate.assessments[type.name][plot.id] = { value: '', entered: false };
              }
            });
          });

          onAssessmentDatesChange([...assessmentDates, newDate].sort((a, b) =>
            new Date(a.date) - new Date(b.date)
          ));
        } else {
          return; // User cancelled
        }
      }

      // Create a temporary canvas for extraction
      const extractCanvas = document.createElement('canvas');
      const extractCtx = extractCanvas.getContext('2d');

      const plotWidth = Math.floor(img.width / cols);
      const plotHeight = Math.floor(img.height / rows);
      extractCanvas.width = plotWidth;
      extractCanvas.height = plotHeight;

      const newPhotos = { ...photos };
      let extractedCount = 0;

      // Extract each plot
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Find the corresponding plot in gridLayout
          if (row >= gridLayout.length || col >= gridLayout[row].length) continue;

          const plot = gridLayout[row][col];
          if (plot.isBlank) continue;

          // Calculate the position in the warped grid using bilinear interpolation
          const colFraction = (col + 0.5) / cols; // Center of the plot
          const rowFraction = (row + 0.5) / rows;

          // Interpolate position on the image
          const topX = tl.x + (tr.x - tl.x) * colFraction;
          const topY = tl.y + (tr.y - tl.y) * colFraction;
          const bottomX = bl.x + (br.x - bl.x) * colFraction;
          const bottomY = bl.y + (br.y - bl.y) * colFraction;

          const centerX = topX + (bottomX - topX) * rowFraction;
          const centerY = topY + (bottomY - topY) * rowFraction;

          // Extract a rectangular region around this center point
          const extractWidth = Math.abs(tr.x - tl.x) / cols * 0.8; // 80% to avoid overlap
          const extractHeight = Math.abs(bl.y - tl.y) / rows * 0.8;

          const sourceX = Math.max(0, centerX - extractWidth / 2);
          const sourceY = Math.max(0, centerY - extractHeight / 2);
          const sourceWidth = Math.min(extractWidth, img.width - sourceX);
          const sourceHeight = Math.min(extractHeight, img.height - sourceY);

          // Clear canvas and draw the extracted plot
          extractCtx.clearRect(0, 0, plotWidth, plotHeight);
          extractCtx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, plotWidth, plotHeight
          );

          // Convert to blob URL
          const dataUrl = extractCanvas.toDataURL('image/jpeg', 0.9);

          // Store in photos object with key: date_plotId
          const photoKey = `${fileDate}_${plot.id}`;
          newPhotos[photoKey] = [dataUrl]; // Array to support multiple photos per plot

          extractedCount++;
        }
      }

      // Update photos state
      onPhotosChange(newPhotos);

      alert(`✓ Success!\n\nExtracted ${extractedCount} plot images for date ${fileDate}.\n\nThese images will now appear in:\n• Field Map view\n• Presentation mode`);

      // Reset the component for next image
      setImageSrc(null);
      setFileDate(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error extracting plots:', error);
      alert('Error extracting plot images. Please try again.');
    }
  };

  // Extract EXIF date from file
  const extractEXIFDate = async (file) => {
    const fallbackDate = new Date(file.lastModified).toISOString().split('T')[0];

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('EXIF extraction timeout')), 5000)
      );

      // Read file as data URL for piexifjs
      const fileReadPromise = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const dataUrl = await Promise.race([fileReadPromise, timeoutPromise]);

      // Extract EXIF data
      const exif = piexif.load(dataUrl);

      if (exif?.Exif?.[piexif.ExifIFD.DateTimeOriginal]) {
        const exifDate = exif.Exif[piexif.ExifIFD.DateTimeOriginal];
        // EXIF date format: "YYYY:MM:DD HH:MM:SS"
        const dateStr = typeof exifDate === 'string' ? exifDate : String.fromCharCode.apply(null, exifDate);
        const dateArray = dateStr.split(' ')[0].split(':');
        const extractedDate = `${dateArray[0]}-${dateArray[1]}-${dateArray[2]}`;
        console.log('[ImageryAnalyzer] ✓ EXIF date found for', file.name, ':', extractedDate);
        return extractedDate;
      }

      console.log('[ImageryAnalyzer] No EXIF date in', file.name);
    } catch (e) {
      console.warn('[ImageryAnalyzer] EXIF extraction failed for', file.name, ':', e.message);
    }

    // Fallback to file modification date
    console.log('[ImageryAnalyzer] Using fallback date for', file.name, ':', fallbackDate);
    return fallbackDate;
  };

  // Handle batch file selection
  const handleBatchFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    console.log('[ImageryAnalyzer] Batch upload: Processing', files.length, 'files');
    setLoading(true);

    try {
      const fileDataArray = [];

      for (const file of files) {
        try {
          const date = await extractEXIFDate(file);
          const preview = URL.createObjectURL(file);

          fileDataArray.push({
            file,
            name: file.name,
            date,
            preview,
            status: 'pending', // pending, uploading, uploaded, error
            error: null
          });
          console.log('[ImageryAnalyzer] Processed:', file.name, 'date:', date);
        } catch (error) {
          console.error('[ImageryAnalyzer] Error processing file:', file.name, error);
          // Still add the file with fallback date
          fileDataArray.push({
            file,
            name: file.name,
            date: new Date().toISOString().split('T')[0],
            preview: URL.createObjectURL(file),
            status: 'pending',
            error: null
          });
        }
      }

      console.log('[ImageryAnalyzer] All files processed, showing modal');
      setBatchFiles(fileDataArray);
      setShowBatchUpload(true);
    } catch (error) {
      console.error('[ImageryAnalyzer] Batch file selection error:', error);
      alert('Error processing files: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle date edit for a specific file
  const handleDateEdit = (index, newDate) => {
    setBatchFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, date: newDate } : f
    ));
  };

  // Handle batch upload
  const handleBatchUpload = async () => {
    if (!trialId) {
      alert('Trial ID is missing. Cannot upload images.');
      return;
    }

    setBatchUploading(true);
    setUploadComplete(false);
    setUploadProgress({ current: 0, total: batchFiles.length });

    const updatedFiles = [...batchFiles];

    for (let i = 0; i < updatedFiles.length; i++) {
      const fileData = updatedFiles[i];

      // Update status to uploading
      updatedFiles[i] = { ...fileData, status: 'uploading' };
      setBatchFiles([...updatedFiles]);

      try {
        // Upload to storage with unassigned marker
        const storagePath = await uploadPlotImage(
          trialId,
          fileData.date,
          'unassigned', // Special marker for unassigned images
          fileData.file,
          i
        );

        // Add to photos object with special unassigned key
        const photoKey = `${fileData.date}_unassigned_${i}`;
        const updatedPhotos = {
          ...photos,
          [photoKey]: [storagePath]
        };
        onPhotosChange(updatedPhotos);

        // Update status to uploaded
        updatedFiles[i] = { ...fileData, status: 'uploaded' };
        setUploadProgress({ current: i + 1, total: batchFiles.length });
      } catch (error) {
        console.error('Upload failed for', fileData.name, error);
        updatedFiles[i] = {
          ...fileData,
          status: 'error',
          error: error.message || 'Upload failed'
        };
      }

      setBatchFiles([...updatedFiles]);
    }

    setBatchUploading(false);
    setUploadComplete(true);

    // Don't auto-close - let user review results or close manually
    console.log('[ImageryAnalyzer] Batch upload complete');
  };

  // Cancel/Close batch upload
  const handleCancelBatch = () => {
    // If currently uploading, just close the modal (uploads continue in background)
    if (batchUploading) {
      setShowBatchUpload(false);
      return;
    }

    // If not uploading, cleanup and close
    batchFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setBatchFiles([]);
    setShowBatchUpload(false);
    setUploadComplete(false);
    if (batchFileInputRef.current) {
      batchFileInputRef.current.value = '';
    }
  };

  // Dismiss completed upload notification
  const dismissUploadComplete = () => {
    batchFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setBatchFiles([]);
    setUploadComplete(false);
    if (batchFileInputRef.current) {
      batchFileInputRef.current.value = '';
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

        {/* Upload Buttons */}
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
            {loading ? 'Loading...' : 'Upload Single Image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={(event) => handleFileUpload(event.target.files?.[0])}
            className="hidden"
            disabled={loading}
          />

          <button
            onClick={() => batchFileInputRef.current?.click()}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded text-white text-sm transition ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Upload size={16} />
            {loading ? 'Loading...' : 'Batch Upload Drone Images'}
          </button>
          <input
            ref={batchFileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            multiple
            onChange={handleBatchFileSelect}
            className="hidden"
            disabled={loading}
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="border-2 border-blue-300 rounded-lg p-8 text-center bg-blue-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-blue-900">Loading image...</p>
                <p className="text-sm text-blue-600">Processing EXIF data and preparing canvas</p>
              </div>
              <div className="w-full max-w-md bg-blue-200 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-600 h-full animate-pulse" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* No Image State */}
        {!imageSrc && !loading && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center border-gray-300 bg-gray-50">
            <p className="text-lg font-medium">Drag & drop or click to upload a drone image</p>
            <p className="text-sm text-gray-500 mt-2">JPEG or PNG files are supported</p>
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

            {/* Submit Button */}
            <button
              onClick={handleExtractPlots}
              className="w-full px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition"
            >
              ✓ Extract Plot Images
            </button>
          </div>
        )}
      </div>

      {/* Batch Upload Modal */}
      {showBatchUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50">
              <h3 className="text-xl font-bold text-blue-900">Batch Upload Drone Images</h3>
              <button
                onClick={handleCancelBatch}
                className="p-2 hover:bg-blue-100 rounded transition"
                title={batchUploading ? "Close (uploads continue in background)" : "Close"}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {!batchUploading && batchFiles.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>{batchFiles.length} files ready to upload</strong>
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Review dates extracted from EXIF metadata. Edit any date if needed, then click "Upload" below.
                  </p>
                </div>
              )}

              {batchUploading && (
                <div className="mb-4 p-4 bg-blue-100 rounded-lg border-2 border-blue-400">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-blue-900">
                      📤 Uploading: {uploadProgress.current} of {uploadProgress.total} complete
                    </span>
                    <span className="text-sm font-bold text-blue-700">
                      {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-3 mb-2">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-700">
                    💡 Close this window to start gridding uploaded images while others upload
                  </p>
                </div>
              )}

              {/* File List */}
              {batchFiles.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Files:</h4>
                </div>
              )}
              <div className="space-y-2">
                {batchFiles.map((fileData, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      fileData.status === 'uploaded'
                        ? 'bg-green-50 border-green-200'
                        : fileData.status === 'error'
                        ? 'bg-red-50 border-red-200'
                        : fileData.status === 'uploading'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Thumbnail */}
                    <img
                      src={fileData.preview}
                      alt={fileData.name}
                      className="w-16 h-16 object-cover rounded"
                    />

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fileData.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="date"
                          value={fileData.date}
                          onChange={(e) => handleDateEdit(index, e.target.value)}
                          disabled={batchUploading}
                          className="text-xs px-2 py-1 border rounded"
                        />
                        {fileData.error && (
                          <span className="text-xs text-red-600">{fileData.error}</span>
                        )}
                      </div>
                    </div>

                    {/* Status Icon and Label */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {fileData.status === 'uploaded' && (
                        <>
                          <Check size={20} className="text-green-600" />
                          <span className="text-xs font-medium text-green-700">Uploaded</span>
                        </>
                      )}
                      {fileData.status === 'error' && (
                        <>
                          <AlertCircle size={20} className="text-red-600" />
                          <span className="text-xs font-medium text-red-700">Failed</span>
                        </>
                      )}
                      {fileData.status === 'uploading' && (
                        <>
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-medium text-blue-700">Uploading...</span>
                        </>
                      )}
                      {fileData.status === 'pending' && (
                        <span className="text-xs font-medium text-gray-500">Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={handleCancelBatch}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition"
              >
                {batchUploading ? 'Close (Continue in Background)' : 'Cancel'}
              </button>
              <button
                onClick={handleBatchUpload}
                disabled={batchUploading || batchFiles.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {batchUploading ? 'Uploading...' : `Upload ${batchFiles.length} Images`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Upload Progress Indicator */}
      {!showBatchUpload && batchUploading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl p-4 border-2 border-blue-500 z-40 min-w-[300px]">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-900">Uploading Images</p>
              <p className="text-xs text-gray-600">
                {uploadProgress.current} of {uploadProgress.total} complete
              </p>
            </div>
            <button
              onClick={() => setShowBatchUpload(true)}
              className="text-blue-600 hover:text-blue-800 text-xs underline"
            >
              Show Details
            </button>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-xs text-gray-600">
              {batchFiles.filter(f => f.status === 'uploaded').length} uploaded,
              {batchFiles.filter(f => f.status === 'error').length} failed
            </div>
          </div>
        </div>
      )}

      {/* Upload Complete Notification */}
      {!showBatchUpload && uploadComplete && !batchUploading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl p-4 border-2 border-green-500 z-40 min-w-[300px]">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Check size={20} className="text-green-600" />
                <p className="text-sm font-bold text-green-900">Upload Complete!</p>
              </div>
              <p className="text-xs text-gray-600">
                {batchFiles.filter(f => f.status === 'uploaded').length} images uploaded successfully
              </p>
              {batchFiles.filter(f => f.status === 'error').length > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  {batchFiles.filter(f => f.status === 'error').length} failed - click "Show Details" to review
                </p>
              )}
            </div>
            <button
              onClick={dismissUploadComplete}
              className="text-gray-400 hover:text-gray-600"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowBatchUpload(true)}
              className="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Show Details
            </button>
            <button
              onClick={dismissUploadComplete}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageryAnalyzer;
