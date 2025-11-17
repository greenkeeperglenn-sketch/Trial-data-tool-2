# ImageryAnalyzer - Implementation Guide for Key Improvements

## 1. MEMORY LEAK FIX (Immediate Priority - 5 min)

### Current Problem
Images kept in memory indefinitely, no cleanup on unmount.

### Solution
Add cleanup effects and revoke blob URLs:

```jsx
// Add to ImageryAnalyzer component
useEffect(() => {
  return () => {
    // Cleanup refs
    if (originalImageRef.current) {
      originalImageRef.current.src = '';
    }
    if (imageRef.current) {
      imageRef.current.src = '';
    }
    // Revoke blob URLs if used
    if (imageSrc && imageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(imageSrc);
    }
  };
}, [imageSrc]);

// Also add cleanup when clearing image
const handleClearImage = () => {
  if (imageSrc && imageSrc.startsWith('blob:')) {
    URL.revokeObjectURL(imageSrc);
  }
  setImageSrc(null);
  setFileDate(null);
  setCommitted(false);
  setPlots([]);
};
```

---

## 2. IMAGE PROCESSING WEB WORKER (High Priority - 30 min)

### Create Worker File: `src/utils/imageProcessingWorker.js`

```javascript
// Offload expensive pixel processing to worker thread
self.onmessage = async (event) => {
  const {
    imageData,
    width,
    height,
    plotCorners,
    targetSize,
    scaleFactor,
    plotId,
    messageId
  } = event.data;

  try {
    const result = await extractPlotWithPerspective(
      imageData,
      width,
      height,
      plotCorners,
      targetSize,
      scaleFactor
    );

    self.postMessage({
      success: true,
      messageId,
      plotId,
      imageData: result,
      error: null
    });
  } catch (error) {
    self.postMessage({
      success: false,
      messageId,
      plotId,
      imageData: null,
      error: error.message
    });
  }
};

function extractPlotWithPerspective(
  sourceImageData,
  srcWidth,
  srcHeight,
  plotCorners,
  targetSize,
  scaleFactor
) {
  const canvas = new OffscreenCanvas(targetSize, targetSize);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, targetSize, targetSize);

  // Create output image data
  const output = ctx.createImageData(targetSize, targetSize);
  const srcData = sourceImageData.data;
  const dstData = output.data;

  // Process pixels
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const u = x / (targetSize - 1);
      const v = y / (targetSize - 1);

      // Bilinear interpolation
      const srcX =
        (plotCorners.tl.x * scaleFactor) * (1 - u) * (1 - v) +
        (plotCorners.tr.x * scaleFactor) * u * (1 - v) +
        (plotCorners.br.x * scaleFactor) * u * v +
        (plotCorners.bl.x * scaleFactor) * (1 - u) * v;

      const srcY =
        (plotCorners.tl.y * scaleFactor) * (1 - u) * (1 - v) +
        (plotCorners.tr.y * scaleFactor) * u * (1 - v) +
        (plotCorners.br.y * scaleFactor) * u * v +
        (plotCorners.bl.y * scaleFactor) * (1 - u) * v;

      const sx = Math.floor(srcX);
      const sy = Math.floor(srcY);

      const dstIdx = (y * targetSize + x) * 4;

      if (sx >= 0 && sx < srcWidth && sy >= 0 && sy < srcHeight) {
        const srcIdx = (sy * srcWidth + sx) * 4;
        dstData[dstIdx] = srcData[srcIdx];
        dstData[dstIdx + 1] = srcData[srcIdx + 1];
        dstData[dstIdx + 2] = srcData[srcIdx + 2];
        dstData[dstIdx + 3] = 255;
      } else {
        dstData[dstIdx] = 255;
        dstData[dstIdx + 1] = 255;
        dstData[dstIdx + 2] = 255;
        dstData[dstIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(output, 0, 0);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.98 });
}
```

### Update Component: Use Worker

