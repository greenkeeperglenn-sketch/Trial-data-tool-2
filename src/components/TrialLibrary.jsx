import React from 'react';
import { Plus, Trash2, Upload, FileSpreadsheet } from 'lucide-react';

const TrialLibrary = ({ trials, onCreateNew, onLoadTrial, onDeleteTrial, onImportTrial, onImportExcel }) => {
  const trialList = Object.values(trials).sort((a, b) => 
    new Date(b.lastModified) - new Date(a.lastModified)
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Trial Library</h1>
        <p className="text-gray-600">Manage your field trials</p>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Create New Trial
        </button>

        <button
          onClick={onImportExcel}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <FileSpreadsheet size={20} /> Import from Excel
        </button>

        <label className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition">
          <Upload size={20} /> Import Trial (JSON)
          <input
            type="file"
            accept=".json"
            onChange={onImportTrial}
            className="hidden"
          />
        </label>
      </div>

      {/* Info Box */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>💡 Tip:</strong> Import existing trial data from Excel spreadsheets or use "Backup Trial" inside each trial to export as JSON.
          You can re-import here to restore data or share with colleagues.
        </p>
      </div>

      {/* Trial Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trialList.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No trials yet. Create your first trial!</p>
          </div>
        ) : (
          trialList.map(trial => (
            <div 
              key={trial.id} 
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold">{trial.name}</h3>
                <button 
                  onClick={() => onDeleteTrial(trial.id)} 
                  className="text-red-500 hover:bg-red-50 p-1 rounded transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Card Details */}
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div>
                  <strong>Blocks:</strong> {trial.config.numBlocks} | 
                  <strong> Treatments:</strong> {trial.config.numTreatments}
                </div>
                <div>
                  <strong>Assessments:</strong> {trial.assessmentDates?.length || 0}
                </div>
                <div>
                  <strong>Modified:</strong> {new Date(trial.lastModified).toLocaleDateString()}
                </div>
                {trial.layoutLocked && (
                  <div className="text-green-600 font-medium">✓ Layout Locked</div>
                )}
              </div>

              {/* Open Button */}
              <button 
                onClick={() => onLoadTrial(trial.id)} 
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded transition"
              >
                Open Trial
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TrialLibrary;
