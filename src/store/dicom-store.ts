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

    // 주석 저장 함수 (Element not enabled 오류 해결)
    saveAnnotations: () => {
      const { annotations } = get();
      
      if (annotations.length === 0) {
        console.warn("💾 저장할 주석이 없습니다");
        return;
      }

      try {
        console.log("🔍 주석 저장 시작 - 뷰포트 및 annotation 상태 확인");
        
        // 1. 렌더링 엔진과 뷰포트 상태 확인
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        let viewport = null;
        let isElementEnabled = false;
        
        if (renderingEngine) {
          try {
            viewport = renderingEngine.getViewport("dicom-viewport");
            isElementEnabled = viewport && viewport.element && viewport.element.isConnected;
            console.log(`📱 뷰포트 상태: ${isElementEnabled ? '활성화됨' : '비활성화됨'}`);
          } catch (error) {
            console.warn("⚠️ 뷰포트 접근 실패:", error);
          }
        }

        // 2. 안전한 방법으로 Cornerstone annotations 수집
        let cornerstoneAnnotations = {};
        let fallbackFrameOfReferenceUID = null;
        
        if (isElementEnabled && viewport) {
          try {
            // 뷰포트에서 현재 이미지의 FrameOfReferenceUID 가져오기
            const currentImage = viewport.getCurrentImageId();
            if (currentImage) {
              // 현재 이미지에서 FrameOfReferenceUID 추출 시도
              const imageData = viewport.getImageData();
              fallbackFrameOfReferenceUID = imageData?.metadata?.FrameOfReferenceUID || 
                                            viewport.getFrameOfReferenceUID?.() || 
                                            "default-frame-of-reference";
              console.log(`🆔 기본 FrameOfReferenceUID: ${fallbackFrameOfReferenceUID}`);
            }
            
            // 개별 FrameOfReferenceUID별로 주석 수집 (안전한 방법)
            const uniqueFrameUIDs = new Set();
            annotations.forEach(ann => {
              if (ann.metadata?.FrameOfReferenceUID) {
                uniqueFrameUIDs.add(ann.metadata.FrameOfReferenceUID);
              } else if (fallbackFrameOfReferenceUID) {
                uniqueFrameUIDs.add(fallbackFrameOfReferenceUID);
              }
            });
            
            // 각 FrameOfReferenceUID에 대해 주석 가져오기
            uniqueFrameUIDs.forEach(frameUID => {
              try {
                const frameAnnotations = annotation.state.getAnnotations(frameUID);
                if (frameAnnotations && Object.keys(frameAnnotations).length > 0) {
                  cornerstoneAnnotations[frameUID] = frameAnnotations;
                  console.log(`✅ FrameOfReferenceUID ${frameUID}에서 주석 수집 완료`);
                }
              } catch (error) {
                console.warn(`⚠️ FrameOfReferenceUID ${frameUID} 주석 수집 실패:`, error);
              }
            });
            
          } catch (error) {
            console.warn("⚠️ 뷰포트에서 주석 수집 실패:", error);
          }
        }

        // 3. Zustand 스토어의 주석 데이터 보강 (FrameOfReferenceUID 누락 시 보완)
        const enrichedAnnotations = annotations.map(ann => {
          const enrichedAnn = { ...ann };
          
          // FrameOfReferenceUID가 누락된 경우 보완
          if (!enrichedAnn.metadata?.FrameOfReferenceUID && fallbackFrameOfReferenceUID) {
            enrichedAnn.metadata = {
              ...enrichedAnn.metadata,
              FrameOfReferenceUID: fallbackFrameOfReferenceUID
            };
            console.log(`🔧 주석 ${ann.annotationUID}에 FrameOfReferenceUID 추가: ${fallbackFrameOfReferenceUID}`);
          }
          
          return enrichedAnn;
        });

        // 4. 최종 내보내기 데이터 구성
        const exportData = {
          timestamp: new Date().toISOString(),
          annotationCount: enrichedAnnotations.length,
          viewportStatus: {
            isElementEnabled,
            hasRenderingEngine: !!renderingEngine,
            hasViewport: !!viewport,
            fallbackFrameOfReferenceUID
          },
          zustandAnnotations: enrichedAnnotations,
          cornerstoneAnnotations: cornerstoneAnnotations,
          version: "1.1"
        };

        // 5. JSON 파일로 다운로드
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

        console.log(`💾 주석 저장 완료: ${enrichedAnnotations.length}개 주석`);
        console.log(`📊 Cornerstone 주석 프레임: ${Object.keys(cornerstoneAnnotations).length}개`);
        
      } catch (error) {
        console.error("❌ 주석 저장 실패:", error);
        
        // 오류 발생 시에도 최소한 Zustand 데이터라도 저장
        try {
          const fallbackData = {
            timestamp: new Date().toISOString(),
            annotationCount: annotations.length,
            zustandAnnotations: annotations,
            cornerstoneAnnotations: {},
            version: "1.1-fallback",
            error: error.message
          };
          
          const jsonString = JSON.stringify(fallbackData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `dicom-annotations-fallback-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          console.log("🚨 오류 발생했지만 fallback 데이터로 저장 완료");
        } catch (fallbackError) {
          console.error("❌ Fallback 저장도 실패:", fallbackError);
        }
      }
    },

    // 주석 불러오기 함수 (강화된 오류 처리 및 검증)
    loadAnnotations: () => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (!file) {
            console.log("📂 파일 선택이 취소되었습니다");
            return;
          }

          console.log(`📁 파일 선택됨: ${file.name} (${file.size} bytes)`);

          try {
            // 1. 파일 크기 및 확장자 검증
            if (file.size === 0) {
              throw new Error("빈 파일입니다. 유효한 JSON 파일을 선택해주세요.");
            }

            if (file.size > 10 * 1024 * 1024) { // 10MB 제한
              throw new Error("파일 크기가 너무 큽니다. 10MB 이하의 파일을 선택해주세요.");
            }

            if (!file.name.toLowerCase().endsWith('.json')) {
              console.warn("⚠️ 선택한 파일이 JSON 형식이 아닐 수 있습니다");
            }

            // 2. 파일 내용 읽기
            console.log("📖 파일 내용 읽는 중...");
            const text = await file.text();
            
            if (!text || text.trim().length === 0) {
              throw new Error("파일 내용이 비어있습니다.");
            }

            // 3. JSON 파싱 with detailed error handling
            let importData;
            try {
              console.log("🔍 JSON 파싱 시작...");
              importData = JSON.parse(text);
            } catch (parseError) {
              console.error("❌ JSON 파싱 실패:", parseError);
              
              // 파싱 오류 상세 분석
              let errorMessage = "JSON 파일이 손상되었거나 올바르지 않은 형식입니다.\n\n";
              
              if (parseError instanceof SyntaxError) {
                errorMessage += `파싱 오류: ${parseError.message}\n`;
                
                // 일반적인 JSON 오류 케이스 분석
                if (parseError.message.includes('Unexpected token')) {
                  errorMessage += "• 파일에 유효하지 않은 문자가 포함되어 있습니다.\n";
                } else if (parseError.message.includes('Unexpected end')) {
                  errorMessage += "• 파일이 완전하지 않습니다. 파일 다운로드가 중단되었을 수 있습니다.\n";
                }
                
                errorMessage += "• DICOM 뷰어에서 내보낸 정상적인 JSON 파일인지 확인해주세요.\n";
                errorMessage += "• 파일을 다시 저장하거나 다른 파일을 시도해보세요.";
              }
              
              throw new Error(errorMessage);
            }

            console.log("✅ JSON 파싱 완료:", {
              version: importData.version,
              timestamp: importData.timestamp,
              annotationCount: importData.annotationCount
            });

            // 4. 파일 형식 및 구조 검증
            const validationErrors = [];
            
            if (!importData || typeof importData !== 'object') {
              validationErrors.push("파일 내용이 유효한 객체가 아닙니다.");
            }

            if (!importData.zustandAnnotations) {
              validationErrors.push("주석 데이터(zustandAnnotations)가 없습니다.");
            } else if (!Array.isArray(importData.zustandAnnotations)) {
              validationErrors.push("주석 데이터가 배열 형식이 아닙니다.");
            }

            if (!importData.version) {
              console.warn("⚠️ 파일 버전 정보가 없습니다. 호환성 문제가 발생할 수 있습니다.");
            }

            if (validationErrors.length > 0) {
              throw new Error(`파일 형식 검증 실패:\n${validationErrors.join('\n')}\n\n이 파일은 DICOM 뷰어에서 내보낸 주석 파일이 아닙니다.`);
            }

            // 5. 주석 데이터 개별 검증
            const annotations = importData.zustandAnnotations;
            let validAnnotations = 0;
            let invalidAnnotations = 0;

            annotations.forEach((ann, index) => {
              try {
                if (!ann.annotationUID || !ann.toolName) {
                  console.warn(`⚠️ 주석 ${index + 1}: 필수 필드 누락 (annotationUID 또는 toolName)`);
                  invalidAnnotations++;
                } else {
                  validAnnotations++;
                }
              } catch (error) {
                console.warn(`⚠️ 주석 ${index + 1} 검증 실패:`, error);
                invalidAnnotations++;
              }
            });

            console.log(`📊 주석 검증 결과: 유효 ${validAnnotations}개, 무효 ${invalidAnnotations}개`);

            if (validAnnotations === 0) {
              throw new Error("불러올 수 있는 유효한 주석이 없습니다.");
            }

            // 6. 렌더링 엔진 및 뷰포트 상태 확인
            const renderingEngine = (window as any).cornerstoneRenderingEngine;
            let viewport = null;
            let isViewportReady = false;

            if (renderingEngine) {
              try {
                viewport = renderingEngine.getViewport("dicom-viewport");
                isViewportReady = viewport && viewport.element && viewport.element.isConnected;
                console.log(`🖼️ 뷰포트 상태: ${isViewportReady ? '준비됨' : '준비되지 않음'}`);
              } catch (error) {
                console.warn("⚠️ 뷰포트 상태 확인 실패:", error);
              }
            }

            if (!isViewportReady) {
              console.warn("⚠️ 뷰포트가 준비되지 않았습니다. 일부 기능이 제한될 수 있습니다.");
            }

            // 7. 기존 주석 모두 삭제
            console.log("🗑️ 기존 주석 삭제 중...");
            get().clearAllAnnotations();
            
            // 8. Cornerstone 주석 복원
            let cornerstoneRestoredCount = 0;
            
            if (importData.cornerstoneAnnotations && isViewportReady) {
              console.log("🔄 Cornerstone 주석 복원 시작...");
              
              try {
                Object.keys(importData.cornerstoneAnnotations).forEach(frameOfReferenceUID => {
                  const frameAnnotations = importData.cornerstoneAnnotations[frameOfReferenceUID];
                  
                  if (frameAnnotations && typeof frameAnnotations === 'object') {
                    Object.keys(frameAnnotations).forEach(toolName => {
                      const toolAnnotations = frameAnnotations[toolName];
                      
                      if (Array.isArray(toolAnnotations)) {
                        toolAnnotations.forEach((ann: any) => {
                          try {
                            if (ann && ann.annotationUID && ann.metadata?.FrameOfReferenceUID) {
                              annotation.state.addAnnotation(ann, ann.metadata.FrameOfReferenceUID);
                              cornerstoneRestoredCount++;
                            }
                          } catch (error) {
                            console.warn(`주석 복원 실패 (${ann?.annotationUID}):`, error);
                          }
                        });
                      }
                    });
                  }
                });
              } catch (error) {
                console.error("❌ Cornerstone 주석 복원 중 오류:", error);
              }
            }

            // 9. Zustand 스토어에 주석 복원
            console.log("📝 Zustand 스토어에 주석 복원 중...");
            set({ 
              annotations: annotations,
              selectedAnnotationUID: null 
            });

            // 10. 뷰포트 새로고침
            if (isViewportReady && viewport) {
              try {
                console.log("🔄 뷰포트 새로고침 중...");
                viewport.render();
                console.log("✅ 뷰포트 새로고침 완료");
              } catch (e) {
                console.warn("뷰포트 새로고침 실패:", e);
              }
            }

            // 11. 성공 메시지
            const successMessage = [
              `📁 주석 불러오기 완료!`,
              `• 총 ${validAnnotations}개 주석 복원`,
              `• Cornerstone 주석 ${cornerstoneRestoredCount}개 복원`,
              `• 파일 버전: ${importData.version || 'Unknown'}`,
              `• 원본 저장 시간: ${importData.timestamp || 'Unknown'}`
            ].join('\n');

            console.log(successMessage);

            // 사용자에게 성공 알림 (선택사항)
            if (typeof window !== 'undefined' && window.alert) {
              setTimeout(() => {
                alert(`주석 불러오기 완료!\n\n${validAnnotations}개의 주석이 성공적으로 복원되었습니다.`);
              }, 100);
            }

          } catch (error) {
            console.error("❌ 주석 불러오기 실패:", error);
            
            // 사용자에게 오류 알림
            if (typeof window !== 'undefined' && window.alert) {
              setTimeout(() => {
                alert(`주석 불러오기 실패\n\n${error.message}`);
              }, 100);
            }
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
