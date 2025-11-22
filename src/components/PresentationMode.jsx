import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Image as ImageIcon, FileText, TrendingUp, Eye, EyeOff, ArrowUp, ArrowDown, Maximize2, MapPin, Grid } from 'lucide-react';
import { jStat } from 'jstat';

// Helper function to normalize date format to YYYY-MM-DD
const normalizeDateFormat = (dateStr) => {
  if (!dateStr) return '';

  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try to parse and convert to YYYY-MM-DD
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn('Could not parse date:', dateStr);
  }

  return dateStr;
};

// Helper function to calculate auto-scale min/max with padding
const calculateAutoScale = (values) => {
  if (!values || values.length === 0) {
    return { min: 0, max: 100 };
  }

  const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
  if (numericValues.length === 0) {
    return { min: 0, max: 100 };
  }

  const dataMin = Math.min(...numericValues);
  const dataMax = Math.max(...numericValues);

  // If all values are the same, add padding above and below
  if (dataMin === dataMax) {
    const padding = Math.abs(dataMax * 0.1) || 1; // 10% padding or 1 if value is 0
    return {
      min: Math.max(0, dataMin - padding),
      max: dataMax + padding
    };
  }

  // Add 10% padding to the range
  const range = dataMax - dataMin;
  const padding = range * 0.1;

  return {
    min: Math.max(0, dataMin - padding), // Don't go below 0
    max: dataMax + padding
  };
};

// GenStat-style Compact Letter Display (CLD) algorithm for Fisher's LSD
const assignLetters = (sortedTreatments, lsd, significant) => {
  if (!significant) {
    return sortedTreatments.map(t => ({ ...t, group: 'NS' }));
  }

  if (sortedTreatments.length === 0) {
    return [];
  }

  // Sort by mean descending (standard for CLD)
  const treatments = [...sortedTreatments].sort((a, b) => b.mean - a.mean);

  // Groups: each group contains treatments that are ALL within LSD of each other
  let groups = [];

  // Step 1: Insert each treatment into applicable groups
  for (const t of treatments) {
    for (const group of groups) {
      let fits = true;
      for (const member of group) {
        if (Math.abs(t.mean - member.mean) > lsd) {
          fits = false;
          break;
        }
      }
      if (fits) {
        group.push(t);
      }
    }
    groups.push([t]);
  }

  // Step 2: Remove redundant groups
  groups = groups.filter(g => {
    const gSet = new Set(g.map(t => t.treatment));
    for (const other of groups) {
      if (other === g) continue;
      if (other.length > g.length) {
        const otherSet = new Set(other.map(t => t.treatment));
        let isSubset = true;
        for (const gt of gSet) {
          if (!otherSet.has(gt)) {
            isSubset = false;
            break;
          }
        }
        if (isSubset) return false;
      }
    }
    return true;
  });

  // Step 3: Assign letters to groups
  const letterMap = new Map();
  treatments.forEach(t => letterMap.set(t.treatment, ''));

  groups.forEach((group, idx) => {
    const letter = String.fromCharCode('a'.charCodeAt(0) + idx);
    for (const member of group) {
      letterMap.set(member.treatment, letterMap.get(member.treatment) + letter);
    }
  });

  return sortedTreatments.map(t => ({
    ...t,
    group: letterMap.get(t.treatment).split('').sort().join('')
  }));
};

// Calculate RCBD ANOVA and LSD for a dataset
const calculateAnovaStats = (treatmentStats, numBlocks) => {
  const treatments = Object.keys(treatmentStats);
  const numTreatments = treatments.length;

  if (numTreatments < 2 || numBlocks < 2) {
    return { significant: false, lsd: 0 };
  }

  // Collect all values
  const allValues = [];
  treatments.forEach(t => {
    treatmentStats[t].values.forEach(v => allValues.push(v));
  });

  const totalN = allValues.length;
  const grandTotal = allValues.reduce((sum, v) => sum + v, 0);
  const grandMean = grandTotal / totalN;
  const correctionFactor = (grandTotal * grandTotal) / totalN;

  // Total SS
  const ssTotal = allValues.reduce((sum, v) => sum + v * v, 0) - correctionFactor;

  // Treatment SS
  let ssTreatment = 0;
  treatments.forEach(t => {
    const tt = treatmentStats[t];
    ssTreatment += (tt.total * tt.total) / tt.n;
  });
  ssTreatment -= correctionFactor;

  // Residual SS (simplified - assumes balanced design)
  const ssResidual = ssTotal - ssTreatment;

  // Degrees of freedom
  const dfTreatment = numTreatments - 1;
  const dfResidual = totalN - numTreatments;

  if (dfResidual <= 0) {
    return { significant: false, lsd: 0 };
  }

  // Mean squares
  const msTreatment = ssTreatment / dfTreatment;
  const msResidual = ssResidual / dfResidual;

  // F-statistic and p-value
  const fTreatment = msResidual > 0 ? msTreatment / msResidual : 0;
  const pValue = dfTreatment > 0 && dfResidual > 0 && fTreatment > 0
    ? 1 - jStat.centralF.cdf(fTreatment, dfTreatment, dfResidual)
    : 1;

  const significant = pValue < 0.05;

  // Calculate LSD
  const replicates = numBlocks;
  const sed = msResidual > 0 ? Math.sqrt(2 * msResidual / replicates) : 0;
  const tCritical = dfResidual > 0 ? jStat.studentt.inv(0.975, dfResidual) : 2.064;
  const lsd = sed * tCritical;

  return { significant, lsd, pValue, fTreatment };
};

