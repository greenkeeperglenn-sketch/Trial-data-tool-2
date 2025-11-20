import React, { useState } from 'react';
import { Plus, Trash2, Upload, Play, LogOut, User, FileSpreadsheet, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';

const TrialLibrary = ({ trials, loading, user, onCreateNew, onLoadTrial, onDeleteTrial, onImportTrial, onImportExcel, onLoadDemo, onSignOut, onUpdateTrialMetadata }) => {
  const [expandedTrials, setExpandedTrials] = useState({});
  const [editingTrial, setEditingTrial] = useState(null);
  const [metadataForm, setMetadataForm] = useState({});

  const trialList = Object.values(trials).sort((a, b) =>
    new Date(b.lastModified) - new Date(a.lastModified)
  );

  const toggleExpand = (trialId) => {
    setExpandedTrials(prev => ({
      ...prev,
      [trialId]: !prev[trialId]
    }));
  };

  const startEditingMetadata = (trial) => {
    setEditingTrial(trial.id);
    setMetadataForm({
      trialistName: trial.trialistName || '',
      clientSponsor: trial.clientSponsor || '',
      contactInfo: trial.contactInfo || ''
    });
  };

  const saveMetadata = async (trialId) => {
    if (onUpdateTrialMetadata) {
      await onUpdateTrialMetadata(trialId, metadataForm);
    }
    setEditingTrial(null);
  };

  const cancelEditing = () => {
    setEditingTrial(null);
    setMetadataForm({});
  };

  const calculateStats = (trial) => {
    // Count data points (entered assessments)
    let dataPoints = 0;
    if (trial.assessmentDates) {
      trial.assessmentDates.forEach(dateObj => {
        Object.values(dateObj.assessments || {}).forEach(assessmentData => {
          Object.values(assessmentData).forEach(plotData => {
            if (plotData.entered) {
              dataPoints++;
            }
          });
        });
      });
    }

    // Count images
    const imageCount = Object.keys(trial.photos || {}).length;

    return { dataPoints, imageCount };
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Trial Library</h1>
          <p className="text-gray-600">Manage your field trials</p>
        </div>

        {/* User Info & Sign Out */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User size={16} />
                <span>{user.email}</span>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-6 py-3 bg-stri-teal text-white rounded-lg hover:bg-stri-teal-light transition"
        >
          <Plus size={20} /> Create New Trial
        </button>

        <button
          onClick={onLoadDemo}
          className="flex items-center gap-2 px-6 py-3 bg-stri-blue-research text-white rounded-lg hover:bg-stri-blue-info transition"
        >
          <Play size={20} /> Load Demo Trial
        </button>

        <button
          onClick={onImportExcel}
          className="flex items-center gap-2 px-6 py-3 bg-stri-green-growth text-white rounded-lg hover:bg-stri-green-success transition"
        >
          <FileSpreadsheet size={20} /> Import from Excel
        </button>

        <label className="flex items-center gap-2 px-6 py-3 bg-stri-green-success text-white rounded-lg hover:bg-stri-green-growth cursor-pointer transition">
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
          <strong>💡 Tip:</strong> Use "Backup Trial" inside each trial to export as JSON. 
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
          trialList.map(trial => {
            const isExpanded = expandedTrials[trial.id];
            const isEditing = editingTrial === trial.id;
            const stats = calculateStats(trial);

            return (
              <div
                key={trial.id}
                className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
              >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold flex-1">{trial.name}</h3>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleExpand(trial.id)}
                      className="text-gray-500 hover:bg-gray-100 p-1 rounded transition"
                      title={isExpanded ? "Collapse details" : "Expand details"}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <button
                      onClick={() => onDeleteTrial(trial.id)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
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

                {/* Expandable Details Section */}
                {isExpanded && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-gray-700">Trial Information</h4>
                      {!isEditing && (
                        <button
                          onClick={() => startEditingMetadata(trial)}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Trialist Name
                          </label>
                          <input
                            type="text"
                            value={metadataForm.trialistName}
                            onChange={(e) => setMetadataForm({ ...metadataForm, trialistName: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter trialist name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Client/Sponsor
                          </label>
                          <input
                            type="text"
                            value={metadataForm.clientSponsor}
                            onChange={(e) => setMetadataForm({ ...metadataForm, clientSponsor: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter client/sponsor"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Contact Info
                          </label>
                          <input
                            type="text"
                            value={metadataForm.contactInfo}
                            onChange={(e) => setMetadataForm({ ...metadataForm, contactInfo: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter contact info"
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => saveMetadata(trial.id)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Trialist:</span>{' '}
                          <span className="text-gray-600">
                            {trial.trialistName || <em className="text-gray-400">Not specified</em>}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Client/Sponsor:</span>{' '}
                          <span className="text-gray-600">
                            {trial.clientSponsor || <em className="text-gray-400">Not specified</em>}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Contact:</span>{' '}
                          <span className="text-gray-600">
                            {trial.contactInfo || <em className="text-gray-400">Not specified</em>}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-gray-200 mt-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-medium text-gray-700">Data Points:</span>{' '}
                              <span className="text-blue-600 font-semibold">{stats.dataPoints}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Images:</span>{' '}
                              <span className="text-green-600 font-semibold">{stats.imageCount}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Open Button */}
                <button
                  onClick={() => onLoadTrial(trial.id)}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  Open Trial
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TrialLibrary;
