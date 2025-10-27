import React, { useState } from 'react';
import { Eye, Camera, Plus, RotateCw } from 'lucide-react';

const DataEntryField = ({
  config,
  gridLayout,
  currentDateObj,
  selectedAssessmentType,
  photos,
  onUpdateData,
  onPhotosChange,
  orientation = 0
}) => {
  const [showTreatments, setShowTreatments] = useState(false);
  const [reverseColorScale, setReverseColorScale] = useState(false);

  // Validate gridLayout
  if (!gridLayout || !Array.isArray(gridLayout) || gridLayout.length === 0) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800">Error: Invalid grid layout. Please check the trial data.</p>
      </div>
    );
  }

  // Filter out any undefined blocks
  const validGridLayout = gridLayout.filter(block => block && Array.isArray(block));

  if (validGridLayout.length === 0) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800">Error: No valid blocks found in grid layout.</p>
      </div>
    );
  }

  const assessment = config.assessmentTypes.find(a => a.name === selectedAssessmentType);

  // Get color based on value
  const getValueColor = (value) => {
    if (!value || value === '') return 'bg-white border-gray-300';
    
    const numValue = parseFloat(value);
    const allValues = Object.values(currentDateObj.assessments[selectedAssessmentType])
      .filter(v => v.entered && v.value !== '')
      .map(v => parseFloat(v.value));
    
    if (allValues.length === 0) return 'bg-white border-gray-300';
    
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;
    
    if (range === 0) return 'bg-green-300 border-green-500';
    
    let normalized = Math.max(0, Math.min(1, (numValue - min) / range));
    if (reverseColorScale) normalized = 1 - normalized;
    
    if (normalized < 0.1) return 'bg-white border-gray-300';
    else if (normalized < 0.2) return 'bg-green-50 border-green-200';
    else if (normalized < 0.3) return 'bg-green-100 border-green-300';
    else if (normalized < 0.4) return 'bg-green-200 border-green-400';
    else if (normalized < 0.5) return 'bg-green-300 border-green-500';
    else if (normalized < 0.6) return 'bg-green-400 border-green-600';
    else if (normalized < 0.7) return 'bg-green-500 border-green-700 text-black';
    else if (normalized < 0.8) return 'bg-green-600 border-green-800 text-black';
    else if (normalized < 0.9) return 'bg-green-700 border-green-900 text-black';
    else return 'bg-green-800 border-green-950 text-black';
  };

  // Generate test data
  const generateTestData = () => {
    if (!currentDateObj || !selectedAssessmentType) return;
    
    const bestTreatment = Math.floor(Math.random() * config.numTreatments);
    const range = assessment.max - assessment.min;
    const midPoint = assessment.min + (range * 0.6);
    
    validGridLayout.flat().filter(p => !p.isBlank).forEach(plot => {
      let value;
      if (plot.treatment === bestTreatment) {
        value = midPoint + (range * 0.15) + (Math.random() * range * 0.15);
      } else {
        value = midPoint - (range * 0.1) + (Math.random() * range * 0.25);
      }
      value = Math.max(assessment.min, Math.min(assessment.max, Math.round(value * 10) / 10));
      onUpdateData(currentDateObj.date, selectedAssessmentType, plot.id, value.toString());
    });
  };

  // Handle photo upload
  const handlePhotoUpload = (plotId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const key = `${currentDateObj.date}_${plotId}`;
      onPhotosChange({
        ...photos,
        [key]: [...(photos[key] || []), event.target.result]
      });
    };
    reader.readAsDataURL(file);
  };

  // Calculate statistics
  const calculateStats = () => {
    const allValues = Object.values(currentDateObj.assessments[selectedAssessmentType])
      .filter(v => v.entered && v.value !== '')
      .map(v => parseFloat(v.value));

    if (allValues.length === 0) return null;

    const sum = allValues.reduce((acc, val) => acc + val, 0);
    const average = sum / allValues.length;
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    return { average, min, max, count: allValues.length };
  };

  const stats = calculateStats();

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4">
        {currentDateObj.date} - {selectedAssessmentType}
      </h3>

      {/* Statistics Summary */}
      {stats && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <div className="text-center">
              <div className="text-xs font-medium text-gray-600 mb-1">MINIMUM</div>
              <div className="text-2xl font-bold text-blue-600">{stats.min.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-gray-600 mb-1">AVERAGE</div>
              <div className="text-4xl font-bold text-indigo-700">{stats.average.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-gray-600 mb-1">MAXIMUM</div>
              <div className="text-2xl font-bold text-blue-600">{stats.max.toFixed(1)}</div>
            </div>
          </div>
          <div className="text-center mt-2 text-xs text-gray-600">
            Based on {stats.count} plot{stats.count !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Controls and Compass */}
      <div className="mb-4 flex gap-2 flex-wrap items-start">
        <button
          onMouseDown={() => setShowTreatments(true)}
          onMouseUp={() => setShowTreatments(false)}
          onMouseLeave={() => setShowTreatments(false)}
          onTouchStart={() => setShowTreatments(true)}
          onTouchEnd={() => setShowTreatments(false)}
          className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <Eye size={20} className="inline mr-2" /> Hold to Show Treatments
        </button>

        <button
          onClick={generateTestData}
          className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
        >
          <Plus size={20} className="inline mr-2" /> Fill Test Data
        </button>

        <button
          onClick={() => setReverseColorScale(!reverseColorScale)}
          className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 transition"
        >
          <RotateCw size={20} /> {reverseColorScale ? 'Dark = High' : 'Dark = Low'}
        </button>

        {/* Compass */}
        <div className="flex flex-col items-center gap-1 ml-auto">
          <div className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
            ORIENTATION
          </div>
          <div className="relative w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full shadow-lg border-2 border-blue-300">
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `rotate(${orientation}deg)` }}
            >
              {/* North Arrow */}
              <div className="absolute top-0.5 left-1/2 -translate-x-1/2">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-red-600"></div>
                <div className="text-[10px] font-bold text-red-600 text-center">N</div>
              </div>

              {/* South */}
              <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                <div className="text-[10px] font-semibold text-gray-600">S</div>
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[8px] border-t-gray-600"></div>
              </div>

              {/* East */}
              <div className="absolute right-0.5 top-1/2 -translate-y-1/2">
                <div className="text-[10px] font-semibold text-gray-600">E</div>
              </div>

              {/* West */}
              <div className="absolute left-0.5 top-1/2 -translate-y-1/2">
                <div className="text-[10px] font-semibold text-gray-600">W</div>
              </div>

              {/* Center Dot */}
              <div className="w-1.5 h-1.5 bg-gray-800 rounded-full"></div>
            </div>
          </div>
          <div className="text-[10px] font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
            {orientation}°
          </div>
        </div>
      </div>

      {/* Field Grid */}
      <div className="overflow-x-auto mb-4">
        <div className="space-y-2">
          {validGridLayout.map((row, rowIdx) => (
            <div key={rowIdx} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
              {row.map((plot, colIdx) => {
                if (plot.isBlank) {
                  return (
                    <div key={colIdx} className="aspect-square border-2 border-dashed border-gray-300 bg-gray-100 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-400">Blank</span>
                    </div>
                  );
                }
                
                const plotData = currentDateObj.assessments[selectedAssessmentType][plot.id];
                const colorClass = getValueColor(plotData?.value);
                const photoKey = `${currentDateObj.date}_${plot.id}`;
                const plotPhotos = photos[photoKey] || [];
                
                return (
                  <div key={colIdx} className={`aspect-square p-1 border-2 rounded ${colorClass} transition-colors flex flex-col`}>
                    <div className="text-xs font-medium truncate">{plot.id}</div>
                    {showTreatments && (
                      <div className="text-xs font-semibold bg-white/90 px-1 rounded truncate">
                        {plot.treatmentName}
                      </div>
                    )}
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
                      className="w-full p-0.5 text-xs border rounded bg-white flex-1"
                      placeholder={`${assessment?.min}-${assessment?.max}`}
                    />
                    <label className="block">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handlePhotoUpload(plot.id, e)} 
                        className="hidden" 
                      />
                      <div className="text-xs text-center bg-blue-100 hover:bg-blue-200 p-0.5 rounded cursor-pointer">
                        <Camera size={10} className="inline" /> {plotPhotos.length > 0 ? plotPhotos.length : '+'}
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Color Legend */}
      <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
        {(() => {
          const allValues = Object.values(currentDateObj.assessments[selectedAssessmentType])
            .filter(v => v.entered && v.value !== '')
            .map(v => parseFloat(v.value));
          
          if (allValues.length === 0) {
            return <div className="text-gray-600">Enter data to see color scale</div>;
          }
          
          const actualMin = Math.min(...allValues).toFixed(1);
          const actualMax = Math.max(...allValues).toFixed(1);
          
          return (
            <>
              <div className="font-medium mb-2">
                Color Scale - Data Range: {actualMin} to {actualMax} (Scale: {assessment?.min}-{assessment?.max})
                {reverseColorScale && <span className="ml-2 text-orange-600">⚠️ Reversed</span>}
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 text-xs">
                {[
                  { bg: 'bg-white border-2 border-gray-300', label: reverseColorScale ? 'High' : 'Low' },
                  { bg: 'bg-green-50 border-2 border-green-200', label: '10%' },
                  { bg: 'bg-green-100 border-2 border-green-300', label: '20%' },
                  { bg: 'bg-green-200 border-2 border-green-400', label: '30%' },
                  { bg: 'bg-green-300 border-2 border-green-500', label: '40%' },
                  { bg: 'bg-green-400 border-2 border-green-600', label: '50%' },
                  { bg: 'bg-green-500 border-2 border-green-700', label: '60%' },
                  { bg: 'bg-green-600 border-2 border-green-800', label: '70%' },
                  { bg: 'bg-green-700 border-2 border-green-900', label: '80%' },
                  { bg: 'bg-green-800 border-2 border-green-950', label: reverseColorScale ? 'Low' : 'High' }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className={`w-full h-8 ${item.bg} rounded`}></div>
                    <span className="mt-1">{item.label}</span>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default DataEntryField;
