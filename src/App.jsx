import React, { useState, useEffect } from 'react';

// Import components (we'll create these next)
import TrialLibrary from './components/TrialLibrary';
import TrialSetup from './components/TrialSetup';
import TrialLayoutEditor from './components/TrialLayoutEditor';
import DataEntry from './components/DataEntry';
import ExcelImport from './components/ExcelImport';

const App = () => {
  // Navigation state
  const [step, setStep] = useState('library'); // 'library', 'setup', 'layoutBuilder', 'entry'
  const [currentTrialId, setCurrentTrialId] = useState(null);
  const [showExcelImport, setShowExcelImport] = useState(false);

  // Data state
  const [trials, setTrials] = useState({});
  const [config, setConfig] = useState({
    trialName: '',
    numBlocks: 4,
    numTreatments: 3,
    treatments: ['Treatment A', 'Treatment B', 'Treatment C'],
    assessmentTypes: [
      { name: 'Turf Quality', min: 1, max: 10 },
      { name: 'Turf Color', min: 1, max: 10 }
    ]
  });
  
  const [gridLayout, setGridLayout] = useState([]);
  const [orientation, setOrientation] = useState(0);
  const [layoutLocked, setLayoutLocked] = useState(false);
  const [assessmentDates, setAssessmentDates] = useState([]);
  const [photos, setPhotos] = useState({});
  const [notes, setNotes] = useState({});

  // Load trials from localStorage
  useEffect(() => {
    const savedTrials = localStorage.getItem('trials');
    if (savedTrials) {
      setTrials(JSON.parse(savedTrials));
    }
  }, []);

  // Save trials to localStorage (database-ready structure)
  useEffect(() => {
    if (Object.keys(trials).length > 0) {
      localStorage.setItem('trials', JSON.stringify(trials));
    }
  }, [trials]);

  // Auto-save current trial
  const saveCurrentTrial = () => {
    if (!currentTrialId) return;
    
    const trialData = {
      id: currentTrialId,
      name: config.trialName,
      config,
      gridLayout,
      orientation,
      layoutLocked,
      assessmentDates,
      photos,
      notes,
      lastModified: new Date().toISOString(),
      created: trials[currentTrialId]?.created || new Date().toISOString()
    };
    
    setTrials(prev => ({ ...prev, [currentTrialId]: trialData }));
  };

  // Auto-save when data changes
  useEffect(() => {
    if (currentTrialId && gridLayout.length > 0) {
      saveCurrentTrial();
    }
  }, [config, gridLayout, orientation, layoutLocked, assessmentDates, photos, notes]);

  // Create new trial
  const createNewTrial = () => {
    const id = Date.now().toString();
    setCurrentTrialId(id);
    setConfig({
      trialName: 'New Trial',
      numBlocks: 4,
      numTreatments: 3,
      treatments: ['Treatment A', 'Treatment B', 'Treatment C'],
      assessmentTypes: [
        { name: 'Turf Quality', min: 1, max: 10 },
        { name: 'Turf Color', min: 1, max: 10 }
      ]
    });
    setGridLayout([]);
    setOrientation(0);
    setLayoutLocked(false);
    setAssessmentDates([]);
    setPhotos({});
    setNotes({});
    setStep('setup');
  };

  // Load existing trial
  const loadTrial = (trialId) => {
    const trial = trials[trialId];
    if (!trial) return;
    
    setCurrentTrialId(trialId);
    setConfig(trial.config);
    setGridLayout(trial.gridLayout || []);
    setOrientation(trial.orientation || 0);
    setLayoutLocked(trial.layoutLocked || false);
    setAssessmentDates(trial.assessmentDates || []);
    setPhotos(trial.photos || {});
    setNotes(trial.notes || {});
    setStep('entry');
  };

  // Delete trial
  const deleteTrial = (trialId) => {
    if (confirm('Delete this trial? This cannot be undone.')) {
      setTrials(prev => {
        const newTrials = { ...prev };
        delete newTrials[trialId];
        return newTrials;
      });
    }
  };

  // Export trial as JSON (database-ready format)
  const exportTrialJSON = () => {
    const trial = trials[currentTrialId];
    if (!trial) return;
    
    const dataStr = JSON.stringify(trial, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.trialName.replace(/\s+/g, '_')}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import trial from JSON
  const importTrialJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        const newId = Date.now().toString();
        imported.id = newId;
        imported.lastModified = new Date().toISOString();
        setTrials(prev => ({ ...prev, [newId]: imported }));
        alert('Trial imported successfully!');
      } catch (err) {
        alert('Error importing trial. Check file format.');
      }
    };
    reader.readAsText(file);
  };

  // Import trial from Excel
  const importTrialFromExcel = (parsedData) => {
    try {
      console.log('[App] Importing trial data:', parsedData);

      // The parser already returns data in the correct format
      const trialData = {
        id: parsedData.id,
        name: parsedData.name,
        config: {
          trialName: parsedData.name,
          numBlocks: parsedData.config.blocks,
          numTreatments: parsedData.config.treatments,
          treatments: parsedData.config.treatmentNames,
          assessmentTypes: parsedData.config.assessmentTypes
        },
        gridLayout: parsedData.gridLayout,
        orientation: 0,
        layoutLocked: true, // Lock layout since it came from Excel
        assessmentDates: parsedData.assessmentDates,
        photos: parsedData.photos || {},
        notes: parsedData.notes || {},
        lastModified: new Date().toISOString(),
        created: new Date().toISOString(),
        metadata: parsedData.metadata
      };

      console.log('[App] Trial data prepared:', trialData);
      setTrials(prev => ({ ...prev, [trialData.id]: trialData }));
      console.log('[App] Trial saved to state');
      setShowExcelImport(false);
      console.log('[App] Import complete!');
      alert(`Trial "${parsedData.name}" imported successfully with ${parsedData.assessmentDates.length} assessment dates!`);
    } catch (err) {
      console.error('[App] Import error:', err);
      alert('Error importing trial from Excel: ' + err.message);
    }
  };

  // Router - render appropriate component based on step
  if (step === 'library') {
    return (
      <>
        <TrialLibrary
          trials={trials}
          onCreateNew={createNewTrial}
          onLoadTrial={loadTrial}
          onDeleteTrial={deleteTrial}
          onImportTrial={importTrialJSON}
          onImportExcel={() => setShowExcelImport(true)}
        />
        {showExcelImport && (
          <ExcelImport
            onImport={importTrialFromExcel}
            onCancel={() => setShowExcelImport(false)}
          />
        )}
      </>
    );
  }

  if (step === 'setup') {
    return (
      <TrialSetup
        config={config}
        onConfigChange={setConfig}
        onNext={() => setStep('layoutBuilder')}
        onBack={() => setStep('library')}
      />
    );
  }

  if (step === 'layoutBuilder') {
    return (
      <TrialLayoutEditor
        config={config}
        gridLayout={gridLayout}
        orientation={orientation}
        onLayoutChange={setGridLayout}
        onOrientationChange={setOrientation}
        onFinalize={() => {
          setLayoutLocked(true);
          setStep('entry');
        }}
        onBack={() => setStep('setup')}
      />
    );
  }

  if (step === 'entry') {
    return (
      <DataEntry
        config={config}
        gridLayout={gridLayout}
        orientation={orientation}
        layoutLocked={layoutLocked}
        assessmentDates={assessmentDates}
        photos={photos}
        notes={notes}
        onAssessmentDatesChange={setAssessmentDates}
        onPhotosChange={setPhotos}
        onNotesChange={setNotes}
        onUnlockLayout={() => {
          if (confirm('⚠️ Unlocking layout may affect existing data. Continue?')) {
            setLayoutLocked(false);
            setStep('layoutBuilder');
          }
        }}
        onExportJSON={exportTrialJSON}
        onBackToLibrary={() => {
          saveCurrentTrial();
          setStep('library');
        }}
      />
    );
  }

  return null;
};

export default App;
