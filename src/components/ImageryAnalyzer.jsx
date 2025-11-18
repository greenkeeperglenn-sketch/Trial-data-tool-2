import React, { useState, useRef, useEffect } from 'react';
import piexif from 'piexifjs';
import { extractGridCells } from '../utils/gridExtractor';
import { uploadPlotImages, ensureBucketExists } from '../services/storage';

const ImageryAnalyzer = ({
  trialId,
  gridLayout,
  config,
  photos,
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });

  // Refs (required for canvas and file input)
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  // SIMPLE: Just handle image loading
  const handleFileUpload = async (file) => {
    if (!file) return;

    try {
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
      };
      
      img.onerror = (error) => {
        console.error('Image load error:', error);
        URL.revokeObjectURL(blobUrl);
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

  // Handle grid extraction and upload
  const handleSubmitGrid = async () => {
    if (!imageRef.current || !trialId || !fileDate) {
      alert('Missing required data. Please ensure image is loaded and trial is saved.');
      return;
    }

    try {
      setIsProcessing(true);
      setProgress({ current: 0, total: rows * cols, stage: 'Extracting plots' });

      console.log('[ImageryAnalyzer] Starting grid extraction...');
      console.log('[ImageryAnalyzer] Trial ID:', trialId);
      console.log('[ImageryAnalyzer] Date:', fileDate);
      console.log('[ImageryAnalyzer] Grid size:', rows, 'x', cols);

      // Ensure storage bucket exists (note: requires admin permissions or pre-created bucket)
      try {
        await ensureBucketExists();
        console.log('[ImageryAnalyzer] Storage bucket check complete');
      } catch (bucketError) {
        console.warn('[ImageryAnalyzer] Could not verify/create bucket (expected if using anon key):', bucketError);
        // Continue anyway - bucket might already exist
      }

      // Extract all grid cells
      const cells = await extractGridCells(
        imageRef.current,
        rows,
        cols,
        corners,
        gridLayout,
        (current, total) => {
          setProgress({ current, total, stage: 'Extracting plots' });
        }
      );

      console.log(`Extracted ${cells.length} plot images`);

      // Prepare uploads
      const uploads = cells.map(cell => ({
        imageBlob: cell.blob,
        trialId,
        date: fileDate,
        plotId: cell.plotId
      }));

      // Upload to Supabase Storage
      setProgress({ current: 0, total: uploads.length, stage: 'Uploading to storage' });
      const uploadResults = await uploadPlotImages(uploads, (current, total) => {
        setProgress({ current, total, stage: 'Uploading to storage' });
      });

      console.log('[ImageryAnalyzer] Upload results:', uploadResults);

      // Count successful uploads
      const successCount = Object.values(uploadResults).filter(url => url !== null).length;
      const failCount = Object.values(uploadResults).filter(url => url === null).length;
      console.log('[ImageryAnalyzer] Successful uploads:', successCount);
      console.log('[ImageryAnalyzer] Failed uploads:', failCount);

      // Update photos object with URLs
      const updatedPhotos = { ...(photos || {}) };
      console.log('[ImageryAnalyzer] Current photos object:', photos);

      Object.entries(uploadResults).forEach(([plotId, url]) => {
        if (url) {
          const key = `${fileDate}_${plotId}`;
          console.log(`[ImageryAnalyzer] Adding photo for key: ${key}, URL: ${url}`);
          // Store URL instead of data URL
          updatedPhotos[key] = updatedPhotos[key] || [];
          updatedPhotos[key].push(url);
        } else {
          console.error(`[ImageryAnalyzer] Failed to upload plot ${plotId}`);
        }
      });

      console.log('[ImageryAnalyzer] Updated photos object:', updatedPhotos);
      console.log('[ImageryAnalyzer] Total photo keys:', Object.keys(updatedPhotos).length);

      // Call onPhotosChange with updated photos
      if (onPhotosChange) {
        onPhotosChange(updatedPhotos);
        console.log('[ImageryAnalyzer] Photos state updated via onPhotosChange');
      }

      setIsProcessing(false);

      if (failCount > 0) {
        alert(`⚠️ Partial Success\n\nExtracted: ${cells.length} images\nUploaded: ${successCount}\nFailed: ${failCount}\n\nCheck console for details. You may need to:\n1. Create 'plot-images' bucket in Supabase Storage\n2. Make bucket public\n3. Check Supabase credentials`);
      } else {
        alert(`✅ Success!\n\nExtracted and uploaded ${cells.length} plot images for ${fileDate}\n\nImages are now saved in the database.`);
      }

      // Clear the image to allow processing another one
      setImageSrc(null);
      setFileDate(null);
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    } catch (error) {
      console.error('Error processing grid:', error);
      setIsProcessing(false);
      alert(`❌ Error: ${error.message}\n\nPlease try again or check console for details.`);
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

        {/* No Image State */}
        {!imageSrc && (
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
              onClick={handleSubmitGrid}
              disabled={isProcessing || !trialId}
              className="w-full px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span>
                  {progress.stage} ({progress.current}/{progress.total})
                </span>
              ) : (
                '✓ Extract Grids & Save to Database'
              )}
            </button>

            {/* Progress Indicator */}
            {isProcessing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="w-full bg-blue-200 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-blue-800 text-center">
                  {progress.stage}: {progress.current} / {progress.total}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageryAnalyzer;
