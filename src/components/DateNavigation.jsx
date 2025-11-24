import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

const DateNavigation = ({
  assessmentDates,
  currentDateIndex,
  onDateChange,
  onAddDate,
  onDeleteDate
}) => {
  const [newDate, setNewDate] = React.useState('');

  const handleAddDate = () => {
    if (!newDate) return;
    onAddDate(newDate);
    setNewDate('');
  };

  const handleDeleteDate = () => {
    const dateToDelete = assessmentDates[currentDateIndex].date;
    if (!confirm(`Delete assessment date "${dateToDelete}"?\n\nThis will remove:\n• All assessment data for this date\n• All photos from this date\n• All notes from this date\n\nThis cannot be undone.`)) {
      return;
    }
    onDeleteDate(currentDateIndex);
  };

  const currentDate = assessmentDates[currentDateIndex];

  if (assessmentDates.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Add Assessment Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button 
            onClick={handleAddDate} 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 transition"
          >
            <Plus size={20} /> Add Date
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Add Date Section */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Add Assessment Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button 
            onClick={handleAddDate} 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 transition"
          >
            <Plus size={20} /> Add Date
          </button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onDateChange(Math.max(0, currentDateIndex - 1))}
            disabled={currentDateIndex === 0}
            className={`p-2 rounded transition ${
              currentDateIndex === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-center flex-1">
            <div className="text-xl font-bold">{currentDate?.date}</div>
            <div className="text-sm text-gray-600">
              Assessment {currentDateIndex + 1} of {assessmentDates.length}
            </div>
            {onDeleteDate && (
              <button
                onClick={handleDeleteDate}
                className="mt-2 flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition mx-auto"
                title="Delete this assessment date and all its data"
              >
                <Trash2 size={14} /> Delete Date
              </button>
            )}
          </div>

          <button
            onClick={() => onDateChange(Math.min(assessmentDates.length - 1, currentDateIndex + 1))}
            disabled={currentDateIndex === assessmentDates.length - 1}
            className={`p-2 rounded transition ${
              currentDateIndex === assessmentDates.length - 1
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </>
  );
};

export default DateNavigation;
