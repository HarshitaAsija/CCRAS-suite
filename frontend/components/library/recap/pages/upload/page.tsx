"use client";
export default function UploadPage() {
  return (
    <div className="p-8 md:ml-64 min-h-screen bg-white">
      <h1 className="text-2xl font-bold text-gray-900">Upload Papers</h1>
      <p className="text-gray-600 mt-2">Upload research papers to your library</p>
      <div className="mt-6 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <p className="text-gray-500">Drag and drop your papers here, or click to browse</p>
        <button className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Select Files
        </button>
      </div>
    </div>
  );
}
