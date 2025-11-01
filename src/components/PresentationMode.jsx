import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Image as ImageIcon, FileText, TrendingUp } from 'lucide-react';

// Simple SVG Line Chart Component
const SimpleLineChart = ({ data, assessmentType, currentDate, min, max, color }) => {
  const width = 800;
  const height = 300;
  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  if (!data || data.length === 0) return null;

  // Find min/max values for scaling
  const values = data.map(d => parseFloat(d.value)).filter(v => !isNaN(v));
  if (values.length === 0) return null;

  const dataMin = min;
  const dataMax = max;
  const range = dataMax - dataMin;

  // Scale functions
  const scaleX = (index) => padding + (index / (data.length - 1)) * chartWidth;
  const scaleY = (value) => {
    if (isNaN(value)) return null;
    return height - padding - ((value - dataMin) / range) * chartHeight;
  };

  // Create path
  const points = data.map((d, i) => {
    const y = scaleY(parseFloat(d.value));
    if (y === null) return null;
    return { x: scaleX(i), y, date: d.date };
  }).filter(p => p !== null);

  const pathData = points.map((p, i) => {
    return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
  }).join(' ');

  // Find current date index
  const currentDateIndex = data.findIndex(d => d.date === currentDate);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="text-gray-300">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = height - padding - pct * chartHeight;
        const value = (dataMin + pct * range).toFixed(1);
        return (
          <g key={pct}>
            <line
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#374151"
              strokeDasharray="3 3"
            />
            <text x={padding - 10} y={y + 5} fontSize="12" fill="#9ca3af" textAnchor="end">
              {value}
            </text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {data.map((d, i) => {
        const x = scaleX(i);
        return (
          <text
            key={i}
            x={x}
            y={height - padding + 20}
            fontSize="11"
            fill="#9ca3af"
            textAnchor="middle"
          >
            {d.date}
          </text>
        );
      })}

      {/* Current date marker */}
      {currentDateIndex >= 0 && (
        <g>
          <line
            x1={scaleX(currentDateIndex)}
            y1={padding}
            x2={scaleX(currentDateIndex)}
            y2={height - padding}
            stroke="#a855f7"
            strokeWidth="3"
          />
          <text
            x={scaleX(currentDateIndex)}
            y={padding - 10}
            fontSize="14"
            fontWeight="bold"
            fill="#a855f7"
            textAnchor="middle"
          >
            Current
          </text>
        </g>
      )}

      {/* Line path */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="3"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="6"
          fill={color}
          className="hover:r-8 transition-all cursor-pointer"
        />
      ))}
    </svg>
  );
};

