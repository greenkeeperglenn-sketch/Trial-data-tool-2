import React from 'react';
import * as ss from 'simple-statistics';
import { jStat } from 'jstat';

const Analysis = ({ config, gridLayout, assessmentDates, selectedAssessmentType }) => {

  // Safety checks
  if (!config || !gridLayout || !assessmentDates || !selectedAssessmentType) {
    return (
      <div className="p-8 bg-red-50 rounded-lg border border-red-200">
        <h3 className="text-lg font-bold text-red-800 mb-2">Unable to Load Analysis</h3>
        <p className="text-red-600">Missing required data. Please ensure you have:</p>
        <ul className="list-disc ml-6 mt-2 text-red-600">
          <li>Selected an assessment type</li>
          <li>Added assessment dates</li>
          <li>Entered some data</li>
        </ul>
      </div>
    );
  }

  if (assessmentDates.length === 0) {
    return (
      <div className="p-8 bg-yellow-50 rounded-lg border border-yellow-200">
        <h3 className="text-lg font-bold text-yellow-800 mb-2">No Assessment Dates</h3>
        <p className="text-yellow-600">Please add assessment dates to view analysis.</p>
      </div>
    );
  }

  // GenStat-style Fisher's LSD letter assignment algorithm
  const assignLetters = (sortedTreatments, lsd, significant) => {
    // Only assign letters if treatment effect is significant
    if (!significant) {
      return sortedTreatments.map(t => ({ ...t, group: '-' }));
    }

    const letters = {};

    if (sortedTreatments.length === 0) return [];

    // First treatment (lowest mean) gets 'a'
    letters[sortedTreatments[0].treatment] = 'a';

    // Each subsequent treatment
    for (let i = 1; i < sortedTreatments.length; i++) {
      const curr = sortedTreatments[i];
      const prev = sortedTreatments[i - 1];
      const prevLetters = letters[prev.treatment];

      // Compare with previous treatment
      if (Math.abs(curr.mean - prev.mean) > lsd) {
        // Significantly different: add new letter
        const lastLetter = prevLetters[prevLetters.length - 1];
        const nextLetter = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
        letters[curr.treatment] = prevLetters + nextLetter;
      } else {
        // Not significantly different: inherit letters + repeat last
        const lastLetter = prevLetters[prevLetters.length - 1];
        letters[curr.treatment] = prevLetters + lastLetter;
      }
    }

    // Clean up duplicate consecutive letters (e.g., 'aab' -> 'ab')
    const cleanLetters = (str) => {
      const unique = [];
      for (const char of str) {
        if (unique.length === 0 || unique[unique.length - 1] !== char) {
          unique.push(char);
        }
      }
      return unique.join('');
    };

    return sortedTreatments.map(t => ({
      ...t,
      group: cleanLetters(letters[t.treatment])
    }));
  };

  // Calculate RCBD ANOVA statistics for a single date
  const calculateStats = (dateObj) => {
    const assessmentData = dateObj.assessments[selectedAssessmentType];
    if (!assessmentData) return null;

    const allPlots = gridLayout.flat().filter(p => !p.isBlank);

    // Get all values with treatment and block info
    const values = allPlots
      .map(plot => {
        const v = assessmentData[plot.id];
        if (!v?.entered || v.value === '' || isNaN(parseFloat(v.value))) return null;
        return {
          treatment: plot.treatment,
          value: parseFloat(v.value),
          block: plot.block
        };
      })
      .filter(v => v !== null);

    if (values.length === 0) return null;

    // Get unique blocks and treatments
    const blocks = [...new Set(values.map(v => v.block))];
    const treatments = [...new Set(values.map(v => v.treatment))];
    const numBlocks = blocks.length;
    const numTreatments = treatments.length;
    const totalN = values.length;

    // Calculate grand mean and total
    const grandTotal = values.reduce((sum, v) => sum + v.value, 0);
    const grandMean = grandTotal / totalN;
    const correctionFactor = (grandTotal * grandTotal) / totalN;

    // Calculate block totals and means
    const blockTotals = {};
    blocks.forEach(b => {
      const blockValues = values.filter(v => v.block === b);
      blockTotals[b] = {
        total: blockValues.reduce((sum, v) => sum + v.value, 0),
        n: blockValues.length
      };
    });

    // Calculate treatment totals and means
    const treatmentTotals = {};
    treatments.forEach(t => {
      const treatValues = values.filter(v => v.treatment === t);
      treatmentTotals[t] = {
        total: treatValues.reduce((sum, v) => sum + v.value, 0),
        values: treatValues.map(v => v.value),
        n: treatValues.length,
        mean: treatValues.reduce((sum, v) => sum + v.value, 0) / treatValues.length
      };
    });

    // Sum of Squares calculations (RCBD method)
    // Total SS = Σ(Y²) - CF
    const ssTotal = values.reduce((sum, v) => sum + v.value * v.value, 0) - correctionFactor;

    // Block SS = Σ(Block totals² / n_treatments) - CF
    let ssBlock = 0;
    blocks.forEach(b => {
      const bt = blockTotals[b];
      ssBlock += (bt.total * bt.total) / bt.n;
    });
    ssBlock -= correctionFactor;

    // Treatment SS = Σ(Treatment totals² / n_blocks) - CF
    let ssTreatment = 0;
    treatments.forEach(t => {
      const tt = treatmentTotals[t];
      ssTreatment += (tt.total * tt.total) / tt.n;
    });
    ssTreatment -= correctionFactor;

    // Residual SS = Total SS - Block SS - Treatment SS
    const ssResidual = ssTotal - ssBlock - ssTreatment;

    // Degrees of freedom (RCBD)
    const dfBlock = numBlocks - 1;
    const dfTreatment = numTreatments - 1;
    const dfResidual = (numBlocks - 1) * (numTreatments - 1);
    const dfTotal = totalN - 1;

    // Mean squares
    const msBlock = dfBlock > 0 ? ssBlock / dfBlock : 0;
    const msTreatment = dfTreatment > 0 ? ssTreatment / dfTreatment : 0;
    const msResidual = dfResidual > 0 ? ssResidual / dfResidual : 0;

    // F-statistics (variance ratios)
    const fBlock = msResidual > 0 ? msBlock / msResidual : 0;
    const fTreatment = msResidual > 0 ? msTreatment / msResidual : 0;

    // P-value for treatment effect
    const pValue = dfTreatment > 0 && dfResidual > 0 && fTreatment > 0
      ? 1 - jStat.centralF.cdf(fTreatment, dfTreatment, dfResidual)
      : 1;
    const significant = pValue < 0.05;

    // Standard errors (GenStat formulas)
    const replicates = numBlocks;
    const ese = msResidual > 0 ? Math.sqrt(msResidual / replicates) : 0;  // e.s.e.
    const sed = msResidual > 0 ? Math.sqrt(2 * msResidual / replicates) : 0;  // s.e.d.

    // Fisher's LSD
    const tCritical = dfResidual > 0 ? jStat.studentt.inv(0.975, dfResidual) : 2.064;
    const lsd = sed * tCritical;

    // Build treatment stats and assign letter groups
    const treatmentStats = treatments.map(t => ({
      treatment: t,
      treatmentName: config.treatments[t] || `Treatment ${t + 1}`,
      mean: treatmentTotals[t].mean,
      n: treatmentTotals[t].n,
      values: treatmentTotals[t].values
    }));

    // Sort by mean ASCENDING for GenStat-style letter assignment
    const sortedStats = [...treatmentStats].sort((a, b) => a.mean - b.mean);

    // Assign letters using GenStat algorithm
    const statsWithLetters = assignLetters(sortedStats, lsd, significant);

    // Create lookup for letters by treatment
    const letterLookup = {};
    statsWithLetters.forEach(s => {
      letterLookup[s.treatment] = s.group;
    });

    // Add letters back to original treatment order
    const finalStats = treatmentStats.map(ts => ({
      ...ts,
      group: letterLookup[ts.treatment],
      stdError: ese
    }));

    return {
      treatmentStats: finalStats,
      sortedStats: statsWithLetters,
      anova: {
        ssBlock,
        ssTreatment,
        ssResidual,
        ssTotal,
        dfBlock,
        dfTreatment,
        dfResidual,
        dfTotal,
        msBlock,
        msTreatment,
        msResidual,
        fBlock,
        fTreatment,
        pValue,
        significant
      },
      standardErrors: {
        ese,
        sed,
        lsd,
        replicates
      },
      grandMean
    };
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics Table with Significance */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">Statistical Analysis - {selectedAssessmentType}</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
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
                          {treatmentStat.mean.toFixed(2)} ± {treatmentStat.stdError.toFixed(3)}
                        </div>
                        {stats.anova.significant ? (
                          <div className="text-xs font-bold text-blue-600">
                            ({treatmentStat.group})
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">
                            (NS)
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Significance row at bottom of table */}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="p-3 font-semibold">Significance</td>
                {assessmentDates.map((dateObj, dateIdx) => {
                  const stats = calculateStats(dateObj);
                  if (!stats) {
                    return <td key={dateIdx} className="p-3 text-center text-gray-400">-</td>;
                  }

                  return (
                    <td key={dateIdx} className="p-3 text-center">
                      <div className={`font-semibold ${stats.anova.significant ? 'text-green-600' : 'text-gray-500'}`}>
                        {stats.anova.significant ? '✓ Sig.' : 'NS'}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        p = {stats.anova.pValue < 0.001 ? '<0.001' : stats.anova.pValue.toFixed(3)}
                      </div>
                      <div className="text-xs text-gray-500">
                        F = {stats.anova.fTreatment.toFixed(2)}
                      </div>
                      {stats.anova.significant && (
                        <div className="text-xs text-gray-500">
                          LSD: {stats.standardErrors.lsd.toFixed(3)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>

          <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
            <p className="text-gray-700">
              <strong>RCBD Analysis:</strong> Treatments with different letters are significantly different (p &lt; 0.05).
              Letters only shown when treatment effect is significant. LSD = Fisher's Least Significant Difference.
            </p>
          </div>
        </div>
      </div>

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
                    if (!treatmentStat || !treatmentStat.values || treatmentStat.values.length === 0) return null;

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
                    const allValues = allStats.flatMap(s => s.treatmentStats.flatMap(ts => ts.values || []));
                    if (allValues.length === 0) return null;

                    const globalMin = Math.min(...allValues);
                    const globalMax = Math.max(...allValues);
                    const range = globalMax - globalMin || 1;

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
                              height: `${Math.max(0, scale(q1) - scale(min))}px`
                            }}
                          />
                          {/* Whisker to max */}
                          <div
                            className="absolute left-1/2 w-0.5 bg-black -translate-x-1/2"
                            style={{
                              bottom: `${scale(q3)}px`,
                              height: `${Math.max(0, scale(max) - scale(q3))}px`
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
          <p>Letters below indicate statistical groupings (Fisher's protected LSD test)</p>
        </div>
      </div>
    </div>
  );
};

export default Analysis;
