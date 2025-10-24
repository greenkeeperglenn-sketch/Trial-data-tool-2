import * as XLSX from 'xlsx';

/**
 * Parses Excel trial data files and converts them to Trial Data Tool format
 */

/**
 * Find the header row in a sheet by looking for column markers
 */
function findHeaderRow(data) {
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    const hasBlockMarker = row.some(cell =>
      String(cell).toLowerCase().includes('block!')
    );
    const hasPlotMarker = row.some(cell =>
      String(cell).toLowerCase().includes('plot!')
    );

    if (hasBlockMarker && hasPlotMarker) {
      return i;
    }
  }
  return -1;
}

/**
 * Extract trial metadata from the top rows
 */
function extractMetadata(data, headerRowIndex) {
  const metadata = {
    trialName: '',
    date: '',
    area: '',
    assessor: '',
    notes: ''
  };

  for (let i = 0; i < headerRowIndex; i++) {
    const row = data[i];
    const firstCell = String(row[0] || '').toLowerCase();

    if (firstCell.includes('trial name') || firstCell.includes('trial code')) {
      // Trial name might be in the same row or next cell
      metadata.trialName = row.find((cell, idx) =>
        idx > 0 && cell && !String(cell).toLowerCase().includes('trial')
      ) || '';
    } else if (firstCell.includes('date')) {
      metadata.date = row[1] || '';
    } else if (firstCell.includes('area')) {
      metadata.area = row[1] || '';
    } else if (firstCell.includes('assessor')) {
      metadata.assessor = row[1] || '';
    } else if (firstCell.includes('notes')) {
      metadata.notes = row[1] || '';
    }
  }

  return metadata;
}

/**
 * Parse column headers and create assessment type definitions
 */
function parseHeaders(headerRow) {
  const headers = {
    blockCol: -1,
    plotCol: -1,
    treatmentCol: -1,
    assessmentCols: []
  };

  headerRow.forEach((cell, idx) => {
    const cellStr = String(cell).toLowerCase();

    if (cellStr.includes('block!')) {
      headers.blockCol = idx;
    } else if (cellStr.includes('plot!')) {
      headers.plotCol = idx;
    } else if (cellStr.includes('treat')) {
      headers.treatmentCol = idx;
    } else if (cell && !cellStr.includes('!') && idx > Math.max(headers.blockCol, headers.plotCol, headers.treatmentCol)) {
      // This is likely an assessment column
      headers.assessmentCols.push({
        name: String(cell).trim(),
        index: idx
      });
    }
  });

  return headers;
}

/**
 * Parse data rows and extract plot information
 */
function parseDataRows(data, headerRowIndex, headers) {
  const plots = [];

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];

    // Skip empty rows or rows with "X" markers (blanks)
    if (!row || row.length === 0) continue;
    if (String(row[0]).toUpperCase() === 'X') continue;

    const block = row[headers.blockCol];
    const plot = row[headers.plotCol];
    const treatment = row[headers.treatmentCol];

    // Skip if essential data is missing
    if (!block || !plot || !treatment) continue;

    const plotData = {
      block: Number(block),
      plot: Number(plot),
      treatment: Number(treatment),
      values: {}
    };

    // Extract assessment values
    headers.assessmentCols.forEach(col => {
      const value = row[col.index];
      if (value !== '' && value !== null && value !== undefined) {
        plotData.values[col.name] = Number(value);
      }
    });

    plots.push(plotData);
  }

  return plots;
}

/**
 * Parse a single sheet (one assessment date)
 */
function parseSheet(sheet, sheetName) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const headerRowIndex = findHeaderRow(data);
  if (headerRowIndex === -1) {
    throw new Error(`Could not find header row in sheet: ${sheetName}`);
  }

  const metadata = extractMetadata(data, headerRowIndex);
  const headers = parseHeaders(data[headerRowIndex]);
  const plots = parseDataRows(data, headerRowIndex, headers);

  return {
    sheetName,
    metadata,
    headers,
    plots
  };
}

/**
 * Main function to parse Excel file and convert to Trial Data Tool format
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Filter out sheets like "Sheet1", "Trial Plan", "spare empty"
        const dataSheets = workbook.SheetNames.filter(name => {
          const lowerName = name.toLowerCase();
          return !lowerName.includes('sheet1') &&
                 !lowerName.includes('trial plan') &&
                 !lowerName.includes('spare') &&
                 !lowerName.includes('empty');
        });

        if (dataSheets.length === 0) {
          reject(new Error('No data sheets found in the Excel file'));
          return;
        }

        // Parse all sheets
        const parsedSheets = dataSheets.map(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          return parseSheet(sheet, sheetName);
        });

        // Convert to Trial Data Tool format
        const trialData = convertToTrialFormat(parsedSheets);

        resolve(trialData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert parsed sheets to Trial Data Tool format
 */