```jsx
const imageWorker = useRef(null);

useEffect(() => {
  imageWorker.current = new Worker(
    new URL('../utils/imageProcessingWorker.js', import.meta.url)
  );

  return () => {
    imageWorker.current?.terminate();
  };
}, []);

const commitGrid = async () => {
  if (!originalImageRef.current || !canvasRef.current || !fileDate) {
    alert('Please upload an image and confirm the date first');
    return;
  }

  try {
    setProcessing(true);
    setProgress(0);

    const originalImage = originalImageRef.current;
    const displayImage = imageRef.current;
    const [tl, tr, br, bl] = corners;
    const scaleFactor = originalImage.width / displayImage.width;

    // Get image data from original
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImage.width;
    tempCanvas.height = originalImage.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(originalImage, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, originalImage.width, originalImage.height);

    const plotImages = {};
    const plotProcessingPromises = [];

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
                imageWorker.current.removeEventListener('message', handleMessage);

                if (event.data.success) {
                  const photoKey = `${fileDate}_${plotId}`;
                  event.data.imageData.text().then(base64 => {
                    plotImages[photoKey] = `data:image/jpeg;base64,${base64}`;
                    processedPlots++;
                    setProgress(Math.round((processedPlots / totalPlots) * 100));
                    resolve();
                  });
                } else {
                  resolve();
                }
              }
            };

            imageWorker.current.addEventListener('message', handleMessage);
            imageWorker.current.postMessage({
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

    setCommitted(true);
    setProcessing(false);
    createAssessmentDateIfNeeded(fileDate);
    applyImagesToFieldMap(plotImages);
  } catch (error) {
    console.error('Error processing images:', error);
    setProcessing(false);
    alert('Error processing images. The image may be too large. Try a smaller image or contact support.');
  }
};

function calculatePlotCorners(row, col, rows, cols, tl, tr, br, bl) {
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
}
```

---

## 3. EXIF DATE EXTRACTION (Medium Priority - 20 min)

### Install piexifjs

```bash
npm install piexifjs
```

### Add EXIF Extraction

```jsx
import piexif from 'piexifjs';

const handleFileUpload = async (file) => {
  if (!file) return;

  setUploadedFile(file);

  // Try to extract date from EXIF first
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
      } catch (e) {
        // EXIF extraction failed, fall back to file date
      }
    }
  } catch (e) {
    console.warn('Could not extract EXIF data');
  }

  // Fallback to file modified date
  if (!dateStr) {
    const modifiedDate = new Date(file.lastModified);
    dateStr = modifiedDate.toISOString().split('T')[0];
  }

  setFileDate(dateStr);
  setShowDateConfirmation(true);

  // ... rest of image loading code ...
};
```

---

## 4. STATE CONSOLIDATION WITH useReducer (Medium Priority - 30 min)

```jsx
// Define action types
const ACTIONS = {
  SET_IMAGE: 'SET_IMAGE',
  SET_FILE_DATE: 'SET_FILE_DATE',
  SET_ROWS_COLS: 'SET_ROWS_COLS',
  SET_CORNERS: 'SET_CORNERS',
  SET_DRAGGING_CORNER: 'SET_DRAGGING_CORNER',
  COMMIT_GRID: 'COMMIT_GRID',
  SET_PROCESSING: 'SET_PROCESSING',
  SET_PROGRESS: 'SET_PROGRESS',
  RESET: 'RESET'
};

const initialState = {
  imageSrc: null,
  uploadedFile: null,
  fileDate: null,
  showDateConfirmation: false,
  rows: 0,
  cols: 0,
  corners: [],
  draggingCorner: null,
  committed: false,
  plots: [],
  processing: false,
  progress: 0
};

function analyzerReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_IMAGE:
      return {
        ...state,
        imageSrc: action.payload.imageSrc,
        uploadedFile: action.payload.file,
        corners: action.payload.corners
      };
    case ACTIONS.SET_FILE_DATE:
      return { ...state, fileDate: action.payload, showDateConfirmation: true };
    case ACTIONS.SET_ROWS_COLS:
      return { ...state, rows: action.payload.rows, cols: action.payload.cols };
    case ACTIONS.SET_CORNERS:
      return { ...state, corners: action.payload };
    case ACTIONS.SET_DRAGGING_CORNER:
      return { ...state, draggingCorner: action.payload };
    case ACTIONS.COMMIT_GRID:
      return { ...state, committed: true, plots: action.payload, processing: false };
    case ACTIONS.SET_PROCESSING:
      return { ...state, processing: action.payload };
    case ACTIONS.SET_PROGRESS:
      return { ...state, progress: action.payload };
    case ACTIONS.RESET:
      return initialState;
    default:
      return state;
  }
}

// Use in component
const [state, dispatch] = useReducer(analyzerReducer, {
  ...initialState,
  rows: trialRows,
  cols: trialCols
});

// Usage examples
dispatch({ type: ACTIONS.SET_FILE_DATE, payload: dateStr });
dispatch({ type: ACTIONS.SET_PROCESSING, payload: true });
dispatch({ type: ACTIONS.COMMIT_GRID, payload: extractedPlots });
```

