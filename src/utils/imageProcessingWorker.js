// Web Worker for offloading expensive image processing from main thread
// Handles perspective transformation and plot extraction

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

    // Convert blob to data URL
    const reader = new FileReader();
    reader.onload = () => {
      self.postMessage({
        success: true,
        messageId,
        plotId,
        imageData: reader.result,
        error: null
      });
    };
    reader.readAsDataURL(result);
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

  // Process pixels with perspective transformation
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      // Normalize coordinates (0 to 1)
      const u = x / (targetSize - 1);
      const v = y / (targetSize - 1);

      // Bilinear interpolation to map destination to source quad
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
        // White pixel for out-of-bounds
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
