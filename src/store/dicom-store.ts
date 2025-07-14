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

    // Actions
    setActiveViewport: (viewportId: string) => {
      set({ activeViewportId: viewportId });
    },

    setLayout: (layout: LayoutType) => {
      set({ layoutType: layout });
    },

    // Layout functionality completely removed for single viewport stability

    loadSeries: (series: SeriesInfo) => {
      set((state) => {
        const existingIndex = state.loadedSeries.findIndex(
          (s) => s.seriesInstanceUID === series.seriesInstanceUID
        );

        let updatedSeries;
        if (existingIndex >= 0) {
          updatedSeries = [...state.loadedSeries];
          updatedSeries[existingIndex] = series;
        } else {
          updatedSeries = [...state.loadedSeries, series];
        }

        return {
          loadedSeries: updatedSeries,
          currentSeries: series,
          currentImageIndex: 0,
          isLoading: false,
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



    // 모든 주석 지우기
    clearAllAnnotations: () => {
      set({ annotations: [], selectedAnnotationUID: null });
      console.log("🗑️ 모든 주석 지움");
    },

    // 주석 저장 함수
    saveAnnotations: () => {
      const { annotations } = get();
      
      if (annotations.length === 0) {
        console.warn("💾 저장할 주석이 없습니다");
        return;
      }

      try {
        // Cornerstone 뷰포트에서 실제 주석 데이터 가져오기
        const cornerstoneAnnotations = annotation.state.getAnnotations();
        
        // Zustand 스토어의 annotations와 Cornerstone의 annotations를 결합
        const exportData = {
          timestamp: new Date().toISOString(),
          annotationCount: annotations.length,
          zustandAnnotations: annotations,
          cornerstoneAnnotations: cornerstoneAnnotations || {},
          version: "1.0"
        };

        // JSON 파일로 다운로드
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `dicom-annotations-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`💾 주석 저장 완료: ${annotations.length}개 주석`);
      } catch (error) {
        console.error("❌ 주석 저장 실패:", error);
      }
    },

    // 주석 불러오기 함수
    loadAnnotations: () => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (!file) return;

          try {
            const text = await file.text();
            const importData = JSON.parse(text);

            console.log("📁 주석 파일 로드:", importData);

            // 데이터 검증
            if (!importData.zustandAnnotations || !Array.isArray(importData.zustandAnnotations)) {
              throw new Error("유효하지 않은 주석 파일 형식입니다");
            }

            // 기존 주석 모두 삭제
            get().clearAllAnnotations();
            
            // Cornerstone에서도 모든 주석 삭제
            if (importData.cornerstoneAnnotations) {
              Object.keys(importData.cornerstoneAnnotations).forEach(frameOfReferenceUID => {
                const frameAnnotations = importData.cornerstoneAnnotations[frameOfReferenceUID];
                Object.keys(frameAnnotations).forEach(toolName => {
                  const toolAnnotations = frameAnnotations[toolName];
                  if (Array.isArray(toolAnnotations)) {
                    toolAnnotations.forEach((ann: any) => {
                      try {
                        // Cornerstone에 주석 추가
                        annotation.state.addAnnotation(ann, ann.metadata.FrameOfReferenceUID);
                      } catch (error) {
                        console.warn("주석 복원 실패:", ann.annotationUID, error);
                      }
                    });
                  }
                });
              });
            }

            // Zustand 스토어에 주석 복원
            set({ 
              annotations: importData.zustandAnnotations,
              selectedAnnotationUID: null 
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

            console.log(`📁 주석 불러오기 완료: ${importData.zustandAnnotations.length}개 주석 복원`);
          } catch (error) {
            console.error("❌ 주석 불러오기 실패:", error);
          }
        };

        input.click();
      } catch (error) {
        console.error("❌ 파일 선택 실패:", error);
      }
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
