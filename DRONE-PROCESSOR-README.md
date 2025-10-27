# 🚁 Drone Image Processor - Turf Trial Grid Detector

## Overview

The Drone Image Processor is a powerful web-based tool that automatically processes drone images of turf trials, extracts EXIF metadata, detects grid markers, and segments individual trial plots with green coverage analysis.

## Features

### 🎯 Core Capabilities

1. **Multi-Image Support**
   - Drag and drop multiple drone images at once
   - Batch processing queue with status tracking
   - Process images sequentially or all at once

2. **EXIF Metadata Extraction**
   - Automatically reads GPS coordinates (latitude/longitude)
   - Extracts altitude, timestamp, and camera information
   - Displays metadata for each processed image
   - Includes metadata in CSV exports

3. **Intelligent Grid Detection**
   - Automatic marker detection using computer vision
   - Auto-detects grid dimensions (rows x columns)
   - Adjustable corner handles for manual refinement
   - Perspective correction for accurate plot extraction

4. **Green Coverage Analysis**
   - Calculates percentage of green vegetation in each plot
   - Adjustable sensitivity for different grass types
   - Visual coverage bars and statistics

5. **Data Export**
   - Download individual or all plot images
   - Export comprehensive CSV with metadata
   - Organized file naming with coverage percentages

## How to Use

### Step 1: Open the Tool

Open `drone-image-processor.html` in a modern web browser (Chrome, Firefox, Edge recommended).

### Step 2: Upload Drone Images

1. **Drag and Drop**: Drag one or multiple drone images into the upload area
2. **Or Click to Browse**: Click the upload button to select files from your computer

**Supported Formats**: JPEG, JPG, PNG (with EXIF metadata)

### Step 3: Review Metadata

Once uploaded, you'll see:
- File name and size
- GPS coordinates (if available)
- Altitude
- Date/Time captured
- Camera make and model
- Image dimensions

### Step 4: Adjust Grid Detection

The tool will automatically:
- Detect colored markers in your image
- Estimate grid dimensions (rows and columns)
- Place corner handles at grid boundaries

**Manual Adjustments**:
- **Drag corner handles** (red circles with TL, TR, BR, BL labels) to adjust grid alignment
- **Adjust rows/columns** if auto-detection is incorrect
- **Change marker color** setting if using white markers instead of bright colors
- **Fine-tune sensitivity** settings in Advanced options

### Step 5: Commit and Extract Plots

1. Click **"Commit & Extract Plots"** when grid is aligned
2. The tool will:
   - Apply perspective correction
   - Extract individual plot images
   - Calculate green coverage for each plot
   - Associate metadata with each plot

### Step 6: Process Multiple Images

After committing one image:
- Click **"Process Next Image"** to continue with the next in queue
- Or click **"Finish Processing"** to review all extracted plots

### Step 7: Export Results

Once all images are processed:

1. **Download All Plots**: Downloads all plot images with organized filenames
   - Format: `{source-image}_plot-{number}_coverage-{percentage}pct.png`

2. **Export CSV with Metadata**: Creates comprehensive spreadsheet with:
   - Source image name
   - Plot number, row, column
   - Green coverage percentage
   - GPS coordinates
   - Altitude, date/time
   - Camera information

## Settings Guide

### Basic Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Marker Color Type** | Choose between bright colors or white markers | Bright Colors |
| **Grid Rows** | Number of rows in your trial grid | Auto-detected |
| **Grid Columns** | Number of columns in your trial grid | Auto-detected |
| **Green Sensitivity** | Adjust detection for different grass colors (10-60) | 35 |

### Advanced Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Marker Min Area** | Minimum marker size in pixels² | 50 |
| **Marker Max Area** | Maximum marker size in pixels² | 5000 |

**Tips for Adjusting Settings**:
- If markers aren't detected: increase Min Area or decrease Max Area
- For dense grids: lower the marker area thresholds
- For different grass colors: adjust Green Sensitivity slider
- For faded/older grass: increase sensitivity
- For very bright grass: decrease sensitivity

## CSV Export Fields

The exported CSV includes the following columns:

1. **Source Image** - Original drone image filename
2. **Plot Number** - Sequential plot number
3. **Row** - Row position in grid
4. **Column** - Column position in grid
5. **Green Coverage (%)** - Calculated vegetation coverage
6. **GPS Latitude** - Latitude from EXIF data
7. **GPS Longitude** - Longitude from EXIF data
8. **Altitude** - Altitude from EXIF data
9. **Date/Time** - Capture timestamp
10. **Camera Make** - Camera manufacturer
11. **Camera Model** - Camera model

## Workflow Examples

### Example 1: Single Trial Site
1. Upload 1 drone image of your trial
2. Adjust grid if needed
3. Commit and extract plots
4. Export CSV for analysis

### Example 2: Multiple Trial Sites
1. Upload multiple images from different locations
2. Process each image sequentially
3. All plots are collected together
4. Single CSV export contains all plots with GPS data for location tracking

### Example 3: Time Series Analysis
1. Upload images from different dates (same location)
2. Date/time metadata helps track temporal changes
3. Compare green coverage over time using CSV data

## Technical Requirements

- **Browser**: Modern web browser with JavaScript enabled
- **Libraries Used**:
  - React 18.2.0
  - OpenCV.js 1.2.1
  - EXIF.js (for metadata extraction)
- **Image Requirements**:
  - JPEG/PNG format
  - EXIF metadata embedded (standard for most drones)
  - Visible grid markers (bright colors or white)

## Troubleshooting

### Markers Not Detected

**Solution**:
- Check marker color setting matches your markers
- Adjust Min/Max Area in Advanced Settings
- Ensure markers are clearly visible and not obscured
- Try adjusting contrast on the original image

### Incorrect Grid Dimensions

**Solution**:
- Manually adjust rows and columns values
- Drag corner handles to correct positions
- Check that all corner markers are visible in image

### No EXIF Metadata

**Solution**:
- Verify your drone saves EXIF data (most do by default)
- Some image editors strip EXIF data - use original files
- Check camera settings to ensure GPS is enabled

### Green Coverage Seems Incorrect

**Solution**:
- Adjust Green Sensitivity slider
- Consider lighting conditions when captured
- Very bright or shaded areas may need sensitivity adjustment

## Best Practices

1. **Image Quality**
   - Capture images on clear days with consistent lighting
   - Fly at consistent altitude for comparable results
   - Ensure grid markers are clearly visible

2. **Marker Placement**
   - Use bright, contrasting colors for markers
   - Place markers at exact grid corners
   - Ensure markers are flat and visible from above

3. **Processing Workflow**
   - Process images from same altitude together
   - Keep consistent marker color across trials
   - Save settings that work well for your setup

4. **Data Management**
   - Export CSV after each session
   - Keep original drone images for reprocessing
   - Document your grid dimensions and marker colors

## Integration with Trial Data Tool

This standalone processor can be used alongside the main Trial Data Tool:

1. Process drone images to extract plots
2. Import plot images into Trial Data Tool's photo system
3. Combine with manual assessment data
4. Create comprehensive trial reports

## Updates and Support

For issues, feature requests, or contributions, please refer to the main repository README.

## License

Part of the Trial Data Tool v2 project.
