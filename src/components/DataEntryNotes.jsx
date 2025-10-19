import React from 'react';
import { X } from 'lucide-react';

const DataEntryNotes = ({
  config,
  gridLayout,
  currentDateObj,
  selectedAssessmentType,
  photos,
  notes,
  onPhotosChange,
  onNotesChange
}) => {
  const notesKey = `${currentDateObj.date}_${selectedAssessmentType}`;

  const updateNotes = (value) => {
    onNotesChange({
      ...notes,
      [notesKey]: value
    });
  };

  const deletePhoto = (plotId, photoIndex) => {
    const key = `${currentDateObj.date}_${plotId}`;
    const updatedPhotos = {
      ...photos,
      [key]: photos[key].filter((_, idx) => idx !== photoIndex)
    };
    onPhotosChange(updatedPhotos);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-xl font-bold mb-4">
        Notes - {currentDateObj.date} - {selectedAssessmentType}
      </h3>
      
      {/* Assessment Notes */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Assessment Notes</label>
        <textarea
          value={notes[notesKey] || ''}
          onChange={(e) => updateNotes(e.target.value)}
          className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[200px]"
          placeholder="Enter observations, weather conditions, notable findings..."
        />
      </div>

      {/* Voice Recording Placeholder */}
      <div className="mb-6">
        <button 
          onClick={() => alert('Voice transcription coming in Phase 2! For now, please type your notes.')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 rounded cursor-not-allowed"
          disabled
        >
          🎤 Voice Recording (Coming Soon)
        </button>
      </div>

      {/* Photo Gallery */}
      <div>
        <h4 className="font-medium mb-3">Photos from this Assessment</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {gridLayout.flat().filter(p => !p.isBlank).map(plot => {
            const photoKey = `${currentDateObj.date}_${plot.id}`;
            const plotPhotos = photos[photoKey] || [];
            
            return plotPhotos.map((photo, photoIdx) => (
              <div key={`${plot.id}-${photoIdx}`} className="relative group">
                <img 
                  src={photo} 
                  alt={`${plot.id}`} 
                  className="w-full h-32 object-cover rounded border shadow-sm"
                />
                <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {plot.id}
                </div>
                <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {plot.treatmentName}
                </div>
                <button
                  onClick={() => deletePhoto(plot.id, photoIdx)}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>
            ));
          })}
        </div>
        
        {Object.keys(photos).filter(key => key.startsWith(currentDateObj.date)).length === 0 && (
          <p className="text-gray-500 text-sm">
            No photos uploaded yet. Add photos in Field Map view.
          </p>
        )}
      </div>
    </div>
  );
};

export default DataEntryNotes;
