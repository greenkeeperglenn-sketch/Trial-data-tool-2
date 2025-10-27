import React, { useState } from 'react';
import * as ss from 'simple-statistics';
import { jStat } from 'jstat';
import { LineChart, BarChart3, Box } from 'lucide-react';

const Analysis = ({ config, gridLayout, assessmentDates, selectedAssessmentType }) => {
  const [chartType, setChartType] = useState('box'); // 'line', 'box', 'bar'
  const [barGrouping, setBarGrouping] = useState('treatment'); // 'treatment' or 'date'
  const [boxGrouping, setBoxGrouping] = useState('treatment'); // 'treatment' or 'date'
  const [lineGrouping, setLineGrouping] = useState('treatment'); // 'treatment' or 'date'
  const [scaleMode, setScaleMode] = useState('fixed'); // 'fixed', 'auto', 'custom'
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');
  const [selectedTreatments, setSelectedTreatments] = useState(
    new Set(config.treatments.map((_, idx) => idx))
  );

  // Calculate comprehensive statistics for a single date (Genstat-style RCBD)
  const calculateStats = (dateObj) => {
    const assessmentData = dateObj.assessments[selectedAssessmentType];
    const allPlots = gridLayout.flat().filter(p => !p.isBlank);

    // Get all values with treatment and block info
    const values = allPlots
      .map(plot => {
        const v = assessmentData[plot.id];
        if (!v?.entered || isNaN(parseFloat(v.value))) return null;
        return {
          treatment: plot.treatment,
          value: parseFloat(v.value),
          block: plot.block
        };
      })
      .filter(v => v !== null);

    if (values.length === 0) return null;

    // Group by treatment
    const treatmentGroups = {};
    values.forEach(v => {
      if (!treatmentGroups[v.treatment]) treatmentGroups[v.treatment] = [];
      treatmentGroups[v.treatment].push(v.value);
    });

    // Group by block
    const blockGroups = {};
    values.forEach(v => {
      if (!blockGroups[v.block]) blockGroups[v.block] = [];
      blockGroups[v.block].push(v.value);
    });

    // Calculate means for each treatment
    const treatmentStats = Object.entries(treatmentGroups).map(([treatment, vals]) => {
      const mean = ss.mean(vals);
      const stdDev = ss.standardDeviation(vals);
      const stdError = stdDev / Math.sqrt(vals.length);

      return {
        treatment: parseInt(treatment),
        treatmentName: config.treatments[treatment],
        mean,
        stdDev,
        stdError,
        n: vals.length,
        values: vals
      };
    });

    // ANOVA calculation for Randomized Complete Block Design
    const grandMean = ss.mean(values.map(v => v.value));
    const numTreatments = Object.keys(treatmentGroups).length;
    const numBlocks = Object.keys(blockGroups).length;
    const totalN = values.length;

    // Calculate block means
    const blockMeans = Object.entries(blockGroups).map(([block, vals]) => ({
      block: parseInt(block),
      mean: ss.mean(vals),
      n: vals.length
    }));

    // Sum of squares for blocks (SSB)
    let ssBlock = 0;
    blockMeans.forEach(bm => {
      ssBlock += bm.n * Math.pow(bm.mean - grandMean, 2);
    });

    // Sum of squares for treatments (SST)
    let ssTreatment = 0;
    treatmentStats.forEach(ts => {
      ssTreatment += ts.n * Math.pow(ts.mean - grandMean, 2);
    });

    // Total sum of squares
    let ssTotal = 0;
    values.forEach(v => {
      ssTotal += Math.pow(v.value - grandMean, 2);
    });

    // Sum of squares for error (residual)
    const ssError = ssTotal - ssBlock - ssTreatment;

    // Degrees of freedom
    const dfTreatment = numTreatments - 1;
    const dfBlock = numBlocks - 1;
    const dfError = (numTreatments - 1) * (numBlocks - 1);
    const dfTotal = totalN - 1;

    // Mean squares
    const msTreatment = ssTreatment / dfTreatment;
    const msBlock = ssBlock / dfBlock;
    const msError = ssError / dfError;

    // F-statistic
    const fValue = msTreatment / msError;

    // P-value using F-distribution
    const pValue = 1 - jStat.centralF.cdf(fValue, dfTreatment, dfError);
    const significant = pValue < 0.05;

    // Coefficient of Variation
    const cv = (Math.sqrt(msError) / grandMean) * 100;

    // Fisher's LSD (only meaningful if significant)
    const tCritical = jStat.studentt.inv(0.975, dfError); // 95% confidence (two-tailed)
    const lsd = tCritical * Math.sqrt(2 * msError / numBlocks);

    // Assign letter groups based on Fisher's Protected LSD (ASCENDING)
    // Only apply if P ≤ 0.05
    let groups;
    if (significant) {
      // Sort by mean ASCENDING (lowest gets 'a')
      const sortedStats = [...treatmentStats].sort((a, b) => a.mean - b.mean);
      const n = sortedStats.length;

      // Create matrix of significant differences
      const sigDiff = Array(n).fill(null).map(() => Array(n).fill(false));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          sigDiff[i][j] = Math.abs(sortedStats[i].mean - sortedStats[j].mean) > lsd;
        }
      }

      // Assign letters using insertion algorithm
      // letterGroups[i] = array of treatment indices in group i
      const letterGroups = [];

      for (let i = 0; i < n; i++) {
        let assigned = false;

        // Try to add to existing letter groups
        for (let g = 0; g < letterGroups.length; g++) {
          // Check if treatment i is NOT significantly different from ALL treatments in group g
          let canJoinGroup = true;
          for (const j of letterGroups[g]) {
            if (sigDiff[i][j]) {
              canJoinGroup = false;
              break;
            }
          }

          if (canJoinGroup) {
            letterGroups[g].push(i);
            assigned = true;
          }
        }

        // If not assigned to any group, create new group
        if (!assigned) {
          letterGroups.push([i]);
        }
      }

      // Convert letter groups to letter strings for each treatment
      const treatmentLetters = Array(n).fill('');
      letterGroups.forEach((group, groupIdx) => {
        const letter = String.fromCharCode(97 + groupIdx); // 'a', 'b', 'c', ...
        group.forEach(treatmentIdx => {
          treatmentLetters[treatmentIdx] += letter;
        });
      });

      // Apply letters back to stats (sorted alphabetically)
      groups = sortedStats.map((stat, idx) => ({
        ...stat,
        group: treatmentLetters[idx].split('').sort().join('')
      }));
    } else {
      // Not significant - no letter groups
      groups = treatmentStats.map(stat => ({
        ...stat,
        group: null
      }));
    }

    return {
      treatmentStats: groups,
      anova: {
        ssTreatment,
        ssBlock,
        ssError,
        ssTotal,
        dfTreatment,
        dfBlock,
        dfError,
        dfTotal,
        msTreatment,
        msBlock,
        msError,
        fValue,
        pValue,
        significant,
        cv
      },
      lsd,
      grandMean
    };
  };

  // Helper function to calculate DAT (Days After Treatment)
  const calculateDAT = (dateString) => {
    if (assessmentDates.length === 0) return '0DAT';
    const firstDate = new Date(assessmentDates[0].date);
    const currentDate = new Date(dateString);
    const diffTime = Math.abs(currentDate - firstDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays}DAT`;
  };

  // Helper function to format P-value for display
  const formatPValue = (pValue) => {
    if (pValue > 0.05) return 'NS';
    if (pValue < 0.001) return '<0.001';
    return pValue.toFixed(3);
  };

  // Filter out blank dates (dates with no data)
  const validAssessmentDates = assessmentDates.filter(dateObj => {
    const stats = calculateStats(dateObj);
    return stats !== null;
  });

  // Get assessment type configuration for min/max scale
  const assessment = config.assessmentTypes.find(a => a.name === selectedAssessmentType);
  const fixedMin = assessment?.min || 0;
  const fixedMax = assessment?.max || 10;

  // Calculate auto-fit scale from actual data
  const allStats = validAssessmentDates.map(d => calculateStats(d)).filter(s => s !== null);
  const allDataValues = allStats.flatMap(s => s.treatmentStats.flatMap(ts => ts.values));
  const autoMin = allDataValues.length > 0 ? Math.min(...allDataValues) : fixedMin;
  const autoMax = allDataValues.length > 0 ? Math.max(...allDataValues) : fixedMax;

  // Determine scale based on mode
  let scaleMin, scaleMax;
  if (scaleMode === 'auto') {
    scaleMin = autoMin;
    scaleMax = autoMax;
  } else if (scaleMode === 'custom') {
    scaleMin = customMin !== '' ? parseFloat(customMin) : fixedMin;
    scaleMax = customMax !== '' ? parseFloat(customMax) : fixedMax;
  } else {
    scaleMin = fixedMin;
    scaleMax = fixedMax;
  }

  return (
    <div className="space-y-6">
      {/* Charts - Moved to top */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">{selectedAssessmentType} - Data Visualization</h3>

        <div className="flex items-center justify-between mb-4">
          {/* Chart Type Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setChartType('line')}
              className={`px-4 py-2 rounded flex items-center gap-2 transition-colors ${
                chartType === 'line'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <LineChart size={18} />
              Line
            </button>
            <button
              onClick={() => setChartType('box')}
              className={`px-4 py-2 rounded flex items-center gap-2 transition-colors ${
                chartType === 'box'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Box size={18} />
              Box Plot
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-4 py-2 rounded flex items-center gap-2 transition-colors ${
                chartType === 'bar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <BarChart3 size={18} />
              Bar
            </button>
          </div>
        </div>

        {/* Chart Grouping Toggles */}
        {chartType === 'bar' && (
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Group by:</span>
            <div className="flex gap-1 bg-gray-100 p-1 rounded">
              <button
                onClick={() => setBarGrouping('treatment')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  barGrouping === 'treatment'
                    ? 'bg-white shadow text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Treatment
              </button>
              <button
                onClick={() => setBarGrouping('date')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  barGrouping === 'date'
                    ? 'bg-white shadow text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Date
              </button>
            </div>
          </div>
        )}

        {chartType === 'box' && (
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Group by:</span>
            <div className="flex gap-1 bg-gray-100 p-1 rounded">
              <button
                onClick={() => setBoxGrouping('treatment')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  boxGrouping === 'treatment'
                    ? 'bg-white shadow text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Treatment
              </button>
              <button
                onClick={() => setBoxGrouping('date')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  boxGrouping === 'date'
                    ? 'bg-white shadow text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Date
              </button>
            </div>
          </div>
        )}

        {chartType === 'line' && (
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Group by:</span>
            <div className="flex gap-1 bg-gray-100 p-1 rounded">
              <button
                onClick={() => setLineGrouping('treatment')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  lineGrouping === 'treatment'
                    ? 'bg-white shadow text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Treatment
              </button>
              <button
                onClick={() => setLineGrouping('date')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  lineGrouping === 'date'
                    ? 'bg-white shadow text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Date
              </button>
            </div>
          </div>
        )}

        {/* Scale Controls */}
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Y-Axis Scale:</span>

            <div className="flex gap-2">
              <button
                onClick={() => setScaleMode('fixed')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  scaleMode === 'fixed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                Fixed ({fixedMin}-{fixedMax})
              </button>
              <button
                onClick={() => setScaleMode('auto')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  scaleMode === 'auto'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                Auto-Fit ({autoMin.toFixed(1)}-{autoMax.toFixed(1)})
              </button>
              <button
                onClick={() => setScaleMode('custom')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  scaleMode === 'custom'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                Custom
              </button>
            </div>

            {scaleMode === 'custom' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Min:</label>
                <input
                  type="number"
                  step="0.1"
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  placeholder={fixedMin.toString()}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <label className="text-sm text-gray-600">Max:</label>
                <input
                  type="number"
                  step="0.1"
                  value={customMax}
                  onChange={(e) => setCustomMax(e.target.value)}
                  placeholder={fixedMax.toString()}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            )}

            <span className="text-xs text-gray-500">
              Current: {scaleMin.toFixed(1)} to {scaleMax.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Treatment Filter */}
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="flex items-start gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-700 pt-1">Show Treatments:</span>
            <div className="flex flex-wrap gap-3">
              {config.treatments.map((treatment, idx) => (
                <label key={idx} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTreatments.has(idx)}
                    onChange={() => {
                      const newSelected = new Set(selectedTreatments);
                      if (newSelected.has(idx)) {
                        newSelected.delete(idx);
                      } else {
                        newSelected.add(idx);
                      }
                      setSelectedTreatments(newSelected);
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">{treatment}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => {
                if (selectedTreatments.size === config.treatments.length) {
                  setSelectedTreatments(new Set());
                } else {
                  setSelectedTreatments(new Set(config.treatments.map((_, idx) => idx)));
                }
              }}
              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100"
            >
              {selectedTreatments.size === config.treatments.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        {/* Chart Area */}
        <div className="overflow-x-auto">
          {/* Line Chart - Grouped by Treatment (Separate charts) */}
          {chartType === 'line' && lineGrouping === 'treatment' && (
            <div className="space-y-6">
              {(() => {
                const allStats = validAssessmentDates.map(d => calculateStats(d)).filter(s => s !== null);
                if (allStats.length === 0) return <p className="text-gray-500">No data available</p>;

                const range = scaleMax - scaleMin;
                const padding = range * 0.1;

                const chartHeight = 150;
                const chartWidth = Math.max(500, validAssessmentDates.length * 80);
                const scale = (val) => chartHeight - ((val - (scaleMin - padding)) / (range + 2 * padding)) * chartHeight;

                const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16', '#eab308', '#ef4444', '#06b6d4'];

                return config.treatments.map((treatment, treatmentIdx) => {
                  // Filter by selected treatments
                  if (!selectedTreatments.has(treatmentIdx)) return null;

                  const points = validAssessmentDates.map((dateObj, dateIdx) => {
                    const stats = calculateStats(dateObj);
                    if (!stats) return null;
                    const treatmentStat = stats.treatmentStats.find(ts => ts.treatment === treatmentIdx);
                    if (!treatmentStat) return null;
                    const x = (dateIdx / (validAssessmentDates.length - 1)) * (chartWidth - 40);
                    const y = scale(treatmentStat.mean);
                    return { x, y, mean: treatmentStat.mean, se: treatmentStat.stdError };
                  }).filter(p => p !== null);

                  if (points.length === 0) return null;
                  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                  return (
                    <div key={treatmentIdx} className="border rounded p-3 bg-gray-50">
                      <h4 className="text-sm font-bold mb-2">{treatment}</h4>
                      <div className="relative" style={{ height: chartHeight + 40, width: chartWidth }}>
                        <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-gray-600">
                          <span>{(scaleMax + padding).toFixed(1)}</span>
                          <span>{(scaleMax + padding - 0.25 * (range + 2 * padding)).toFixed(1)}</span>
                          <span>{(scaleMax + padding - 0.5 * (range + 2 * padding)).toFixed(1)}</span>
                          <span>{(scaleMax + padding - 0.75 * (range + 2 * padding)).toFixed(1)}</span>
                          <span>{(scaleMin - padding).toFixed(1)}</span>
                        </div>

                        <svg className="absolute left-10 top-0" width={chartWidth - 40} height={chartHeight}>
                          {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => (
                            <line key={i} x1="0" y1={chartHeight * fraction} x2={chartWidth - 40} y2={chartHeight * fraction} stroke="#e5e7eb" strokeWidth="1" />
                          ))}

                          <path d={pathD} fill="none" stroke={colors[treatmentIdx % colors.length]} strokeWidth="2" />
                          {points.map((p, i) => (
                            <g key={i}>
                              <line x1={p.x} y1={scale(p.mean - p.se)} x2={p.x} y2={scale(p.mean + p.se)} stroke={colors[treatmentIdx % colors.length]} strokeWidth="1" />
                              <circle cx={p.x} cy={p.y} r="3" fill={colors[treatmentIdx % colors.length]} stroke="white" strokeWidth="1.5" />
                            </g>
                          ))}
                        </svg>

                        <div className="absolute left-10 bottom-0 right-0 flex justify-between text-xs text-gray-600">
                          {validAssessmentDates.map((dateObj, idx) => (
                            <div key={idx} className="text-center" style={{ width: '1px' }}>
                              <div className="transform -rotate-45 origin-top-left whitespace-nowrap" style={{ fontSize: '10px' }}>{dateObj.date}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Line Chart - Grouped by Date */}
          {chartType === 'line' && lineGrouping === 'date' && (
            <div className="min-w-max">
              {(() => {
                const allStats = validAssessmentDates.map(d => calculateStats(d)).filter(s => s !== null);
                if (allStats.length === 0) return <p className="text-gray-500">No data available</p>;

                const range = scaleMax - scaleMin;
                const padding = range * 0.1;

                const chartHeight = 220;
                const chartWidth = Math.max(500, config.treatments.length * 100);
                const scale = (val) => chartHeight - ((val - (scaleMin - padding)) / (range + 2 * padding)) * chartHeight;

                const dateColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16', '#eab308', '#ef4444', '#06b6d4', '#10b981', '#f59e0b', '#6366f1'];

                return (
                  <div className="relative" style={{ height: chartHeight + 50, width: chartWidth }}>
                    <div className="absolute left-0 top-0 bottom-10 flex flex-col justify-between text-xs text-gray-600">
                      <span>{(scaleMax + padding).toFixed(1)}</span>
                      <span>{(scaleMax + padding - 0.25 * (range + 2 * padding)).toFixed(1)}</span>
                      <span>{(scaleMax + padding - 0.5 * (range + 2 * padding)).toFixed(1)}</span>
                      <span>{(scaleMax + padding - 0.75 * (range + 2 * padding)).toFixed(1)}</span>
                      <span>{(scaleMin - padding).toFixed(1)}</span>
                    </div>

                    <svg className="absolute left-10 top-0" width={chartWidth - 40} height={chartHeight}>
                      {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => (
                        <line key={i} x1="0" y1={chartHeight * fraction} x2={chartWidth - 40} y2={chartHeight * fraction} stroke="#e5e7eb" strokeWidth="1" />
                      ))}

                      {validAssessmentDates.map((dateObj, dateIdx) => {
                        const stats = calculateStats(dateObj);
                        if (!stats) return null;

                        // Filter treatments and recalculate x positions
                        const filteredTreatments = config.treatments
                          .map((treatment, idx) => ({ treatment, idx }))
                          .filter(t => selectedTreatments.has(t.idx));

                        const points = filteredTreatments.map((t, filteredIdx) => {
                          const treatmentStat = stats.treatmentStats.find(ts => ts.treatment === t.idx);
                          if (!treatmentStat) return null;
                          const x = filteredTreatments.length > 1
                            ? (filteredIdx / (filteredTreatments.length - 1)) * (chartWidth - 40)
                            : (chartWidth - 40) / 2;
                          const y = scale(treatmentStat.mean);
                          return { x, y, mean: treatmentStat.mean, se: treatmentStat.stdError };
                        }).filter(p => p !== null);

                        if (points.length === 0) return null;
                        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                        return (
                          <g key={dateIdx}>
                            <path d={pathD} fill="none" stroke={dateColors[dateIdx % dateColors.length]} strokeWidth="2" />
                            {points.map((p, i) => (
                              <g key={i}>
                                <line x1={p.x} y1={scale(p.mean - p.se)} x2={p.x} y2={scale(p.mean + p.se)} stroke={dateColors[dateIdx % dateColors.length]} strokeWidth="1" />
                                <circle cx={p.x} cy={p.y} r="3" fill={dateColors[dateIdx % dateColors.length]} stroke="white" strokeWidth="1.5" />
                              </g>
                            ))}
                          </g>
                        );
                      })}
                    </svg>

                    <div className="absolute left-10 bottom-0 right-0 flex justify-between text-xs text-gray-600">
                      {config.treatments
                        .filter((treatment, idx) => selectedTreatments.has(idx))
                        .map((treatment, idx) => (
                          <div key={idx} className="text-center" style={{ width: '1px' }}>
                            <div className="transform -rotate-45 origin-top-left whitespace-nowrap" style={{ fontSize: '10px' }}>{treatment}</div>
                          </div>
                        ))}
                    </div>

                    <div className="absolute top-0 right-0 bg-white border rounded p-1.5 text-xs">
                      {validAssessmentDates.map((dateObj, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 mb-0.5" style={{ fontSize: '10px' }}>
                          <div className="w-3 h-0.5" style={{ backgroundColor: dateColors[idx % dateColors.length] }} />
                          <span>{dateObj.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Box Plot - Grouped by Treatment */}
          {chartType === 'box' && boxGrouping === 'treatment' && (
            <div className="flex gap-2 items-end min-w-max pb-4">
              {(() => {
                const treatmentColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16', '#eab308', '#ef4444', '#06b6d4'];

                return config.treatments.map((treatment, treatmentIdx) => {
                  // Filter by selected treatments
                  if (!selectedTreatments.has(treatmentIdx)) return null;

                  const color = treatmentColors[treatmentIdx % treatmentColors.length];

                  return (
                    <div key={treatmentIdx} className="flex flex-col items-center">
                        <div className="text-xs font-medium mb-1">{treatment}</div>
                        <div className="flex gap-0.5 items-end h-40">
                          {validAssessmentDates.map((dateObj, dateIdx) => {
                            const stats = calculateStats(dateObj);
                            if (!stats) return null;

                            const treatmentStat = stats.treatmentStats.find(ts => ts.treatment === treatmentIdx);
                            if (!treatmentStat) return null;

                            const vals = treatmentStat.values;
                            const min = Math.min(...vals);
                            const max = Math.max(...vals);
                            const sorted = [...vals].sort((a, b) => a - b);
                            const q1 = ss.quantile(sorted, 0.25);
                            const q3 = ss.quantile(sorted, 0.75);
                            const median = ss.median(sorted);

                            const range = scaleMax - scaleMin;
                            const scale = (val) => ((val - scaleMin) / range) * 120;

                            // Light version of color for box fill
                            const colorWithOpacity = color + '40'; // Add opacity to hex

                            return (
                              <div key={dateIdx} className="flex flex-col items-center">
                                <div className="relative h-32 w-6 bg-white border border-gray-300">
                                  {/* Box (Q1 to Q3) */}
                                  <div
                                    className="absolute w-full border-2"
                                    style={{
                                      bottom: `${scale(q1)}px`,
                                      height: `${Math.max(2, scale(q3) - scale(q1))}px`,
                                      backgroundColor: colorWithOpacity,
                                      borderColor: color
                                    }}
                                  />
                                  {/* Median line */}
                                  <div
                                    className="absolute w-full h-0.5"
                                    style={{
                                      bottom: `${scale(median)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                  {/* Whisker to min */}
                                  <div
                                    className="absolute left-1/2 w-0.5 -translate-x-1/2"
                                    style={{
                                      bottom: `${scale(min)}px`,
                                      height: `${scale(q1) - scale(min)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                  {/* Min cap */}
                                  <div
                                    className="absolute left-1/4 w-1/2 h-0.5"
                                    style={{
                                      bottom: `${scale(min)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                  {/* Whisker to max */}
                                  <div
                                    className="absolute left-1/2 w-0.5 -translate-x-1/2"
                                    style={{
                                      bottom: `${scale(q3)}px`,
                                      height: `${scale(max) - scale(q3)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                  {/* Max cap */}
                                  <div
                                    className="absolute left-1/4 w-1/2 h-0.5"
                                    style={{
                                      bottom: `${scale(max)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                </div>
                                <div className="text-xs mt-0.5 text-center" style={{ fontSize: '8px' }}>{dateObj.date}</div>
                                <div className="text-xs font-bold" style={{ fontSize: '8px', color }}>({treatmentStat.group || '-'})</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Box Plot - Grouped by Date */}
          {chartType === 'box' && boxGrouping === 'date' && (
            <div className="flex gap-2 items-end min-w-max pb-4">
              {(() => {
                const treatmentColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16', '#eab308', '#ef4444', '#06b6d4'];

                return validAssessmentDates.map((dateObj, dateIdx) => {
                  const stats = calculateStats(dateObj);
                  if (!stats) return null;

                  return (
                    <div key={dateIdx} className="flex flex-col items-center">
                      <div className="text-xs font-medium mb-1">{dateObj.date}</div>
                      <div className="flex gap-0.5 items-end h-40">
                        {config.treatments.map((treatment, treatmentIdx) => {
                          // Filter by selected treatments
                          if (!selectedTreatments.has(treatmentIdx)) return null;

                          const treatmentStat = stats.treatmentStats.find(ts => ts.treatment === treatmentIdx);
                          if (!treatmentStat) return null;

                          const color = treatmentColors[treatmentIdx % treatmentColors.length];
                          const vals = treatmentStat.values;
                          const min = Math.min(...vals);
                          const max = Math.max(...vals);
                          const sorted = [...vals].sort((a, b) => a - b);
                          const q1 = ss.quantile(sorted, 0.25);
                          const q3 = ss.quantile(sorted, 0.75);
                          const median = ss.median(sorted);

                          const range = scaleMax - scaleMin;
                          const scale = (val) => ((val - scaleMin) / range) * 120;

                          // Light version of color for box fill
                          const colorWithOpacity = color + '40';

                          return (
                            <div key={treatmentIdx} className="flex flex-col items-center">
                                <div className="relative h-32 w-6 bg-white border border-gray-300">
                                  {/* Box (Q1 to Q3) */}
                                  <div
                                    className="absolute w-full border-2"
                                    style={{
                                      bottom: `${scale(q1)}px`,
                                      height: `${Math.max(2, scale(q3) - scale(q1))}px`,
                                      backgroundColor: colorWithOpacity,
                                      borderColor: color
                                    }}
                                  />
                                  {/* Median line */}
                                  <div
                                    className="absolute w-full h-0.5"
                                    style={{
                                      bottom: `${scale(median)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                  {/* Whisker to min */}
                                  <div
                                    className="absolute left-1/2 w-0.5 -translate-x-1/2"
                                    style={{
                                      bottom: `${scale(min)}px`,
                                      height: `${scale(q1) - scale(min)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                  {/* Min cap */}
                                  <div
                                    className="absolute left-1/4 w-1/2 h-0.5"
                                    style={{
                                      bottom: `${scale(min)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                  {/* Whisker to max */}
                                  <div
                                    className="absolute left-1/2 w-0.5 -translate-x-1/2"
                                    style={{
                                      bottom: `${scale(q3)}px`,
                                      height: `${scale(max) - scale(q3)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                  {/* Max cap */}
                                  <div
                                    className="absolute left-1/4 w-1/2 h-0.5"
                                    style={{
                                      bottom: `${scale(max)}px`,
                                      backgroundColor: color
                                    }}
                                  />
                                </div>
                                <div className="text-xs mt-0.5 text-center" style={{ fontSize: '8px' }}>{treatment}</div>
                                <div className="text-xs font-bold" style={{ fontSize: '8px', color }}>({treatmentStat.group || '-'})</div>
                              </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Bar Chart */}
          {chartType === 'bar' && (
            <div className="min-w-max">
              {(() => {
                if (validAssessmentDates.length === 0) return <p className="text-gray-500">No data available</p>;

                const chartHeight = 220;
                const barWidth = 20;

                const dateColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16', '#eab308', '#ef4444', '#06b6d4', '#10b981', '#f59e0b', '#6366f1'];
                const treatmentColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16', '#eab308', '#ef4444', '#06b6d4'];

                return (
                  <div>
                    {/* Bar Chart grouped by Treatment */}
                    {barGrouping === 'treatment' && (
                      <div>
                        <div className="flex gap-4 items-end pb-6" style={{ height: chartHeight + 80 }}>
                          {/* Y-axis */}
                          <div className="flex flex-col justify-between text-xs text-gray-600 h-full pb-16">
                            <span>{scaleMax.toFixed(1)}</span>
                            <span>{(scaleMax - 0.25 * (scaleMax - scaleMin)).toFixed(1)}</span>
                            <span>{(scaleMax - 0.5 * (scaleMax - scaleMin)).toFixed(1)}</span>
                            <span>{(scaleMax - 0.75 * (scaleMax - scaleMin)).toFixed(1)}</span>
                            <span>{scaleMin.toFixed(1)}</span>
                          </div>

                          {/* Bar groups for each treatment */}
                          {config.treatments.map((treatment, treatmentIdx) => {
                            // Filter by selected treatments
                            if (!selectedTreatments.has(treatmentIdx)) return null;

                            const groupWidth = validAssessmentDates.length * (barWidth + 3);

                            return (
                              <div key={treatmentIdx} className="flex flex-col items-center" style={{ width: groupWidth + 'px' }}>
                                <div className="flex gap-0.5 items-end h-full pb-3">
                                  {validAssessmentDates.map((dateObj, dateIdx) => {
                                    const stats = calculateStats(dateObj);
                                    if (!stats) return <div key={dateIdx} style={{ width: barWidth + 'px' }} />;

                                    const treatmentStat = stats.treatmentStats.find(ts => ts.treatment === treatmentIdx);
                                    if (!treatmentStat) return <div key={dateIdx} style={{ width: barWidth + 'px' }} />;

                                    const barHeight = ((treatmentStat.mean - scaleMin) / (scaleMax - scaleMin)) * (chartHeight - 45);
                                    const errorBarHeight = (treatmentStat.stdError / (scaleMax - scaleMin)) * (chartHeight - 45);

                                    return (
                                      <div key={dateIdx} className="flex flex-col items-center" style={{ width: barWidth + 'px' }}>
                                        {/* Value label */}
                                        <div className="text-xs font-medium mb-0.5 text-center whitespace-nowrap" style={{ fontSize: '8px' }}>
                                          {treatmentStat.mean.toFixed(1)}
                                        </div>
                                        {/* Letter group (only show on last date) */}
                                        {dateIdx === validAssessmentDates.length - 1 && (
                                          <div className="text-xs text-blue-600 font-bold mb-0.5" style={{ fontSize: '8px' }}>
                                            ({treatmentStat.group || '-'})
                                          </div>
                                        )}
                                        {/* Error bar */}
                                        <div className="relative" style={{ height: errorBarHeight + 'px', marginBottom: '2px' }}>
                                          <div
                                            className="absolute left-1/2 w-0.5 bg-black -translate-x-1/2 bottom-0"
                                            style={{ height: '100%' }}
                                          />
                                          <div
                                            className="absolute left-1/2 w-2 h-0.5 bg-black -translate-x-1/2 top-0"
                                          />
                                        </div>
                                        {/* Bar */}
                                        <div
                                          className="w-full rounded-t transition-all"
                                          style={{
                                            height: `${barHeight}px`,
                                            backgroundColor: dateColors[dateIdx % dateColors.length]
                                          }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* Treatment label */}
                                <div className="text-xs font-medium text-center mt-1">
                                  {treatment}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-2 mt-3 justify-center text-xs">
                          {validAssessmentDates.map((dateObj, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: dateColors[idx % dateColors.length] }}
                              />
                              <span>{dateObj.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bar Chart grouped by Date */}
                    {barGrouping === 'date' && (
                      <div>
                        <div className="flex gap-4 items-end pb-6" style={{ height: chartHeight + 80 }}>
                          {/* Y-axis */}
                          <div className="flex flex-col justify-between text-xs text-gray-600 h-full pb-16">
                            <span>{scaleMax.toFixed(1)}</span>
                            <span>{(scaleMax - 0.25 * (scaleMax - scaleMin)).toFixed(1)}</span>
                            <span>{(scaleMax - 0.5 * (scaleMax - scaleMin)).toFixed(1)}</span>
                            <span>{(scaleMax - 0.75 * (scaleMax - scaleMin)).toFixed(1)}</span>
                            <span>{scaleMin.toFixed(1)}</span>
                          </div>

                          {/* Bar groups for each date */}
                          {validAssessmentDates.map((dateObj, dateIdx) => {
                            const groupWidth = selectedTreatments.size * (barWidth + 3);
                            const stats = calculateStats(dateObj);

                            return (
                              <div key={dateIdx} className="flex flex-col items-center" style={{ width: groupWidth + 'px' }}>
                                <div className="flex gap-0.5 items-end h-full pb-3">
                                  {config.treatments.map((treatment, treatmentIdx) => {
                                    // Filter by selected treatments
                                    if (!selectedTreatments.has(treatmentIdx)) return null;

                                    if (!stats) return <div key={treatmentIdx} style={{ width: barWidth + 'px' }} />;

                                    const treatmentStat = stats.treatmentStats.find(ts => ts.treatment === treatmentIdx);
                                    if (!treatmentStat) return <div key={treatmentIdx} style={{ width: barWidth + 'px' }} />;

                                    const barHeight = ((treatmentStat.mean - scaleMin) / (scaleMax - scaleMin)) * (chartHeight - 45);
                                    const errorBarHeight = (treatmentStat.stdError / (scaleMax - scaleMin)) * (chartHeight - 45);

                                    return (
                                      <div key={treatmentIdx} className="flex flex-col items-center" style={{ width: barWidth + 'px' }}>
                                        {/* Value label */}
                                        <div className="text-xs font-medium mb-0.5 text-center whitespace-nowrap" style={{ fontSize: '8px' }}>
                                          {treatmentStat.mean.toFixed(1)}
                                        </div>
                                        {/* Letter group */}
                                        <div className="text-xs text-blue-600 font-bold mb-0.5" style={{ fontSize: '8px' }}>
                                          ({treatmentStat.group || '-'})
                                        </div>
                                        {/* Error bar */}
                                        <div className="relative" style={{ height: errorBarHeight + 'px', marginBottom: '2px' }}>
                                          <div
                                            className="absolute left-1/2 w-0.5 bg-black -translate-x-1/2 bottom-0"
                                            style={{ height: '100%' }}
                                          />
                                          <div
                                            className="absolute left-1/2 w-2 h-0.5 bg-black -translate-x-1/2 top-0"
                                          />
                                        </div>
                                        {/* Bar */}
                                        <div
                                          className="w-full rounded-t transition-all"
                                          style={{
                                            height: `${barHeight}px`,
                                            backgroundColor: treatmentColors[treatmentIdx % treatmentColors.length]
                                          }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* Date label */}
                                <div className="text-xs font-medium text-center mt-1">
                                  {dateObj.date}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-2 mt-3 justify-center text-xs">
                          {config.treatments
                            .filter((treatment, idx) => selectedTreatments.has(idx))
                            .map((treatment, idx) => {
                              const originalIdx = config.treatments.indexOf(treatment);
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: treatmentColors[originalIdx % treatmentColors.length] }}
                                  />
                                  <span>{treatment}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-600">
          {chartType === 'line' && lineGrouping === 'treatment' && (
            <>
              <p>Each treatment shows its timeline across all assessment dates with error bars (±SE)</p>
              <p>Separate charts allow easy comparison of individual treatment patterns over time</p>
            </>
          )}
          {chartType === 'line' && lineGrouping === 'date' && (
            <>
              <p>Lines show date progression across all treatments with error bars (±SE)</p>
              <p>Different colors represent different assessment dates</p>
            </>
          )}
          {chartType === 'box' && boxGrouping === 'treatment' && (
            <>
              <p>Traditional box-and-whisker plots for each treatment across all assessment dates</p>
              <p>Box shows Q1-Q3 (IQR), horizontal line is median, whiskers extend to min/max</p>
              <p>Letters indicate statistical groupings (LSD test)</p>
            </>
          )}
          {chartType === 'box' && boxGrouping === 'date' && (
            <>
              <p>Traditional box-and-whisker plots for each assessment date across all treatments</p>
              <p>Box shows Q1-Q3 (IQR), horizontal line is median, whiskers extend to min/max</p>
              <p>Letters indicate statistical groupings (LSD test)</p>
            </>
          )}
          {chartType === 'bar' && barGrouping === 'treatment' && (
            <>
              <p>Grouped bars show all assessment dates for each treatment with error bars (±SE)</p>
              <p>Different colors represent different dates - see legend below chart</p>
              <p>Letters show statistical groupings for the latest date (LSD test)</p>
            </>
          )}
          {chartType === 'bar' && barGrouping === 'date' && (
            <>
              <p>Grouped bars show all treatments for each assessment date with error bars (±SE)</p>
              <p>Different colors represent different treatments - see legend below chart</p>
              <p>Letters show statistical groupings for each date (LSD test)</p>
            </>
          )}
        </div>
      </div>

      {/* Genstat-Style Summary Statistics Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">Statistical Analysis - {selectedAssessmentType}</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="p-3 text-left bg-gray-100 font-bold">Treatment</th>
                {assessmentDates.map((dateObj, idx) => (
                  <th key={idx} className="p-3 text-center bg-gray-100 min-w-32">
                    <div className="text-xs font-normal text-gray-600">{dateObj.date}</div>
                    <div className="font-semibold mt-1">{calculateDAT(dateObj.date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.treatments.map((treatment, treatmentIdx) => (
                <tr key={treatmentIdx} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium bg-gray-50">
                    [{treatmentIdx + 1}] {treatment}
                  </td>
                  {assessmentDates.map((dateObj, dateIdx) => {
                    const stats = calculateStats(dateObj);
                    if (!stats) {
                      return <td key={dateIdx} className="p-3 text-center text-gray-400">-</td>;
                    }

                    const treatmentStat = stats.treatmentStats.find(ts => ts.treatment === treatmentIdx);
                    if (!treatmentStat) {
                      return <td key={dateIdx} className="p-3 text-center text-gray-400">-</td>;
                    }

                    return (
                      <td key={dateIdx} className="p-3 text-center font-mono">
                        {treatmentStat.mean.toFixed(2)}
                        {stats.anova.significant && treatmentStat.group && (
                          <span className="ml-1 font-bold text-blue-600">{treatmentStat.group}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Blank separator row */}
              <tr>
                <td colSpan={assessmentDates.length + 1} className="p-1"></td>
              </tr>

              {/* Summary statistics rows */}
              <tr className="border-b bg-gray-50">
                <td className="p-3 font-bold">P</td>
                {assessmentDates.map((dateObj, idx) => {
                  const stats = calculateStats(dateObj);
                  return (
                    <td key={idx} className="p-3 text-center font-mono">
                      {stats ? formatPValue(stats.anova.pValue) : '-'}
                    </td>
                  );
                })}
              </tr>

              <tr className="border-b bg-gray-50">
                <td className="p-3 font-bold">LSD</td>
                {assessmentDates.map((dateObj, idx) => {
                  const stats = calculateStats(dateObj);
                  return (
                    <td key={idx} className="p-3 text-center font-mono">
                      {stats ? (stats.anova.significant ? stats.lsd.toFixed(4) : '-') : '-'}
                    </td>
                  );
                })}
              </tr>

              <tr className="border-b bg-gray-50">
                <td className="p-3 font-bold">d.f.</td>
                {assessmentDates.map((dateObj, idx) => {
                  const stats = calculateStats(dateObj);
                  return (
                    <td key={idx} className="p-3 text-center font-mono">
                      {stats ? stats.anova.dfError : '-'}
                    </td>
                  );
                })}
              </tr>

              <tr className="border-b bg-gray-50">
                <td className="p-3 font-bold">%c.v.</td>
                {assessmentDates.map((dateObj, idx) => {
                  const stats = calculateStats(dateObj);
                  return (
                    <td key={idx} className="p-3 text-center font-mono">
                      {stats ? stats.anova.cv.toFixed(1) : '-'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>

          {/* ANOVA Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {assessmentDates.map((dateObj, idx) => {
              const stats = calculateStats(dateObj);
              if (!stats) return null;

              return (
                <div key={idx} className="p-4 bg-gray-50 rounded border">
                  <div className="font-semibold mb-3 text-base">
                    {dateObj.date} ({calculateDAT(dateObj.date)})
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>P-value:</span>
                      <span className="font-mono">{formatPValue(stats.anova.pValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>F-value:</span>
                      <span className="font-mono">{stats.anova.fValue.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>LSD (5%):</span>
                      <span className="font-mono">
                        {stats.anova.significant ? stats.lsd.toFixed(4) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>d.f. (error):</span>
                      <span className="font-mono">{stats.anova.dfError}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>%c.v.:</span>
                      <span className="font-mono">{stats.anova.cv.toFixed(1)}</span>
                    </div>
                    <div className={`pt-2 border-t ${stats.anova.significant ? 'text-green-600' : 'text-gray-600'} font-medium`}>
                      {stats.anova.significant ? '✓ Significant (p ≤ 0.05)' : '○ Not Significant (p > 0.05)'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ANOVA Table Detail for Latest Date */}
      {assessmentDates.length > 0 && (() => {
        const latestDate = assessmentDates[assessmentDates.length - 1];
        const stats = calculateStats(latestDate);
        if (!stats) return null;

        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4">
              ANOVA Table (Randomized Complete Block Design) - {latestDate.date} ({calculateDAT(latestDate.date)})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-100">
                    <th className="p-3 text-left">Source</th>
                    <th className="p-3 text-right">DF</th>
                    <th className="p-3 text-right">Sum of Squares</th>
                    <th className="p-3 text-right">Mean Square</th>
                    <th className="p-3 text-right">F-Value</th>
                    <th className="p-3 text-right">P-Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Block</td>
                    <td className="p-3 text-right font-mono">{stats.anova.dfBlock}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.ssBlock.toFixed(4)}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.msBlock.toFixed(4)}</td>
                    <td className="p-3 text-right text-gray-400">-</td>
                    <td className="p-3 text-right text-gray-400">-</td>
                  </tr>
                  <tr className="border-b bg-blue-50">
                    <td className="p-3 font-medium">Treatment</td>
                    <td className="p-3 text-right font-mono">{stats.anova.dfTreatment}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.ssTreatment.toFixed(4)}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.msTreatment.toFixed(4)}</td>
                    <td className="p-3 text-right font-mono font-bold">{stats.anova.fValue.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono font-bold">{formatPValue(stats.anova.pValue)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Residual</td>
                    <td className="p-3 text-right font-mono">{stats.anova.dfError}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.ssError.toFixed(4)}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.msError.toFixed(4)}</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">-</td>
                  </tr>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right font-mono">{stats.anova.dfTotal}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.ssTotal.toFixed(4)}</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm space-y-2">
              <div>
                <span className="font-medium">Grand Mean:</span>
                <span className="ml-2 font-mono">{stats.grandMean.toFixed(4)}</span>
              </div>
              <div>
                <span className="font-medium">Coefficient of Variation:</span>
                <span className="ml-2 font-mono">{stats.anova.cv.toFixed(1)}%</span>
              </div>
              <div>
                <span className="font-medium">Fisher's Protected LSD (5% level):</span>
                <span className="ml-2 font-mono">
                  {stats.anova.significant ? stats.lsd.toFixed(4) : 'Not applicable (p > 0.05)'}
                </span>
              </div>
              <div className="pt-2 border-t">
                <p className="font-medium mb-1">Interpretation:</p>
                <p>
                  {stats.anova.significant ? (
                    <>
                      Treatment effect is <strong>significant</strong> (p ≤ 0.05).
                      Treatments with different letter groups are significantly different from each other.
                      Letters are assigned in <strong>ascending</strong> order (lowest mean gets 'a').
                    </>
                  ) : (
                    <>
                      Treatment effect is <strong>not significant</strong> (p &gt; 0.05).
                      There are no statistically significant differences among treatments at the 5% significance level.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Analysis;
