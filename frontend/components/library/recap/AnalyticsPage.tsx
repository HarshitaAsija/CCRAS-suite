import React from "react";

export default function AnalyticsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Analytics</h1>
      <p className="text-text-muted mb-4">
        Gain insights into your research library with visualizations and metrics.
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-surface/50 backdrop-blur-sm rounded-xl p-6 border border-border-light">
          <h3 className="font-semibold mb-4 text-foreground">Collection Growth</h3>
          <div className="h-20 bg-border-light rounded-full">
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 h-full w-2/3 rounded-full"></div>
          </div>
          <p className="text-sm text-text-muted mt-2">12 collections added this month</p>
        </div>
        <div className="bg-surface/50 backdrop-blur-sm rounded-xl p-6 border border-border-light">
          <h3 className="font-semibold mb-4 text-foreground">Paper Distribution</h3>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Recent Papers</span>
            <span className="font-medium text-foreground">45</span>
          </div>
        </div>
        <div className="bg-surface/50 backdrop-blur-sm rounded-xl p-6 border border-border-light">
          <h3 className="font-semibold mb-4 text-foreground">Search Activity</h3>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Searches Today</span>
            <span className="font-medium text-foreground">23</span>
          </div>
        </div>
      </div>
    </div>
  );
}
