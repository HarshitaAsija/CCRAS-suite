import React from "react";

export default function UploadPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Upload Papers</h1>
      <p className="text-text-muted mb-4">
        Add your research papers to the library by uploading files or importing from external sources.
      </p>
      <div className="space-y-6">
        <div className="bg-surface/50 backdrop-blur-sm rounded-xl p-6 border border-border-light">
          <h3 className="font-semibold mb-4">Upload Files</h3>
          <p className="text-text-muted">Supported formats: PDF, EPUB, RIS, BibTeX, CSV</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input
              type="file"
              accept=".pdf,.epub,.ris,.bib,.csv"
              className="flex-1 px-4 py-2 border border-border-light rounded-lg bg-surface/20 text-foreground placeholder-text-text-muted"
            />
            <button className="px-6 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:opacity-90">
              Upload
            </button>
          </div>
        </div>
        <div className="bg-surface/50 backdrop-blur-sm rounded-xl p-6 border border-border-light">
          <h3 className="font-semibold mb-4">Import from Sources</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface/20 rounded-lg">
              <span>PubMed</span>
              <button className="px-3 py-1 bg-surface/20 text-text-muted hover:bg-surface/30 rounded hover:opacity-90">
                Connect
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface/20 rounded-lg">
              <span>arXiv</span>
              <button className="px-3 py-1 bg-surface/20 text-text-muted hover:bg-surface/30 rounded hover:opacity-90">
                Connect
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface/20 rounded-lg">
              <span>Google Scholar</span>
              <button className="px-3 py-1 bg-surface/20 text-text-muted hover:bg-surface/30 rounded hover:opacity-90">
                Connect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
