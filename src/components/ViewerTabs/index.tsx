/**
 * ViewerTabs Component
 * Tab navigation for different viewer modes
 */

import React from 'react';
import './styles.css';

export type TabId = 'viewer' | 'comparison' | 'analysis';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface ViewerTabsProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  className?: string;
}

export const ViewerTabs: React.FC<ViewerTabsProps> = ({
  activeTab,
  onTabChange,
  className = '',
}) => {
  const tabs: Tab[] = [
    {
      id: 'viewer',
      label: 'Viewer',
      description: 'Single series viewing and analysis',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21,15 16,10 5,21"/>
        </svg>
      ),
    },
    {
      id: 'comparison',
      label: 'Comparison',
      description: 'Side-by-side study comparison',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9"/>
          <rect x="14" y="3" width="7" height="5"/>
          <rect x="14" y="12" width="7" height="9"/>
          <rect x="3" y="16" width="7" height="5"/>
        </svg>
      ),
    },
    {
      id: 'analysis',
      label: 'Analysis',
      description: 'Advanced measurement and annotation tools',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
          <path d="M22 12A10 10 0 0 0 12 2v10z"/>
        </svg>
      ),
    },
  ];

  return (
    <div className={`viewer-tabs ${className}`}>
      <div className="viewer-tabs__container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`viewer-tab ${
              activeTab === tab.id ? 'viewer-tab--active' : ''
            }`}
            onClick={() => onTabChange(tab.id)}
            title={tab.description}
          >
            <div className="viewer-tab__icon">
              {tab.icon}
            </div>
            <span className="viewer-tab__label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="viewer-tabs__indicator">
        <div
          className="indicator"
          style={{
            transform: `translateX(${tabs.findIndex(tab => tab.id === activeTab) * 100}%)`,
          }}
        />
      </div>
    </div>
  );
};
