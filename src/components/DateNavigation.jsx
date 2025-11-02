import React from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const DateNavigation = ({ 
  assessmentDates, 
  currentDateIndex, 
  onDateChange, 
  onAddDate 
}) => {
  const [newDate, setNewDate] = React.useState('');

  const handleAddDate = () => {
    if (!newDate) return;
    onAddDate(newDate);
    setNewDate('');
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
              className="w-full p-2 border rounded focus:ring-2 focus:ring-stri-teal focus:border-stri-teal"
            />
          </div>
          <button 
            onClick={handleAddDate} 
            className="px-4 py-2 bg-stri-green-success text-white rounded hover:bg-stri-green-growth flex items-center gap-2 transition"
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
              className="w-full p-2 border rounded focus:ring-2 focus:ring-stri-teal focus:border-stri-teal"
            />
          </div>
          <button 
            onClick={handleAddDate} 
            className="px-4 py-2 bg-stri-green-success text-white rounded hover:bg-stri-green-growth flex items-center gap-2 transition"
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
                : 'text-stri-teal hover:bg-gray-50'
            }`}
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="text-center">
            <div className="text-xl font-bold">{currentDate?.date}</div>
            <div className="text-sm text-gray-600">
              Assessment {currentDateIndex + 1} of {assessmentDates.length}
            </div>
          </div>
          
          <button
            onClick={() => onDateChange(Math.min(assessmentDates.length - 1, currentDateIndex + 1))}
            disabled={currentDateIndex === assessmentDates.length - 1}
            className={`p-2 rounded transition ${
              currentDateIndex === assessmentDates.length - 1
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-stri-teal hover:bg-gray-50'
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
