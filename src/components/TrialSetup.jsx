import React, { useState } from 'react';
import { Plus, Trash2, ClipboardPaste } from 'lucide-react';

const TrialSetup = ({ config, onConfigChange, onNext, onBack }) => {
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');

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

  const handleBulkPaste = () => {
    // Split by newlines and filter out empty lines
    const lines = bulkPasteText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      alert('Please paste treatment names (one per line)');
      return;
    }

    if (lines.length > 17) {
      alert('Maximum 17 treatments allowed. Only the first 17 will be used.');
    }

    const treatmentNames = lines.slice(0, 17);

    onConfigChange({
      ...config,
      numTreatments: treatmentNames.length,
      treatments: treatmentNames
    });

    // Close bulk paste and clear text
    setShowBulkPaste(false);
    setBulkPasteText('');
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Treatment Names</label>
            <button
              onClick={() => setShowBulkPaste(!showBulkPaste)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition"
            >
              <ClipboardPaste size={16} />
              {showBulkPaste ? 'Individual Inputs' : 'Bulk Paste'}
            </button>
          </div>

          {showBulkPaste ? (
            /* Bulk Paste Mode */
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900 mb-1">
                  <strong>Paste treatment names from Excel:</strong>
                </p>
                <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
                  <li>Copy a column from Excel (Ctrl+C)</li>
                  <li>Paste below (one treatment per line)</li>
                  <li>Max 17 treatments</li>
                </ul>
              </div>

              <textarea
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                rows={10}
                placeholder="Paste treatment names here...&#10;Treatment A&#10;Treatment B&#10;Treatment C&#10;..."
              />

              <div className="flex gap-2">
                <button
                  onClick={handleBulkPaste}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Apply Treatment Names
                </button>
                <button
                  onClick={() => {
                    setShowBulkPaste(false);
                    setBulkPasteText('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>

              {bulkPasteText && (
                <p className="text-sm text-gray-600">
                  Preview: {bulkPasteText.split('\n').filter(line => line.trim()).length} treatments detected
                </p>
              )}
            </div>
          ) : (
            /* Individual Input Mode */
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
          )}
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
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 p-2 rounded transition"
            >
              <Plus size={20} /> Add Assessment Type
            </button>
          </div>
        </div>

        {/* Generate Layout Button */}
        <button 
          onClick={onNext} 
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Generate Trial Layout →
        </button>
      </div>
    </div>
  );
};

export default TrialSetup;
