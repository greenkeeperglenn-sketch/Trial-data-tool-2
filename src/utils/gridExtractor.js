/**
 * Grid extraction utilities for processing drone imagery
 * Extracts individual plot images from an aligned grid overlay
 */

/**
 * Calculate the position of a grid cell using perspective transformation
 * @param {number} row - Row index (0-based)
 * @param {number} col - Column index (0-based)
 * @param {number} totalRows - Total number of rows
 * @param {number} totalCols - Total number of columns
 * @param {Array} corners - Four corner points [{x, y, label}] in order: TL, TR, BR, BL
 * @returns {Object} Cell corners {tl, tr, br, bl}
 */
const getCellCorners = (row, col, totalRows, totalCols, corners) => {
  const [cornerTL, cornerTR, cornerBR, cornerBL] = corners;

  // Calculate interpolation factors
  const rowStart = row / totalRows;
  const rowEnd = (row + 1) / totalRows;
  const colStart = col / totalCols;
  const colEnd = (col + 1) / totalCols;

  // Interpolate top edge
  const topLeft = {
    x: cornerTL.x + (cornerTR.x - cornerTL.x) * colStart,
    y: cornerTL.y + (cornerTR.y - cornerTL.y) * colStart
  };
  const topRight = {
    x: cornerTL.x + (cornerTR.x - cornerTL.x) * colEnd,
    y: cornerTL.y + (cornerTR.y - cornerTL.y) * colEnd
  };

  // Interpolate bottom edge
  const bottomLeft = {
    x: cornerBL.x + (cornerBR.x - cornerBL.x) * colStart,
    y: cornerBL.y + (cornerBR.y - cornerBL.y) * colStart
  };
  const bottomRight = {
    x: cornerBL.x + (cornerBR.x - cornerBL.x) * colEnd,
    y: cornerBL.y + (cornerBR.y - cornerBL.y) * colEnd
  };

  // Interpolate between top and bottom to get cell corners
  const cellTL = {
    x: topLeft.x + (bottomLeft.x - topLeft.x) * rowStart,
    y: topLeft.y + (bottomLeft.y - topLeft.y) * rowStart
  };
  const cellTR = {
    x: topRight.x + (bottomRight.x - topRight.x) * rowStart,
    y: topRight.y + (bottomRight.y - topRight.y) * rowStart
  };
  const cellBR = {
    x: topRight.x + (bottomRight.x - topRight.x) * rowEnd,
    y: topRight.y + (bottomRight.y - topRight.y) * rowEnd
  };
  const cellBL = {
    x: topLeft.x + (bottomLeft.x - topLeft.x) * rowEnd,
    y: topLeft.y + (bottomLeft.y - topLeft.y) * rowEnd
  };

  return { tl: cellTL, tr: cellTR, br: cellBR, bl: cellBL };
};

/**
 * Extract a rectangular region from a perspective-transformed cell
 * Uses a simple approach: get bounding box and extract with some padding
 * @param {HTMLImageElement} img - Source image
 * @param {Object} cellCorners - Cell corners {tl, tr, br, bl}
 * @param {number} outputSize - Size of output image (square)
 * @returns {Promise<Blob>} JPEG blob of extracted cell
 */
const extractCell = async (img, cellCorners, outputSize = 512) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Calculate bounding box
  const minX = Math.min(cellCorners.tl.x, cellCorners.tr.x, cellCorners.br.x, cellCorners.bl.x);
  const maxX = Math.max(cellCorners.tl.x, cellCorners.tr.x, cellCorners.br.x, cellCorners.bl.x);
  const minY = Math.min(cellCorners.tl.y, cellCorners.tr.y, cellCorners.br.y, cellCorners.bl.y);
  const maxY = Math.max(cellCorners.tl.y, cellCorners.tr.y, cellCorners.br.y, cellCorners.bl.y);

  const width = maxX - minX;
  const height = maxY - minY;

  // Set canvas to output size
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Draw the cropped region, scaled to fit output size
  ctx.drawImage(
    img,
    minX, minY, width, height,
    0, 0, outputSize, outputSize
  );

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/jpeg',
      0.9 // Quality
    );
  });
};

/**
 * Extract all grid cells from the main image
 * @param {HTMLImageElement} img - Source image
 * @param {number} rows - Number of rows in grid
 * @param {number} cols - Number of columns in grid
 * @param {Array} corners - Four corner points [{x, y, label}] in order: TL, TR, BR, BL
 * @param {Array} gridLayout - Optional grid layout array for plot IDs
 * @param {Function} onProgress - Optional progress callback (current, total)
 * @returns {Promise<Array>} Array of {row, col, plotId, blob}
 */
export const extractGridCells = async (img, rows, cols, corners, gridLayout = null, onProgress = null) => {
  const cells = [];
  const total = rows * cols;
  let current = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Get cell corners with perspective
      const cellCorners = getCellCorners(row, col, rows, cols, corners);

      // Extract cell image
      const blob = await extractCell(img, cellCorners);

      // Get plot ID from grid layout if available
      let plotId = `R${row + 1}C${col + 1}`;
      if (gridLayout && gridLayout[row] && gridLayout[row][col]) {
        const plotData = gridLayout[row][col];
        if (plotData && plotData.id) {
          plotId = plotData.id;
        }
      }

      cells.push({
        row,
        col,
        plotId,
        blob
      });

      current++;
      if (onProgress) {
        onProgress(current, total);
      }
    }
  }

  return cells;
};

/**
 * Preview a single grid cell extraction (for testing)
 * @param {HTMLImageElement} img - Source image
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} totalRows - Total rows
 * @param {number} totalCols - Total columns
 * @param {Array} corners - Four corner points
 * @returns {Promise<string>} Data URL of extracted cell
 */
export const previewCell = async (img, row, col, totalRows, totalCols, corners) => {
  const cellCorners = getCellCorners(row, col, totalRows, totalCols, corners);
  const blob = await extractCell(img, cellCorners);
  return URL.createObjectURL(blob);
};