const PresentationMode = ({
  config,
  gridLayout,
  assessmentDates,
  photos,
  notes
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Get all dates sorted chronologically
  const sortedDates = [...assessmentDates].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const currentDate = sortedDates[currentSlide];

  // Group plots by treatment
  const getTreatmentGroups = () => {
    const groups = {};
    gridLayout.forEach(row => {
      row.forEach(plot => {
        if (!plot.isBlank) {
          const treatment = plot.treatmentName || 'Untreated';
          if (!groups[treatment]) {
            groups[treatment] = [];
          }
          groups[treatment].push(plot);
        }
      });
    });
    return groups;
  };

  const treatmentGroups = getTreatmentGroups();

  // Get photos for current date
  const getPhotosForDate = (date) => {
    const datePhotos = {};
    Object.entries(photos).forEach(([key, photoArray]) => {
      if (key.startsWith(`${date}_`)) {
        const plotId = key.substring(date.length + 1);
        datePhotos[plotId] = photoArray;
      }
    });
    return datePhotos;
  };

  const currentPhotos = getPhotosForDate(currentDate?.date);

  // Get notes for current date
  const getCurrentNotes = () => {
    if (!notes || !currentDate) return [];
    return Object.entries(notes)
      .filter(([key]) => key.startsWith(`${currentDate.date}_`))
      .map(([key, note]) => {
        const plotId = key.substring(currentDate.date.length + 1);
        return { plotId, note };
      })
      .filter(item => item.note && item.note.trim() !== '');
  };

  const currentNotes = getCurrentNotes();

  // Prepare chart data for a specific assessment type
  const prepareChartDataForType = (typeName) => {
    return sortedDates.map(dateObj => {
      const assessment = dateObj.assessments[typeName];
      if (assessment) {
        const values = Object.values(assessment)
          .filter(v => v.entered && v.value !== '')
          .map(v => parseFloat(v.value));

        if (values.length > 0) {
          const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
          return { date: dateObj.date, value: avg.toFixed(1) };
        }
      }
      return { date: dateObj.date, value: null };
    }).filter(d => d.value !== null);
  };

  const nextSlide = () => {
    if (currentSlide < sortedDates.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Timeline Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto p-6">
          {/* Trial Title */}
          <h1 className="text-3xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {config.trialName}
          </h1>

          {/* Timeline */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="flex gap-2 overflow-x-auto py-2 px-4">
              {sortedDates.map((date, idx) => (
                <button
                  key={date.date}
                  onClick={() => setCurrentSlide(idx)}
                  className={`px-4 py-2 rounded-lg transition whitespace-nowrap ${
                    idx === currentSlide
                      ? 'bg-purple-600 shadow-lg scale-110'
                      : idx < currentSlide
                      ? 'bg-gray-600 opacity-60'
                      : 'bg-gray-700 opacity-40'
                  }`}
                >
                  <Calendar size={16} className="inline mr-1" />
                  {date.date}
                </button>
              ))}
            </div>

            <button
              onClick={nextSlide}
              disabled={currentSlide === sortedDates.length - 1}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="text-center text-sm text-gray-400">
            Slide {currentSlide + 1} of {sortedDates.length}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Date Title */}
        <div className="text-center">
          <h2 className="text-5xl font-bold mb-2">{currentDate?.date}</h2>
          <p className="text-gray-400">Assessment Data</p>
        </div>

        {/* Photos Section - Grouped by Treatment */}
        {Object.keys(currentPhotos).length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <ImageIcon size={24} className="text-blue-400" />
              Plot Images by Treatment
            </h3>

            {Object.entries(treatmentGroups).map(([treatment, plots]) => {
              const treatmentPhotos = plots.filter(plot => currentPhotos[plot.id]);

              if (treatmentPhotos.length === 0) return null;

              return (
                <div key={treatment} className="mb-8 last:mb-0">
                  <h4 className="text-xl font-semibold mb-4 text-purple-400">{treatment}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {treatmentPhotos.map(plot => {
                      const plotPhotos = currentPhotos[plot.id];
                      if (!plotPhotos || plotPhotos.length === 0) return null;

                      return (
                        <div key={plot.id} className="bg-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition transform hover:scale-105">
                          <img
                            src={plotPhotos[0]}
                            alt={plot.id}
                            className="w-full aspect-square object-cover"
                          />
                          <div className="p-2 text-center">
                            <div className="font-medium text-sm">{plot.id}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Notes Section */}
        {currentNotes.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <FileText size={24} className="text-green-400" />
              Notes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentNotes.map(({ plotId, note }) => (
                <div key={plotId} className="bg-gray-700 rounded-lg p-4">
                  <div className="font-semibold text-blue-400 mb-2">Plot {plotId}</div>
                  <p className="text-gray-300 text-sm">{note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Graphs Section - One per Assessment Type */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp size={24} className="text-orange-400" />
            Assessment Trends
          </h3>

          <div className="space-y-8">
            {config.assessmentTypes.map((type, idx) => {
              const chartData = prepareChartDataForType(type.name);
              if (chartData.length === 0) return null;

              return (
                <div key={type.name} className="bg-gray-700 rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-4 text-center text-gray-200">{type.name}</h4>
                  <div className="flex justify-center">
                    <SimpleLineChart
                      data={chartData}
                      assessmentType={type.name}
                      currentDate={currentDate?.date}
                      min={type.min}
                      max={type.max}
                      color={colors[idx % colors.length]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="flex justify-between items-center pt-8">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Previous
          </button>

          <div className="text-gray-400">
            {currentSlide + 1} / {sortedDates.length}
          </div>

          <button
            onClick={nextSlide}
            disabled={currentSlide === sortedDates.length - 1}
            className="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            Next
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresentationMode;