function convertToTrialFormat(parsedSheets) {
  if (parsedSheets.length === 0) {
    throw new Error('No sheets to process');
  }

  const firstSheet = parsedSheets[0];

  // Extract unique treatments and blocks
  const allPlots = firstSheet.plots;
  const treatments = [...new Set(allPlots.map(p => p.treatment))].sort((a, b) => a - b);
  const blocks = [...new Set(allPlots.map(p => p.block))].sort((a, b) => a - b);

  // Extract all unique assessment types from all sheets
  const assessmentTypesSet = new Set();
  parsedSheets.forEach(sheet => {
    sheet.headers.assessmentCols.forEach(col => {
      assessmentTypesSet.add(col.name);
    });
  });

  const assessmentTypes = Array.from(assessmentTypesSet).map(name => ({
    name,
    min: 0,
    max: 100, // Default, user can adjust
    unit: guessUnit(name)
  }));

  // Create grid layout
  const gridLayout = createGridLayout(allPlots, blocks.length, treatments);

  // Process assessment dates - convert to app format
  const assessmentDates = parsedSheets.map(sheet => {
    // Try to parse the date from sheet name or metadata
    let date = sheet.sheetName;
    if (sheet.metadata.date) {
      date = sheet.metadata.date;
    }

    // Create assessments object in the format the app expects
    const assessments = {};

    // Initialize all assessment types
    assessmentTypes.forEach(assessmentType => {
      assessments[assessmentType.name] = {};

      // Add data for each plot
      sheet.plots.forEach(plot => {
        const plotId = `${plot.block}-${plot.plot}`;
        const value = plot.values[assessmentType.name];

        if (value !== undefined && value !== null && value !== '') {
          assessments[assessmentType.name][plotId] = {
            value: String(value),
            entered: true
          };
        } else {
          assessments[assessmentType.name][plotId] = {
            value: '',
            entered: false
          };
        }
      });
    });

    return {
      date,
      assessments
    };
  });

  // Generate trial ID
  const trialId = Date.now().toString();

  // Use trial name from first sheet
  const trialName = firstSheet.metadata.trialName || 'Imported Trial';

  return {
    id: trialId,
    name: trialName,
    config: {
      blocks: blocks.length,
      treatments: treatments.length,
      treatmentNames: treatments.map((t, i) => `Treatment ${t}`),
      assessmentTypes
    },
    gridLayout,
    assessmentDates,
    metadata: {
      area: firstSheet.metadata.area,
      assessor: firstSheet.metadata.assessor,
      notes: firstSheet.metadata.notes,
      importedFrom: 'Excel',
      importedAt: new Date().toISOString()
    },
    notes: {},
    photos: {}
  };
}

/**
 * Create grid layout from plot data
 */
function createGridLayout(plots, numBlocks, treatmentsList) {
  // Create treatment index mapping (Excel treatment number -> 0-based index)
  const treatmentMap = new Map();
  treatmentsList.forEach((t, idx) => {
    treatmentMap.set(t, idx);
  });

  // Build grid: array of blocks, each block is an array of plots
  const grid = [];

  for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
    const blockPlots = [];
    const blockNum = blockIdx + 1;

    // Find all plots in this block
    const plotsInBlock = plots.filter(p => p.block === blockNum)
      .sort((a, b) => a.plot - b.plot);

    plotsInBlock.forEach(plot => {
      const treatmentIdx = treatmentMap.get(plot.treatment);
      blockPlots.push({
        id: `${plot.block}-${plot.plot}`,
        block: plot.block,
        treatment: treatmentIdx,
        treatmentName: `Treatment ${plot.treatment}`,
        isBlank: false,
        plotNumber: plot.plot
      });
    });

    grid.push(blockPlots);
  }

  return grid;
}

/**
 * Guess the unit based on assessment type name
 */
function guessUnit(name) {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('%') || lowerName.includes('percent')) {
    return '%';
  }
  if (lowerName.includes('ndvi')) {
    return '';
  }
  if (lowerName.includes('vwc') || lowerName.includes('moisture')) {
    return '%';
  }
  if (lowerName.includes('temp')) {
    return '°C';
  }
  if (lowerName.includes('rating') || lowerName.includes('tq') || lowerName.includes('tc')) {
    return '';
  }

  return '';
}
