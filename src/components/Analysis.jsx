import React from 'react';
import * as ss from 'simple-statistics';
import { jStat } from 'jstat';

const Analysis = ({ config, gridLayout, assessmentDates, selectedAssessmentType }) => {
  
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

  return (
    <div className="space-y-6">
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

      {/* Box Plots */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">Box Plots - All Assessment Dates</h3>
        <div className="overflow-x-auto">
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
                        <div className="text-xs mt-2 text-center">{calculateDAT(dateObj.date)}</div>
                        <div className="text-xs text-blue-600 font-bold">
                          {stats.anova.significant && treatmentStat.group ? treatmentStat.group : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-600 space-y-1">
          <p>Each treatment shows box plots for all assessment dates side by side.</p>
          <p>Different colors represent different assessment dates.</p>
          <p>
            Letters below indicate statistical groupings from Fisher's Protected LSD test
            (shown only when p ≤ 0.05, ascending order: lowest mean gets 'a').
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analysis;
