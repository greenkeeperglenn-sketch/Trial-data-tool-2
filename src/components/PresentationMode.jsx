import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Image as ImageIcon, FileText, TrendingUp, Eye, EyeOff, ArrowUp, ArrowDown, Maximize2 } from 'lucide-react';

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

// Simple SVG Bar Chart Component by Treatment
const SimpleBarChart = ({ data, min, max, currentDateColor }) => {
  const width = 600;
  const height = 300;
  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

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
        const y = height - padding - pct * chartHeight;
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
        const y = height - padding - barHeight;

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
            <text
              x={x + barWidth / 2}
              y={height - padding + 20}
              fontSize="11"
              fill="#9ca3af"
              textAnchor="middle"
              className="max-w-20"
            >
              {item.treatment}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - padding + 35}
              fontSize="9"
              fill="#6b7280"
              textAnchor="middle"
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
const MultiLineChart = ({ treatmentData, treatmentColors, currentDate, min, max, allDates }) => {
  const width = 1000;  // Increased to make room for legend on right
  const height = 350;
  const padding = 60;
  const legendWidth = 200;  // Space reserved for legend on right
  const chartWidth = width - padding * 2 - legendWidth;  // Chart area excludes legend space
  const chartHeight = height - padding * 2;  // No bottom space needed for legend anymore

  if (!treatmentData || Object.keys(treatmentData).length === 0) return null;

  const dataMin = min;
  const dataMax = max;
  const range = dataMax - dataMin;

  const numDates = allDates.length;

  // Scale functions
  const scaleX = (dateIndex) => padding + (dateIndex / (numDates - 1)) * chartWidth;
  const scaleY = (value) => {
    if (isNaN(value)) return null;
    return height - padding - ((value - dataMin) / range) * chartHeight;
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

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="text-gray-300">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = height - padding - pct * chartHeight;
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

      {/* X-axis labels */}
      {allDates.map((date, i) => {
        const x = scaleX(i);
        return (
          <text
            key={i}
            x={x}
            y={height - padding + 20}
            fontSize="11"
            fill="#9ca3af"
            textAnchor="middle"
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
            y2={height - padding}
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
            Current ({currentDate})
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
          console.log(`No points for treatment: ${treatment}`);
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

      {/* Legend - show all treatments vertically on the right, sorted by current date value */}
      <g>
        {(() => {
          // Get current date values for each treatment to sort by
          const treatmentValuesAtCurrentDate = Object.entries(treatmentData).map(([treatment, dataPoints]) => {
            const currentDataPoint = dataPoints.find(d => d.date === currentDate);
            const value = currentDataPoint ? parseFloat(currentDataPoint.value) : -Infinity;
            return { treatment, value };
          });

          // Sort by value (highest to lowest)
          const sortedTreatments = treatmentValuesAtCurrentDate
            .sort((a, b) => b.value - a.value)
            .map(item => item.treatment);

          return sortedTreatments.map((treatment, idx) => {
            const color = treatmentColors[treatment];
            const x = padding + chartWidth + 30;  // Legend starts 30px after chart
            const y = padding + (idx * 25);  // 25px spacing between items

            return (
              <g key={treatment}>
                <line
                  x1={x}
                  y1={y}
                  x2={x + 20}
                  y2={y}
                  stroke={color}
                  strokeWidth="3"
                />
                <circle
                  cx={x + 10}
                  cy={y}
                  r="4"
                  fill={color}
                />
                <text
                  x={x + 25}
                  y={y + 4}
                  fontSize="12"
                  fill="#9ca3af"
                >
                  {treatment}
                </text>
              </g>
            );
          });
        })()}
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

  // Get photos for current date
  const getPhotosForDate = (date) => {
    const datePhotos = {};
    Object.entries(photos).forEach(([key, photoArray]) => {
      if (key.startsWith(`${date}_`)) {
        const plotId = key.substring(date.length + 1);
        datePhotos[plotId] = photoArray;
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

    // Initialize data structure for each visible treatment
    treatmentNames.forEach(treatment => {
      if (visibleTreatments[treatment]) {
        treatmentData[treatment] = [];
      }
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
            // Only include visible treatments
            if (!visibleTreatments[treatment]) return;

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
        treatmentData[treatment].push({
          date: dateObj.date,
          value: avg.toFixed(1)
        });
      });
    });

    console.log('Final treatment data:', Object.keys(treatmentData).map(t => `${t}: ${treatmentData[t].length} points`));

    return treatmentData;
  };

  // Prepare bar chart data by treatment for current date
  const prepareBarChartDataForType = (typeName) => {
    if (!currentDate) return [];

    const assessment = currentDate.assessments[typeName];
    if (!assessment) return [];

    const treatmentStats = {};

    // Calculate average for each treatment
    gridLayout.forEach(row => {
      row.forEach(plot => {
        if (!plot.isBlank) {
          const treatment = plot.treatmentName || 'Untreated';
          // Only include visible treatments
          if (!visibleTreatments[treatment]) return;

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

    // Convert to array with averages, sorted by value (highest to lowest)
    return Object.entries(treatmentStats).map(([treatment, stats]) => {
      const avg = stats.values.reduce((sum, val) => sum + val, 0) / stats.values.length;
      return {
        treatment,
        value: avg.toFixed(1),
        count: stats.count,
        color: treatmentColors[treatment]
      };
    }).sort((a, b) => parseFloat(b.value) - parseFloat(a.value)); // Sort by value descending
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
    if (Object.keys(currentPhotos).length === 0) return null;

    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ImageIcon size={24} className="text-stri-teal" />
          Plot Images by Treatment
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Object.entries(treatmentGroups)
            .filter(([treatment]) => visibleTreatments[treatment])
            .map(([treatment, plots]) => {
            const treatmentPhotos = plots.filter(plot => currentPhotos[plot.id]);

            if (treatmentPhotos.length === 0) return null;

            const treatmentColor = treatmentColors[treatment];

            return (
              <div key={treatment} className="space-y-4">
                <div
                  className="text-center font-bold text-lg py-2 rounded-lg"
                  style={{
                    backgroundColor: `${treatmentColor}30`,
                    borderLeft: `4px solid ${treatmentColor}`,
                    borderRight: `4px solid ${treatmentColor}`
                  }}
                >
                  {treatment}
                </div>

                <div className="space-y-4">
                  {treatmentPhotos.map(plot => {
                    const plotPhotos = currentPhotos[plot.id];
                    if (!plotPhotos || plotPhotos.length === 0) return null;

                    return (
                      <div
                        key={plot.id}
                        className="rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition transform hover:scale-105"
                        style={{
                          border: `4px solid ${treatmentColor}`,
                          backgroundColor: treatmentColor
                        }}
                      >
                        <img
                          src={plotPhotos[0]}
                          alt={plot.id}
                          className="w-full aspect-square object-cover"
                        />
                        <div
                          className="p-2 text-center font-semibold text-white"
                          style={{ backgroundColor: treatmentColor }}
                        >
                          {plot.id}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
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
