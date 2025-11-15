import React, { useState } from 'react';
import { X, Save, Plus, Trash2, Edit2, Grip, RotateCw, Square, Columns, Rows } from 'lucide-react';

export default function TrialConfigEditor({ config, gridLayout, orientation, onSave, onCancel }) {
  // Debug logging
  console.log('[TrialConfigEditor] Received config:', config);
  console.log('[TrialConfigEditor] Has treatments:', config?.treatments);
  console.log('[TrialConfigEditor] Has assessmentTypes:', config?.assessmentTypes);

  // Safety check - if config is invalid, show error
  if (!config || !config.assessmentTypes) {
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

  // Handle treatments - could be array or number (numTreatments)
  const getTreatmentsArray = () => {
    if (Array.isArray(config.treatments)) {
      return [...config.treatments];
    }
    // If treatments is a number (numTreatments), generate array
    if (typeof config.treatments === 'number' || typeof config.numTreatments === 'number') {
      const count = config.treatments || config.numTreatments || 3;
      return Array.from({ length: count }, (_, i) => `Treatment ${i + 1}`);
    }
    return ['Treatment 1', 'Treatment 2', 'Treatment 3'];
  };

  const [editedConfig, setEditedConfig] = useState({
    ...config,
    treatments: getTreatmentsArray(),
    assessmentTypes: config.assessmentTypes ? config.assessmentTypes.map(type => ({ ...type })) : []
  });

  // Field map state
  const [localGridLayout, setLocalGridLayout] = useState(gridLayout || []);
  const [localOrientation, setLocalOrientation] = useState(orientation || 0);
  const [draggedPlot, setDraggedPlot] = useState(null);

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

  // Drag and drop handlers
  const handleDragStart = (rowIdx, colIdx) => {
    setDraggedPlot({ rowIdx, colIdx });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (targetRowIdx, targetColIdx) => {
    if (!draggedPlot) return;

    const newGrid = localGridLayout.map(row => [...row]);
    const draggedItem = newGrid[draggedPlot.rowIdx][draggedPlot.colIdx];
    const targetItem = newGrid[targetRowIdx][targetColIdx];

    // Swap plots
    newGrid[draggedPlot.rowIdx][draggedPlot.colIdx] = targetItem;
    newGrid[targetRowIdx][targetColIdx] = draggedItem;

    setLocalGridLayout(newGrid);
    setDraggedPlot(null);
  };

  // Rotate compass
  const rotateCompass = (degrees) => {
    const newOrientation = (localOrientation + degrees + 360) % 360;
    setLocalOrientation(newOrientation);
  };

  // Toggle plot between blank and non-blank
  const togglePlotBlank = (rowIdx, colIdx, e) => {
    e.stopPropagation();
    e.preventDefault();

    const newGrid = localGridLayout.map(row => [...row]);
    const plot = newGrid[rowIdx][colIdx];

    if (plot.isBlank) {
      // Convert from blank to real plot - assign next available treatment
      const treatmentIdx = 0; // Default to first treatment
      newGrid[rowIdx][colIdx] = {
        id: `${rowIdx + 1}-${colIdx + 1}`,
        block: rowIdx + 1,
        treatment: treatmentIdx,
        treatmentName: editedConfig.treatments[treatmentIdx] || 'Treatment 1',
        isBlank: false,
        plotNumber: colIdx + 1
      };
    } else {
      // Convert to blank
      newGrid[rowIdx][colIdx] = {
        ...plot,
        isBlank: true
      };
    }

    setLocalGridLayout(newGrid);
  };

  // Handle plot selection from dropdown
  const handlePlotSelect = (rowIdx, colIdx, value) => {
    const newGrid = localGridLayout.map(row => [...row]);

    if (value === 'BLANK') {
      // Set to blank
      newGrid[rowIdx][colIdx] = {
        id: `${rowIdx + 1}-${colIdx + 1}`,
        block: rowIdx + 1,
        treatment: 0,
        treatmentName: '',
        isBlank: true,
        plotNumber: colIdx + 1
      };
    } else {
      // Parse the value: "block-treatment" format
      const [blockStr, treatmentStr] = value.split('-');
      const block = parseInt(blockStr);
      const treatmentIdx = parseInt(treatmentStr);

      newGrid[rowIdx][colIdx] = {
        id: `${block}-${colIdx + 1}`,
        block: block,
        treatment: treatmentIdx,
        treatmentName: editedConfig.treatments[treatmentIdx] || `Treatment ${treatmentIdx + 1}`,
        isBlank: false,
        plotNumber: colIdx + 1
      };
    }

    setLocalGridLayout(newGrid);
  };

  // Generate all possible plot combinations
  const getAllPossiblePlots = () => {
    const plots = [];
    const numBlocks = Math.max(4, localGridLayout.length); // At least 4 blocks or current rows

    for (let block = 1; block <= numBlocks; block++) {
      editedConfig.treatments.forEach((treatment, treatmentIdx) => {
        plots.push({
          value: `${block}-${treatmentIdx}`,
          label: `Block ${block} - ${treatment}`,
          block,
          treatmentIdx,
          treatmentName: treatment
        });
      });
    }

    return plots;
  };

  // Add a row of blank plots
  const addBlankRow = () => {
    if (localGridLayout.length === 0) return;

    const numCols = localGridLayout[0].length;
    const newRowIdx = localGridLayout.length;
    const newRow = Array.from({ length: numCols }, (_, colIdx) => ({
      id: `${newRowIdx + 1}-${colIdx + 1}`,
      block: newRowIdx + 1,
      treatment: 0,
      treatmentName: '',
      isBlank: true,
      plotNumber: colIdx + 1
    }));

    setLocalGridLayout([...localGridLayout, newRow]);
  };

  // Add a column of blank plots
  const addBlankColumn = () => {
    const newGrid = localGridLayout.map((row, rowIdx) => {
      const newColIdx = row.length;
      return [
        ...row,
        {
          id: `${rowIdx + 1}-${newColIdx + 1}`,
          block: rowIdx + 1,
          treatment: 0,
          treatmentName: '',
          isBlank: true,
          plotNumber: newColIdx + 1
        }
      ];
    });

    setLocalGridLayout(newGrid);
  };

  // Remove last row
  const removeLastRow = () => {
    if (localGridLayout.length <= 1) {
      alert('Cannot remove the last row');
      return;
    }

    if (!confirm('Remove the last row? This cannot be undone.')) return;

    setLocalGridLayout(localGridLayout.slice(0, -1));
  };

  // Remove last column
  const removeLastColumn = () => {
    if (localGridLayout.length === 0 || localGridLayout[0].length <= 1) {
      alert('Cannot remove the last column');
      return;
    }

    if (!confirm('Remove the last column from all rows? This cannot be undone.')) return;

    const newGrid = localGridLayout.map(row => row.slice(0, -1));
    setLocalGridLayout(newGrid);
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

    onSave(editedConfig, localGridLayout, localOrientation);
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

          {/* Field Map Editor Section */}
          {localGridLayout && localGridLayout.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Field Map Layout</h3>
                  <p className="text-sm text-gray-600">Drag and drop plots to rearrange. Useful for odd trial configurations.</p>
                </div>

                {/* Compass Control */}
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs font-semibold text-gray-600">ORIENTATION</div>

                  {/* Compass Display */}
                  <div className="relative w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full shadow-lg border-4 border-blue-300">
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ transform: `rotate(${localOrientation}deg)` }}
                    >
                      {/* North Arrow */}
                      <div className="absolute top-0.5 left-1/2 -translate-x-1/2">
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-red-600"></div>
                        <div className="text-xs font-bold text-red-600 text-center">N</div>
                      </div>
                      {/* South Marker */}
                      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                        <div className="text-xs text-gray-500">S</div>
                      </div>
                      {/* East Marker */}
                      <div className="absolute right-0.5 top-1/2 -translate-y-1/2">
                        <div className="text-xs text-gray-500">E</div>
                      </div>
                      {/* West Marker */}
                      <div className="absolute left-0.5 top-1/2 -translate-y-1/2">
                        <div className="text-xs text-gray-500">W</div>
                      </div>
                    </div>
                  </div>

                  {/* Rotation Display */}
                  <div className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                    {localOrientation}°
                  </div>

                  {/* Rotation Controls */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => rotateCompass(-5)}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition"
                      title="Rotate -5°"
                      type="button"
                    >
                      ↺ 5°
                    </button>
                    <button
                      onClick={() => rotateCompass(5)}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition"
                      title="Rotate +5°"
                      type="button"
                    >
                      ↻ 5°
                    </button>
                  </div>
                  <button
                    onClick={() => setLocalOrientation(0)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded transition"
                    type="button"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Grid Management Buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={addBlankRow}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
                  type="button"
                  title="Add a row of blank plots"
                >
                  <Plus size={16} />
                  <Rows size={16} />
                  Add Blank Row
                </button>

                <button
                  onClick={addBlankColumn}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
                  type="button"
                  title="Add a column of blank plots"
                >
                  <Plus size={16} />
                  <Columns size={16} />
                  Add Blank Column
                </button>

                <button
                  onClick={removeLastRow}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                  type="button"
                  title="Remove the last row"
                >
                  <Trash2 size={16} />
                  Remove Last Row
                </button>

                <button
                  onClick={removeLastColumn}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                  type="button"
                  title="Remove the last column"
                >
                  <Trash2 size={16} />
                  Remove Last Column
                </button>
              </div>

              {/* Grid Display */}
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 overflow-x-auto">
                <div className="space-y-2">
                  {localGridLayout.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex gap-2">
                      {row.map((plot, colIdx) => {
                        const allPlots = getAllPossiblePlots();
                        const currentValue = plot.isBlank
                          ? 'BLANK'
                          : `${plot.block}-${plot.treatment}`;

                        return (
                          <div
                            key={colIdx}
                            className={`
                              relative min-w-[140px] rounded border-2 p-2
                              ${plot.isBlank
                                ? 'border-dashed border-gray-300 bg-gray-100'
                                : 'border-solid border-blue-400 bg-white'
                              }
                            `}
                          >
                            {/* Dropdown for plot selection */}
                            <select
                              value={currentValue}
                              onChange={(e) => handlePlotSelect(rowIdx, colIdx, e.target.value)}
                              className="w-full text-xs p-1 border rounded bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="BLANK">-- Blank --</option>
                              {allPlots.map((plotOption) => (
                                <option key={plotOption.value} value={plotOption.value}>
                                  {plotOption.label}
                                </option>
                              ))}
                            </select>

                            {/* Display current plot info */}
                            {!plot.isBlank && (
                              <div className="mt-1 text-xs text-center">
                                <div className="font-semibold text-gray-600">{plot.id}</div>
                                <div className="text-blue-700 truncate">{plot.treatmentName}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Tips:</strong>
                </p>
                <ul className="text-sm text-blue-800 list-disc list-inside mt-1 space-y-1">
                  <li>Use dropdown menus to assign plots to each position</li>
                  <li>Select "-- Blank --" to make a position empty</li>
                  <li>Choose any Block-Treatment combination from the dropdown</li>
                  <li>Use buttons above to add/remove rows and columns</li>
                  <li>Blank plots won't appear in data entry</li>
                </ul>
              </div>
            </div>
          )}

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
