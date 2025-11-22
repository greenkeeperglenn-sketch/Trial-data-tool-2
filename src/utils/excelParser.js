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
    try {
      console.log('[Parser] Starting file read...');
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          console.log('[Parser] File loaded, starting parse...');
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          console.log('[Parser] Workbook read, sheet names:', workbook.SheetNames);

          // Filter out sheets like "Sheet1", "Trial Plan", "spare empty"
          const dataSheets = workbook.SheetNames.filter(name => {
            const lowerName = name.toLowerCase();
            return !lowerName.includes('sheet1') &&
                   !lowerName.includes('trial plan') &&
                   !lowerName.includes('spare') &&
                   !lowerName.includes('empty');
          });

          console.log('[Parser] Data sheets found:', dataSheets);

          if (dataSheets.length === 0) {
            reject(new Error('No data sheets found in the Excel file'));
            return;
          }

          // Parse all sheets
          console.log('[Parser] Parsing sheets...');
          const parsedSheets = dataSheets.map(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            return parseSheet(sheet, sheetName);
          });

          console.log('[Parser] Converting to trial format...');
          // Convert to Trial Data Tool format
          const trialData = convertToTrialFormat(parsedSheets);

          console.log('[Parser] Success! Trial data created:', trialData.name);
          resolve(trialData);
        } catch (error) {
          console.error('[Parser] Error in onload:', error);
          reject(error);
        }
      };

      reader.onerror = (error) => {
        console.error('[Parser] FileReader error:', error);
        reject(new Error('Failed to read file'));
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('[Parser] Error setting up reader:', error);
      reject(error);
    }
  });
}

/**
 * Convert 2-digit year to 4-digit year
 * Uses 2000-2099 range (assumes years 00-99 mean 2000-2099)
 */
function expandYear(yearStr) {
  const year = parseInt(yearStr, 10);
  if (year >= 100) return year; // Already 4-digit
  return 2000 + year; // Convert 25 -> 2025
}

/**
 * Get all possible date interpretations for user to choose from
 * @param {string} dateStr - Original date string
 * @returns {Object} Object with original, ukFormat, usFormat, and isoFormat
 */
