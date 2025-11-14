import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';

// Import components
import Auth from './components/Auth';
import TrialLibrary from './components/TrialLibrary';
import TrialSetup from './components/TrialSetup';
import TrialLayoutEditor from './components/TrialLayoutEditor';
import DataEntry from './components/DataEntry';
import ExcelImport from './components/ExcelImport';

// Import Supabase services
import { supabase, hasValidCredentials } from './services/supabase';
import {
  getAllTrials,
  createTrial,
  updateTrial,
  deleteTrial as deleteTrialDB,
  migrateFromLocalStorage
} from './services/database';

const App = () => {
  // Authentication state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation state
  const [step, setStep] = useState('library'); // 'library', 'setup', 'layoutBuilder', 'entry'
  const [currentTrialId, setCurrentTrialId] = useState(null);
  const [showExcelImport, setShowExcelImport] = useState(false);

  // Data state
  const [trials, setTrials] = useState({});
  const [trialsLoading, setTrialsLoading] = useState(false);

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

  // =====================================================
  // AUTHENTICATION MANAGEMENT
  // =====================================================

  // Check for existing session on mount
  useEffect(() => {
    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadTrialsFromDatabase();
        } else {
          setTrials({});
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadTrialsFromDatabase();
        await checkForLocalStorageMigration();
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setTrials({});
      setStep('library');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Error signing out. Please try again.');
    }
  };

  // =====================================================
  // DATABASE OPERATIONS
  // =====================================================

  // Load all trials from database
  const loadTrialsFromDatabase = async () => {
    setTrialsLoading(true);
    try {
      const dbTrials = await getAllTrials();
      setTrials(dbTrials);
    } catch (error) {
      console.error('Error loading trials:', error);
      alert('Error loading trials from database');
    } finally {
      setTrialsLoading(false);
    }
  };

  // Auto-save current trial to database
  const saveCurrentTrial = async () => {
    if (!currentTrialId) return;

    // Don't try to save trials with temporary IDs (not yet in database)
    if (currentTrialId.startsWith('temp-')) return;

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

    try {
      const updatedTrial = await updateTrial(currentTrialId, trialData);
      setTrials(prev => ({ ...prev, [currentTrialId]: updatedTrial }));
    } catch (error) {
      console.error('Error saving trial:', error);
      // Silently fail on auto-save errors (user can manually save)
    }
  };

  // Auto-save when data changes (debounced)
  useEffect(() => {
    if (currentTrialId && gridLayout.length > 0 && user) {
      const timeout = setTimeout(() => {
        saveCurrentTrial();
      }, 1000); // Debounce 1 second

      return () => clearTimeout(timeout);
    }
  }, [config, gridLayout, orientation, layoutLocked, assessmentDates, photos, notes]);

  // =====================================================
  // TRIAL CRUD OPERATIONS
  // =====================================================

  // Create new trial
  const createNewTrial = async () => {
    const tempId = `temp-${Date.now()}`;
    setCurrentTrialId(tempId);

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

  // Finalize new trial (save to database)
  const finalizeNewTrial = async () => {
    try {
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
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      const newTrial = await createTrial(trialData);
      setCurrentTrialId(newTrial.id);
      setTrials(prev => ({ ...prev, [newTrial.id]: newTrial }));
    } catch (error) {
      console.error('Error creating trial:', error);
      alert('Error creating trial. Please try again.');
    }
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
  const handleDeleteTrial = async (trialId) => {
    if (!confirm('Delete this trial? This cannot be undone.')) return;

    try {
      await deleteTrialDB(trialId);
      setTrials(prev => {
        const newTrials = { ...prev };
        delete newTrials[trialId];
        return newTrials;
      });
    } catch (error) {
      console.error('Error deleting trial:', error);
      alert('Error deleting trial. Please try again.');
    }
  };

  // Export trial as JSON
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
  const importTrialJSON = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);

        // Create in database
        const newTrial = await createTrial(imported);
        setTrials(prev => ({ ...prev, [newTrial.id]: newTrial }));
        alert('Trial imported successfully!');
      } catch (err) {
        console.error('Error importing trial:', err);
        alert('Error importing trial. Check file format.');
      }
    };
    reader.readAsText(file);
  };

  // Load demo trial
  const loadDemoTrial = async () => {
    try {
      const response = await fetch('/demo-trial.json');
      const demoData = await response.json();

      const newTrial = await createTrial(demoData);
      setTrials(prev => ({ ...prev, [newTrial.id]: newTrial }));
      alert('Demo trial loaded successfully! You can now open it from the library.');
    } catch (err) {
      console.error('Error loading demo trial:', err);
      alert('Error loading demo trial. Please try again.');
    }
  };

  // Handle Excel import
  const handleExcelImport = async (parsedData) => {
    try {
      console.log('[App] Importing Excel data:', parsedData);
      const newTrial = await createTrial(parsedData);
      setTrials(prev => ({ ...prev, [newTrial.id]: newTrial }));
      setShowExcelImport(false);
      alert(`Trial "${parsedData.name}" imported successfully with ${parsedData.assessmentDates.length} assessment dates!`);
    } catch (err) {
      console.error('[App] Import error:', err);
      alert('Error importing trial from Excel: ' + err.message);
    }
  };

  // Handle config changes (for editing trial setup)
  const handleConfigChange = (newConfig, currentAssessmentDates) => {
    // Update config
    setConfig(newConfig);

    // Migrate assessment data to match new assessment types
    const migratedDates = currentAssessmentDates.map(dateObj => {
      const newAssessments = {};

      // For each new assessment type, try to preserve existing data
      newConfig.assessmentTypes.forEach(newType => {
        // Check if this assessment type exists in old data
        const oldData = dateObj.assessments[newType.name];

        if (oldData) {
          // Preserve existing data
          newAssessments[newType.name] = oldData;
        } else {
          // Create new empty assessment data for all plots
          newAssessments[newType.name] = {};
          gridLayout.flat().forEach(plot => {
            if (!plot.isBlank) {
              newAssessments[newType.name][plot.id] = { value: '', entered: false };
            }
          });
        }
      });

      return {
        ...dateObj,
        assessments: newAssessments
      };
    });

    setAssessmentDates(migratedDates);
    alert('Trial configuration updated successfully!');
  };

  // =====================================================
  // MIGRATION FROM LOCALSTORAGE
  // =====================================================

  const checkForLocalStorageMigration = async () => {
    try {
      const savedTrials = localStorage.getItem('trials');
      if (!savedTrials) return;

      const localTrials = JSON.parse(savedTrials);
      const trialCount = Object.keys(localTrials).length;

      if (trialCount === 0) return;

      if (confirm(
        `Found ${trialCount} trial(s) in local storage. Would you like to migrate them to the database?`
      )) {
        const results = await migrateFromLocalStorage(localTrials);

        alert(
          `Migration complete!\nSuccessful: ${results.success}\nFailed: ${results.errors.length}`
        );

        if (results.success > 0) {
          // Reload trials from database
          await loadTrialsFromDatabase();
          // Clear localStorage after successful migration
          localStorage.removeItem('trials');
        }
      }
    } catch (error) {
      console.error('Migration error:', error);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  // Check for valid Supabase credentials first
  if (!hasValidCredentials()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Supabase Configuration Required</h1>
            <p className="text-gray-600">Your Supabase credentials are missing or invalid</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="font-bold text-lg mb-3">Quick Setup (5 minutes):</h2>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="font-bold text-stri-teal">1.</span>
                <span>Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-stri-teal hover:underline font-medium">supabase.com/dashboard</a></span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-stri-teal">2.</span>
                <span>Click your project → <strong>Settings</strong> (⚙️) → <strong>API</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-stri-teal">3.</span>
                <span>Copy your <strong>Project URL</strong> and <strong>anon public</strong> key</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-stri-teal">4.</span>
                <span>Update the <code className="bg-gray-200 px-2 py-1 rounded">.env</code> file in your project root</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-stri-teal">5.</span>
                <span>Restart your dev server (Ctrl+C then <code className="bg-gray-200 px-2 py-1 rounded">npm run dev</code>)</span>
              </li>
            </ol>
          </div>

          <div className="bg-blue-50 border-l-4 border-stri-blue-info rounded p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>Need help?</strong> Check the <code className="bg-white px-2 py-1 rounded">SUPABASE_SETUP.md</code> file in your project for detailed instructions.
            </p>
          </div>

          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-stri-teal hover:bg-stri-teal-light text-white rounded-lg font-semibold transition"
            >
              Refresh After Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader size={48} className="animate-spin text-stri-teal mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!user) {
    return <Auth onAuthSuccess={() => checkUser()} />;
  }

  // Router - render appropriate component based on step
  if (step === 'library') {
    return (
      <>
        <TrialLibrary
          trials={trials}
          loading={trialsLoading}
          user={user}
          onCreateNew={createNewTrial}
          onLoadTrial={loadTrial}
          onDeleteTrial={handleDeleteTrial}
          onImportTrial={importTrialJSON}
          onImportExcel={() => setShowExcelImport(true)}
          onLoadDemo={loadDemoTrial}
          onSignOut={handleSignOut}
        />

        {showExcelImport && (
          <ExcelImport
            onImport={handleExcelImport}
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
        onFinalize={async () => {
          setLayoutLocked(true);

          // If this is a new trial (temp ID), create it in database
          if (currentTrialId.startsWith('temp-')) {
            await finalizeNewTrial();
          }

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
        onConfigChange={handleConfigChange}
        onUnlockLayout={() => {
          if (confirm('⚠️ Unlocking layout may affect existing data. Continue?')) {
            setLayoutLocked(false);
            setStep('layoutBuilder');
          }
        }}
        onExportJSON={exportTrialJSON}
        onBackToLibrary={async () => {
          await saveCurrentTrial();
          setStep('library');
        }}
      />
    );
  }

  return null;
};

export default App;
