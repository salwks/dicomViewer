/**
 * useSidePanel Hook
 * 사이드 패널 상태 관리를 위한 커스텀 훅
 */

import { createContext, useContext } from 'react';

interface PanelState {
  leftPanel: {
    isCollapsed: boolean;
    width: number;
  };
  rightPanel: {
    isCollapsed: boolean;
    width: number;
  };
}

interface SidePanelContextType {
  panelState: PanelState;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
}

export const SidePanelContext = createContext<SidePanelContextType | undefined>(undefined);

export const useSidePanel = (): SidePanelContextType => {
  const context = useContext(SidePanelContext);
  if (context === undefined) {
    throw new Error('useSidePanel must be used within a SidePanelProvider');
  }
  return context;
};

export type { PanelState, SidePanelContextType };