---

## 5. INPUT VALIDATION (Quick Win - 10 min)

```jsx
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
  const minDistance = 50;
  if (
    Math.hypot(tr.x - tl.x, tr.y - tl.y) < minDistance ||
    Math.hypot(br.x - bl.x, br.y - bl.y) < minDistance ||
    Math.hypot(bl.x - tl.x, bl.y - tl.y) < minDistance ||
    Math.hypot(br.x - tr.x, br.y - tr.y) < minDistance
  ) {
    errors.push('Grid corners are too close together');
  }

  return errors;
};

const commitGrid = async () => {
  const errors = validateInputs();
  if (errors.length > 0) {
    alert('Cannot process:\n' + errors.join('\n'));
    return;
  }

  // ... proceed with processing ...
};
```

---

## 6. CANVAS TRANSFORM OPTIMIZATION (Advanced - 45 min)

Instead of manual pixel processing, use canvas transforms:

```jsx
function extractPlotWithCanvasTransform(
  sourceImage,
  plotCorners,
  targetSize,
  displayImage
) {
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');

  // Calculate scale factor
  const scaleFactor = sourceImage.width / displayImage.width;

  // Scale corners to original image
  const scaledCorners = {
    tl: { x: plotCorners.tl.x * scaleFactor, y: plotCorners.tl.y * scaleFactor },
    tr: { x: plotCorners.tr.x * scaleFactor, y: plotCorners.tr.y * scaleFactor },
    br: { x: plotCorners.br.x * scaleFactor, y: plotCorners.br.y * scaleFactor },
    bl: { x: plotCorners.bl.x * scaleFactor, y: plotCorners.bl.y * scaleFactor }
  };

  // Create transformation matrix for quad to rect
  ctx.save();

  // Use transform that maps source quad to canvas rect
  const { tl, tr, br, bl } = scaledCorners;

  // Calculate transformation using math:
  // We need to map (tl, tr, br, bl) to (0,0), (width,0), (width,height), (0,height)
  // This requires solving a perspective transform

  // For simplicity, use ctx.transform() with calculated values
  // OR use a WebGL shader for true perspective correction
  
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.98);
}
```

**Note:** True perspective correction without pixel-loop requires WebGL or a library like `OpenCV.js`. The pixel-loop approach is correct but slow - the Worker approach above is the pragmatic fix.

---

## SUMMARY OF CHANGES BY FILE

| File | Changes | Effort | Impact |
|------|---------|--------|--------|
| `ImageryAnalyzer.jsx` | Memory cleanup + validation | 30 min | HIGH |
| `imageProcessingWorker.js` | NEW - offload processing | 30 min | HIGH |
| `ImageryAnalyzer.jsx` | useReducer for state | 30 min | MEDIUM |
| `ImageryAnalyzer.jsx` | Add EXIF extraction | 20 min | MEDIUM |
| `ImageryAnalyzer.jsx` | Apply image orientation | 15 min | LOW |

**Total Recommended Effort:** 2-3 hours for all improvements  
**Critical Path (P0-P1 only):** 60 minutes

