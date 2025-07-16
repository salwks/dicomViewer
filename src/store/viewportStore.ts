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
  currentRotation: number;
  isFlippedHorizontal: boolean;
  isFlippedVertical: boolean;
  currentDicomDataSet: any;

  // Actions
  setActiveViewport: (viewportId: string) => void;
  setLayout: (layout: LayoutType) => void;
  loadSeries: (series: SeriesInfo) => void;
  setWindowLevel: (config: WindowLevelConfig) => void;
  rotateImage: (direction: 'left' | 'right') => void;
  flipImage: (direction: 'horizontal' | 'vertical') => void;
  resetImageTransform: () => void;
  setDicomDataSet: (dataSet: any) => void;
  captureViewportAsPng: () => Promise<void>;
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
    currentRotation: 0,
    isFlippedHorizontal: false,
    isFlippedVertical: false,
    currentDicomDataSet: null,

    // Actions
    setActiveViewport: (viewportId: string) => {
      set({ activeViewportId: viewportId });
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

    rotateImage: (direction: 'left' | 'right') => {
      const { currentRotation } = get();
      const rotationChange = direction === 'right' ? 90 : -90;
      const newRotation = (currentRotation + rotationChange) % 360;
      
      set({ currentRotation: newRotation });
      
      try {
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        if (renderingEngine) {
          const viewport = renderingEngine.getViewport("dicom-viewport");
          if (viewport) {
            viewport.setRotation(newRotation);
            renderingEngine.render();
            console.log(`🔄 이미지 회전: ${direction} (${newRotation}도)`);
          }
        }
      } catch (error) {
        console.error("이미지 회전 실패:", error);
      }
    },

    flipImage: (direction: 'horizontal' | 'vertical') => {
      const state = get();
      const isHorizontal = direction === 'horizontal';
      const newFlipState = {
        isFlippedHorizontal: isHorizontal ? !state.isFlippedHorizontal : state.isFlippedHorizontal,
        isFlippedVertical: !isHorizontal ? !state.isFlippedVertical : state.isFlippedVertical
      };
      
      set(newFlipState);
      
      try {
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        if (renderingEngine) {
          const viewport = renderingEngine.getViewport("dicom-viewport");
          if (viewport) {
            if (isHorizontal) {
              viewport.flip({ flipHorizontal: true });
              console.log("🔄 수평 뒤집기 실행");
            } else {
              viewport.flip({ flipVertical: true });
              console.log("🔄 수직 뒤집기 실행");
            }
            
            renderingEngine.render();
            console.log(`✅ 이미지 뒤집기 성공: ${direction} (H:${newFlipState.isFlippedHorizontal}, V:${newFlipState.isFlippedVertical})`);
          } else {
            console.error("❌ 뷰포트를 찾을 수 없습니다");
          }
        } else {
          console.error("❌ 렌더링 엔진을 찾을 수 없습니다");
        }
      } catch (error) {
        console.error("❌ 이미지 뒤집기 실패:", error);
        set({
          isFlippedHorizontal: state.isFlippedHorizontal,
          isFlippedVertical: state.isFlippedVertical
        });
      }
    },

    resetImageTransform: () => {
      const oldState = get();
      
      set({
        currentRotation: 0,
        isFlippedHorizontal: false,
        isFlippedVertical: false
      });
      
      try {
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        if (renderingEngine) {
          const viewport = renderingEngine.getViewport("dicom-viewport");
          if (viewport) {
            viewport.setRotation(0);
            
            if (oldState.isFlippedHorizontal) {
              viewport.flip({ flipHorizontal: true });
              console.log("🔄 수평 뒤집기 리셋");
            }
            if (oldState.isFlippedVertical) {
              viewport.flip({ flipVertical: true });
              console.log("🔄 수직 뒤집기 리셋");
            }
            
            renderingEngine.render();
            console.log("✅ 이미지 변환 리셋 완료");
          }
        }
      } catch (error) {
        console.error("❌ 이미지 변환 리셋 실패:", error);
        set({
          currentRotation: oldState.currentRotation,
          isFlippedHorizontal: oldState.isFlippedHorizontal,
          isFlippedVertical: oldState.isFlippedVertical
        });
      }
    },

    setDicomDataSet: (dataSet: any) => {
      set({ currentDicomDataSet: dataSet });
      console.log("💾 DICOM 데이터셋 저장 완료");
    },

    captureViewportAsPng: async () => {
      const viewportId = 'dicom-viewport';
      debugLogger.log(`📸 뷰포트 캡처 시작...`);

      // Security logging for viewport capture
      const securityStore = useSecurityStore.getState();
      securityStore.logSecurityEvent({
        type: 'EXPORT',
        details: `Viewport capture initiated for ${viewportId}`,
        severity: 'MEDIUM',
        userId: securityStore.currentUser?.username || 'unknown',
        metadata: {
          viewportId,
          action: 'capture_viewport_png',
          timestamp: new Date().toISOString()
        }
      });

      try {
        const { viewport, viewportElement } = await get().prepareViewportForCapture(viewportId);
        const canvas = await get().captureWithHTML2Canvas(viewportElement);
        await get().downloadCanvasAsFile(canvas);
        
        // Log successful export
        securityStore.logSecurityEvent({
          type: 'EXPORT',
          details: `Viewport capture completed successfully for ${viewportId}`,
          severity: 'LOW',
          userId: securityStore.currentUser?.username || 'unknown',
          metadata: {
            viewportId,
            action: 'capture_success',
            canvasSize: `${canvas.width}x${canvas.height}`
          }
        });
        
        debugLogger.success('✅ 주석이 포함된 화면 캡처가 완료되었습니다.');
      } catch (error) {
        // Log capture error
        securityStore.logSecurityEvent({
          type: 'ERROR',
          details: `Viewport capture failed for ${viewportId}: ${error}`,
          severity: 'HIGH',
          userId: securityStore.currentUser?.username || 'unknown',
          metadata: {
            viewportId,
            action: 'capture_error',
            error: error?.toString()
          }
        });
        
        console.error("❌ 고해상도 캡처 실패, 기본 방법 시도:", error);
        await get().fallbackCapture(viewportId);
      }
    },

    prepareViewportForCapture: async (viewportId: string) => {
      const renderingEngine = getRenderingEngine('dicom-rendering-engine');
      if (!renderingEngine) {
        throw new Error('렌더링 엔진을 찾을 수 없습니다.');
      }

      const viewport = renderingEngine.getViewport(viewportId);
      if (!viewport) {
        throw new Error(`뷰포트(${viewportId})를 찾을 수 없습니다.`);
      }

      await viewport.render();
      await new Promise(resolve => setTimeout(resolve, 200));

      const viewportElement = viewport.element || 
                             document.querySelector(`[data-viewport-uid="${viewportId}"]`) ||
                             document.querySelector('.viewport-element') ||
                             document.querySelector('.cornerstone-viewport');

      if (!viewportElement) {
        throw new Error('뷰포트 DOM 요소를 찾을 수 없습니다.');
      }

      return { viewport, viewportElement };
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

        const renderingEngine = getRenderingEngine('dicom-rendering-engine');
        const viewport = renderingEngine.getViewport(viewportId);
        const canvas = viewport.getCanvas();
        
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
        
        debugLogger.success('이미지만 캡처 완료 (주석 제외)');
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
        
        console.error("❌ 폴백 방법도 실패:", fallbackError);
        debugLogger.error('❌ 화면 캡처에 완전히 실패했습니다.');
        alert('화면을 캡처하는 데 실패했습니다.');
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