import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

const TrialSetup = ({ config, onConfigChange, onNext, onBack }) => {
  
  const updateConfig = (field, value) => {
    onConfigChange({ ...config, [field]: value });
  };

  const updateTreatmentCount = (num) => {
    const newTreatments = Array(num).fill(0).map((_, i) => 
      config.treatments[i] || `Treatment ${String.fromCharCode(65 + i)}`
    );
    onConfigChange({ 
      ...config, 
      numTreatments: num, 
      treatments: newTreatments 
    });
  };

  const updateTreatmentName = (idx, name) => {
    const newTreatments = [...config.treatments];
    newTreatments[idx] = name;
    onConfigChange({ ...config, treatments: newTreatments });
  };

  const updateAssessmentType = (idx, field, value) => {
    const newTypes = [...config.assessmentTypes];
    newTypes[idx] = { ...newTypes[idx], [field]: value };
    onConfigChange({ ...config, assessmentTypes: newTypes });
  };

  const deleteAssessmentType = (idx) => {
    const newTypes = config.assessmentTypes.filter((_, i) => i !== idx);
    onConfigChange({ ...config, assessmentTypes: newTypes });
  };

  const addAssessmentType = () => {
    onConfigChange({
      ...config, 
      assessmentTypes: [
        ...config.assessmentTypes, 
        { name: `Assessment ${config.assessmentTypes.length + 1}`, min: 1, max: 10 }
      ]
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Trial Setup</h1>
        <button 
          onClick={onBack} 
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
        >
          ← Library
        </button>
      </div>

      {/* Setup Form */}
      <div className="space-y-6 bg-white p-6 rounded-lg shadow">
        
        {/* Trial Name */}
        <div>
          <label className="block text-sm font-medium mb-2">Trial Name</label>
          <input
            type="text"
            value={config.trialName}
            onChange={(e) => updateConfig('trialName', e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Summer 2025 Turf Quality Study"
          />
        </div>

        {/* Number of Blocks */}
        <div>
          <label className="block text-sm font-medium mb-2">Number of Blocks (Replicates)</label>
          <input
            type="number"
            value={config.numBlocks}
            onChange={(e) => updateConfig('numBlocks', parseInt(e.target.value) || 1)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            min="1"
            max="20"
          />
        </div>

        {/* Number of Treatments */}
        <div>
          <label className="block text-sm font-medium mb-2">Number of Treatments</label>
          <input
            type="number"
            value={config.numTreatments}
            onChange={(e) => updateTreatmentCount(parseInt(e.target.value) || 1)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            min="1"
            max="17"
          />
          <p className="text-xs text-gray-500 mt-1">Max 17 treatments (A-Q)</p>
        </div>

        {/* Treatment Names */}
        <div>
          <label className="block text-sm font-medium mb-2">Treatment Names</label>
          <div className="space-y-2">
            {config.treatments.map((treatment, idx) => (
              <input
                key={idx}
                type="text"
                value={treatment}
                onChange={(e) => updateTreatmentName(idx, e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={`Treatment ${String.fromCharCode(65 + idx)}`}
              />
            ))}
          </div>
        </div>

        {/* Assessment Types */}
        <div>
          <label className="block text-sm font-medium mb-2">Assessment Types</label>
          <div className="space-y-2">
            {config.assessmentTypes.map((type, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                {/* Name */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={type.name}
                    onChange={(e) => updateAssessmentType(idx, 'name', e.target.value)}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-stri-teal focus:border-stri-teal"
                    placeholder="Assessment name"
                  />
                </div>
                
                {/* Min */}
                <div className="w-24">
                  <label className="text-xs text-gray-600">Min</label>
                  <input
                    type="number"
                    step="0.1"
                    value={type.min}
                    onChange={(e) => updateAssessmentType(idx, 'min', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-stri-teal focus:border-stri-teal"
                  />
                </div>
                
                {/* Max */}
                <div className="w-24">
                  <label className="text-xs text-gray-600">Max</label>
                  <input
                    type="number"
                    step="0.1"
                    value={type.max}
                    onChange={(e) => updateAssessmentType(idx, 'max', parseFloat(e.target.value) || 10)}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-stri-teal focus:border-stri-teal"
                  />
                </div>
                
                {/* Delete Button */}
                <button
                  onClick={() => deleteAssessmentType(idx)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded transition"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            
            {/* Add Assessment Type Button */}
            <button
              onClick={addAssessmentType}
              className="flex items-center gap-2 text-stri-teal hover:bg-gray-50 p-2 rounded transition"
            >
              <Plus size={20} /> Add Assessment Type
            </button>
          </div>
        </div>

        {/* Generate Layout Button */}
        <button
          onClick={onNext}
          className="w-full bg-stri-teal text-white py-3 rounded-lg font-medium hover:bg-stri-teal-light transition"
        >
          Generate Trial Layout →
        </button>
      </div>
    </div>
  );
};

export default TrialSetup;