// Simple SVG Bar Chart Component by Treatment
const SimpleBarChart = ({ data, min, max, currentDateColor }) => {
  const width = 600;
  const height = 350;  // Increased to accommodate rotated labels
  const padding = 60;
  const bottomPadding = 80;  // Extra space for rotated labels
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding - bottomPadding;

  if (!data || data.length === 0) return null;

  const dataMin = min;
  const dataMax = max;
  const range = dataMax - dataMin;

  const barWidth = chartWidth / data.length * 0.7;
  const barSpacing = chartWidth / data.length;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = height - bottomPadding - pct * chartHeight;
        const value = (dataMin + pct * range).toFixed(1);
        return (
          <g key={pct}>
            <line
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#374151"
              strokeDasharray="3 3"
            />
            <text x={padding - 10} y={y + 5} fontSize="12" fill="#9ca3af" textAnchor="end">
              {value}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((item, idx) => {
        const x = padding + idx * barSpacing + (barSpacing - barWidth) / 2;
        const barHeight = (parseFloat(item.value) - dataMin) / range * chartHeight;
        const y = height - bottomPadding - barHeight;

        return (
          <g key={idx}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={item.color}
              className="hover:opacity-80 transition-opacity"
            />
            {/* Significance letter above value */}
            {item.group && (
              <text
                x={x + barWidth / 2}
                y={y - 22}
                fontSize="16"
                fontWeight="bold"
                fill="#fbbf24"
                textAnchor="middle"
              >
                ({item.group})
              </text>
            )}
            {/* Value label above bar */}
            <text
              x={x + barWidth / 2}
              y={y - 5}
              fontSize="14"
              fontWeight="bold"
              fill="#fff"
              textAnchor="middle"
            >
              {item.value}
            </text>

            {/* Treatment name - rotated for better readability */}
            <text
              x={x + barWidth / 2}
              y={height - bottomPadding + 15}
              fontSize="13"
              fontWeight="500"
              fill="#d1d5db"
              textAnchor="end"
              transform={`rotate(-45, ${x + barWidth / 2}, ${height - bottomPadding + 15})`}
              className="cursor-pointer hover:fill-white transition-colors"
            >
              {item.treatment}
            </text>

            {/* Sample count */}
            <text
              x={x + barWidth / 2}
              y={height - bottomPadding + 35}
              fontSize="10"
              fill="#6b7280"
              textAnchor="end"
              transform={`rotate(-45, ${x + barWidth / 2}, ${height - bottomPadding + 35})`}
            >
              (n={item.count})
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Multi-Line Chart Component - One line per treatment
const MultiLineChart = ({ treatmentData, treatmentColors, currentDate, min, max, allDates, statsData }) => {
  const width = 1100;  // Increased to make room for bigger legend
  const height = 450;  // Increased for better proportions
  const padding = 60;
  const bottomPadding = 80;  // Extra space for rotated labels
  const legendWidth = 300;  // Increased space for legend with grouping lines
  const chartWidth = width - padding * 2 - legendWidth;  // Chart area excludes legend space
  const chartHeight = height - padding - bottomPadding;

  if (!treatmentData || Object.keys(treatmentData).length === 0) return null;

  const dataMin = min;
  const dataMax = max;
  const range = dataMax - dataMin;

  const numDates = allDates.length;

  // Scale functions
  const scaleX = (dateIndex) => padding + (dateIndex / (numDates - 1)) * chartWidth;
  const scaleY = (value) => {
    if (isNaN(value)) return null;
    return height - bottomPadding - ((value - dataMin) / range) * chartHeight;
  };

  // Calculate position for current date (interpolate if between assessment dates)
  const getCurrentDatePosition = () => {
    if (!currentDate) return null;

    // First check if currentDate is exactly an assessment date
    const exactIndex = allDates.indexOf(currentDate);
    if (exactIndex >= 0) {
      return scaleX(exactIndex);
    }

    // If not, interpolate position based on chronological order
    const currentTime = new Date(currentDate).getTime();
    const dateTimes = allDates.map(d => new Date(d).getTime());

    // Find the two dates it falls between
    for (let i = 0; i < dateTimes.length - 1; i++) {
      if (currentTime >= dateTimes[i] && currentTime <= dateTimes[i + 1]) {
        // Interpolate position
        const t = (currentTime - dateTimes[i]) / (dateTimes[i + 1] - dateTimes[i]);
        const x1 = scaleX(i);
        const x2 = scaleX(i + 1);
        return x1 + t * (x2 - x1);
      }
    }

    // If before first date or after last date
    if (currentTime < dateTimes[0]) {
      return scaleX(0);
    }
    if (currentTime > dateTimes[dateTimes.length - 1]) {
      return scaleX(dateTimes.length - 1);
    }

    return null;
  };

  const currentDateX = getCurrentDatePosition();

  // Get sorted treatments with their stats for legend
  const getSortedTreatmentsWithStats = () => {
    const treatmentValuesAtCurrentDate = Object.entries(treatmentData).map(([treatment, dataPoints]) => {
      const currentDataPoint = dataPoints.find(d => d.date === currentDate);
      const value = currentDataPoint ? parseFloat(currentDataPoint.value) : -Infinity;
      // Find stats for this treatment
      const stat = statsData?.find(s => s.treatment === treatment);
      return {
        treatment,
        value,
        group: stat?.group || '',
        displayValue: currentDataPoint ? currentDataPoint.value : '-'
      };
    });

    return treatmentValuesAtCurrentDate.sort((a, b) => b.value - a.value);
  };

  const sortedTreatments = getSortedTreatmentsWithStats();

  // Get unique letters and which treatments have each letter
  const getLetterGroups = () => {
    const letterGroups = {};
    sortedTreatments.forEach((t, idx) => {
      if (t.group && t.group !== 'NS') {
        for (const letter of t.group) {
          if (!letterGroups[letter]) {
            letterGroups[letter] = [];
          }
          letterGroups[letter].push({ treatment: t.treatment, index: idx });
        }
      }
    });
    return letterGroups;
  };

  const letterGroups = getLetterGroups();
  const letters = Object.keys(letterGroups).sort();

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="text-gray-300">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = height - bottomPadding - pct * chartHeight;
        const value = (dataMin + pct * range).toFixed(1);
        return (
          <g key={pct}>
            <line
              x1={padding}
              y1={y}
              x2={padding + chartWidth}
              y2={y}
              stroke="#374151"
              strokeDasharray="3 3"
            />
            <text x={padding - 10} y={y + 5} fontSize="12" fill="#9ca3af" textAnchor="end">
              {value}
            </text>
          </g>
        );
      })}

      {/* X-axis labels - rotated for better readability */}
      {allDates.map((date, i) => {
        const x = scaleX(i);
        const labelY = height - bottomPadding + 20;
        return (
          <text
            key={i}
            x={x}
            y={labelY}
            fontSize="13"
            fontWeight="500"
            fill="#9ca3af"
            textAnchor="end"
            transform={`rotate(-45, ${x}, ${labelY})`}
            className="cursor-pointer hover:fill-white transition-colors"
          >
            {date}
          </text>
        );
      })}

      {/* Current date marker - always show */}
      {currentDateX !== null && (
        <g>
          <line
            x1={currentDateX}
            y1={padding}
            x2={currentDateX}
            y2={height - bottomPadding}
            stroke="#00BFB8"
            strokeWidth="3"
          />
          <text
            x={currentDateX}
            y={padding - 10}
            fontSize="14"
            fontWeight="bold"
            fill="#00BFB8"
            textAnchor="middle"
          >
            {currentDate}
          </text>
        </g>
      )}

      {/* Draw line for each treatment */}
      {Object.entries(treatmentData).map(([treatment, dataPoints]) => {
        const color = treatmentColors[treatment];

        // Create path for this treatment - skip if no data points
        const points = dataPoints.map(d => {
          const dateIndex = allDates.indexOf(d.date);
          const y = scaleY(parseFloat(d.value));
          if (y === null || dateIndex < 0) return null;
          return { x: scaleX(dateIndex), y, date: d.date };
        }).filter(p => p !== null);

        // Still show in legend even if no points
        if (points.length === 0) {
          return null;
        }

        const pathData = points.map((p, i) => {
          return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
        }).join(' ');

        return (
          <g key={treatment}>
            {/* Line path */}
            <path
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth="3"
            />

            {/* Data points */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="5"
                fill={color}
                stroke="#1f2937"
                strokeWidth="2"
                className="hover:r-7 transition-all cursor-pointer"
              />
            ))}
          </g>
        );
      })}

      {/* Enhanced Legend with Statistical Groupings */}
      <g>
        {/* Legend background */}
        <rect
          x={padding + chartWidth + 15}
          y={padding - 20}
          width={legendWidth - 20}
          height={sortedTreatments.length * 36 + 50}
          fill="#1f2937"
          rx="8"
          opacity="0.9"
        />

        {/* Legend title */}
        <text
          x={padding + chartWidth + 25}
          y={padding}
          fontSize="14"
          fontWeight="bold"
          fill="#fbbf24"
        >
          Treatments (ranked)
        </text>

        {/* Statistical grouping brackets on the left */}
        {letters.map((letter, letterIdx) => {
          const group = letterGroups[letter];
          if (group.length < 1) return null;

          const minIdx = Math.min(...group.map(g => g.index));
          const maxIdx = Math.max(...group.map(g => g.index));

          const bracketX = padding + chartWidth + 25 + (letterIdx * 12);
          const topY = padding + 18 + (minIdx * 36);
          const bottomY = padding + 18 + (maxIdx * 36);

          // Colors for different letters
          const bracketColors = ['#00BFB8', '#43B12E', '#00B6ED', '#E2E200', '#8ED8B2', '#0072BC'];
          const bracketColor = bracketColors[letterIdx % bracketColors.length];

          return (
            <g key={letter}>
              {/* Vertical line */}
              <line
                x1={bracketX}
                y1={topY}
                x2={bracketX}
                y2={bottomY}
                stroke={bracketColor}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Top cap */}
              <line
                x1={bracketX}
                y1={topY}
                x2={bracketX + 6}
                y2={topY}
                stroke={bracketColor}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Bottom cap */}
              <line
                x1={bracketX}
                y1={bottomY}
                x2={bracketX + 6}
                y2={bottomY}
                stroke={bracketColor}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Letter label */}
              <text
                x={bracketX}
                y={bottomY + 18}
                fontSize="12"
                fontWeight="bold"
                fill={bracketColor}
                textAnchor="middle"
              >
                {letter}
              </text>
            </g>
          );
        })}

        {/* Treatment items */}
        {sortedTreatments.map((item, idx) => {
          const color = treatmentColors[item.treatment];
          const x = padding + chartWidth + 55 + (letters.length * 12);  // Offset for brackets
          const y = padding + 20 + (idx * 36);

          return (
            <g key={item.treatment}>
              {/* Color indicator */}
              <rect
                x={x}
                y={y - 10}
                width={16}
                height={16}
                rx="3"
                fill={color}
              />

              {/* Treatment name */}
              <text
                x={x + 22}
                y={y + 2}
                fontSize="14"
                fontWeight="600"
                fill="#ffffff"
              >
                {item.treatment}
              </text>
            </g>
          );
        })}

        {/* Legend footer - explanation */}
        {letters.length > 0 && (
          <text
            x={padding + chartWidth + 25}
            y={padding + 30 + (sortedTreatments.length * 36)}
            fontSize="10"
            fill="#6b7280"
          >
            Brackets = not significantly different
          </text>
        )}
      </g>
    </svg>
  );
};

