import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { annotation } from "@cornerstonejs/tools";
import { getRenderingEngine } from "@cornerstonejs/core";
import { debugLogger } from "../utils/debug-logger";
import type {
  DicomViewerState,
  ViewportConfig,
  LayoutType,
  SeriesInfo,
  ToolGroupConfig,
  AnnotationData,
  RequiredAnnotationData,
  WindowLevelConfig,
  WindowLevelPreset,
} from "../types";

// Default window level presets
const defaultWindowLevelPresets: WindowLevelPreset[] = [
  { name: "Abdomen", windowCenter: 60, windowWidth: 400 },
  { name: "Bone", windowCenter: 400, windowWidth: 1000 },
  { name: "Brain", windowCenter: 40, windowWidth: 80 },
  { name: "Chest", windowCenter: -600, windowWidth: 1600 },
  { name: "Lung", windowCenter: -600, windowWidth: 1600 },
  { name: "Mediastinum", windowCenter: 50, windowWidth: 350 },
];

export const useDicomStore = create<DicomViewerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    viewports: new Map(),
    activeViewportId: null,
    layoutType: "1x1" as LayoutType,
    viewportConfigs: new Map(), // 뷰포트별 설정 저장

    loadedSeries: [],
    currentSeries: null,
    currentImageIndex: 0,

    activeTool: null,
    toolGroups: new Map(),

    annotations: [],
    selectedAnnotationUID: null,


    windowLevelPresets: defaultWindowLevelPresets,
    currentWindowLevel: null,

    isLoading: false,
    error: null,
    sidebarOpen: true,

    // Image manipulation state
    currentRotation: 0,
    isFlippedHorizontal: false,
    isFlippedVertical: false,
    currentDicomDataSet: null,
    isLicenseModalOpen: false,

    // Actions
    setActiveViewport: (viewportId: string) => {
      set({ activeViewportId: viewportId });
    },

    setLayout: (layout: LayoutType) => {
      set({ layoutType: layout });
    },

    // Layout functionality completely removed for single viewport stability

    loadSeries: (series: SeriesInfo) => {
      // ⬇️ 핵심 수정: 새로운 시리즈를 로드하기 전에, 관련 상태를 모두 깨끗하게 초기화합니다.
      console.log("🔄 새로운 시리즈 로드 시작 - 상태 초기화 중...");
      set({ 
        isLoading: true, 
        error: null, 
        annotations: [], 
        currentSeries: null,
        selectedAnnotationUID: null,
        currentImageIndex: 0,
        // 🔥 새 파일 로드 시 이미지 변환 상태도 리셋
        currentRotation: 0,
        isFlippedHorizontal: false,
        isFlippedVertical: false,
        currentDicomDataSet: null
      });

      // 그 다음에 실제 로딩 로직을 실행합니다.
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

        console.log("✅ 시리즈 로드 완료 - 로딩 상태 해제");

        return {
          loadedSeries: updatedSeries,
          currentSeries: series,
          currentImageIndex: 0,
          isLoading: false, // 작업이 끝나면 로딩 상태를 false로 변경
          error: null,
        };
      });
    },

    setActiveTool: (toolName: string) => {
      const currentTool = get().activeTool;
      if (currentTool !== toolName) {
        console.log(`Activating tool: ${toolName}`);
        set({ activeTool: toolName });

        // Tool activation will be handled by DicomRenderer through subscription
        // This ensures proper setToolActive and mouse binding integration
      }
    },

    // Tool state management for DicomRenderer integration
    activateToolInViewport: (toolName: string, toolGroupRef: any) => {
      if (!toolGroupRef?.current) {
        console.warn("No tool group available for tool activation");
        return false;
      }

      try {
        console.log(`🔧 도구 활성화 시작: ${toolName}`);

        // Define tool categories and their activation logic
        const annotationTools = [
          "Length",
          "Angle",
          "CobbAngle",
          "Bidirectional",
          "RectangleROI",
          "EllipticalROI",
          "CircleROI",
          "PlanarFreehandROI",
          "SplineROI",
          "ArrowAnnotate",
          "Probe",
        ];
        const basicTools = [
          "Pan",
          "Zoom",
          "WindowLevel",
          "StackScroll",
          "Magnify",
        ];

        console.log(`📋 도구 카테고리 확인:`, {
          toolName,
          isAnnotationTool: annotationTools.includes(toolName),
          isBasicTool: basicTools.includes(toolName),
        });

        // Reset all tools to passive first
        const allTools = [...annotationTools, ...basicTools];
        allTools.forEach((tool) => {
          try {
            toolGroupRef.current.setToolPassive(tool);
          } catch (e) {
            console.warn(`Failed to set ${tool} passive:`, e);
          }
        });

        // 선택된 도구만 마우스 왼쪽 버튼에 활성화
        if (
          annotationTools.includes(toolName) ||
          basicTools.includes(toolName)
        ) {
          toolGroupRef.current.setToolActive(toolName, {
            bindings: [{ mouseButton: 1 }], // 마우스 왼쪽 버튼
          });
          console.log(`✅ 도구 활성화: ${toolName} (왼쪽 버튼에 바인딩)`);
        } else {
          console.warn(`Unknown tool: ${toolName}`);
          return false;
        }

        // Update store state to reflect successful activation
        set({ activeTool: toolName });

        // 🔍 최종 확인: 도구 활성화 상태 검증
        console.log(`🎯 도구 활성화 완료! 현재 상태:`, {
          selectedTool: toolName,
          mouseButton: 1,
          message: `마우스 왼쪽 버튼으로 ${toolName} 도구를 사용할 수 있습니다.`,
        });

        return true;
      } catch (error) {
        console.error(`Failed to activate tool ${toolName}:`, error);
        return false;
      }
    },

    addAnnotation: (newAnnotation: RequiredAnnotationData) => {
      // Ensure annotationUID is always present - fix for TS2345
      const annotationWithUID: AnnotationData = {
        ...newAnnotation,
        annotationUID: newAnnotation.annotationUID || uuidv4(),
      };

      set((state) => ({
        annotations: [...state.annotations, annotationWithUID],
        selectedAnnotationUID: annotationWithUID.annotationUID,
      }));

      console.log(`📝 새 주석 추가: ${annotationWithUID.annotationUID}`);
    },

    updateAnnotation: (
      annotationUID: string,
      updates: Partial<AnnotationData>
    ) => {
      // Ensure annotationUID is string type - fix for TS2345
      if (typeof annotationUID !== "string" || !annotationUID) {
        console.error("Invalid annotationUID provided for update");
        return;
      }

      set((state) => ({
        annotations: state.annotations.map((ann) =>
          ann.annotationUID === annotationUID ? { ...ann, ...updates } : ann
        ),
      }));

      console.log(`Updated annotation: ${annotationUID}`);
    },

    updateAnnotationLabel: (annotationUID: string, newLabel: string) => {
      // Ensure annotationUID is string type and newLabel is provided
      if (typeof annotationUID !== "string" || !annotationUID) {
        console.error("Invalid annotationUID provided for label update");
        return;
      }

      if (typeof newLabel !== "string") {
        console.error("Invalid label provided for annotation update");
        return;
      }

      console.log(`📝 주석 라벨 업데이트: ${annotationUID} -> "${newLabel}"`);

      set((state) => ({
        annotations: state.annotations.map((ann) =>
          ann.annotationUID === annotationUID
            ? {
                ...ann,
                data: {
                  ...ann.data,
                  label: newLabel,
                  text: newLabel,
                },
              }
            : ann
        ),
      }));

      console.log(`✅ 주석 라벨 업데이트 완료: ${annotationUID}`);
    },

    removeAnnotation: (annotationUID: string) => {
      // Ensure annotationUID is string type - fix for TS2345
      if (typeof annotationUID !== "string" || !annotationUID) {
        console.error("Invalid annotationUID provided for removal");
        return;
      }

      console.log(`🗑️ 주석 삭제 시작: ${annotationUID}`);

      // 🔥 Cornerstone에서 주석 제거 (화면에서 즉시 사라짐)
      try {
        annotation.state.removeAnnotation(annotationUID);
        console.log(`✅ Cornerstone에서 주석 제거 완료: ${annotationUID}`);

        // 단일 뷰포트 새로고침
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        if (renderingEngine) {
          try {
            const viewport = renderingEngine.getViewport("dicom-viewport");
            if (viewport) {
              viewport.render();
              console.log("✅ 뷰포트 새로고침 완료");
            }
          } catch (e) {
            console.warn("뷰포트 새로고침 실패:", e);
          }
        }
      } catch (error) {
        console.error("Cornerstone 주석 제거 실패:", error);
      }

      // 🔥 Zustand 스토어에서 주석 제거 (목록에서 즉시 사라짐)
      set((state) => ({
        annotations: state.annotations.filter(
          (ann) => ann.annotationUID !== annotationUID
        ),
        selectedAnnotationUID:
          state.selectedAnnotationUID === annotationUID
            ? null
            : state.selectedAnnotationUID,
      }));

      console.log(`✅ 스토어에서 주석 제거 완료: ${annotationUID}`);
    },

    setWindowLevel: (config: WindowLevelConfig) => {
      set({ currentWindowLevel: config });
      console.log(
        `Window level set: C${config.windowCenter} W${config.windowWidth}`
      );
    },

    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    setError: (error: string | null) => {
      set({ error, isLoading: false });
      if (error) {
        console.error("DICOM Viewer Error:", error);
      }
    },

    toggleSidebar: () => {
      set((state) => ({ sidebarOpen: !state.sidebarOpen }));
    },



    // 모든 주석 지우기 (Cornerstone에서도 완전히 삭제)
    clearAllAnnotations: () => {
      const currentAnnotations = get().annotations;
      console.log(`🗑️ 모든 주석 지우기 시작: ${currentAnnotations.length}개`);

      // 🔥 Cornerstone에서 모든 주석 제거
      try {
        // 각 주석을 개별적으로 Cornerstone에서 제거
        currentAnnotations.forEach((annotationData) => {
          try {
            annotation.state.removeAnnotation(annotationData.annotationUID);
            console.log(`✅ Cornerstone에서 주석 제거: ${annotationData.annotationUID}`);
          } catch (error) {
            console.error(`❌ 주석 제거 실패: ${annotationData.annotationUID}`, error);
          }
        });

        // 뷰포트 새로고침
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        if (renderingEngine) {
          try {
            const viewport = renderingEngine.getViewport("dicom-viewport");
            if (viewport) {
              viewport.render();
              console.log("✅ 뷰포트 새로고침 완료");
            }
          } catch (e) {
            console.warn("뷰포트 새로고침 실패:", e);
          }
        }
      } catch (error) {
        console.error("Cornerstone 주석 제거 실패:", error);
      }

      // 🔥 Zustand 스토어에서 모든 주석 제거
      set({ annotations: [], selectedAnnotationUID: null });
      console.log("✅ 모든 주석 지우기 완료");
    },

    // 이미지 회전 기능
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

    // 이미지 뒤집기 기능 (CornerstoneJS 3D 올바른 API 사용)
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
            // 🔥 핵심 수정: CornerstoneJS 3D의 올바른 flip API 사용
            // FlipDirection 객체를 매개변수로 사용
            if (isHorizontal) {
              viewport.flip({ flipHorizontal: true });
              console.log("🔄 수평 뒤집기 실행");
            } else {
              viewport.flip({ flipVertical: true });
              console.log("🔄 수직 뒤집기 실행");
            }
            
            // 🔥 핵심: 렌더링 엔진에서 변경사항 즉시 반영
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
        // 오류 발생 시 상태 롤백
        set({
          isFlippedHorizontal: state.isFlippedHorizontal,
          isFlippedVertical: state.isFlippedVertical
        });
      }
    },

    // 이미지 변환 리셋 (CornerstoneJS 3D 올바른 API 사용)
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
            // 🔥 수정: 회전 리셋
            viewport.setRotation(0);
            
            // 🔥 수정: 뒤집기 상태 리셋 - 현재 상태에 따라 다시 뒤집어서 원상복구
            if (oldState.isFlippedHorizontal) {
              viewport.flip({ flipHorizontal: true });
              console.log("🔄 수평 뒤집기 리셋");
            }
            if (oldState.isFlippedVertical) {
              viewport.flip({ flipVertical: true });
              console.log("🔄 수직 뒤집기 리셋");
            }
            
            // 🔥 핵심: 렌더링 엔진에서 변경사항 즉시 반영
            renderingEngine.render();
            
            console.log("✅ 이미지 변환 리셋 완료");
          }
        }
      } catch (error) {
        console.error("❌ 이미지 변환 리셋 실패:", error);
        // 오류 발생 시 상태 롤백
        set({
          currentRotation: oldState.currentRotation,
          isFlippedHorizontal: oldState.isFlippedHorizontal,
          isFlippedVertical: oldState.isFlippedVertical
        });
      }
    },

    // DICOM 데이터셋 저장
    setDicomDataSet: (dataSet: any) => {
      set({ currentDicomDataSet: dataSet });
      console.log("💾 DICOM 데이터셋 저장 완료");
    },

    // 라이선스 모달 토글
    toggleLicenseModal: () => {
      set((state) => ({ isLicenseModalOpen: !state.isLicenseModalOpen }));
    },

  }))
);

// Selectors for better performance
export const selectActiveViewport = (state: DicomViewerState) =>
  state.activeViewportId;
export const selectCurrentSeries = (state: DicomViewerState) =>
  state.currentSeries;
export const selectAnnotations = (state: DicomViewerState) => state.annotations;
export const selectActiveTool = (state: DicomViewerState) => state.activeTool;
export const selectWindowLevel = (state: DicomViewerState) =>
  state.currentWindowLevel;
export const selectIsLoading = (state: DicomViewerState) => state.isLoading;
export const selectError = (state: DicomViewerState) => state.error;
