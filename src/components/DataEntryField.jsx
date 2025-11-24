import React, { useState } from 'react';
import { Eye, Camera, Plus, RotateCw } from 'lucide-react';
import { uploadPlotImage } from '../services/storage';

const DataEntryField = ({
  trialId,
  config,
  gridLayout,
  currentDateObj,
  selectedAssessmentType,
  photos,
  onUpdateData,
  onPhotosChange
}) => {
  const [showTreatments, setShowTreatments] = useState(false);
  const [reverseColorScale, setReverseColorScale] = useState(false);

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
    
    if (normalized < 0.1) return 'bg-white border-gray-300 text-black';
    else if (normalized < 0.2) return 'bg-green-50 border-green-200 text-black';
    else if (normalized < 0.3) return 'bg-green-100 border-green-300 text-black';
    else if (normalized < 0.4) return 'bg-green-200 border-green-400 text-black';
    else if (normalized < 0.5) return 'bg-green-300 border-green-500 text-black';
    else if (normalized < 0.6) return 'bg-green-400 border-green-600 text-black';
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
    
    gridLayout.flat().filter(p => !p.isBlank).forEach(plot => {
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
  const handlePhotoUpload = async (plotId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const key = `${currentDateObj.date}_${plotId}`;
      const existingPhotos = photos[key] || [];
      const index = existingPhotos.length;

      // Upload to Supabase Storage
      const storagePath = await uploadPlotImage(
        trialId,
        currentDateObj.date,
        plotId,
        file,
        index
      );

      // Update photos state with storage path
      onPhotosChange({
        ...photos,
        [key]: [...existingPhotos, storagePath]
      });

      console.log('[DataEntryField] Photo uploaded successfully:', storagePath);
    } catch (error) {
      console.error('[DataEntryField] Photo upload failed:', error);
      alert('Failed to upload photo. Please try again.');
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4">
        {currentDateObj.date} - {selectedAssessmentType}
      </h3>
      
      {/* Controls */}
      <div className="mb-4 flex gap-2 flex-wrap">
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
      </div>

      {/* Field Grid */}
      <div className="overflow-x-auto mb-4">
        <div className="space-y-2">
          {gridLayout.map((row, rowIdx) => (
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
                  <div key={colIdx} className={`aspect-square p-2 border-2 rounded ${colorClass} transition-colors flex flex-col items-center justify-center`}>
                    {/* Large centered plot ID */}
                    <div className="text-2xl font-bold text-center">{plot.id}</div>
                    {showTreatments && (
                      <div className="text-xs font-semibold bg-white/90 px-1 rounded truncate mt-1">
                        {plot.treatmentName}
                      </div>
                    )}
                    {/* Input field */}
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
                      className="w-full p-1 text-sm border rounded bg-white text-black text-center mt-1"
                      placeholder={`${assessment?.min}-${assessment?.max}`}
                    />
                    {/* Photo upload button */}
                    <label className="block mt-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(plot.id, e)}
                        className="hidden"
                      />
                      <div className="text-xs text-center bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded cursor-pointer">
                        <Camera size={12} className="inline" /> {plotPhotos.length > 0 ? plotPhotos.length : '+'}
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
