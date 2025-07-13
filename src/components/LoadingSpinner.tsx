import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner(): JSX.Element {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <Loader2 className="loading-spinner" size={32} />
        <p>Loading...</p>
      </div>
    </div>
  );
}