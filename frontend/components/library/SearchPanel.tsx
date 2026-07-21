import React from 'react';
import { LiteratureExplorer } from '../literature/LiteratureExplorer';

interface SearchPanelProps = {};

export const SearchPanel: React.FC<SearchPanelProps> = () => {
  return (
    <div className="flex-1 overflow-auto bg-surface-hover">
      <LiteratureExplorer />
    </div>
  );
};