// Section Wrapper with Reorder Controls
const SectionWithControls = ({ sectionId, children, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) => {
  return (
    <div className="relative">
      {/* Reorder Controls */}
      <div className="absolute -right-16 top-8 flex flex-col gap-2 z-10">
        <button
          onClick={() => onMoveUp(sectionId)}
          disabled={!canMoveUp}
          className="p-2 rounded-lg bg-stri-teal hover:bg-stri-blue-info disabled:opacity-20 disabled:cursor-not-allowed transition shadow-lg hover:scale-110"
          title="Move section up"
        >
          <ArrowUp size={20} />
        </button>
        <button
          onClick={() => onMoveDown(sectionId)}
          disabled={!canMoveDown}
          className="p-2 rounded-lg bg-stri-teal hover:bg-stri-blue-info disabled:opacity-20 disabled:cursor-not-allowed transition shadow-lg hover:scale-110"
          title="Move section down"
        >
          <ArrowDown size={20} />
        </button>
      </div>
      {children}
    </div>
  );
};

const PresentationMode = ({
  config,
  gridLayout,
  assessmentDates,
  photos,
  notes
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visibleTreatments, setVisibleTreatments] = useState({});
  const [visibleAssessments, setVisibleAssessments] = useState({});
  const [sectionOrder, setSectionOrder] = useState(['barCharts', 'photos', 'notes', 'graphs']);
  const [useAutoScale, setUseAutoScale] = useState(false);
  const [showDataGrid, setShowDataGrid] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [selectedGridAssessment, setSelectedGridAssessment] = useState(null);
  const [reverseColorScale, setReverseColorScale] = useState(false);

  // Get all dates sorted chronologically
  const sortedDates = [...assessmentDates].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const currentDate = sortedDates[currentSlide];

  // Group plots by treatment
  const getTreatmentGroups = () => {
    const groups = {};
    gridLayout.forEach(row => {
      row.forEach(plot => {
        if (!plot.isBlank) {
          const treatment = plot.treatmentName || 'Untreated';
          if (!groups[treatment]) {
            groups[treatment] = [];
          }
          groups[treatment].push(plot);
        }
      });
    });
    return groups;
  };

  const treatmentGroups = getTreatmentGroups();

  // Create consistent color mapping for treatments using STRI brand colors
  const treatmentNames = Object.keys(treatmentGroups).sort();

  // Initialize visibility states - all visible by default
  useEffect(() => {
    const treatments = {};
    treatmentNames.forEach(name => {
      treatments[name] = true;
    });
    setVisibleTreatments(treatments);

    const assessments = {};
    config.assessmentTypes.forEach(type => {
      assessments[type.name] = true;
    });
    setVisibleAssessments(assessments);

    // Initialize selected grid assessment if not set
    if (!selectedGridAssessment && config.assessmentTypes.length > 0) {
      setSelectedGridAssessment(config.assessmentTypes[0].name);
    }
  }, [treatmentNames.join(','), config.assessmentTypes.map(t => t.name).join(',')]);
  const treatmentColors = {};
  // STRI Brand Color Palette for treatments
  const colorPalette = [
    '#00BFB8', // STRI Teal - Primary
    '#43B12E', // STRI Green Growth - Design
    '#00B6ED', // STRI Blue Info - Plan
    '#E2E200', // STRI Yellow - Build/Attention
    '#8ED8B2', // STRI Green Success - Environment
    '#0072BC', // STRI Blue Research
    '#71DCDF', // STRI Teal Light
    '#4E6584'  // STRI Blue Deep
  ];
  treatmentNames.forEach((name, idx) => {
    treatmentColors[name] = colorPalette[idx % colorPalette.length];
  });

  // Color for current date across all charts - STRI Teal
  const currentDateColor = '#00BFB8'; // STRI Primary Teal

  // Calculate color based on assessment value (green = high/good, red = low/bad)
  const getScoreColor = (value, min, max) => {
    if (value === null || value === undefined || value === '') return '#4B5563'; // Gray for no data

    const numVal = parseFloat(value);
    if (isNaN(numVal)) return '#4B5563';

    // Normalize value to 0-1 range
    const range = max - min;
    let normalized = range > 0 ? (numVal - min) / range : 0.5;

    // Reverse if needed (so low = green, high = red)
    if (reverseColorScale) {
      normalized = 1 - normalized;
    }

    const clamped = Math.max(0, Math.min(1, normalized));

    // Interpolate from red (low) to yellow (mid) to green (high)
    let r, g, b;
    if (clamped < 0.5) {
      // Red to Yellow
      const t = clamped * 2;
      r = 220;
      g = Math.round(50 + t * 170); // 50 to 220
      b = 50;
    } else {
      // Yellow to Green
      const t = (clamped - 0.5) * 2;
      r = Math.round(220 - t * 180); // 220 to 40
      g = Math.round(220 - t * 20); // 220 to 200
      b = Math.round(50 + t * 30); // 50 to 80
    }

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Get assessment value for a plot on current date
  const getPlotAssessmentValue = (plotId, assessmentName) => {
    if (!currentDate || !assessmentName) return null;
    const assessment = currentDate.assessments[assessmentName];
    if (!assessment) return null;
    const plotData = assessment[plotId];
    if (!plotData?.entered || plotData.value === '') return null;
    return plotData.value;
  };

  // Get assessment type config by name
  const getAssessmentTypeConfig = (name) => {
    return config.assessmentTypes.find(t => t.name === name);
  };

  // Toggle functions
  const toggleTreatment = (treatment) => {
    setVisibleTreatments(prev => ({
      ...prev,
      [treatment]: !prev[treatment]
    }));
  };

  const toggleAssessment = (assessmentName) => {
    setVisibleAssessments(prev => ({
      ...prev,
      [assessmentName]: !prev[assessmentName]
    }));
  };

  // Section reordering handlers
  const moveSectionUp = (sectionId) => {
    const index = sectionOrder.indexOf(sectionId);
    if (index > 0) {
      const newOrder = [...sectionOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setSectionOrder(newOrder);
    }
  };

  const moveSectionDown = (sectionId) => {
    const index = sectionOrder.indexOf(sectionId);
    if (index < sectionOrder.length - 1) {
      const newOrder = [...sectionOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setSectionOrder(newOrder);
    }
  };

  // Get photos for current date (with date normalization)
  const getPhotosForDate = (date) => {
    const normalizedDate = normalizeDateFormat(date);
    const datePhotos = {};

    Object.entries(photos).forEach(([key, photoArray]) => {
      // Extract the date part from the key and normalize it
      const keyParts = key.split('_');
      if (keyParts.length >= 2) {
        const photoDate = normalizeDateFormat(keyParts[0]);
        if (photoDate === normalizedDate) {
          const plotId = keyParts.slice(1).join('_'); // In case plot ID has underscores
          datePhotos[plotId] = photoArray;
        }
      }
    });

    return datePhotos;
  };

  const currentPhotos = getPhotosForDate(currentDate?.date);

  // Get notes for current date
  const getCurrentNotes = () => {
    if (!notes || !currentDate) return [];
    return Object.entries(notes)
      .filter(([key]) => key.startsWith(`${currentDate.date}_`))
      .map(([key, note]) => {
        const plotId = key.substring(currentDate.date.length + 1);
        return { plotId, note };
      })
      .filter(item => item.note && item.note.trim() !== '');
  };

  const currentNotes = getCurrentNotes();

  // Prepare chart data by treatment for line charts (all dates)
  const prepareLineChartDataByTreatment = (typeName) => {
    const treatmentData = {};

    // Initialize data structure for each treatment (visible or not initially)
    // We'll filter by visibility when rendering
    treatmentNames.forEach(treatment => {
      treatmentData[treatment] = [];
    });

    console.log(`Preparing data for ${typeName}, treatments:`, treatmentNames);

    // For each date, calculate average per treatment
    sortedDates.forEach(dateObj => {
      const assessment = dateObj.assessments[typeName];
      if (!assessment) {
        console.log(`No assessment data for ${typeName} on ${dateObj.date}`);
        return;
      }

      const treatmentStats = {};

      // Calculate average for each treatment on this date
      gridLayout.forEach(row => {
        row.forEach(plot => {
          if (!plot.isBlank) {
            const treatment = plot.treatmentName || 'Untreated';

            const plotData = assessment[plot.id];

            if (plotData?.entered && plotData.value !== '') {
              if (!treatmentStats[treatment]) {
                treatmentStats[treatment] = { values: [], count: 0 };
              }
              treatmentStats[treatment].values.push(parseFloat(plotData.value));
              treatmentStats[treatment].count++;
            }
          }
        });
      });

      console.log(`Stats for ${dateObj.date}:`, Object.keys(treatmentStats));

      // Add data point for each treatment
      Object.entries(treatmentStats).forEach(([treatment, stats]) => {
        const avg = stats.values.reduce((sum, val) => sum + val, 0) / stats.values.length;
        // Ensure the array exists before pushing
        if (!treatmentData[treatment]) {
          treatmentData[treatment] = [];
        }
        treatmentData[treatment].push({
          date: dateObj.date,
          value: avg.toFixed(1)
        });
      });
    });

    console.log('Final treatment data:', Object.keys(treatmentData).map(t => `${t}: ${treatmentData[t].length} points`));

    // Filter by visible treatments before returning
    const filteredData = {};
    Object.entries(treatmentData).forEach(([treatment, data]) => {
      if (visibleTreatments[treatment] !== false) {  // Include if true or undefined (default visible)
        filteredData[treatment] = data;
      }
    });

    return filteredData;
  };

  // Prepare bar chart data by treatment for current date (with statistics)
  const prepareBarChartDataForType = (typeName) => {
    if (!currentDate) return [];

    const assessment = currentDate.assessments[typeName];
    if (!assessment) return [];

    const treatmentStats = {};

    // Get unique blocks for ANOVA calculation
    const blocks = new Set();

    // Calculate stats for each treatment
    gridLayout.forEach(row => {
      row.forEach(plot => {
        if (!plot.isBlank) {
          const treatment = plot.treatmentName || 'Untreated';
          blocks.add(plot.block);

          // Only include visible treatments
          if (!visibleTreatments[treatment]) return;

          const plotData = assessment[plot.id];

          if (plotData?.entered && plotData.value !== '') {
            if (!treatmentStats[treatment]) {
              treatmentStats[treatment] = { values: [], count: 0, total: 0, n: 0 };
            }
            const val = parseFloat(plotData.value);
            treatmentStats[treatment].values.push(val);
            treatmentStats[treatment].total += val;
            treatmentStats[treatment].n++;
            treatmentStats[treatment].count++;
          }
        }
      });
    });

    const numBlocks = blocks.size;

    // Calculate ANOVA and get LSD
    const anovaResult = calculateAnovaStats(treatmentStats, numBlocks);

    // Build treatment data with means
    const treatmentData = Object.entries(treatmentStats).map(([treatment, stats]) => {
      const mean = stats.total / stats.n;
      return {
        treatment,
        mean,
        value: mean.toFixed(1),
        count: stats.count,
        color: treatmentColors[treatment]
      };
    });

    // Sort by mean ascending for letter assignment
    const sortedForLetters = [...treatmentData].sort((a, b) => a.mean - b.mean);

    // Assign significance letters
    const withLetters = assignLetters(sortedForLetters, anovaResult.lsd, anovaResult.significant);

    // Create lookup for letters
    const letterLookup = {};
    withLetters.forEach(t => {
      letterLookup[t.treatment] = t.group;
    });

    // Add letters to treatment data and sort by value descending for display
    return treatmentData.map(t => ({
      ...t,
      group: letterLookup[t.treatment]
    })).sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
  };

  const nextSlide = () => {
    if (currentSlide < sortedDates.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // Section rendering functions
  const renderBarCharts = () => {
    const hasData = config.assessmentTypes.some(type => {
      if (!visibleAssessments[type.name]) return false;
      const barData = prepareBarChartDataForType(type.name);
      return barData.length > 0;
    });

    if (!hasData) return null;

    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <TrendingUp size={24} className="text-stri-teal" />
          Results by Treatment (Current Date)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {config.assessmentTypes.filter(type => visibleAssessments[type.name]).map((type) => {
            const barData = prepareBarChartDataForType(type.name);
            if (barData.length === 0) return null;

            // Use config min/max by default, or auto-calculated when button is held
            let minValue = type.min;
            let maxValue = type.max;

            if (useAutoScale) {
              const values = barData.map(d => d.value);
              const autoScale = calculateAutoScale(values);
              minValue = autoScale.min;
              maxValue = autoScale.max;
            }

            return (
              <div key={type.name} className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-3 text-center text-gray-200">{type.name}</h4>
                <div className="flex justify-center">
                  <SimpleBarChart
                    data={barData}
                    min={minValue}
                    max={maxValue}
                    currentDateColor={currentDateColor}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPhotos = () => {
    // Get selected assessment config for color scoring
    const selectedAssessmentConfig = getAssessmentTypeConfig(selectedGridAssessment);
    const assessmentMin = selectedAssessmentConfig?.min ?? 0;
    const assessmentMax = selectedAssessmentConfig?.max ?? 10;

    // Collect all plot data with photos
    const plotDataMap = {};
    Object.entries(treatmentGroups)
      .filter(([treatment]) => visibleTreatments[treatment])
      .forEach(([treatment, plots]) => {
        plots.forEach(plot => {
          const plotPhotos = currentPhotos[plot.id];
          plotDataMap[plot.id] = {
            plotId: plot.id,
            treatment: treatment,
            treatmentName: plot.treatmentName,
            treatmentIdx: plot.treatment,
            block: plot.block,
            color: treatmentColors[treatment],
            image: plotPhotos && plotPhotos.length > 0 ? plotPhotos[0] : null
          };
        });
      });

    // Get expanded photo data for modal (rendered once, outside loops)
    const expandedPhotoData = expandedPhoto ? plotDataMap[expandedPhoto] : null;

    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon size={24} className="text-stri-teal" />
            Field Map
          </h3>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Assessment dropdown for color scoring */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Color by:</label>
              <select
                value={selectedGridAssessment || ''}
                onChange={(e) => setSelectedGridAssessment(e.target.value)}
                className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-stri-teal"
              >
                {config.assessmentTypes.map(type => (
                  <option key={type.name} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reverse scale toggle */}
            <button
              onClick={() => setReverseColorScale(!reverseColorScale)}
              className={`px-3 py-2 rounded-lg text-sm transition ${
                reverseColorScale
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Reverse color scale (low=green, high=red)"
            >
              {reverseColorScale ? 'Low=Good' : 'High=Good'}
            </button>
          </div>
        </div>

        {/* Color legend */}
        {selectedGridAssessment && (
          <div className="mb-4 flex items-center gap-4 justify-center">
            <span className="text-sm text-gray-400">{selectedGridAssessment}:</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">{reverseColorScale ? 'Good' : 'Bad'} {assessmentMin}</span>
              <div className="flex h-4 rounded overflow-hidden">
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                  <div
                    key={i}
                    className="w-8 h-4"
                    style={{ backgroundColor: getScoreColor(assessmentMin + pct * (assessmentMax - assessmentMin), assessmentMin, assessmentMax) }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">{assessmentMax} {reverseColorScale ? 'Bad' : 'Good'}</span>
            </div>
          </div>
        )}

        {showDataGrid ? (
          // Data Grid View - Original field map layout
          <div className="space-y-3">
            {gridLayout.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-3 justify-center">
                {row.map((plot, colIdx) => {
                  const assessmentValue = getPlotAssessmentValue(plot.id, selectedGridAssessment);
                  const bgColor = getScoreColor(assessmentValue, assessmentMin, assessmentMax);
                  const plotData = plotDataMap[plot.id];

                  if (plot.isBlank) {
                    return (
                      <div
                        key={colIdx}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-600 bg-gray-700 flex items-center justify-center"
                      >
                        <span className="text-gray-500 text-xs">-</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={colIdx}
                      className="w-20 h-20 rounded-lg shadow-lg overflow-hidden transition-all hover:scale-110 cursor-pointer relative"
                      style={{ backgroundColor: bgColor }}
                      onClick={() => {
                        if (plotData?.image) {
                          setExpandedPhoto(plot.id);
                        }
                      }}
                    >
                      {/* Show photo if available, otherwise show data */}
                      {plotData?.image ? (
                        <img
                          src={plotData.image}
                          alt={plot.id}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          {/* Large assessment value */}
                          <span className="text-2xl font-bold text-white drop-shadow-lg">
                            {assessmentValue !== null ? assessmentValue : '-'}
                          </span>
                          {/* Small block-treatment info */}
                          <span className="text-xs text-white/70">{plot.id}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          // Default View - Treatment columns with photos/data
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${config.treatments.length}, minmax(120px, 1fr))` }}>
            {config.treatments.map((treatmentName, treatmentIdx) => {
              const color = treatmentColors[treatmentName];

              // Get plots for this treatment, sorted by block
              // Use == for comparison to handle string/number type mismatch
              const treatmentPlots = Object.values(plotDataMap)
                .filter(p => p.treatmentIdx == treatmentIdx)
                .sort((a, b) => a.block - b.block);

              return (
                <div key={treatmentIdx} className="space-y-2">
                  {/* Treatment Header - Fixed height with truncation */}
                  <div
                    className="text-center font-bold text-sm py-3 rounded-lg shadow-lg h-14 flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: color, color: 'white' }}
                    title={treatmentName}
                  >
                    <span className="truncate px-2">{treatmentName}</span>
                  </div>

                  {/* Blocks for this treatment */}
                  <div className="space-y-2">
                    {treatmentPlots.map((plotData) => {
                      const assessmentValue = getPlotAssessmentValue(plotData.plotId, selectedGridAssessment);
                      const bgColor = getScoreColor(assessmentValue, assessmentMin, assessmentMax);

                      return (
                        <div
                          key={plotData.plotId}
                          className="relative rounded-lg shadow-lg overflow-hidden cursor-pointer transition-all hover:scale-105 aspect-square"
                          style={{ backgroundColor: bgColor }}
                          onClick={() => {
                            if (plotData.image) {
                              setExpandedPhoto(plotData.plotId);
                            }
                          }}
                        >
                          {/* Show photo if available */}
                          {plotData.image ? (
                            <img
                              src={plotData.image}
                              alt={plotData.plotId}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            // No photo - show colored box with data
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <span className="text-3xl font-bold text-white drop-shadow-lg">
                                {assessmentValue !== null ? assessmentValue : '-'}
                              </span>
                              <span className="text-xs text-white/80">B{plotData.block}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Single expanded photo modal - rendered once outside loops */}
        {expandedPhoto && expandedPhotoData?.image && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setExpandedPhoto(null)}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={expandedPhotoData.image}
                alt={expandedPhotoData.plotId}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                style={{ border: `8px solid ${expandedPhotoData.color}` }}
                onClick={(e) => e.stopPropagation()}
              />
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 text-center text-3xl font-bold text-white px-6 py-3 rounded-lg shadow-xl"
                style={{ backgroundColor: expandedPhotoData.color }}
              >
                Plot {expandedPhotoData.plotId} - {expandedPhotoData.treatment}
              </div>
              <button
                className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold shadow-xl"
                onClick={() => setExpandedPhoto(null)}
              >
                Close (X)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNotes = () => {
    if (currentNotes.length === 0) return null;

    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <FileText size={24} className="text-stri-green-success" />
          Notes
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentNotes.map(({ plotId, note }) => (
            <div key={plotId} className="bg-gray-700 rounded-lg p-4">
              <div className="font-semibold text-stri-teal mb-2">Plot {plotId}</div>
              <p className="text-gray-300 text-sm">{note}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGraphs = () => {
    const hasData = config.assessmentTypes.some(type => {
      if (!visibleAssessments[type.name]) return false;
      const treatmentLineData = prepareLineChartDataByTreatment(type.name);
      return Object.keys(treatmentLineData).length > 0;
    });

    if (!hasData) return null;

    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <TrendingUp size={24} className="text-stri-blue-info" />
          Treatment Trends Over Time
        </h3>

        <div className="space-y-8">
          {config.assessmentTypes.filter(type => visibleAssessments[type.name]).map((type) => {
            const treatmentLineData = prepareLineChartDataByTreatment(type.name);
            if (Object.keys(treatmentLineData).length === 0) return null;

            const allDates = sortedDates.map(d => d.date);

            // Get stats for current date (includes letter groups)
            const statsData = prepareBarChartDataForType(type.name);

            // Use config min/max by default, or auto-calculated when button is held
            let minValue = type.min;
            let maxValue = type.max;

            if (useAutoScale) {
              const allValues = Object.values(treatmentLineData)
                .flat()
                .map(d => d.value);
              const autoScale = calculateAutoScale(allValues);
              minValue = autoScale.min;
              maxValue = autoScale.max;
            }

            return (
              <div key={type.name} className="bg-gray-700 rounded-lg p-6">
                <h4 className="text-xl font-semibold mb-4 text-center text-gray-200">{type.name}</h4>
                <div className="flex justify-center">
                  <MultiLineChart
                    treatmentData={treatmentLineData}
                    treatmentColors={treatmentColors}
                    currentDate={currentDate?.date}
                    min={minValue}
                    max={maxValue}
                    allDates={allDates}
                    statsData={statsData}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const sectionRenderers = {
    barCharts: renderBarCharts,
    photos: renderPhotos,
    notes: renderNotes,
    graphs: renderGraphs
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Timeline Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto p-6">
          {/* Trial Title */}
          <h1 className="text-3xl font-bold mb-4 text-center bg-gradient-to-r from-stri-teal to-stri-blue-info bg-clip-text text-transparent">
            {config.trialName}
          </h1>

          {/* Timeline */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="p-2 rounded-lg bg-stri-blue-deep hover:bg-stri-blue-research disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="flex gap-2 overflow-x-auto py-2 px-4">
              {sortedDates.map((date, idx) => (
                <button
                  key={date.date}
                  onClick={() => setCurrentSlide(idx)}
                  className={`px-4 py-2 rounded-lg transition whitespace-nowrap ${
                    idx === currentSlide
                      ? 'bg-stri-teal shadow-lg scale-110'
                      : idx < currentSlide
                      ? 'bg-gray-600 opacity-60'
                      : 'bg-gray-700 opacity-40'
                  }`}
                >
                  <Calendar size={16} className="inline mr-1" />
                  {date.date}
                </button>
              ))}
            </div>

            <button
              onClick={nextSlide}
              disabled={currentSlide === sortedDates.length - 1}
              className="p-2 rounded-lg bg-stri-blue-deep hover:bg-stri-blue-research disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="text-center text-sm text-gray-400">
            Slide {currentSlide + 1} of {sortedDates.length}
          </div>
        </div>
      </div>

      {/* Fixed Side Navigation */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="p-4 rounded-full bg-stri-teal hover:bg-stri-blue-info disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xl hover:scale-110"
          title="Previous date"
        >
          <ChevronLeft size={28} />
        </button>

        <div className="bg-gray-800 rounded-lg px-3 py-2 text-center shadow-2xl min-w-[100px]">
          <div className="text-xs text-gray-400 mb-1">Current</div>
          <div className="text-sm font-bold text-stri-teal">{currentDate?.date}</div>
          <div className="text-xs text-gray-500 mt-1">{currentSlide + 1}/{sortedDates.length}</div>
        </div>

        <button
          onMouseDown={() => setUseAutoScale(true)}
          onMouseUp={() => setUseAutoScale(false)}
          onMouseLeave={() => setUseAutoScale(false)}
          onTouchStart={() => setUseAutoScale(true)}
          onTouchEnd={() => setUseAutoScale(false)}
          className={`p-4 rounded-full transition shadow-2xl hover:scale-110 ${
            useAutoScale
              ? 'bg-orange-500 hover:bg-orange-600'
              : 'bg-purple-600 hover:bg-purple-700'
          }`}
          title="Hold to auto-adjust chart axes to data"
        >
          <Maximize2 size={28} />
        </button>

        <button
          onMouseDown={() => setShowDataGrid(true)}
          onMouseUp={() => setShowDataGrid(false)}
          onMouseLeave={() => setShowDataGrid(false)}
          onTouchStart={() => setShowDataGrid(true)}
          onTouchEnd={() => setShowDataGrid(false)}
          className={`p-4 rounded-full transition shadow-2xl hover:scale-110 ${
            showDataGrid
              ? 'bg-orange-500 hover:bg-orange-600'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
          title="Hold to show field map grid layout"
        >
          <Grid size={28} />
        </button>

        <button
          onClick={nextSlide}
          disabled={currentSlide === sortedDates.length - 1}
          className="p-4 rounded-full bg-stri-teal hover:bg-stri-blue-info disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xl hover:scale-110"
          title="Next date"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-8 pl-16 space-y-8">
        {/* Date Title */}
        <div className="text-center">
          <h2 className="text-5xl font-bold mb-2">{currentDate?.date}</h2>
          <p className="text-gray-400">Assessment Data</p>
        </div>

        {/* Filter Controls */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
          <h3 className="text-xl font-bold mb-4 text-stri-teal">Display Filters</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Treatment Toggles */}
            <div>
              <h4 className="text-lg font-semibold mb-3 text-gray-300">Treatments</h4>
              <div className="space-y-2">
                {treatmentNames.map(treatment => (
                  <button
                    key={treatment}
                    onClick={() => toggleTreatment(treatment)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                      visibleTreatments[treatment]
                        ? 'bg-gray-700 hover:bg-gray-600'
                        : 'bg-gray-900 opacity-50 hover:opacity-70'
                    }`}
                  >
                    {visibleTreatments[treatment] ? (
                      <Eye size={20} className="text-stri-teal flex-shrink-0" />
                    ) : (
                      <EyeOff size={20} className="text-gray-500 flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: treatmentColors[treatment] }}
                      />
                      <span className={visibleTreatments[treatment] ? 'text-white' : 'text-gray-500'}>
                        {treatment}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Assessment Type Toggles */}
            <div>
              <h4 className="text-lg font-semibold mb-3 text-gray-300">Assessment Types</h4>
              <div className="space-y-2">
                {config.assessmentTypes.map(type => (
                  <button
                    key={type.name}
                    onClick={() => toggleAssessment(type.name)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                      visibleAssessments[type.name]
                        ? 'bg-gray-700 hover:bg-gray-600'
                        : 'bg-gray-900 opacity-50 hover:opacity-70'
                    }`}
                  >
                    {visibleAssessments[type.name] ? (
                      <Eye size={20} className="text-stri-blue-info flex-shrink-0" />
                    ) : (
                      <EyeOff size={20} className="text-gray-500 flex-shrink-0" />
                    )}
                    <span className={visibleAssessments[type.name] ? 'text-white' : 'text-gray-500'}>
                      {type.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reorder Hint */}
        <div className="bg-stri-teal bg-opacity-10 border border-stri-teal rounded-lg p-4 text-center">
          <p className="text-stri-teal text-sm">
            <ArrowUp size={16} className="inline mr-1" />
            <ArrowDown size={16} className="inline mr-2" />
            Use the arrow buttons to reorder sections
          </p>
        </div>

        {/* Dynamic Content Sections - Reorderable */}
        {sectionOrder.map((sectionId, index) => {
          const content = sectionRenderers[sectionId]();
          if (!content) return null;

          return (
            <SectionWithControls
              key={sectionId}
              sectionId={sectionId}
              onMoveUp={moveSectionUp}
              onMoveDown={moveSectionDown}
              canMoveUp={index > 0}
              canMoveDown={index < sectionOrder.length - 1}
            >
              {content}
            </SectionWithControls>
          );
        })}
      </div>
    </div>
  );
};

export default PresentationMode;
