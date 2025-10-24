import React, { useState } from 'react';
import * as ss from 'simple-statistics';
import { jStat } from 'jstat';
import { LineChart, BarChart3, Box } from 'lucide-react';

const Analysis = ({ config, gridLayout, assessmentDates, selectedAssessmentType }) => {
  const [chartType, setChartType] = useState('box'); // 'line', 'box', 'bar'
  
  // Calculate comprehensive statistics for a single date
  const calculateStats = (dateObj) => {
    const assessmentData = dateObj.assessments[selectedAssessmentType];
    const allPlots = gridLayout.flat().filter(p => !p.isBlank);
    
    // Get all values with treatment info
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
    
    // Calculate means, std dev, and std error for each treatment
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
    
    // ANOVA calculation
    const grandMean = ss.mean(values.map(v => v.value));
    const numTreatments = Object.keys(treatmentGroups).length;
    const totalN = values.length;
    
    // Sum of squares between treatments (SST)
    let ssTreatment = 0;
    treatmentStats.forEach(ts => {
      ssTreatment += ts.n * Math.pow(ts.mean - grandMean, 2);
    });
    
    // Sum of squares within treatments (SSE)
    let ssError = 0;
    values.forEach(v => {
      const treatmentMean = treatmentStats.find(ts => ts.treatment === v.treatment).mean;
      ssError += Math.pow(v.value - treatmentMean, 2);
    });
    
    // Degrees of freedom
    const dfTreatment = numTreatments - 1;
    const dfError = totalN - numTreatments;
    const dfTotal = totalN - 1;
    
    // Mean squares
    const msTreatment = ssTreatment / dfTreatment;
    const msError = ssError / dfError;
    
    // F-statistic
    const fValue = msTreatment / msError;
    
    // P-value using F-distribution
    const pValue = 1 - jStat.centralF.cdf(fValue, dfTreatment, dfError);
    const significant = pValue < 0.05;
    
    // Fisher's LSD
    const tCritical = jStat.studentt.inv(0.975, dfError); // 95% confidence
    const lsd = tCritical * Math.sqrt(2 * msError / config.numBlocks);
    
    // Assign letter groups based on LSD
    const sortedStats = [...treatmentStats].sort((a, b) => b.mean - a.mean);
    const groups = sortedStats.map((stat, idx) => {
      let group = String.fromCharCode(97 + idx); // Start with 'a', 'b', etc.
      
      // Check if this treatment is not significantly different from any higher-ranked treatment
      for (let i = 0; i < idx; i++) {
        if (Math.abs(stat.mean - sortedStats[i].mean) <= lsd) {
          group = String.fromCharCode(97 + i);
          break;
        }
      }
      
      return { ...stat, group };
    });
    
    return {
      treatmentStats: groups,
      anova: {
        ssTreatment,
        ssError,
        ssTotal: ssTreatment + ssError,
        dfTreatment,
        dfError,
        dfTotal,
        msTreatment,
        msError,
        fValue,
        pValue,
        significant
      },
      lsd
    };
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">Statistical Analysis - {selectedAssessmentType}</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="p-3 text-left bg-gray-100">Treatment</th>
                {assessmentDates.map((dateObj, idx) => (
                  <th key={idx} className="p-3 text-center bg-gray-100 min-w-40">
                    <div className="font-semibold">{dateObj.date}</div>
                    <div className="text-xs font-normal text-gray-600 mt-1">Mean ± SE (Group)</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.treatments.map((treatment, treatmentIdx) => (
                <tr key={treatmentIdx} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium bg-gray-50">{treatment}</td>
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
                      <td key={dateIdx} className="p-3 text-center">
                        <div className="font-medium">
                          {treatmentStat.mean.toFixed(2)} ± {treatmentStat.stdError.toFixed(2)}
                        </div>
                        <div className="text-xs font-bold text-blue-600">
                          ({treatmentStat.group})
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Statistical Summary Rows */}
              <tr className="border-t-2 border-gray-400 bg-blue-50">
                <td className="p-3 font-bold">F-value</td>
                {assessmentDates.map((dateObj, dateIdx) => {
                  const stats = calculateStats(dateObj);
                  return (
                    <td key={dateIdx} className="p-3 text-center font-mono">
                      {stats ? stats.anova.fValue.toFixed(3) : '-'}
                    </td>
                  );
                })}
              </tr>

              <tr className="bg-blue-50">
                <td className="p-3 font-bold">P-value</td>
                {assessmentDates.map((dateObj, dateIdx) => {
                  const stats = calculateStats(dateObj);
                  return (
                    <td key={dateIdx} className="p-3 text-center font-mono">
                      {stats ? stats.anova.pValue.toFixed(4) : '-'}
                    </td>
                  );
                })}
              </tr>

              <tr className="bg-blue-50">
                <td className="p-3 font-bold">LSD (95%)</td>
                {assessmentDates.map((dateObj, dateIdx) => {
                  const stats = calculateStats(dateObj);
                  return (
                    <td key={dateIdx} className="p-3 text-center font-mono">
                      {stats ? stats.lsd.toFixed(3) : '-'}
                    </td>
                  );
                })}
              </tr>

              <tr className="bg-blue-50 border-b">
                <td className="p-3 font-bold">Significance</td>
                {assessmentDates.map((dateObj, dateIdx) => {
                  const stats = calculateStats(dateObj);
                  if (!stats) return <td key={dateIdx} className="p-3 text-center">-</td>;
                  return (
                    <td key={dateIdx} className={`p-3 text-center font-medium ${stats.anova.significant ? 'text-green-600' : 'text-gray-500'}`}>
                      {stats.anova.significant ? '✓ p < 0.05' : '○ n.s.'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
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
              ANOVA Table - {latestDate.date}
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
                    <td className="p-3 font-medium">Treatment</td>
                    <td className="p-3 text-right font-mono">{stats.anova.dfTreatment}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.ssTreatment.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.msTreatment.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.fValue.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.pValue.toFixed(4)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Error</td>
                    <td className="p-3 text-right font-mono">{stats.anova.dfError}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.ssError.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.msError.toFixed(3)}</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">-</td>
                  </tr>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right font-mono">{stats.anova.dfTotal}</td>
                    <td className="p-3 text-right font-mono">{stats.anova.ssTotal.toFixed(3)}</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
              <p className="font-medium mb-1">Interpretation:</p>
              <p>
                Fisher's LSD at 95% confidence: {stats.lsd.toFixed(3)}. 
                Treatments with different letters are significantly different at p &lt; 0.05.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Charts */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Data Visualization - All Assessment Dates</h3>

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

        <div className="overflow-x-auto">
          {/* Line Chart */}
          {chartType === 'line' && (
            <div className="min-w-max">
              {(() => {
                // Calculate data for all treatments across dates
                const allStats = assessmentDates.map(d => calculateStats(d)).filter(s => s !== null);
                if (allStats.length === 0) return <p className="text-gray-500">No data available</p>;

                const allValues = allStats.flatMap(s => s.treatmentStats.flatMap(ts => ts.values));
                const globalMin = Math.min(...allValues);
                const globalMax = Math.max(...allValues);
                const range = globalMax - globalMin;
                const padding = range * 0.1;

                const chartHeight = 300;
                const chartWidth = Math.max(600, assessmentDates.length * 100);
                const scale = (val) => chartHeight - ((val - (globalMin - padding)) / (range + 2 * padding)) * chartHeight;

                const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16', '#eab308', '#ef4444', '#06b6d4'];

                return (
                  <div className="relative" style={{ height: chartHeight + 60, width: chartWidth }}>
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between text-xs text-gray-600">
                      <span>{(globalMax + padding).toFixed(1)}</span>
                      <span>{((globalMax + globalMin) / 2).toFixed(1)}</span>
                      <span>{(globalMin - padding).toFixed(1)}</span>
                    </div>

                    {/* Chart area */}
                    <svg className="absolute left-12 top-0" width={chartWidth - 48} height={chartHeight}>
                      {/* Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => (
                        <line
                          key={i}
                          x1="0"
                          y1={chartHeight * fraction}
                          x2={chartWidth - 48}
                          y2={chartHeight * fraction}
                          stroke="#e5e7eb"
                          strokeWidth="1"
                        />
                      ))}

                      {/* Lines for each treatment */}
                      {config.treatments.map((treatment, treatmentIdx) => {
                        const points = assessmentDates.map((dateObj, dateIdx) => {
                          const stats = calculateStats(dateObj);
                          if (!stats) return null;
                          const treatmentStat = stats.treatmentStats.find(ts => ts.treatment === treatmentIdx);
                          if (!treatmentStat) return null;

                          const x = (dateIdx / (assessmentDates.length - 1)) * (chartWidth - 48);
                          const y = scale(treatmentStat.mean);
                          return { x, y, mean: treatmentStat.mean, se: treatmentStat.stdError };
                        }).filter(p => p !== null);

                        if (points.length === 0) return null;

                        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                        return (
                          <g key={treatmentIdx}>
                            {/* Line */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke={colors[treatmentIdx % colors.length]}
                              strokeWidth="2"
                            />
                            {/* Points with error bars */}
                            {points.map((p, i) => (
                              <g key={i}>
                                {/* Error bar */}
                                <line
                                  x1={p.x}
                                  y1={scale(p.mean - p.se)}
                                  x2={p.x}
                                  y2={scale(p.mean + p.se)}
                                  stroke={colors[treatmentIdx % colors.length]}
                                  strokeWidth="1"
                                />
                                {/* Point */}
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="4"
                                  fill={colors[treatmentIdx % colors.length]}
                                  stroke="white"
                                  strokeWidth="2"
                                />
                              </g>
                            ))}
                          </g>
                        );
                      })}
                    </svg>

                    {/* X-axis labels */}
                    <div className="absolute left-12 bottom-0 right-0 flex justify-between text-xs text-gray-600">
                      {assessmentDates.map((dateObj, idx) => (
                        <div key={idx} className="text-center" style={{ width: '1px' }}>
                          <div className="transform -rotate-45 origin-top-left whitespace-nowrap">
                            {dateObj.date}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Legend */}
                    <div className="absolute top-0 right-0 bg-white border rounded p-2 text-xs">
                      {config.treatments.map((treatment, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-1">
                          <div
                            className="w-4 h-0.5"
                            style={{ backgroundColor: colors[idx % colors.length] }}
                          />
                          <span>{treatment}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Box Plot */}
          {chartType === 'box' && (
            <div className="flex gap-8 items-end min-w-max pb-8">
              {config.treatments.map((treatment, treatmentIdx) => (
                <div key={treatmentIdx} className="flex flex-col items-center">
                  <div className="text-sm font-medium mb-2">{treatment}</div>
                  <div className="flex gap-2 items-end h-64">
                    {assessmentDates.map((dateObj, dateIdx) => {
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

                      // Get global min/max for scaling
                      const allStats = assessmentDates
                        .map(d => calculateStats(d))
                        .filter(s => s !== null);
                      const allValues = allStats.flatMap(s => s.treatmentStats.flatMap(ts => ts.values));
                      const globalMin = Math.min(...allValues);
                      const globalMax = Math.max(...allValues);
                      const range = globalMax - globalMin;

                      const scale = (val) => ((val - globalMin) / range) * 200;

                      const colors = [
                        'bg-blue-200 border-blue-400',
                        'bg-purple-200 border-purple-400',
                        'bg-pink-200 border-pink-400',
                        'bg-orange-200 border-orange-400',
                        'bg-teal-200 border-teal-400'
                      ];
                      const colorClass = colors[dateIdx % colors.length];

                      return (
                        <div key={dateIdx} className="flex flex-col items-center">
                          <div className="relative h-48 w-12 bg-gray-100 rounded border">
                            {/* Box (Q1 to Q3) */}
                            <div
                              className={`absolute w-full ${colorClass} border-2`}
                              style={{
                                bottom: `${scale(q1)}px`,
                                height: `${Math.max(2, scale(q3) - scale(q1))}px`
                              }}
                            />
                            {/* Median line */}
                            <div
                              className="absolute w-full h-1 bg-black"
                              style={{ bottom: `${scale(median)}px` }}
                            />
                            {/* Whisker to min */}
                            <div
                              className="absolute left-1/2 w-0.5 bg-black -translate-x-1/2"
                              style={{
                                bottom: `${scale(min)}px`,
                                height: `${scale(q1) - scale(min)}px`
                              }}
                            />
                            {/* Whisker to max */}
                            <div
                              className="absolute left-1/2 w-0.5 bg-black -translate-x-1/2"
                              style={{
                                bottom: `${scale(q3)}px`,
                                height: `${scale(max) - scale(q3)}px`
                              }}
                            />
                          </div>
                          <div className="text-xs mt-2 text-center">{dateObj.date}</div>
                          <div className="text-xs text-gray-600">{treatmentStat.group}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bar Chart */}
          {chartType === 'bar' && (
            <div className="min-w-max">
              {(() => {
                const allStats = assessmentDates.map(d => calculateStats(d)).filter(s => s !== null);
                if (allStats.length === 0) return <p className="text-gray-500">No data available</p>;

                const allValues = allStats.flatMap(s => s.treatmentStats.flatMap(ts => ts.values));
                const globalMax = Math.max(...allValues);
                const chartHeight = 350;
                const barWidth = 30;

                const dateColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16', '#eab308', '#ef4444', '#06b6d4', '#10b981', '#f59e0b', '#6366f1'];

                return (
                  <div>
                    <div className="flex gap-8 items-end pb-8" style={{ height: chartHeight + 100 }}>
                      {/* Y-axis */}
                      <div className="flex flex-col justify-between text-xs text-gray-600 h-full pb-16">
                        <span>{globalMax.toFixed(1)}</span>
                        <span>{(globalMax * 0.75).toFixed(1)}</span>
                        <span>{(globalMax * 0.5).toFixed(1)}</span>
                        <span>{(globalMax * 0.25).toFixed(1)}</span>
                        <span>0</span>
                      </div>

                      {/* Bar groups for each treatment */}
                      {config.treatments.map((treatment, treatmentIdx) => {
                        const groupWidth = assessmentDates.length * (barWidth + 4);

                        return (
                          <div key={treatmentIdx} className="flex flex-col items-center" style={{ width: groupWidth + 'px' }}>
                            <div className="flex gap-1 items-end h-full pb-4">
                              {assessmentDates.map((dateObj, dateIdx) => {
                                const stats = calculateStats(dateObj);
                                if (!stats) return <div key={dateIdx} style={{ width: barWidth + 'px' }} />;

                                const treatmentStat = stats.treatmentStats.find(ts => ts.treatment === treatmentIdx);
                                if (!treatmentStat) return <div key={dateIdx} style={{ width: barWidth + 'px' }} />;

                                const barHeight = (treatmentStat.mean / globalMax) * (chartHeight - 60);
                                const errorBarHeight = (treatmentStat.stdError / globalMax) * (chartHeight - 60);

                                return (
                                  <div key={dateIdx} className="flex flex-col items-center" style={{ width: barWidth + 'px' }}>
                                    {/* Value label */}
                                    <div className="text-xs font-medium mb-1 text-center whitespace-nowrap" style={{ fontSize: '10px' }}>
                                      {treatmentStat.mean.toFixed(1)}
                                    </div>
                                    {/* Letter group (only show on last date) */}
                                    {dateIdx === assessmentDates.length - 1 && (
                                      <div className="text-xs text-blue-600 font-bold mb-1" style={{ fontSize: '10px' }}>
                                        ({treatmentStat.group})
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
                            <div className="text-sm font-medium text-center mt-2">
                              {treatment}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 mt-4 justify-center text-xs">
                      {assessmentDates.map((dateObj, idx) => (
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
                );
              })()}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-600">
          {chartType === 'line' && (
            <>
              <p>Lines show treatment means across all assessment dates with error bars (±SE)</p>
              <p>Different colors represent different treatments</p>
            </>
          )}
          {chartType === 'box' && (
            <>
              <p>Each treatment shows box plots for all assessment dates side by side</p>
              <p>Different colors represent different assessment dates</p>
              <p>Letters below indicate statistical groupings (LSD test)</p>
            </>
          )}
          {chartType === 'bar' && (
            <>
              <p>Grouped bars show all assessment dates for each treatment with error bars (±SE)</p>
              <p>Different colors represent different dates - see legend below chart</p>
              <p>Letters show statistical groupings for the latest date (LSD test)</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analysis;