function getDateInterpretations(dateStr) {
  if (!dateStr) {
    return {
      original: '',
      detected: new Date().toISOString().split('T')[0],
      options: [],
      needsConfirmation: false
    };
  }

  const str = String(dateStr).trim();
  const options = [];

  // If already in YYYY-MM-DD format, only one option (no confirmation needed)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const date = new Date(str);
    return {
      original: str,
      detected: str,
      options: [{
        format: 'ISO (YYYY-MM-DD)',
        date: str,
        label: str,
        readable: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
      }],
      needsConfirmation: false
    };
  }

  // Parse dates with separators: supports /, -, or . (dot)
  // Supports both 2-digit (YY) and 4-digit (YYYY) years
  // Examples: DD/MM/YYYY, DD.MM.YY, D.M.YY, etc.
  const dateMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dateMatch) {
    const first = parseInt(dateMatch[1], 10);
    const second = parseInt(dateMatch[2], 10);
    const year = expandYear(dateMatch[3]);

    // Determine if date is ambiguous
    const firstIsValidDay = first >= 1 && first <= 31;
    const firstIsValidMonth = first >= 1 && first <= 12;
    const secondIsValidDay = second >= 1 && second <= 31;
    const secondIsValidMonth = second >= 1 && second <= 12;

    // UK/European Format (DD/MM/YYYY or DD.MM.YY) - PREFER THIS
    if (secondIsValidMonth && firstIsValidDay) {
      const ukDate = `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`;
      const ukDateObj = new Date(year, second - 1, first);
      // Validate the date is real (e.g., catches 31 Feb)
      if (ukDateObj.getDate() === first && ukDateObj.getMonth() === second - 1) {
        options.push({
          format: 'UK/EU (DD.MM.YY)',
          date: ukDate,
          label: `${String(first).padStart(2, '0')}/${String(second).padStart(2, '0')}/${year}`,
          readable: ukDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        });
      }
    }

    // US Format (MM/DD/YYYY) - only add if DIFFERENT from UK and both are valid
    if (firstIsValidMonth && secondIsValidDay && first !== second) {
      const usDate = `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;
      const usDateObj = new Date(year, first - 1, second);
      // Validate the date is real
      if (usDateObj.getDate() === second && usDateObj.getMonth() === first - 1) {
        options.push({
          format: 'US (MM/DD/YY)',
          date: usDate,
          label: `${String(first).padStart(2, '0')}/${String(second).padStart(2, '0')}/${year}`,
          readable: usDateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })
        });
      }
    }

    // Only need confirmation if genuinely ambiguous (both interpretations valid and different)
    const needsConfirmation = options.length > 1;

    // Default to UK format (first option)
    const detected = options.length > 0 ? options[0].date : new Date().toISOString().split('T')[0];

    return {
      original: str,
      detected,
      options,
      needsConfirmation
    };
  }

  // Try JavaScript Date parser as fallback
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const isoDate = date.toISOString().split('T')[0];
      return {
        original: str,
        detected: isoDate,
        options: [{
          format: 'Auto-detected',
          date: isoDate,
          label: str,
          readable: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        }],
        needsConfirmation: false
      };
    }
  } catch (e) {
    console.warn('[excelParser] Could not parse date:', dateStr);
  }

  // Fallback to current date (needs confirmation!)
  const fallback = new Date().toISOString().split('T')[0];
  return {
    original: str,
    detected: fallback,
    options: [{
      format: 'Fallback (today)',
      date: fallback,
      label: 'Unable to parse - using today',
      readable: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    }],
    needsConfirmation: true // Always confirm fallbacks
  };
}

/**
 * Normalize date string to YYYY-MM-DD format
 * Handles UK (DD/MM/YYYY, DD.MM.YY) and US (MM/DD/YYYY) formats
 */
function normalizeDateFormat(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  const str = String(dateStr).trim();

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Handle dates with various separators (/, -, .) and 2 or 4 digit years
  // Examples: DD/MM/YYYY, DD.MM.YY, D.M.YY, etc.
  const dateMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const year = expandYear(dateMatch[3]);

    // Assume UK/European format (DD.MM.YY) for consistency
    const paddedMonth = String(month).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');

    // Validate the date is reasonable
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${paddedMonth}-${paddedDay}`;
    }
  }

  // Handle YYYY-MM-DD with different separators
  const isoMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Try JavaScript Date parser as fallback (handles "March 15, 2024", etc.)
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn('[excelParser] Could not parse date:', dateStr);
  }

  // Last resort: use current date
  console.warn('[excelParser] Using current date for unparseable date string:', dateStr);
  return new Date().toISOString().split('T')[0];
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

  // Create treatment names array
  const treatmentNames = treatments.map((t, i) => `Treatment ${t}`);

  // Create grid layout
  const gridLayout = createGridLayout(allPlots, blocks.length, treatments, treatmentNames);

  // Collect date interpretations for user confirmation
  const dateInterpretations = parsedSheets.map(sheet => {
    let dateStr = sheet.sheetName;
    if (sheet.metadata.date) {
      dateStr = sheet.metadata.date;
    }
    return getDateInterpretations(dateStr);
  });

  // Process assessment dates - convert to app format
  const assessmentDates = parsedSheets.map((sheet, index) => {
    // Try to parse the date from sheet name or metadata
    let dateStr = sheet.sheetName;
    if (sheet.metadata.date) {
      dateStr = sheet.metadata.date;
    }

    // Use the detected date from interpretations
    const date = dateInterpretations[index].detected;

    // Create assessments object in the format the app expects
    const assessments = {};

    // Initialize all assessment types
    assessmentTypes.forEach(assessmentType => {
      assessments[assessmentType.name] = {};

      // Add data for each plot - ID is block-treatment (e.g., 1-1, 1-2, 2-1, 2-2)
      sheet.plots.forEach(plot => {
        const plotId = `${plot.block}-${plot.treatment}`;
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

  // Use trial name from first sheet
  const trialName = firstSheet.metadata.trialName || 'Imported Trial';

  return {
    // Don't set id - let Supabase auto-generate a proper UUID
    name: trialName,
    config: {
      blocks: blocks.length,
      numTreatments: treatments.length,
      treatments: treatmentNames,  // Array of treatment names, not number
      assessmentTypes
    },
    gridLayout,
    assessmentDates,
    dateInterpretations,  // Add date interpretation data for user confirmation
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
function createGridLayout(plots, numBlocks, treatmentsList, treatmentNames) {
  console.log('[createGridLayout] Input:', {
    plotsCount: plots.length,
    numBlocks,
    treatments: treatmentsList,
    treatmentNames
  });

  // Create treatment index mapping (Excel treatment number -> 0-based index)
  const treatmentMap = new Map();
  treatmentsList.forEach((t, idx) => {
    treatmentMap.set(t, idx);
  });

  // Build grid: array of blocks, each block is an array of plots
  const grid = [];

  for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
    const blockNum = blockIdx + 1;

    // Find all plots in this block
    const plotsInBlock = plots.filter(p => p.block === blockNum)
      .sort((a, b) => a.plot - b.plot);

    console.log(`[createGridLayout] Block ${blockNum}: ${plotsInBlock.length} plots`);

    const blockPlots = plotsInBlock.map(plot => {
      const treatmentIdx = treatmentMap.get(plot.treatment);

      if (treatmentIdx === undefined) {
        console.warn(`[createGridLayout] Treatment ${plot.treatment} not found in map!`);
      }

      return {
        id: `${plot.block}-${plot.treatment}`,  // block-treatment format (e.g., 1-1, 1-2)
        block: plot.block,
        treatment: treatmentIdx !== undefined ? treatmentIdx : 0,
        treatmentName: treatmentNames[treatmentIdx] || `Treatment ${plot.treatment}`,
        isBlank: false,
        plotNumber: plot.plot
      };
    });

    grid.push(blockPlots);
  }

  console.log('[createGridLayout] Grid created:', {
    blocks: grid.length,
    plotsPerBlock: grid.map(b => b.length)
  });

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
