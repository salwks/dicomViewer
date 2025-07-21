import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { getRenderingEngine } from "@cornerstonejs/core";
import { debugLogger } from "../utils/debug-logger";
import type {
  ViewportConfig,
  LayoutType,
  SeriesInfo,
  ToolGroupConfig,
  WindowLevelConfig,
  WindowLevelPreset,
} from "../types";
import { useSecurityStore } from "./securityStore";

// Default window level presets
const defaultWindowLevelPresets: WindowLevelPreset[] = [
  { name: "Abdomen", windowCenter: 60, windowWidth: 400 },
  { name: "Bone", windowCenter: 400, windowWidth: 1000 },
  { name: "Brain", windowCenter: 40, windowWidth: 80 },
  { name: "Chest", windowCenter: -600, windowWidth: 1600 },
  { name: "Lung", windowCenter: -600, windowWidth: 1600 },
  { name: "Mediastinum", windowCenter: 50, windowWidth: 350 },
];

// Viewport transform state interface
export interface ViewportTransformState {
  rotation: number;
  isFlippedHorizontal: boolean;
  isFlippedVertical: boolean;
}

// Viewport store interface
export interface ViewportStoreState {
  // State
  viewports: Map<string, ViewportConfig>;
  activeViewportId: string | null;
  layoutType: LayoutType;
  viewportConfigs: Map<string, any>;
  loadedSeries: SeriesInfo[];
  currentSeries: SeriesInfo | null;
  currentImageIndex: number;
  toolGroups: Map<string, ToolGroupConfig>;
  windowLevelPresets: WindowLevelPreset[];
  currentWindowLevel: WindowLevelConfig | null;
  // Per-viewport transform states
  viewportTransforms: Map<string, ViewportTransformState>;
  // Legacy global state for backward compatibility
  currentRotation: number;
  isFlippedHorizontal: boolean;
  isFlippedVertical: boolean;
  currentDicomDataSet: any;

  // Actions
  setActiveViewport: (viewportId: string) => void;
  setLayout: (layout: LayoutType) => void;
  loadSeries: (series: SeriesInfo) => void;
  setWindowLevel: (config: WindowLevelConfig) => void;
  // New viewport-specific transform actions
  rotateViewport: (viewportId: string, direction: 'left' | 'right') => void;
  flipViewport: (viewportId: string, direction: 'horizontal' | 'vertical') => void;
  resetViewportTransform: (viewportId: string) => void;
  getViewportTransform: (viewportId: string) => ViewportTransformState;
  // Legacy actions for backward compatibility
  rotateImage: (direction: 'left' | 'right') => void;
  flipImage: (direction: 'horizontal' | 'vertical') => void;
  resetImageTransform: () => void;
  setDicomDataSet: (dataSet: any) => void;
  captureViewportAsPng: (viewportId?: string) => Promise<void>;
  prepareViewportForCapture: (viewportId: string) => Promise<{ viewport: any; viewportElement: Element; }>;
  captureWithHTML2Canvas: (viewportElement: Element) => Promise<HTMLCanvasElement>;
  downloadCanvasAsFile: (canvas: HTMLCanvasElement) => Promise<void>;
  fallbackCapture: (viewportId: string) => Promise<void>;
}

