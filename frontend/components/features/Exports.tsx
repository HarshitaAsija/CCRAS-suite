export function Exports() {
  return (
    <div className="flex-1 p-8 bg-background flex flex-col overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Exported Documents</h1>
        <p className="text-text-muted mt-1">Download and manage your exported PDF and Word documents.</p>
      </div>
      
      <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-border-light rounded-2xl bg-surface/50">
        <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center text-success mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground">No recent exports</h3>
        <p className="text-sm text-text-muted mt-1 max-w-sm text-center mb-6">Your exported documents will appear here. Currently, your export queue is empty.</p>
      </div>
    </div>
  );
}
