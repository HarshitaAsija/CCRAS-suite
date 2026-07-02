export function SettingsView() {
  return (
    <div className="flex-1 p-8 bg-background flex flex-col overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-text-muted mt-1">Configure your workspace preferences and integrations.</p>
      </div>
      
      <div className="max-w-3xl flex flex-col gap-6">
        <div className="bg-surface rounded-xl border border-border-light p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">CCRAS Suite Integration</h3>
          <p className="text-sm text-text-muted mb-6">Brahma is operating as the Design module. Connection settings to RECAP and RISHI-AI.</p>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border-light">
              <div>
                <div className="font-medium text-foreground">RECAP (Library) Connection</div>
                <div className="text-xs text-text-muted mt-1">Sync evidence collections automatically</div>
              </div>
              <div className="w-12 h-6 bg-success/20 rounded-full flex items-center p-1 cursor-pointer">
                <div className="w-4 h-4 bg-success rounded-full translate-x-6" />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border-light">
              <div>
                <div className="font-medium text-foreground">RISHI-AI (Discover) Connection</div>
                <div className="text-xs text-text-muted mt-1">Import validated research gaps</div>
              </div>
              <div className="w-12 h-6 bg-success/20 rounded-full flex items-center p-1 cursor-pointer">
                <div className="w-4 h-4 bg-success rounded-full translate-x-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
