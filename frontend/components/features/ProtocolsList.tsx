export function ProtocolsList() {
  return (
    <div className="flex-1 p-8 bg-background flex flex-col overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Saved Protocols</h1>
        <p className="text-text-muted mt-1">Manage and export your generated study protocols.</p>
      </div>
      
      <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-border-light rounded-2xl bg-surface/50">
        <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center text-primary mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground">No protocols yet</h3>
        <p className="text-sm text-text-muted mt-1 max-w-sm text-center mb-6">You haven't generated any study protocols yet. Head over to the Study Design Studio to create your first protocol.</p>
        <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          Go to Study Design
        </button>
      </div>
    </div>
  );
}
