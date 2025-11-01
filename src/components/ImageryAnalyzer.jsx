import React, { useState, useRef } from 'react';

const ImageryAnalyzer = ({
  gridLayout,
  config,
  currentDateObj,
  selectedAssessmentType,
  onSelectAssessmentType,
  onBulkUpdateData
}) => {
  const [imageSrc, setImageSrc] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Turf Trial Imagery Analyzer</h2>
          <p className="text-sm text-gray-600">
            Upload a drone image to analyze plot coverage.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition"
          >
            Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={(event) => handleFileUpload(event.target.files?.[0])}
            className="hidden"
          />
        </div>

        <div className="border-2 border-dashed rounded-lg p-8 text-center border-gray-300 bg-gray-50">
          <p className="text-lg font-medium">Drag & drop or click to upload a drone image</p>
          <p className="text-sm text-gray-500 mt-2">JPEG or PNG files are supported</p>
        </div>

        {imageSrc && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Uploaded Image</h3>
            <img
              src={imageSrc}
              alt="Uploaded drone imagery"
              className="w-full max-h-96 object-contain border rounded"
            />
            <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded">
              <p className="font-medium">Image uploaded successfully!</p>
              <p className="text-sm mt-2">
                Full imagery analysis with plot detection and green coverage calculation
                requires additional configuration. This simplified version displays your uploaded image.
              </p>
            </div>
          </div>
        )}

        {!imageSrc && (
          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">How to use:</h3>
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
              <li>Upload an aerial/drone image of your trial plots</li>
              <li>The system will display your image for review</li>
              <li>Advanced features like plot detection and analysis coming soon</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageryAnalyzer;
