import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
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
    layoutType: '1x1' as LayoutType,
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

    setLayout: (layout: LayoutType) => {
      const state = get();
      if (state.layoutType !== layout) {
        console.log(`🔄 레이아웃 변경: ${state.layoutType} → ${layout}`);
        set({ layoutType: layout });
        
        // 레이아웃 변경 시 렌더링 엔진 재구성 트리거
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        if (renderingEngine) {
          get().applyLayoutChange(layout, renderingEngine);
        }
      }
    },

    // 레이아웃 변경 적용
    applyLayoutChange: (layout: LayoutType, renderingEngine: any) => {
      console.log(`🏗️ 레이아웃 적용 시작: ${layout}`);
      
      try {
        // 기존 뷰포트들 정리
        const existingViewports = ['dicom-viewport', 'dicom-viewport-1', 'dicom-viewport-2', 'dicom-viewport-3'];
        existingViewports.forEach(viewportId => {
          try {
            const viewport = renderingEngine.getViewport(viewportId);
            if (viewport) {
              renderingEngine.disableElement(viewportId);
            }
          } catch (e) {
            // 뷰포트가 없으면 무시
          }
        });

        // 새 레이아웃에 따라 뷰포트 설정
        if (layout === '1x1') {
          get().setupSingleViewport(renderingEngine);
        } else if (layout === '2x2') {
          get().setupQuadViewports(renderingEngine);
        }
        
        console.log(`✅ 레이아웃 적용 완료: ${layout}`);
        
      } catch (error) {
        console.error(`❌ 레이아웃 변경 실패:`, error);
      }
    },

    // 1x1 레이아웃 설정
    setupSingleViewport: (renderingEngine: any) => {
      console.log('🔧 1x1 레이아웃 설정');
      
      try {
        const mainContainer = document.querySelector('.viewport-container-inner') as HTMLElement;
        if (!mainContainer) {
          console.error('메인 컨테이너를 찾을 수 없음');
          return;
        }

        // 기존 내용 정리
        mainContainer.innerHTML = '';
        
        // 단일 뷰포트 스타일 복원
        mainContainer.style.display = 'block';
        mainContainer.style.gridTemplateColumns = '';
        mainContainer.style.gridTemplateRows = '';
        mainContainer.style.gap = '';

        // 새 뷰포트 요소 생성
        const viewportElement = document.createElement('div');
        viewportElement.style.width = '100%';
        viewportElement.style.height = '100%';
        viewportElement.style.minHeight = '400px';
        viewportElement.style.backgroundColor = '#000000';
        
        mainContainer.appendChild(viewportElement);

        // 🔥 올바른 Enums 사용
        const { Enums } = require('@cornerstonejs/core');
        const viewportInput = {
          viewportId: 'dicom-viewport',
          type: Enums.ViewportType.STACK,
          element: viewportElement,
          defaultOptions: {
            background: [0, 0, 0] as [number, number, number],
          }
        };
        
        renderingEngine.enableElement(viewportInput);
        console.log('✅ 1x1 뷰포트 활성화 완료');

        // 기존 이미지 데이터 복원
        get().restoreImageData('dicom-viewport');
        
      } catch (error) {
        console.error('1x1 레이아웃 설정 실패:', error);
      }
    },

    // 2x2 레이아웃 설정  
    setupQuadViewports: (renderingEngine: any) => {
      console.log('🔧 2x2 레이아웃 설정');
      
      try {
        const mainContainer = document.querySelector('.viewport-container-inner') as HTMLElement;
        if (!mainContainer) {
          console.error('메인 컨테이너를 찾을 수 없음');
          return;
        }

        // 기존 내용 제거
        mainContainer.innerHTML = '';
        
        // 2x2 그리드 스타일 적용
        mainContainer.style.display = 'grid';
        mainContainer.style.gridTemplateColumns = '1fr 1fr';
        mainContainer.style.gridTemplateRows = '1fr 1fr';
        mainContainer.style.gap = '2px';
        
        // 4개의 뷰포트 요소 생성
        const viewportIds = ['dicom-viewport-0', 'dicom-viewport-1', 'dicom-viewport-2', 'dicom-viewport-3'];
        
        viewportIds.forEach((viewportId, index) => {
          const viewportElement = document.createElement('div');
          viewportElement.id = viewportId;
          viewportElement.style.backgroundColor = '#000000';
          viewportElement.style.border = '1px solid #333';
          viewportElement.style.minHeight = '200px';
          
          mainContainer.appendChild(viewportElement);
          
          // 🔥 올바른 Enums 사용
          const { Enums } = require('@cornerstonejs/core');
          const viewportInput = {
            viewportId,
            type: Enums.ViewportType.STACK,
            element: viewportElement,
            defaultOptions: {
              background: [0, 0, 0] as [number, number, number],
            }
          };
          
          renderingEngine.enableElement(viewportInput);
          console.log(`✅ 뷰포트 ${index + 1} (${viewportId}) 활성화 완료`);

          // 각 뷰포트에 동일한 이미지 데이터 적용
          get().restoreImageData(viewportId);
        });
        
        console.log('✅ 2x2 레이아웃 설정 완료');
        
      } catch (error) {
        console.error('2x2 레이아웃 설정 실패:', error);
      }
    },

    // 이미지 데이터 복원 (레이아웃 변경 시 사용)
    restoreImageData: (viewportId: string) => {
      try {
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        if (!renderingEngine) return;

        const viewport = renderingEngine.getViewport(viewportId);
        if (!viewport) return;

        // 기존 이미지 스택 정보 가져오기
        const mainViewport = renderingEngine.getViewport('dicom-viewport');
        if (mainViewport && mainViewport.getImageIds) {
          const imageIds = mainViewport.getImageIds();
          if (imageIds && imageIds.length > 0) {
            viewport.setStack(imageIds).then(() => {
              viewport.render();
              console.log(`✅ ${viewportId}에 이미지 데이터 복원 완료`);
            }).catch((error: any) => {
              console.error(`${viewportId} 이미지 복원 실패:`, error);
            });
          }
        }
      } catch (error) {
        console.error(`이미지 데이터 복원 실패 (${viewportId}):`, error);
      }
    },

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
        const annotationTools = ['Length', 'RectangleROI', 'EllipticalROI', 'ArrowAnnotate'];
        const basicTools = ['Pan', 'Zoom', 'WindowLevel'];

        console.log(`📋 도구 카테고리 확인:`, {
          toolName,
          isAnnotationTool: annotationTools.includes(toolName),
          isBasicTool: basicTools.includes(toolName)
        });

        // Reset all annotation tools to passive first
        annotationTools.forEach(tool => {
          try {
            toolGroupRef.current.setToolPassive(tool);
          } catch (e) {
            console.warn(`Failed to set ${tool} passive:`, e);
          }
        });

        // 🔥 핵심 수정: 모든 도구를 마우스 왼쪽 버튼에 명시적으로 바인딩
        
        // 1단계: 모든 기본 도구들을 먼저 passive로 설정
        basicTools.forEach(tool => {
          try {
            toolGroupRef.current.setToolPassive(tool);
          } catch (e) {
            console.warn(`Failed to set ${tool} passive:`, e);
          }
        });

        // 2단계: 선택된 도구만 마우스 왼쪽 버튼에 활성화
        if (annotationTools.includes(toolName)) {
          // 주석 도구 활성화
          toolGroupRef.current.setToolActive(toolName, {
            bindings: [{ mouseButton: 1 }] // 마우스 왼쪽 버튼
          });
          console.log(`✅ 주석 도구 활성화: ${toolName} (왼쪽 버튼에 바인딩)`);
          
        } else if (basicTools.includes(toolName)) {
          // 🔥 기본 도구도 마우스 왼쪽 버튼에 명시적으로 바인딩!
          toolGroupRef.current.setToolActive(toolName, {
            bindings: [{ mouseButton: 1 }] // 마우스 왼쪽 버튼
          });
          console.log(`✅ 기본 도구 활성화: ${toolName} (왼쪽 버튼에 바인딩)`);
          
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
        const { annotation } = require('@cornerstonejs/tools');
        annotation.state.removeAnnotation(annotationUID);
        console.log(`✅ Cornerstone에서 주석 제거 완료: ${annotationUID}`);
        
        // 추가: 모든 뷰포트에서 주석 제거 (2x2 레이아웃 지원)
        const renderingEngine = (window as any).cornerstoneRenderingEngine;
        if (renderingEngine) {
          const viewportIds = ['dicom-viewport', 'dicom-viewport-0', 'dicom-viewport-1', 'dicom-viewport-2', 'dicom-viewport-3'];
          
          viewportIds.forEach(viewportId => {
            try {
              const viewport = renderingEngine.getViewport(viewportId);
              if (viewport) {
                viewport.render();
              }
            } catch (e) {
              // 뷰포트가 존재하지 않는 경우 무시
            }
          });
          
          console.log('✅ 모든 뷰포트 새로고침 완료');
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
            ['WindowLevel', 'Pan', 'Zoom', 'Length', 'RectangleROI', 'EllipticalROI', 'ArrowAnnotate'].forEach(tool => {
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