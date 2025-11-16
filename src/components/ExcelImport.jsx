import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { parseExcelFile } from '../utils/excelParser';

export default function ExcelImport({ onImport, onCancel }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [showDateConfirmation, setShowDateConfirmation] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (selectedFile) => {
    // Validate file type
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setError('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setParsing(true);

    try {
      console.log('Starting to parse Excel file:', selectedFile.name);
      const data = await parseExcelFile(selectedFile);
      console.log('Parse successful:', data);
      setParsedData(data);
      setParsing(false);

      // Initialize selected dates with detected defaults
      if (data.dateInterpretations) {
        setSelectedDates(data.dateInterpretations.map(interp => interp.detected));

        // Check if any dates have multiple options (ambiguous)
        const hasAmbiguousDates = data.dateInterpretations.some(interp => interp.options.length > 1);
        if (hasAmbiguousDates) {
          setShowDateConfirmation(true);
        }
      }
    } catch (err) {
      console.error('Parse error:', err);
      setError(err.message || 'Failed to parse Excel file');
      setParsing(false);
      setParsedData(null);
    }
  };

  const handleDateChange = (index, newDate) => {
    const newSelectedDates = [...selectedDates];
    newSelectedDates[index] = newDate;
    setSelectedDates(newSelectedDates);
  };

  const handleConfirmDates = () => {
    // Update parsedData with selected dates
    const updatedData = {
      ...parsedData,
      assessmentDates: parsedData.assessmentDates.map((dateObj, index) => ({
        ...dateObj,
        date: selectedDates[index]
      }))
    };
    setParsedData(updatedData);
    setShowDateConfirmation(false);
  };

  const handleImport = () => {
    if (parsedData) {
      // Remove dateInterpretations before importing (it's only for UI)
      const { dateInterpretations, ...dataToImport } = parsedData;
      onImport(dataToImport);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData(null);
    setError(null);
    setParsing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Import Trial from Excel</h2>
            <p className="text-sm text-gray-600 mt-1">
              Upload your trial assessment spreadsheet to import data
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Upload Area */}
          {!file && (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Drop Excel file here
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                or click to browse
              </p>
              <input
                type="file"
                onChange={handleChange}
                accept=".xlsx,.xls"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors"
              >
                Select File
              </label>
            </div>
          )}

          {/* Parsing Status */}
          {file && parsing && (
            <div className="border rounded-lg p-6 bg-blue-50">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="h-6 w-6 text-blue-600 animate-pulse" />
                <div>
                  <h3 className="font-medium text-gray-900">Parsing Excel file...</h3>
                  <p className="text-sm text-gray-600">{file.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Debug Info */}
          <div className="mb-4 p-3 bg-gray-100 rounded text-xs space-y-1">
            <p><strong>Debug Info:</strong></p>
            <p>File selected: {file ? 'Yes' : 'No'} {file && `(${file.name})`}</p>
            <p>Parsing: {parsing ? 'Yes' : 'No'}</p>
            <p>Has error: {error ? 'Yes' : 'No'}</p>
            <p>Parsed data: {parsedData ? 'Yes' : 'No'}</p>
            {parsedData && <p>Trial name: {parsedData.name}</p>}
          </div>

          {/* Error Message */}
          {error && (
            <div className="border border-red-300 rounded-lg p-4 bg-red-50">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900">Error parsing file</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <button
                    onClick={handleReset}
                    className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Try another file
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview Parsed Data */}
          {parsedData && !parsing && (
            <div className="space-y-4">
              <div className="border border-green-300 rounded-lg p-4 bg-green-50">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-green-900">File parsed successfully!</h3>
                    <p className="text-sm text-green-700 mt-1">{file.name}</p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-sm text-green-600 hover:text-green-800 underline"
                  >
                    Change file
                  </button>
                </div>
              </div>

              {/* Trial Preview */}
              <div className="border rounded-lg p-6 bg-gray-50 space-y-4">
                <h3 className="font-bold text-lg text-gray-900">Trial Preview</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Trial Name:</span>
                    <p className="text-gray-900">{parsedData.name || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Trial ID:</span>
                    <p className="text-gray-900">{parsedData.id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Blocks:</span>
                    <p className="text-gray-900">{parsedData.config?.blocks || 0}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Treatments:</span>
                    <p className="text-gray-900">{parsedData.config?.treatments || 0}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Assessment Dates:</span>
                    <p className="text-gray-900">{parsedData.assessmentDates?.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Assessment Types:</span>
                    <p className="text-gray-900">{parsedData.config?.assessmentTypes?.length || 0}</p>
                  </div>
                </div>

                {/* Assessment Types */}
                {parsedData.config?.assessmentTypes && parsedData.config.assessmentTypes.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 block mb-2">
                      Assessment Types Found:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {parsedData.config.assessmentTypes.map((type, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {type.name} {type.unit && `(${type.unit})`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assessment Dates */}
                {parsedData.assessmentDates && parsedData.assessmentDates.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 block mb-2">
                      Assessment Dates:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {parsedData.assessmentDates.map((dateObj, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                        >
                          {dateObj.date}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {parsedData.metadata && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 block mb-2">
                      Additional Information:
                    </span>
                    <div className="bg-white rounded p-3 text-sm space-y-1">
                      {parsedData.metadata.area && (
                        <p><span className="font-medium">Area:</span> {parsedData.metadata.area}</p>
                      )}
                      {parsedData.metadata.assessor && (
                        <p><span className="font-medium">Assessor:</span> {parsedData.metadata.assessor}</p>
                      )}
                      {parsedData.metadata.notes && (
                        <p><span className="font-medium">Notes:</span> {parsedData.metadata.notes}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Date Confirmation Modal */}
          {showDateConfirmation && parsedData?.dateInterpretations && (
            <div className="border border-yellow-300 rounded-lg p-6 bg-yellow-50">
              <div className="flex items-start space-x-3 mb-4">
                <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-yellow-900 text-lg">Confirm Assessment Dates</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Some dates could be interpreted multiple ways. Please confirm the correct format:
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {parsedData.dateInterpretations.map((interp, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 border border-yellow-200">
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-600">Original from Excel:</span>
                      <p className="text-lg font-bold text-gray-900">"{interp.original}"</p>
                    </div>

                    {interp.options.length > 1 ? (
                      <div>
                        <span className="text-sm font-medium text-gray-600 block mb-2">
                          Select correct interpretation:
                        </span>
                        <div className="space-y-2">
                          {interp.options.map((option, optIdx) => (
                            <label
                              key={optIdx}
                              className={`flex items-center p-3 rounded-lg cursor-pointer transition ${
                                selectedDates[index] === option.date
                                  ? 'bg-blue-100 border-2 border-blue-500'
                                  : 'bg-gray-50 border-2 border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`date-${index}`}
                                value={option.date}
                                checked={selectedDates[index] === option.date}
                                onChange={(e) => handleDateChange(index, e.target.value)}
                                className="mr-3"
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">{option.format}</div>
                                <div className="text-sm text-gray-600">{option.readable}</div>
                                <div className="text-xs text-gray-500 mt-1">ISO: {option.date}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-green-700">
                        <CheckCircle size={18} />
                        <div>
                          <span className="font-semibold">{interp.options[0]?.format}:</span>{' '}
                          {interp.options[0]?.readable}
                          <div className="text-xs text-gray-600 mt-1">ISO: {interp.options[0]?.date}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-yellow-200">
                <button
                  onClick={() => setShowDateConfirmation(false)}
                  className="px-4 py-2 text-yellow-700 hover:text-yellow-900 transition-colors"
                >
                  Skip (Use Defaults)
                </button>
                <button
                  onClick={handleConfirmDates}
                  className="px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors flex items-center space-x-2"
                >
                  <CheckCircle size={18} />
                  <span>Confirm Dates</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            {parsedData && !showDateConfirmation && (
              <button
                onClick={handleImport}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Download size={18} />
                <span>Import Trial</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
