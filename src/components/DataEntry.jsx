import React, { useState } from 'react';
import { Download, Unlock, Grid, List, FileText, BarChart3, Camera, Presentation } from 'lucide-react';
import DateNavigation from './DateNavigation';
import DataEntryField from './DataEntryField';
import DataEntryTable from './DataEntryTable';
import DataEntryNotes from './DataEntryNotes';
import Analysis from './Analysis';
import ImageryAnalyzer from './ImageryAnalyzer';
import PresentationMode from './PresentationMode';

const DataEntry = ({
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
  onBackToLibrary
}) => {
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const [selectedAssessmentType, setSelectedAssessmentType] = useState(
    config.assessmentTypes[0]?.name || ''
  );
  const [viewMode, setViewMode] = useState('field'); // 'field', 'table', 'notes', 'analysis', 'imagery', 'presentation'
  const [showInputDropdown, setShowInputDropdown] = useState(false);

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

  // Export CSV data
  const exportToCSV = () => {
    if (!selectedAssessmentType) return;
    
    let csv = 'Plot,Block,Treatment';
    assessmentDates.forEach(d => csv += `,${d.date}`);
    csv += '\n';
    
    gridLayout.flat().filter(p => !p.isBlank).forEach(plot => {
      csv += `${plot.id},${plot.block},${plot.treatmentName}`;
      assessmentDates.forEach(dateObj => {
        const value = dateObj.assessments[selectedAssessmentType][plot.id]?.value || '';
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
        const treatmentValues = gridLayout.flat()
          .filter(plot => !plot.isBlank && plot.treatment === treatmentIdx)
          .map(plot => {
            const plotData = dateObj.assessments[selectedAssessmentType][plot.id];
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
    <div className="p-4 max-w-7xl mx-auto">
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

      {/* Date Navigation */}
      <DateNavigation
        assessmentDates={assessmentDates}
        currentDateIndex={currentDateIndex}
        onDateChange={setCurrentDateIndex}
        onAddDate={handleAddDate}
      />

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
            <ImageryAnalyzer
              gridLayout={gridLayout}
              config={config}
              assessmentDates={assessmentDates}
              currentDateObj={currentDateObj}
              selectedAssessmentType={selectedAssessmentType}
              onSelectAssessmentType={setSelectedAssessmentType}
              onBulkUpdateData={handleBulkUpdateData}
              onPhotosChange={onPhotosChange}
              onAssessmentDatesChange={onAssessmentDatesChange}
            />
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
  );
};

export default DataEntry;
