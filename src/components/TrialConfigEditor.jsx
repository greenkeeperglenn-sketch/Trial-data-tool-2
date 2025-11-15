import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Edit2 } from 'lucide-react';

export default function TrialConfigEditor({ config, onSave, onCancel }) {
  // Debug logging
  console.log('[TrialConfigEditor] Received config:', config);
  console.log('[TrialConfigEditor] Has treatments:', config?.treatments);
  console.log('[TrialConfigEditor] Has assessmentTypes:', config?.assessmentTypes);

  // Safety check - if config is invalid, show error
  if (!config || !config.treatments || !config.assessmentTypes) {
    console.error('[TrialConfigEditor] Invalid config detected:', {
      config,
      hasTreatments: !!config?.treatments,
      hasAssessmentTypes: !!config?.assessmentTypes
    });
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-red-600 mb-4">Configuration Error</h2>
          <p className="text-gray-700 mb-4">
            The trial configuration is missing required data. Please try reloading the trial.
          </p>
          <div className="bg-gray-100 p-3 rounded text-xs mb-4">
            <p>Debug info:</p>
            <p>Has config: {config ? 'Yes' : 'No'}</p>
            <p>Has treatments: {config?.treatments ? 'Yes' : 'No'}</p>
            <p>Has assessmentTypes: {config?.assessmentTypes ? 'Yes' : 'No'}</p>
          </div>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const [editedConfig, setEditedConfig] = useState({
    ...config,
    treatments: config.treatments ? [...config.treatments] : [],
    assessmentTypes: config.assessmentTypes ? config.assessmentTypes.map(type => ({ ...type })) : []
  });

  const handleTrialNameChange = (value) => {
    setEditedConfig({ ...editedConfig, trialName: value });
  };

  // Treatment management
  const handleTreatmentChange = (index, value) => {
    const newTreatments = [...editedConfig.treatments];
    newTreatments[index] = value;
    setEditedConfig({ ...editedConfig, treatments: newTreatments });
  };

  const handleAddTreatment = () => {
    const newTreatments = [...editedConfig.treatments, `Treatment ${editedConfig.treatments.length + 1}`];
    setEditedConfig({
      ...editedConfig,
      treatments: newTreatments,
      numTreatments: newTreatments.length
    });
  };

  const handleRemoveTreatment = (index) => {
    if (editedConfig.treatments.length <= 1) {
      alert('Cannot remove the last treatment');
      return;
    }
    if (!confirm('Remove this treatment? This may affect your trial layout.')) return;

    const newTreatments = editedConfig.treatments.filter((_, i) => i !== index);
    setEditedConfig({
      ...editedConfig,
      treatments: newTreatments,
      numTreatments: newTreatments.length
    });
  };

  // Assessment type management
  const handleAssessmentTypeChange = (index, field, value) => {
    const newTypes = [...editedConfig.assessmentTypes];
    newTypes[index] = { ...newTypes[index], [field]: value };
    setEditedConfig({ ...editedConfig, assessmentTypes: newTypes });
  };

  const handleAddAssessmentType = () => {
    const newTypes = [...editedConfig.assessmentTypes, {
      name: `Assessment ${editedConfig.assessmentTypes.length + 1}`,
      min: 0,
      max: 10
    }];
    setEditedConfig({ ...editedConfig, assessmentTypes: newTypes });
  };

  const handleRemoveAssessmentType = (index) => {
    if (editedConfig.assessmentTypes.length <= 1) {
      alert('Cannot remove the last assessment type');
      return;
    }
    if (!confirm('Remove this assessment type? All data for this assessment will be lost.')) return;

    const newTypes = editedConfig.assessmentTypes.filter((_, i) => i !== index);
    setEditedConfig({ ...editedConfig, assessmentTypes: newTypes });
  };

  const handleSave = () => {
    // Validation
    if (!editedConfig.trialName || editedConfig.trialName.trim() === '') {
      alert('Trial name cannot be empty');
      return;
    }

    if (editedConfig.treatments.some(t => !t || t.trim() === '')) {
      alert('All treatments must have names');
      return;
    }

    if (editedConfig.assessmentTypes.some(t => !t.name || t.name.trim() === '')) {
      alert('All assessment types must have names');
      return;
    }

    onSave(editedConfig);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Edit2 size={24} />
              Edit Trial Configuration
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Modify trial settings, assessment types, and treatments
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Trial Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Trial Name
            </label>
            <input
              type="text"
              value={editedConfig.trialName}
              onChange={(e) => handleTrialNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter trial name"
            />
          </div>

          {/* Assessment Types Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Assessment Types</h3>
              <button
                onClick={handleAddAssessmentType}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={16} />
                Add Assessment Type
              </button>
            </div>

            <div className="space-y-3">
              {editedConfig.assessmentTypes.map((type, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Assessment Name
                      </label>
                      <input
                        type="text"
                        value={type.name}
                        onChange={(e) => handleAssessmentTypeChange(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Turf Quality"
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Min
                      </label>
                      <input
                        type="number"
                        value={type.min}
                        onChange={(e) => handleAssessmentTypeChange(index, 'min', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Max
                      </label>
                      <input
                        type="number"
                        value={type.max}
                        onChange={(e) => handleAssessmentTypeChange(index, 'max', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => handleRemoveAssessmentType(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove assessment type"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Treatments Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Treatments</h3>
              <button
                onClick={handleAddTreatment}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
              >
                <Plus size={16} />
                Add Treatment
              </button>
            </div>

            <div className="space-y-3">
              {editedConfig.treatments.map((treatment, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={treatment}
                      onChange={(e) => handleTreatmentChange(index, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder={`Treatment ${index + 1}`}
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveTreatment(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove treatment"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> Changing assessment types or treatments may affect existing data.
              Make sure to review your data after making changes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
