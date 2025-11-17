import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Loader } from 'lucide-react';

// Import critical components (needed immediately)
import Auth from './components/Auth';
import TrialLibrary from './components/TrialLibrary';

// Lazy load heavy components (only loaded when needed)
const TrialSetup = lazy(() => import('./components/TrialSetup'));
const TrialLayoutEditor = lazy(() => import('./components/TrialLayoutEditor'));
const DataEntry = lazy(() => import('./components/DataEntry'));
const ExcelImport = lazy(() => import('./components/ExcelImport'));

// Import Supabase services
import { supabase, hasValidCredentials } from './services/supabase';
import {
  getAllTrials,
  createTrial,
  updateTrial,
  deleteTrial as deleteTrialDB,
  migrateFromLocalStorage
} from './services/database';

// Loading fallback component for lazy-loaded routes
const LoadingFallback = () => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <div className="text-center">
      <Loader size={48} className="animate-spin text-stri-teal mx-auto mb-4" />
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

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
          // Load trials in background (non-blocking)
          setTimeout(() => loadTrialsFromDatabase(), 0);
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
      setAuthLoading(false);

      // Load trials in background after UI renders (non-blocking)
      if (session?.user) {
        // Defer to next tick to allow UI to render first
        setTimeout(async () => {
          await loadTrialsFromDatabase();
          await checkForLocalStorageMigration();
        }, 0);
      }
    } catch (error) {
      console.error('Error checking user:', error);
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
  const handleConfigChange = (newConfig, currentAssessmentDates, newGridLayout, newOrientation) => {
    console.log('[App] handleConfigChange called');
    console.log('[App] Old config assessment types:', config.assessmentTypes.map(t => t.name));
    console.log('[App] New config assessment types:', newConfig.assessmentTypes.map(t => t.name));
    console.log('[App] Old config treatments:', config.treatments);
    console.log('[App] New config treatments:', newConfig.treatments);
    console.log('[App] Grid layout available:', !!gridLayout, 'Plots:', gridLayout?.flat().filter(p => !p.isBlank).length);

    // Use provided gridLayout if available, otherwise update current gridLayout with new treatment names
    const updatedGridLayout = (newGridLayout || gridLayout).map(row =>
      row.map(plot => {
        if (plot.isBlank) return plot;

        // Update treatment name based on treatment index
        const treatmentIndex = plot.treatment;
        const newTreatmentName = newConfig.treatments[treatmentIndex];

        if (newTreatmentName && newTreatmentName !== plot.treatmentName) {
          console.log(`[App] Updating plot ${plot.id} treatment: "${plot.treatmentName}" -> "${newTreatmentName}"`);
          return {
            ...plot,
            treatmentName: newTreatmentName
          };
        }

        return plot;
      })
    );

    // Migrate assessment data to match new assessment types
    const migratedDates = currentAssessmentDates.map(dateObj => {
      const newAssessments = {};

      console.log(`[App] Processing date: ${dateObj.date}`);
      console.log(`[App] Available assessments in date:`, Object.keys(dateObj.assessments));

      // For each new assessment type, try to preserve existing data
      newConfig.assessmentTypes.forEach((newType, index) => {
        // Check if this is a renamed assessment (same index, different name)
        const oldType = config.assessmentTypes[index];

        if (oldType && oldType.name !== newType.name) {
          // This is a rename - migrate data from old name to new name
          console.log(`[App] Migrating: "${oldType.name}" -> "${newType.name}"`);
          const oldData = dateObj.assessments[oldType.name];
          if (oldData) {
            const dataCount = Object.keys(oldData).filter(k => oldData[k].entered).length;
            console.log(`[App] Found ${dataCount} entered values for "${oldType.name}"`);
            newAssessments[newType.name] = oldData;
          } else {
            console.warn(`[App] No data found for "${oldType.name}"`);
            newAssessments[newType.name] = {};
            if (updatedGridLayout && updatedGridLayout.length > 0) {
              updatedGridLayout.flat().forEach(plot => {
                if (!plot.isBlank) {
                  newAssessments[newType.name][plot.id] = { value: '', entered: false };
                }
              });
            }
          }
        } else if (dateObj.assessments[newType.name]) {
          // Name hasn't changed, preserve existing data
          const dataCount = Object.keys(dateObj.assessments[newType.name]).filter(k => dateObj.assessments[newType.name][k].entered).length;
          console.log(`[App] Preserving ${dataCount} values for "${newType.name}"`);
          newAssessments[newType.name] = dateObj.assessments[newType.name];
        } else {
          // This is a new assessment type - create empty data
          console.log(`[App] New assessment type: "${newType.name}"`);
          newAssessments[newType.name] = {};
          if (updatedGridLayout && updatedGridLayout.length > 0) {
            updatedGridLayout.flat().forEach(plot => {
              if (!plot.isBlank) {
                newAssessments[newType.name][plot.id] = { value: '', entered: false };
              }
            });
          }
        }
      });

      return {
        ...dateObj,
        assessments: newAssessments
      };
    });

    console.log('[App] Migration complete, updating state');

    // Update config, grid layout, orientation, and assessment dates
    setConfig(newConfig);
    setGridLayout(updatedGridLayout);
    if (newOrientation !== undefined) {
      setOrientation(newOrientation);
    }
    setAssessmentDates(migratedDates);

    // Save immediately after config change
    setTimeout(async () => {
      console.log('[App] Auto-saving after config change');
      await saveCurrentTrial();
    }, 500);

    alert('Trial configuration updated successfully! Data has been preserved.');
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
          <Suspense fallback={<LoadingFallback />}>
            <ExcelImport
              onImport={handleExcelImport}
              onCancel={() => setShowExcelImport(false)}
            />
          </Suspense>
        )}
      </>
    );
  }

  if (step === 'setup') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TrialSetup
          config={config}
          onConfigChange={setConfig}
          onNext={() => setStep('layoutBuilder')}
          onBack={() => setStep('library')}
        />
      </Suspense>
    );
  }

  if (step === 'layoutBuilder') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TrialLayoutEditor
          config={config}
          gridLayout={gridLayout}
          orientation={orientation}
          onLayoutChange={setGridLayout}
          onOrientationChange={setOrientation}
          onFinalize={async () => {
            console.log('[App] Finalizing trial layout');
            console.log('[App] Current trial ID:', currentTrialId);
            console.log('[App] Grid layout:', gridLayout);
            console.log('[App] Config:', config);

            setLayoutLocked(true);

            // If this is a new trial (temp ID), create it in database
            if (currentTrialId.startsWith('temp-')) {
              console.log('[App] Creating new trial in database');
              try {
                await finalizeNewTrial();
                console.log('[App] Trial created successfully');
              } catch (error) {
                console.error('[App] Error creating trial:', error);
                alert('Error saving trial: ' + error.message);
                return; // Don't proceed to entry if save failed
              }
            }

            console.log('[App] Navigating to entry screen');
            setStep('entry');
          }}
          onBack={() => setStep('setup')}
        />
      </Suspense>
    );
  }

  if (step === 'entry') {
    return (
      <Suspense fallback={<LoadingFallback />}>
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
      </Suspense>
    );
  }

  return null;
};

export default App;