export const useViewportStore = create<ViewportStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    viewports: new Map(),
    activeViewportId: null,
    layoutType: "1x1" as LayoutType,
    viewportConfigs: new Map(),
    loadedSeries: [],
    currentSeries: null,
    currentImageIndex: 0,
    toolGroups: new Map(),
    windowLevelPresets: defaultWindowLevelPresets,
    currentWindowLevel: null,
    // Per-viewport transform states
    viewportTransforms: new Map(),
    // Legacy global state for backward compatibility
    currentRotation: 0,
    isFlippedHorizontal: false,
    isFlippedVertical: false,
    currentDicomDataSet: null,

    // Actions
    setActiveViewport: (viewportId: string) => {
      // Update active viewport
      set({ activeViewportId: viewportId });
      
      // Sync legacy state with the new active viewport's transform state
      const transform = get().getViewportTransform(viewportId);
      set({
        currentRotation: transform.rotation,
        isFlippedHorizontal: transform.isFlippedHorizontal,
        isFlippedVertical: transform.isFlippedVertical
      });
      
      console.log(`🎯 활성 뷰포트 변경: ${viewportId}, 변환 상태 동기화 완료`);
    },

    setLayout: (layout: LayoutType) => {
      set({ layoutType: layout });
    },

    loadSeries: (series: SeriesInfo) => {
      console.log("🔄 새로운 시리즈 로드 시작 - 상태 초기화 중...");
      set({ 
        currentSeries: null,
        currentImageIndex: 0,
        currentRotation: 0,
        isFlippedHorizontal: false,
        isFlippedVertical: false,
        currentDicomDataSet: null
      });

      set((state) => {
        const existingIndex = state.loadedSeries.findIndex(
          (s) => s.seriesInstanceUID === series.seriesInstanceUID
        );

        let updatedSeries;
        if (existingIndex >= 0) {
          updatedSeries = [...state.loadedSeries];
          updatedSeries[existingIndex] = series;
          console.log(`📁 기존 시리즈 업데이트: ${series.seriesInstanceUID}`);
        } else {
          updatedSeries = [...state.loadedSeries, series];
          console.log(`📁 새로운 시리즈 추가: ${series.seriesInstanceUID}`);
        }

        console.log("✅ 시리즈 로드 완료");

        return {
          loadedSeries: updatedSeries,
          currentSeries: series,
          currentImageIndex: 0,
        };
      });
    },

    setWindowLevel: (config: WindowLevelConfig) => {
      set({ currentWindowLevel: config });
      console.log(
        `Window level set: C${config.windowCenter} W${config.windowWidth}`
      );
    },

    // Helper function to get viewport transform state
    getViewportTransform: (viewportId: string): ViewportTransformState => {
      const { viewportTransforms } = get();
      return viewportTransforms.get(viewportId) || {
        rotation: 0,
        isFlippedHorizontal: false,
        isFlippedVertical: false
      };
    },

    // Helper function to find rendering engine and viewport  
    _getViewportInstance: (viewportId: string): { renderingEngine: any; viewport: any } => {
      // Try to get the specific rendering engine for this viewport
      const renderingEngineId = `rendering-engine-${viewportId.split('-').pop()}`;
      let renderingEngine = (window as any)[`cornerstoneRenderingEngine_${viewportId}`] || 
                           (window as any).cornerstoneRenderingEngine;
      
      if (!renderingEngine) {
        // Try to get from getRenderingEngine
        try {
          renderingEngine = getRenderingEngine(renderingEngineId) || getRenderingEngine('dicom-rendering-engine');
        } catch (error) {
          console.warn(`No rendering engine found for ${renderingEngineId}, trying default`);
        }
      }
      
      if (!renderingEngine) {
        throw new Error(`렌더링 엔진을 찾을 수 없습니다`);
      }

      const viewport = renderingEngine.getViewport(viewportId);
      if (!viewport) {
        throw new Error(`뷰포트 ${viewportId}를 찾을 수 없습니다`);
      }

      return { renderingEngine, viewport };
    },

    // New viewport-specific transform functions
    rotateViewport: (viewportId: string, direction: 'left' | 'right') => {
      const { viewportTransforms } = get();
      const currentTransform = get().getViewportTransform(viewportId);
      const rotationChange = direction === 'right' ? 90 : -90;
      const newRotation = (currentTransform.rotation + rotationChange) % 360;
      
      try {
        const { renderingEngine, viewport } = get()._getViewportInstance(viewportId);
        
        // Apply rotation to viewport using Cornerstone3D API
        if (viewport.setRotation) {
          viewport.setRotation(newRotation);
        } else {
          // Fallback: use camera manipulation
          const camera = viewport.getCamera();
          if (camera) {
            const radians = (newRotation * Math.PI) / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            const newViewUp: [number, number, number] = [cos, sin, 0];
            viewport.setCamera({ ...camera, viewUp: newViewUp });
          }
        }
        
        renderingEngine.render();

        // Update state
        const updatedTransforms = new Map(viewportTransforms);
        updatedTransforms.set(viewportId, {
          ...currentTransform,
          rotation: newRotation
        });
        set({ viewportTransforms: updatedTransforms });

        // Update legacy state if this is the active viewport
        const { activeViewportId } = get();
        if (activeViewportId === viewportId) {
          set({ currentRotation: newRotation });
        }

        console.log(`🔄 뷰포트 ${viewportId} 이미지 회전: ${direction} (${newRotation}도)`);
      } catch (error) {
        console.error(`❌ 뷰포트 ${viewportId} 이미지 회전 실패:`, error);
      }
    },

    flipViewport: (viewportId: string, direction: 'horizontal' | 'vertical') => {
      const { viewportTransforms } = get();
      const currentTransform = get().getViewportTransform(viewportId);
      const isHorizontal = direction === 'horizontal';
      
      const newTransform = {
        ...currentTransform,
        isFlippedHorizontal: isHorizontal ? !currentTransform.isFlippedHorizontal : currentTransform.isFlippedHorizontal,
        isFlippedVertical: !isHorizontal ? !currentTransform.isFlippedVertical : currentTransform.isFlippedVertical
      };

      try {
        const { renderingEngine, viewport } = get()._getViewportInstance(viewportId);
        
        // Apply flip using Cornerstone3D API
        if (viewport.flip) {
          const flipDirection = {
            flipHorizontal: newTransform.isFlippedHorizontal,
            flipVertical: newTransform.isFlippedVertical
          };
          viewport.flip(flipDirection);
        }
        
        renderingEngine.render();

        // Update state
        const updatedTransforms = new Map(viewportTransforms);
        updatedTransforms.set(viewportId, newTransform);
        set({ viewportTransforms: updatedTransforms });

        // Update legacy state if this is the active viewport
        const { activeViewportId } = get();
        if (activeViewportId === viewportId) {
          set({ 
            isFlippedHorizontal: newTransform.isFlippedHorizontal,
            isFlippedVertical: newTransform.isFlippedVertical
          });
        }

        console.log(`🔄 뷰포트 ${viewportId} 이미지 뒤집기: ${direction} (H:${newTransform.isFlippedHorizontal}, V:${newTransform.isFlippedVertical})`);
      } catch (error) {
        console.error(`❌ 뷰포트 ${viewportId} 이미지 뒤집기 실패:`, error);
      }
    },

    resetViewportTransform: (viewportId: string) => {
      const { viewportTransforms } = get();
      const currentTransform = get().getViewportTransform(viewportId);
      
      try {
        const { renderingEngine, viewport } = get()._getViewportInstance(viewportId);
        
        // Reset rotation
        if (viewport.setRotation) {
          viewport.setRotation(0);
        } else {
          // Fallback: reset camera
          const camera = viewport.getCamera();
          if (camera) {
            viewport.setCamera({ ...camera, viewUp: [1, 0, 0] });
          }
        }
        
        // Reset flips by applying current flip states again (toggle off)
        if (viewport.flip && (currentTransform.isFlippedHorizontal || currentTransform.isFlippedVertical)) {
          const flipDirection = {
            flipHorizontal: currentTransform.isFlippedHorizontal,
            flipVertical: currentTransform.isFlippedVertical
          };
          viewport.flip(flipDirection);
        }
        
        renderingEngine.render();

        // Update state
        const updatedTransforms = new Map(viewportTransforms);
        updatedTransforms.set(viewportId, {
          rotation: 0,
          isFlippedHorizontal: false,
          isFlippedVertical: false
        });
        set({ viewportTransforms: updatedTransforms });

        // Update legacy state if this is the active viewport
        const { activeViewportId } = get();
        if (activeViewportId === viewportId) {
          set({ 
            currentRotation: 0,
            isFlippedHorizontal: false,
            isFlippedVertical: false
          });
        }

        console.log(`✅ 뷰포트 ${viewportId} 이미지 변환 리셋 완료`);
      } catch (error) {
        console.error(`❌ 뷰포트 ${viewportId} 이미지 변환 리셋 실패:`, error);
      }
    },

    // Legacy functions for backward compatibility - now work with active viewport
    rotateImage: (direction: 'left' | 'right') => {
      const { activeViewportId } = get();
      if (!activeViewportId) {
        console.warn("활성 뷰포트가 없습니다. 뷰포트를 먼저 선택해주세요.");
        return;
      }
      get().rotateViewport(activeViewportId, direction);
    },

    flipImage: (direction: 'horizontal' | 'vertical') => {
      const { activeViewportId } = get();
      if (!activeViewportId) {
        console.warn("활성 뷰포트가 없습니다. 뷰포트를 먼저 선택해주세요.");
        return;
      }
      get().flipViewport(activeViewportId, direction);
    },

    resetImageTransform: () => {
      const { activeViewportId } = get();
      if (!activeViewportId) {
        console.warn("활성 뷰포트가 없습니다. 뷰포트를 먼저 선택해주세요.");
        return;
      }
      get().resetViewportTransform(activeViewportId);
    },

    setDicomDataSet: (dataSet: any) => {
      set({ currentDicomDataSet: dataSet });
      console.log("💾 DICOM 데이터셋 저장 완료");
    },

    captureViewportAsPng: async (viewportId?: string) => {
      // Use provided viewportId or active viewport
      const targetViewportId = viewportId || get().activeViewportId;
      
      if (!targetViewportId) {
        console.warn("활성 뷰포트가 없습니다. 뷰포트를 먼저 선택해주세요.");
        alert("캡처할 뷰포트가 선택되지 않았습니다.");
        return;
      }

      debugLogger.log(`📸 뷰포트 ${targetViewportId} 캡처 시작...`);

      // Security logging for viewport capture
      const securityStore = useSecurityStore.getState();
      securityStore.logSecurityEvent({
        type: 'EXPORT',
        details: `Viewport capture initiated for ${targetViewportId}`,
        severity: 'MEDIUM',
        userId: securityStore.currentUser?.username || 'unknown',
        metadata: {
          viewportId: targetViewportId,
          action: 'capture_viewport_png',
          timestamp: new Date().toISOString()
        }
      });

      try {
        const { viewport, viewportElement } = await get().prepareViewportForCapture(targetViewportId);
        const canvas = await get().captureWithHTML2Canvas(viewportElement);
        await get().downloadCanvasAsFile(canvas);
        
        // Log successful export
        securityStore.logSecurityEvent({
          type: 'EXPORT',
          details: `Viewport capture completed successfully for ${targetViewportId}`,
          severity: 'LOW',
          userId: securityStore.currentUser?.username || 'unknown',
          metadata: {
            viewportId: targetViewportId,
            action: 'capture_success',
            canvasSize: `${canvas.width}x${canvas.height}`
          }
        });
        
        debugLogger.success(`✅ 뷰포트 ${targetViewportId} 주석이 포함된 화면 캡처가 완료되었습니다.`);
      } catch (error) {
        // Log capture error
        securityStore.logSecurityEvent({
          type: 'ERROR',
          details: `Viewport capture failed for ${targetViewportId}: ${error}`,
          severity: 'HIGH',
          userId: securityStore.currentUser?.username || 'unknown',
          metadata: {
            viewportId: targetViewportId,
            action: 'capture_error',
            error: error?.toString()
          }
        });
        
        console.error("❌ 고해상도 캡처 실패, 기본 방법 시도:", error);
        await get().fallbackCapture(targetViewportId);
      }
    },

    prepareViewportForCapture: async (viewportId: string) => {
      try {
        const { renderingEngine, viewport } = get()._getViewportInstance(viewportId);

        await viewport.render();
        await new Promise(resolve => setTimeout(resolve, 200));

        // Try multiple strategies to find the viewport element
        const viewportElement = viewport.element || 
                               document.querySelector(`[data-viewport-uid="${viewportId}"]`) ||
                               document.querySelector(`#${viewportId}`) ||
                               document.querySelector(`.${viewportId}`) ||
                               document.querySelector('.viewport-element') ||
                               document.querySelector('.cornerstone-viewport') ||
                               // For multi-viewport layout, look for viewport containers
                               document.querySelector(`[data-viewport-id="${viewportId}"]`) ||
                               document.querySelector(`[data-testid="${viewportId}"]`);

        if (!viewportElement) {
          throw new Error(`뷰포트 ${viewportId} DOM 요소를 찾을 수 없습니다.`);
        }

        console.log(`📸 뷰포트 ${viewportId} 캡처 준비 완료:`, {
          element: viewportElement.tagName,
          size: `${viewportElement.clientWidth}x${viewportElement.clientHeight}`
        });

        return { viewport, viewportElement };
      } catch (error) {
        console.error(`❌ 뷰포트 ${viewportId} 캡처 준비 실패:`, error);
        throw error;
      }
    },

    captureWithHTML2Canvas: async (viewportElement: Element) => {
      console.log("📦 HTML2Canvas 라이브러리 로딩...");
      const html2canvas = await import('https://cdn.skypack.dev/html2canvas@1.4.1');
      
      const devicePixelRatio = window.devicePixelRatio || 1;
      const highResScale = Math.max(devicePixelRatio, 2);
      
      console.log(`🎨 고해상도 캡처 시작 (scale: ${highResScale})...`);
      
      const canvas = await html2canvas.default(viewportElement, {
        backgroundColor: '#000000',
        useCORS: true,
        allowTaint: true,
        scale: highResScale,
        width: viewportElement.offsetWidth,
        height: viewportElement.offsetHeight,
        logging: false,
        removeContainer: true,
        imageTimeout: 0,
        ignoreElements: (element) => element.classList.contains('cornerstone-canvas-background')
      });

      console.log(`✅ 캡처 완료: ${canvas.width}x${canvas.height}`);
      return canvas;
    },

    downloadCanvasAsFile: async (canvas: HTMLCanvasElement) => {
      return new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Blob 생성 실패'));
            return;
          }

          const url = URL.createObjectURL(blob);
          const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
          const filename = `Clarity-Capture_${timestamp}.png`;
          
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log(`✅ 파일 저장 완료: ${filename}`);
          resolve();
        }, 'image/png', 1.0);
      });
    },

    fallbackCapture: async (viewportId: string) => {
      const securityStore = useSecurityStore.getState();
      
      try {
        securityStore.logSecurityEvent({
          type: 'EXPORT',
          details: `Fallback capture initiated for ${viewportId}`,
          severity: 'MEDIUM',
          userId: securityStore.currentUser?.username || 'unknown',
          metadata: {
            viewportId,
            action: 'fallback_capture',
            method: 'cornerstone_canvas'
          }
        });

        const { renderingEngine, viewport } = get()._getViewportInstance(viewportId);
        const canvas = viewport.getCanvas();
        
        if (!canvas) {
          throw new Error(`뷰포트 ${viewportId}의 캔버스를 찾을 수 없습니다.`);
        }
        
        await get().downloadCanvasAsFile(canvas);
        
        securityStore.logSecurityEvent({
          type: 'EXPORT',
          details: `Fallback capture completed successfully for ${viewportId}`,
          severity: 'LOW',
          userId: securityStore.currentUser?.username || 'unknown',
          metadata: {
            viewportId,
            action: 'fallback_success',
            note: 'annotations_excluded'
          }
        });
        
        debugLogger.success(`✅ 뷰포트 ${viewportId} 이미지만 캡처 완료 (주석 제외)`);
      } catch (fallbackError) {
        securityStore.logSecurityEvent({
          type: 'ERROR',
          details: `Fallback capture failed for ${viewportId}: ${fallbackError}`,
          severity: 'CRITICAL',
          userId: securityStore.currentUser?.username || 'unknown',
          metadata: {
            viewportId,
            action: 'fallback_error',
            error: fallbackError?.toString()
          }
        });
        
        console.error(`❌ 뷰포트 ${viewportId} 폴백 방법도 실패:`, fallbackError);
        debugLogger.error(`❌ 뷰포트 ${viewportId} 화면 캡처에 완전히 실패했습니다.`);
        alert(`뷰포트 ${viewportId} 화면을 캡처하는 데 실패했습니다.`);
      }
    },
  }))
);

// Selectors for better performance
export const selectActiveViewport = (state: ViewportStoreState) => state.activeViewportId;
export const selectCurrentSeries = (state: ViewportStoreState) => state.currentSeries;
export const selectWindowLevel = (state: ViewportStoreState) => state.currentWindowLevel;
export const selectImageTransform = (state: ViewportStoreState) => ({
  rotation: state.currentRotation,
  isFlippedHorizontal: state.isFlippedHorizontal,
  isFlippedVertical: state.isFlippedVertical,
});
export const selectDicomDataSet = (state: ViewportStoreState) => state.currentDicomDataSet;