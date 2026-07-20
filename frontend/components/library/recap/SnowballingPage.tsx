import React from "react";

export default function SnowballingPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Snowballing</h1>
      <p className="text-text-muted mb-4">
        Iterative literature search to find relevant papers through citation networks.
      </p>
      <div className="bg-surface/50 backdrop-blur-sm rounded-xl p-6 border border-border-light">
        <h2 className="font-semibold mb-4 text-foreground">How it works</h2>
        <ol className="list-decimal pl-6 space-y-2 text-sm text-text-muted">
          <li>Start with a seed paper</li>
          <li>Find papers that cite it or are cited by it</li>
          <li>Repeat until no new relevant papers are found</li>
          <li>Review and synthesize the collected evidence</li>
        </ol>
      </div>
    </div>
  );
}
