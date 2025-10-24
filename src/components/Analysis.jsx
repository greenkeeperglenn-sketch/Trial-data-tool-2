import React from 'react';
import * as ss from 'simple-statistics';
import { jStat } from 'jstat';

const Analysis = ({ config, gridLayout, assessmentDates, selectedAssessmentType }) => {
  
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
                        <div className="text-xs mt-2 text-center">{dateObj.date}</div>
                        <div className="text-xs text-gray-600">{treatmentStat.group}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-600">
          <p>Each treatment shows box plots for all assessment dates side by side</p>
          <p>Different colors represent different assessment dates</p>
          <p>Letters below indicate statistical groupings (LSD test)</p>
        </div>
      </div>
    </div>
  );
};

export default Analysis;
