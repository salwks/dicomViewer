import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { annotation } from '@cornerstonejs/tools';
import type { 
  DicomViewerState, 
  ViewportConfig, 
  LayoutType, 
  SeriesInfo, 
  ToolGroupConfig,
  AnnotationData,
  RequiredAnnotationData,
  WindowLevelConfig,
  WindowLevelPreset
} from '../types';

// Default window level presets
const defaultWindowLevelPresets: WindowLevelPreset[] = [
  { name: 'Abdomen', windowCenter: 60, windowWidth: 400 },
  { name: 'Bone', windowCenter: 400, windowWidth: 1000 },
  { name: 'Brain', windowCenter: 40, windowWidth: 80 },
  { name: 'Chest', windowCenter: -600, windowWidth: 1600 },
  { name: 'Lung', windowCenter: -600, windowWidth: 1600 },
  { name: 'Mediastinum', windowCenter: 50, windowWidth: 350 },
];

export const useDicomStore = create<DicomViewerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    viewports: new Map(),
    activeViewportId: null,
    viewportConfigs: new Map(), // 뷰포트별 설정 저장
    
    loadedSeries: [],
    currentSeries: null,
    currentImageIndex: 0,
    
    activeTool: null,
    toolGroups: new Map(),
    
    annotations: [],
    selectedAnnotationUID: null,
    
    // 사이드바 컨트롤 상태
    annotationsVisible: true,
    panZoomEnabled: false,
    lastActiveTool: null, // 팬/줌 모드 이전의 마지막 도구
    
    windowLevelPresets: defaultWindowLevelPresets,
    currentWindowLevel: null,
    
    isLoading: false,
    error: null,
    sidebarOpen: true,

    // Actions
    setActiveViewport: (viewportId: string) => {
      set({ activeViewportId: viewportId });
    },

    // Layout functionality completely removed for single viewport stability

    loadSeries: (series: SeriesInfo) => {
      set((state) => {
        const existingIndex = state.loadedSeries.findIndex(
          s => s.seriesInstanceUID === series.seriesInstanceUID
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
          error: null
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
        console.warn('No tool group available for tool activation');
        return false;
      }

      try {
        console.log(`🔧 도구 활성화 시작: ${toolName}`);

        // Define tool categories and their activation logic
        const annotationTools = [
          'Length', 'Angle', 'CobbAngle', 'Bidirectional',
          'RectangleROI', 'EllipticalROI', 'CircleROI',
          'PlanarFreehandROI', 'SplineROI',
          'ArrowAnnotate', 'Probe'
        ];
        const basicTools = ['Pan', 'Zoom', 'WindowLevel', 'StackScroll', 'Magnify'];

        console.log(`📋 도구 카테고리 확인:`, {
          toolName,
          isAnnotationTool: annotationTools.includes(toolName),
          isBasicTool: basicTools.includes(toolName)
        });

        // Reset all tools to passive first
        const allTools = [...annotationTools, ...basicTools];
        allTools.forEach(tool => {
          try {
            toolGroupRef.current.setToolPassive(tool);
          } catch (e) {
            console.warn(`Failed to set ${tool} passive:`, e);
          }
        });

        // 선택된 도구만 마우스 왼쪽 버튼에 활성화
        if (annotationTools.includes(toolName) || basicTools.includes(toolName)) {
          toolGroupRef.current.setToolActive(toolName, {
            bindings: [{ mouseButton: 1 }] // 마우스 왼쪽 버튼
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
          message: `마우스 왼쪽 버튼으로 ${toolName} 도구를 사용할 수 있습니다.`
        });
        
        return true;

      } catch (error) {
        console.error(`Failed to activate tool ${toolName}:`, error);
        return false;
      }
    },

    addAnnotation: (annotation: RequiredAnnotationData) => {
      // Ensure annotationUID is always present - fix for TS2345
      const annotationWithUID: AnnotationData = {
        ...annotation,
        annotationUID: annotation.annotationUID || uuidv4(),
      };

      set((state) => ({
        annotations: [...state.annotations, annotationWithUID],
        selectedAnnotationUID: annotationWithUID.annotationUID
      }));
      
      console.log(`Added annotation: ${annotationWithUID.annotationUID}`);
    },

    updateAnnotation: (annotationUID: string, updates: Partial<AnnotationData>) => {
      // Ensure annotationUID is string type - fix for TS2345
      if (typeof annotationUID !== 'string' || !annotationUID) {
        console.error('Invalid annotationUID provided for update');
        return;
      }

      set((state) => ({
        annotations: state.annotations.map(ann => 
          ann.annotationUID === annotationUID 
            ? { ...ann, ...updates }
            : ann
        )
      }));
      
      console.log(`Updated annotation: ${annotationUID}`);
    },

    updateAnnotationLabel: (annotationUID: string, newLabel: string) => {
      // Ensure annotationUID is string type and newLabel is provided
      if (typeof annotationUID !== 'string' || !annotationUID) {
        console.error('Invalid annotationUID provided for label update');
        return;
      }

      if (typeof newLabel !== 'string') {
        console.error('Invalid label provided for annotation update');
        return;
      }

      console.log(`📝 주석 라벨 업데이트: ${annotationUID} -> "${newLabel}"`);

      set((state) => ({
        annotations: state.annotations.map(ann => 
          ann.annotationUID === annotationUID 
            ? { 
                ...ann, 
                data: { 
                  ...ann.data, 
                  label: newLabel,
                  text: newLabel 
                }
              }
            : ann
        )
      }));
      
      console.log(`✅ 주석 라벨 업데이트 완료: ${annotationUID}`);
    },

    removeAnnotation: (annotationUID: string) => {
      // Ensure annotationUID is string type - fix for TS2345
      if (typeof annotationUID !== 'string' || !annotationUID) {
        console.error('Invalid annotationUID provided for removal');
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
            const viewport = renderingEngine.getViewport('dicom-viewport');
            if (viewport) {
              viewport.render();
              console.log('✅ 뷰포트 새로고침 완료');
            }
          } catch (e) {
            console.warn('뷰포트 새로고침 실패:', e);
          }
        }
        
      } catch (error) {
        console.error('Cornerstone 주석 제거 실패:', error);
      }

      // 🔥 Zustand 스토어에서 주석 제거 (목록에서 즉시 사라짐)
      set((state) => ({
        annotations: state.annotations.filter(ann => ann.annotationUID !== annotationUID),
        selectedAnnotationUID: state.selectedAnnotationUID === annotationUID 
          ? null 
          : state.selectedAnnotationUID
      }));
      
      console.log(`✅ 스토어에서 주석 제거 완료: ${annotationUID}`);
    },

    setWindowLevel: (config: WindowLevelConfig) => {
      set({ currentWindowLevel: config });
      console.log(`Window level set: C${config.windowCenter} W${config.windowWidth}`);
    },

    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    setError: (error: string | null) => {
      set({ error, isLoading: false });
      if (error) {
        console.error('DICOM Viewer Error:', error);
      }
    },

    toggleSidebar: () => {
      set((state) => ({ sidebarOpen: !state.sidebarOpen }));
    },

    // 주석 가시성 제어
    setAnnotationsVisible: (visible: boolean) => {
      set({ annotationsVisible: visible });
      console.log(`주석 가시성 설정: ${visible ? '표시' : '숨김'}`);
      
      // 즉시 주석 가시성 적용
      try {
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        if (renderingEngine) {
          const viewport = renderingEngine.getViewport('dicom-viewport');
          if (viewport) {
            // 모든 기존 주석들의 가시성 제어
            const annotationManager = annotation.state.getAllAnnotations();
            if (annotationManager) {
              Object.keys(annotationManager).forEach(toolName => {
                const toolAnnotations = annotationManager[toolName];
                if (toolAnnotations && Array.isArray(toolAnnotations)) {
                  toolAnnotations.forEach(ann => {
                    if (ann && ann.annotationUID) {
                      ann.isVisible = visible;
                    }
                  });
                }
              });
            }
            
            // 뷰포트 새로고침
            viewport.render();
            console.log(`✅ 주석 가시성 즉시 적용: ${visible ? '표시' : '숨김'}`);
          }
        }
      } catch (error) {
        console.error('주석 가시성 즉시 적용 실패:', error);
      }
    },

    // 팬/줌 모드 토글
    setPanZoomEnabled: (enabled: boolean, toolGroupRef?: any) => {
      const state = get();
      
      if (enabled) {
        // 팬/줌 모드 활성화: 현재 도구를 저장하고 팬/줌 설정
        console.log('🔄 팬/줌 모드 활성화');
        set({ 
          panZoomEnabled: true, 
          lastActiveTool: state.activeTool 
        });
        
        // 팬 도구를 왼쪽 버튼에, 줌 도구를 오른쪽 버튼에 바인딩
        if (toolGroupRef?.current) {
          try {
            // 모든 도구를 passive로 설정
            const allToolNames = [
              'WindowLevel', 'Pan', 'Zoom', 'StackScroll', 'Magnify',
              'Length', 'Angle', 'CobbAngle', 'Bidirectional',
              'RectangleROI', 'EllipticalROI', 'CircleROI',
              'PlanarFreehandROI', 'SplineROI',
              'ArrowAnnotate', 'Probe'
            ];
            allToolNames.forEach(tool => {
              toolGroupRef.current.setToolPassive(tool);
            });
            
            // 팬/줌 도구 활성화
            toolGroupRef.current.setToolActive('Pan', {
              bindings: [{ mouseButton: 1 }] // 왼쪽 버튼
            });
            toolGroupRef.current.setToolActive('Zoom', {
              bindings: [{ mouseButton: 2 }] // 오른쪽 버튼
            });
            
            console.log('✅ 팬/줌 도구 활성화 완료: 왼쪽=Pan, 오른쪽=Zoom');
          } catch (error) {
            console.error('팬/줌 도구 활성화 실패:', error);
          }
        }
        
      } else {
        // 팬/줌 모드 비활성화: 이전 도구로 복구
        console.log('🔄 팬/줌 모드 비활성화');
        const previousTool = state.lastActiveTool || 'WindowLevel';
        
        set({ 
          panZoomEnabled: false,
          activeTool: previousTool,
          lastActiveTool: null
        });
        
        // 이전 도구로 복구
        if (toolGroupRef?.current) {
          get().activateToolInViewport(previousTool, toolGroupRef);
        }
        
        console.log(`✅ 이전 도구로 복구: ${previousTool}`);
      }
    },

    // 모든 주석 지우기
    clearAllAnnotations: () => {
      set({ annotations: [], selectedAnnotationUID: null });
      console.log('🗑️ 모든 주석 지움');
    },
  }))
);

// Selectors for better performance
export const selectActiveViewport = (state: DicomViewerState) => state.activeViewportId;
export const selectCurrentSeries = (state: DicomViewerState) => state.currentSeries;
export const selectAnnotations = (state: DicomViewerState) => state.annotations;
export const selectActiveTool = (state: DicomViewerState) => state.activeTool;
export const selectWindowLevel = (state: DicomViewerState) => state.currentWindowLevel;
export const selectIsLoading = (state: DicomViewerState) => state.isLoading;
export const selectError = (state: DicomViewerState) => state.error;