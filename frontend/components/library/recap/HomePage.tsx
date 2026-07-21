import React from "react";

export default function HomePage() {
  return (
    <div className="p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">Welcome to RECAP-KRITA</h1>
        <p className="text-lg text-text-muted mb-6">
          Your AI-powered research assistant for discovering, understanding, and synthesizing scientific knowledge.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:opacity-90">
            Get Started
          </button>
          <button className="px-6 py-3 border border-border-light text-text-muted rounded-lg hover:bg-surface/30">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
}
