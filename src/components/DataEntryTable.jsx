import React from 'react';

const DataEntryTable = ({
  config,
  gridLayout,
  currentDateObj,
  selectedAssessmentType,
  onUpdateData
}) => {
  const assessment = config.assessmentTypes.find(a => a.name === selectedAssessmentType);
  const allPlots = gridLayout.flat().filter(p => !p.isBlank);

  return (
    <div className="bg-white p-4 rounded-lg shadow overflow-x-auto">
      <h3 className="text-lg font-bold mb-4">
        {currentDateObj.date} - {selectedAssessmentType}
      </h3>
      
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300 bg-gray-50">
            <th className="p-3 text-left font-semibold">Plot ID</th>
            <th className="p-3 text-left font-semibold">Block</th>
            <th className="p-3 text-left font-semibold">Treatment</th>
            <th className="p-3 text-left font-semibold">Value ({assessment?.min}-{assessment?.max})</th>
          </tr>
        </thead>
        <tbody>
          {allPlots.map((plot, idx) => {
            const plotData = currentDateObj.assessments[selectedAssessmentType][plot.id];
            
            return (
              <tr key={idx} className="border-b hover:bg-gray-50 transition">
                <td className="p-3 font-medium">{plot.id}</td>
                <td className="p-3">{plot.block}</td>
                <td className="p-3">{plot.treatmentName}</td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.1"
                    min={assessment?.min}
                    max={assessment?.max}
                    value={plotData?.value || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (parseFloat(val) >= assessment.min && parseFloat(val) <= assessment.max)) {
                        onUpdateData(currentDateObj.date, selectedAssessmentType, plot.id, val);
                      }
                    }}
                    className="w-32 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`${assessment?.min}-${assessment?.max}`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Total Plots:</strong> {allPlots.length}</p>
        <p><strong>Completed:</strong> {allPlots.filter(p => currentDateObj.assessments[selectedAssessmentType][p.id]?.entered).length}</p>
      </div>
    </div>
  );
};

export default DataEntryTable;
