/**
 * Tool Management Hook
 * Handles tool selection for different viewer modes
 */
import { log } from '../utils/logger';

import { useCallback } from 'react';
import { DicomViewerRef } from '../components/DicomViewer';
interface UseToolManagementProps {
  currentMode: string;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  comparisonToolA: string;
  setComparisonToolA: (tool: string) => void;
  comparisonToolB: string;
  setComparisonToolB: (tool: string) => void;
  syncTools: boolean;
  dicomViewerRef: React.RefObject<DicomViewerRef | null>;
  comparisonViewerARef: React.RefObject<DicomViewerRef | null>;
  comparisonViewerBRef: React.RefObject<DicomViewerRef | null>;
}

export const useToolManagement = ({
  currentMode,
  activeTool,
  setActiveTool,
  comparisonToolA,
  setComparisonToolA,
  comparisonToolB,
  setComparisonToolB,
  syncTools,
  dicomViewerRef,
  comparisonViewerARef,
  comparisonViewerBRef,
}: UseToolManagementProps) => {
  // Tool selection handlers - optimized to prevent re-render
  const handleToolSelect = useCallback(
    (tool: string) => {
      log.info('🔧🔧🔧 HANDLER: handleToolSelect called', {
        timestamp: new Date().toISOString(),
        tool,
        currentActiveTool: activeTool,
        mode: currentMode,
        syncTools,
        comparisonToolA,
        comparisonToolB,
      });

      // Handle tool selection based on current mode
      if (currentMode === 'comparison') {
        if (syncTools) {
          // Synchronized mode - set tool for both viewers
          log.info('🔗 Synchronized tool mode - setting tool for both viewers');
          if (comparisonViewerARef.current) {
            log.info('📞📞📞 VIEWER CALL: Setting synchronized tool for Comparison Viewer A:', {
              tool,
              timestamp: new Date().toISOString(),
              viewerRef: !!comparisonViewerARef.current,
            });
            comparisonViewerARef.current.setActiveTool(tool);
            log.info('✅✅✅ VIEWER RESULT: Viewer A tool set completed');
          } else {
            console.warn('⚠️⚠️⚠️ ERROR: comparisonViewerARef.current is null');
          }
          if (comparisonViewerBRef.current) {
            log.info('📞📞📞 VIEWER CALL: Setting synchronized tool for Comparison Viewer B:', {
              tool,
              timestamp: new Date().toISOString(),
              viewerRef: !!comparisonViewerBRef.current,
            });
            comparisonViewerBRef.current.setActiveTool(tool);
            log.info('✅✅✅ VIEWER RESULT: Viewer B tool set completed');
          } else {
            console.warn('⚠️⚠️⚠️ ERROR: comparisonViewerBRef.current is null');
          }
          // Update both tool states
          setComparisonToolA(tool);
          setComparisonToolB(tool);
        } else {
          // Independent mode - this handler should not be used
          log.info('🔀 Independent tool mode - handleToolSelect should not be used in independent mode');
          console.warn('⚠️ In independent mode, use handleToolSelectA or handleToolSelectB from viewer headers');
        }
      } else {
        // In basic mode, set tool for single viewer
        if (dicomViewerRef.current) {
          log.info('📞 Calling DicomViewer.setActiveTool via ref');
          dicomViewerRef.current.setActiveTool(tool);
          log.info('✅ Tool changed via ref');
        } else {
          console.warn('⚠️ DicomViewer ref is null');
        }
      }

      // Update App state for UI synchronization - but this won't trigger BasicViewer re-render due to useMemo
      setActiveTool(tool);
    },
    [
      activeTool,
      currentMode,
      comparisonToolA,
      comparisonToolB,
      comparisonViewerARef,
      comparisonViewerBRef,
      dicomViewerRef,
      setActiveTool,
      syncTools,
      setComparisonToolA,
      setComparisonToolB,
    ],
  );

  // Viewer-specific tool selection for comparison mode
  const handleToolSelectA = useCallback(
    (tool: string) => {
      log.info('🎯 handleToolSelectA called:', { tool });
      if (comparisonViewerARef.current) {
        log.info('📞 Setting tool for Comparison Viewer A:', tool);
        comparisonViewerARef.current.setActiveTool(tool);
      } else {
        console.warn('⚠️ comparisonViewerARef.current is null in handleToolSelectA');
      }
      setComparisonToolA(tool);
    },
    [comparisonViewerARef, setComparisonToolA],
  );

  const handleToolSelectB = useCallback(
    (tool: string) => {
      log.info('🎯 handleToolSelectB called:', { tool });
      if (comparisonViewerBRef.current) {
        log.info('📞 Setting tool for Comparison Viewer B:', tool);
        comparisonViewerBRef.current.setActiveTool(tool);
      } else {
        console.warn('⚠️ comparisonViewerBRef.current is null in handleToolSelectB');
      }
      setComparisonToolB(tool);
    },
    [comparisonViewerBRef, setComparisonToolB],
  );

  return {
    handleToolSelect,
    handleToolSelectA,
    handleToolSelectB,
  };
};
