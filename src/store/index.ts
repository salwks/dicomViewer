/**
 * 루트 스토어 - 모든 슬라이스를 결합하여 단일 인터페이스 제공
 * 
 * 이 파일은 분리된 각 스토어 슬라이스들을 하나의 루트 스토어로 결합합니다.
 * 각 컴포넌트에서는 필요한 특정 슬라이스만 선택적으로 구독할 수 있습니다.
 */

// Export all individual stores for direct access
export { useAnnotationStore, type AnnotationStoreState } from './annotationStore';
export { useViewportStore, type ViewportStoreState } from './viewportStore';
export { useUIStore, type UIStoreState } from './uiStore';
export { useSecurityStore, type SecurityStoreState } from './securityStore';

// Export all selectors for convenience
export {
  selectAnnotations,
  selectActiveTool,
  selectSelectedAnnotation,
} from './annotationStore';

export {
  selectActiveViewport,
  selectCurrentSeries,
  selectWindowLevel,
  selectImageTransform,
  selectDicomDataSet,
} from './viewportStore';

export {
  selectIsLoading,
  selectError,
  selectSidebarOpen,
  selectLicenseModalOpen,
} from './uiStore';

export {
  selectIsAuthenticated,
  selectCurrentUser,
  selectSecurityEvents,
  selectSecuritySettings,
} from './securityStore';

// Combined root store type for compatibility
export interface RootStoreState {
  annotation: AnnotationStoreState;
  viewport: ViewportStoreState;
  ui: UIStoreState;
  security: SecurityStoreState;
}

// Utility hook for accessing multiple stores at once
export const useStores = () => {
  const annotationStore = useAnnotationStore();
  const viewportStore = useViewportStore();
  const uiStore = useUIStore();
  const securityStore = useSecurityStore();

  return {
    annotation: annotationStore,
    viewport: viewportStore,
    ui: uiStore,
    security: securityStore,
  };
};

// Legacy compatibility - combined store that mimics the old structure
// This allows existing components to continue working while migration is in progress
export const useDicomStore = () => {
  const annotation = useAnnotationStore();
  const viewport = useViewportStore();
  const ui = useUIStore();

  return {
    // Annotation state & actions
    annotations: annotation.annotations,
    selectedAnnotationUID: annotation.selectedAnnotationUID,
    activeTool: annotation.activeTool,
    setActiveTool: annotation.setActiveTool,
    activateToolInViewport: annotation.activateToolInViewport,
    addAnnotation: annotation.addAnnotation,
    updateAnnotation: annotation.updateAnnotation,
    updateAnnotationLabel: annotation.updateAnnotationLabel,
    removeAnnotation: annotation.removeAnnotation,
    clearAllAnnotations: annotation.clearAllAnnotations,

    // Viewport state & actions
    viewports: viewport.viewports,
    activeViewportId: viewport.activeViewportId,
    layoutType: viewport.layoutType,
    viewportConfigs: viewport.viewportConfigs,
    loadedSeries: viewport.loadedSeries,
    currentSeries: viewport.currentSeries,
    currentImageIndex: viewport.currentImageIndex,
    toolGroups: viewport.toolGroups,
    windowLevelPresets: viewport.windowLevelPresets,
    currentWindowLevel: viewport.currentWindowLevel,
    currentRotation: viewport.currentRotation,
    isFlippedHorizontal: viewport.isFlippedHorizontal,
    isFlippedVertical: viewport.isFlippedVertical,
    currentDicomDataSet: viewport.currentDicomDataSet,
    setActiveViewport: viewport.setActiveViewport,
    setLayout: viewport.setLayout,
    loadSeries: viewport.loadSeries,
    setWindowLevel: viewport.setWindowLevel,
    rotateImage: viewport.rotateImage,
    flipImage: viewport.flipImage,
    resetImageTransform: viewport.resetImageTransform,
    setDicomDataSet: viewport.setDicomDataSet,
    captureViewportAsPng: viewport.captureViewportAsPng,

    // UI state & actions
    isLoading: ui.isLoading,
    error: ui.error,
    sidebarOpen: ui.sidebarOpen,
    isLicenseModalOpen: ui.isLicenseModalOpen,
    setLoading: ui.setLoading,
    setError: ui.setError,
    toggleSidebar: ui.toggleSidebar,
    toggleLicenseModal: ui.toggleLicenseModal,
  };
};

// Export the old selectors for backward compatibility
export const selectActiveViewportCompat = () => {
  return useViewportStore.getState().activeViewportId;
};

export const selectCurrentSeriesCompat = () => {
  return useViewportStore.getState().currentSeries;
};

export const selectAnnotationsCompat = () => {
  return useAnnotationStore.getState().annotations;
};

export const selectActiveToolCompat = () => {
  return useAnnotationStore.getState().activeTool;
};

export const selectWindowLevelCompat = () => {
  return useViewportStore.getState().currentWindowLevel;
};

export const selectIsLoadingCompat = () => {
  return useUIStore.getState().isLoading;
};

export const selectErrorCompat = () => {
  return useUIStore.getState().error;
};

/**
 * 사용법 예시:
 * 
 * // 1. 개별 스토어 사용 (권장)
 * const { annotations, addAnnotation } = useAnnotationStore();
 * const { isLoading, setLoading } = useUIStore();
 * 
 * // 2. 루트 스토어 사용 (레거시 호환)
 * const { annotations, isLoading, addAnnotation } = useDicomStore();
 * 
 * // 3. 선택적 구독 (성능 최적화)
 * const annotations = useAnnotationStore(selectAnnotations);
 * const isLoading = useUIStore(selectIsLoading);
 */