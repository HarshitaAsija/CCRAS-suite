"use client";
export default function SearchPage() {
  return (
    <div className="p-8 md:ml-64 min-h-screen bg-white">
      <h1 className="text-2xl font-bold text-gray-900">Search</h1>
      <p className="text-gray-600 mt-2">Search across millions of research papers</p>
      <div className="mt-6">
        <input 
          type="text" 
          placeholder="Search papers, authors, keywords..."
          className="w-full max-w-2xl px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
    </div>
  );
}