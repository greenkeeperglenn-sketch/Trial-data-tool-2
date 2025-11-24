import React, { useState } from 'react';
import { Download, Unlock, Grid, List, FileText, BarChart3, Camera, Presentation, Settings, ChevronLeft, ChevronRight, Trash2, Plus } from 'lucide-react';
import DataEntryField from './DataEntryField';
import DataEntryTable from './DataEntryTable';
import DataEntryNotes from './DataEntryNotes';
import Analysis from './Analysis';
import ImageryAnalyzer from './ImageryAnalyzer';
import ErrorBoundary from './ErrorBoundary';
import PresentationMode from './PresentationMode';
import TrialConfigEditor from './TrialConfigEditor';
import { deletePlotImages } from '../services/storage';

const DataEntry = ({
  trialId,
  config,
  gridLayout,
  orientation,
  layoutLocked,
  assessmentDates,
  photos,
  notes,
  onAssessmentDatesChange,
  onPhotosChange,
  onNotesChange,
  onUnlockLayout,
  onExportJSON,
  onBackToLibrary,
  onConfigChange
}) => {
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const [selectedAssessmentType, setSelectedAssessmentType] = useState(
    config.assessmentTypes[0]?.name || ''
  );
  const [viewMode, setViewMode] = useState('field'); // 'field', 'table', 'notes', 'analysis', 'imagery', 'presentation'
  const [showInputDropdown, setShowInputDropdown] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [newDateInput, setNewDateInput] = useState('');

  const currentDateObj = assessmentDates[currentDateIndex];

  // Add new assessment date
  const handleAddDate = (dateStr) => {
    const newDate = { date: dateStr, assessments: {} };

    // Initialize all assessment types for all plots
    config.assessmentTypes.forEach(type => {
      newDate.assessments[type.name] = {};
      gridLayout.flat().forEach(plot => {
        if (!plot.isBlank) {
          newDate.assessments[type.name][plot.id] = { value: '', entered: false };
        }
      });
    });

    onAssessmentDatesChange([...assessmentDates, newDate]);
    setCurrentDateIndex(assessmentDates.length);

    if (!selectedAssessmentType && config.assessmentTypes.length > 0) {
      setSelectedAssessmentType(config.assessmentTypes[0].name);
    }
  };

  // Delete assessment date and all associated data
  const handleDeleteDate = async (dateIndex) => {
    const dateToDelete = assessmentDates[dateIndex].date;

    try {
      // Collect all photo paths for this date
      const dateKeys = Object.keys(photos).filter(key =>
        key.startsWith(dateToDelete)
      );
      const photoPaths = [];
      dateKeys.forEach(key => {
        if (photos[key]) {
          photoPaths.push(...photos[key]);
        }
      });

      // Delete photos from storage
      if (photoPaths.length > 0) {
        await deletePlotImages(photoPaths);
      }

      // Remove the date from assessmentDates
      const updatedDates = assessmentDates.filter((_, idx) => idx !== dateIndex);
      onAssessmentDatesChange(updatedDates);

      // Remove all photos from this date
      const updatedPhotos = {};
      Object.keys(photos).forEach(key => {
        if (!key.startsWith(dateToDelete)) {
          updatedPhotos[key] = photos[key];
        }
      });
      onPhotosChange(updatedPhotos);

      // Remove all notes from this date
      const updatedNotes = {};
      Object.keys(notes).forEach(key => {
        if (!key.startsWith(dateToDelete)) {
          updatedNotes[key] = notes[key];
        }
      });
      onNotesChange(updatedNotes);

      // Adjust current date index if needed
      if (dateIndex <= currentDateIndex) {
        setCurrentDateIndex(Math.max(0, currentDateIndex - 1));
      }

      console.log('[DataEntry] Assessment date and all associated data deleted successfully');
    } catch (error) {
      console.error('[DataEntry] Failed to delete assessment date:', error);
      alert('Failed to delete some data. Please try again.');
    }
  };

  // Update plot data
  const updateData = (date, assessmentType, plotId, value) => {
    onAssessmentDatesChange(
      assessmentDates.map(d => {
        if (d.date === date) {
          return {
            ...d,
            assessments: {
              ...d.assessments,
              [assessmentType]: {
                ...d.assessments[assessmentType],
                [plotId]: { value, entered: value !== '' }
              }
            }
          };
        }
        return d;
      })
    );
  };

  // Bulk update plot data (for imagery analyzer)
  const handleBulkUpdateData = (date, assessmentType, updates) => {
    onAssessmentDatesChange(
      assessmentDates.map(d => {
        if (d.date === date) {
          const updatedAssessments = { ...d.assessments[assessmentType] };
          Object.entries(updates).forEach(([plotId, value]) => {
            updatedAssessments[plotId] = { value, entered: value !== '' };
          });
          return {
            ...d,
            assessments: {
              ...d.assessments,
              [assessmentType]: updatedAssessments
            }
          };
        }
        return d;
      })
    );
  };

  // Handle config changes
  const handleConfigSave = (newConfig, newGridLayout, newOrientation) => {
    console.log('[DataEntry] Config saved, updating selectedAssessmentType');
    console.log('[DataEntry] Old selected:', selectedAssessmentType);
    console.log('[DataEntry] Old config assessment types:', config.assessmentTypes.map(t => t.name));
    console.log('[DataEntry] New config assessment types:', newConfig.assessmentTypes.map(t => t.name));

    // Find the index of the currently selected assessment type in the old config
    const oldIndex = config.assessmentTypes.findIndex(t => t.name === selectedAssessmentType);

    // If we found it, update to the new name at the same index
    if (oldIndex >= 0 && newConfig.assessmentTypes[oldIndex]) {
      const newName = newConfig.assessmentTypes[oldIndex].name;
      console.log('[DataEntry] Updating selected assessment type from', selectedAssessmentType, 'to', newName);
      setSelectedAssessmentType(newName);
    } else if (newConfig.assessmentTypes.length > 0) {
      // Otherwise, just select the first one
      console.log('[DataEntry] Selecting first assessment type:', newConfig.assessmentTypes[0].name);
      setSelectedAssessmentType(newConfig.assessmentTypes[0].name);
    }

    if (onConfigChange) {
      onConfigChange(newConfig, assessmentDates, newGridLayout, newOrientation);
    }
    setShowConfigEditor(false);
  };

  // Export CSV data
  const exportToCSV = () => {
    if (!selectedAssessmentType) return;

    let csv = 'Plot,Block,Treatment';
    assessmentDates.forEach(d => csv += `,${d.date}`);
    csv += '\n';

    gridLayout.flat().filter(p => !p.isBlank).forEach(plot => {
      csv += `${plot.id},${plot.block},${plot.treatmentName}`;
      assessmentDates.forEach(dateObj => {
        const assessmentData = dateObj.assessments[selectedAssessmentType];
        const value = assessmentData?.[plot.id]?.value || '';
        csv += `,${value}`;
      });
      csv += '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.trialName}_${selectedAssessmentType}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export summary CSV with means and standard errors
  const exportSummaryCSV = () => {
    if (!selectedAssessmentType) return;
    
    let csv = 'Treatment';
    assessmentDates.forEach(d => csv += `,${d.date}_Mean,${d.date}_SE`);
    csv += '\n';
    
    config.treatments.forEach((treatment, treatmentIdx) => {
      csv += treatment;
      assessmentDates.forEach(dateObj => {
        const assessmentData = dateObj.assessments[selectedAssessmentType];
        if (!assessmentData) {
          csv += ',,';
          return;
        }
        const treatmentValues = gridLayout.flat()
          .filter(plot => !plot.isBlank && plot.treatment === treatmentIdx)
          .map(plot => {
            const plotData = assessmentData[plot.id];
            return plotData?.entered && plotData.value !== '' ? parseFloat(plotData.value) : null;
          })
          .filter(v => v !== null);
        
        if (treatmentValues.length === 0) {
          csv += ',,';
        } else {
          const mean = treatmentValues.reduce((a, b) => a + b, 0) / treatmentValues.length;
          const variance = treatmentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / treatmentValues.length;
          const stdError = Math.sqrt(variance / treatmentValues.length);
          csv += `,${mean.toFixed(2)},${stdError.toFixed(2)}`;
        }
      });
      csv += '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.trialName}_${selectedAssessmentType}_summary.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      {/* Fixed Side Date Navigation - Only show for input views (not imagery/presentation) */}
      {assessmentDates.length > 0 && !['imagery', 'presentation'].includes(viewMode) && (
        <div className="fixed right-8 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4">
          <button
            onClick={() => setCurrentDateIndex(Math.max(0, currentDateIndex - 1))}
            disabled={currentDateIndex === 0}
            className="p-4 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xl hover:scale-110"
            title="Previous date"
          >
            <ChevronLeft size={28} />
          </button>

          <div className="bg-white rounded-lg px-3 py-2 text-center shadow-2xl min-w-[100px] border-2 border-blue-500">
            <div className="text-xs text-gray-500 mb-1">Current</div>
            <div className="text-sm font-bold text-blue-600">{currentDateObj?.date}</div>
            <div className="text-xs text-gray-500 mt-1">{currentDateIndex + 1}/{assessmentDates.length}</div>
            <button
              onClick={() => {
                const dateToDelete = assessmentDates[currentDateIndex].date;
                if (!confirm(`Delete assessment date "${dateToDelete}"?\n\nThis will remove:\n• All assessment data for this date\n• All photos from this date\n• All notes from this date\n\nThis cannot be undone.`)) {
                  return;
                }
                handleDeleteDate(currentDateIndex);
              }}
              className="mt-2 flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition mx-auto"
              title="Delete this assessment date"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>

          <button
            onClick={() => setCurrentDateIndex(Math.min(assessmentDates.length - 1, currentDateIndex + 1))}
            disabled={currentDateIndex === assessmentDates.length - 1}
            className="p-4 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xl hover:scale-110"
            title="Next date"
          >
            <ChevronRight size={28} />
          </button>
        </div>
      )}

      <div className={`p-4 max-w-7xl mx-auto ${!['imagery', 'presentation'].includes(viewMode) ? 'pr-52' : ''}`}>
        {/* Header */}
        <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{config.trialName}</h1>
          <p className="text-sm text-gray-600">
            Auto-saved • {layoutLocked ? '🔒 Layout Locked' : '🔓 Layout Unlocked'}
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowConfigEditor(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
          >
            <Settings size={16} /> Edit Config
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
          >
            <Download size={16} /> Export Data
          </button>

          <button
            onClick={exportSummaryCSV}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
          >
            <Download size={16} /> Summary
          </button>

          <button
            onClick={onExportJSON}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition"
          >
            <Download size={16} /> Backup Trial
          </button>

          {layoutLocked && (
            <button
              onClick={onUnlockLayout}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
            >
              <Unlock size={16} /> Unlock Layout
            </button>
          )}

          <button
            onClick={onBackToLibrary}
            className="px-3 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300 transition"
          >
            ← Library
          </button>
        </div>
      </div>

      {/* Add Date Section - Only show when we have no dates or at the top */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Add Assessment Date</label>
            <input
              type="date"
              value={newDateInput}
              onChange={(e) => setNewDateInput(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => {
              if (newDateInput) {
                handleAddDate(newDateInput);
                setNewDateInput('');
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 transition"
          >
            <Plus size={20} /> Add Date
          </button>
        </div>
      </div>

      {assessmentDates.length === 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 text-center mt-4">
          <h3 className="text-xl font-bold text-blue-900 mb-2">Welcome to your new trial!</h3>
          <p className="text-blue-700 mb-4">
            Your trial layout is ready. Click "Add Date" above to start recording assessment data.
          </p>
          <div className="text-sm text-blue-600">
            <p><strong>Trial Name:</strong> {config.trialName}</p>
            <p><strong>Grid Size:</strong> {gridLayout.length} rows × {gridLayout[0]?.length || 0} columns</p>
            <p><strong>Plots:</strong> {gridLayout.flat().filter(p => !p.isBlank).length}</p>
          </div>
        </div>
      )}

      {assessmentDates.length > 0 && (
        <>
          {/* View Mode Navigation */}
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <div className="flex gap-2 flex-wrap">
              {/* Input Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowInputDropdown(!showInputDropdown)}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                    ['field', 'table', 'notes'].includes(viewMode) 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200'
                  }`}
                >
                  Input ▼
                </button>
                
                {showInputDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white shadow-lg rounded border z-10">
                    <button 
                      onClick={() => { setViewMode('field'); setShowInputDropdown(false); }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 whitespace-nowrap"
                    >
                      <Grid size={16} className="inline mr-2" /> Field Map
                    </button>
                    <button 
                      onClick={() => { setViewMode('table'); setShowInputDropdown(false); }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 whitespace-nowrap"
                    >
                      <List size={16} className="inline mr-2" /> Table View
                    </button>
                    <button 
                      onClick={() => { setViewMode('notes'); setShowInputDropdown(false); }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 whitespace-nowrap"
                    >
                      <FileText size={16} className="inline mr-2" /> Notes
                    </button>
                  </div>
                )}
              </div>
              
              {/* Analysis Tab */}
              <button
                onClick={() => setViewMode('analysis')}
                className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                  viewMode === 'analysis' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                <BarChart3 size={18} /> Analysis
              </button>

              {/* Imagery Tab - Always available */}
              <button
                onClick={() => setViewMode('imagery')}
                className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                  viewMode === 'imagery' ? 'bg-stri-teal text-white' : 'bg-gray-200'
                }`}
              >
                <Camera size={18} /> Imagery
              </button>

              {/* Presentation Tab - Only show if we have assessment dates */}
              {assessmentDates.length > 0 && (
                <button
                  onClick={() => setViewMode('presentation')}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                    viewMode === 'presentation' ? 'bg-stri-blue-info text-white' : 'bg-gray-200'
                  }`}
                >
                  <Presentation size={18} /> Presentation
                </button>
              )}
            </div>
          </div>

          {/* Assessment Type Selector */}
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <label className="block text-sm font-medium mb-2">Assessment Type</label>
            <select 
              value={selectedAssessmentType} 
              onChange={(e) => setSelectedAssessmentType(e.target.value)} 
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {config.assessmentTypes.map(type => (
                <option key={type.name} value={type.name}>
                  {type.name} (Scale: {type.min}-{type.max})
                </option>
              ))}
            </select>
          </div>

          {/* Render appropriate view */}
          {viewMode === 'field' && currentDateObj && selectedAssessmentType && (
            <DataEntryField
              trialId={trialId}
              config={config}
              gridLayout={gridLayout}
              currentDateObj={currentDateObj}
              selectedAssessmentType={selectedAssessmentType}
              photos={photos}
              onUpdateData={updateData}
              onPhotosChange={onPhotosChange}
            />
          )}

          {viewMode === 'table' && currentDateObj && selectedAssessmentType && (
            <DataEntryTable
              config={config}
              gridLayout={gridLayout}
              currentDateObj={currentDateObj}
              selectedAssessmentType={selectedAssessmentType}
              onUpdateData={updateData}
            />
          )}

          {viewMode === 'notes' && currentDateObj && selectedAssessmentType && (
            <DataEntryNotes
              config={config}
              gridLayout={gridLayout}
              currentDateObj={currentDateObj}
              selectedAssessmentType={selectedAssessmentType}
              photos={photos}
              notes={notes}
              onPhotosChange={onPhotosChange}
              onNotesChange={onNotesChange}
            />
          )}

          {viewMode === 'analysis' && selectedAssessmentType && (
            <Analysis
              config={config}
              gridLayout={gridLayout}
              assessmentDates={assessmentDates}
              selectedAssessmentType={selectedAssessmentType}
            />
          )}

          {/* Imagery Analyzer - Always available, even without assessment dates */}
          {viewMode === 'imagery' && (
            <ErrorBoundary>
              <ImageryAnalyzer
                trialId={trialId}
                gridLayout={gridLayout}
                config={config}
                assessmentDates={assessmentDates}
                currentDateObj={currentDateObj}
                selectedAssessmentType={selectedAssessmentType}
                photos={photos}
                onSelectAssessmentType={setSelectedAssessmentType}
                onBulkUpdateData={handleBulkUpdateData}
                onPhotosChange={onPhotosChange}
                onAssessmentDatesChange={onAssessmentDatesChange}
              />
            </ErrorBoundary>
          )}

          {/* Presentation Mode - Show professional timeline-based presentation */}
          {viewMode === 'presentation' && assessmentDates.length > 0 && (
            <PresentationMode
              config={config}
              gridLayout={gridLayout}
              assessmentDates={assessmentDates}
              photos={photos}
              notes={notes}
              selectedAssessmentType={selectedAssessmentType}
              onSelectAssessmentType={setSelectedAssessmentType}
            />
          )}
        </>
      )}
      </div>

      {/* Config Editor Modal */}
      {showConfigEditor && (
        <TrialConfigEditor
          config={config}
          gridLayout={gridLayout}
          orientation={orientation}
          onSave={handleConfigSave}
          onCancel={() => setShowConfigEditor(false)}
        />
      )}
    </div>
  );
};

export default DataEntry;
