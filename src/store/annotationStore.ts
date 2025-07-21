import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { annotation } from "@cornerstonejs/tools";
import type {
  AnnotationData,
  RequiredAnnotationData,
} from "../types";
import { useSecurityStore } from "./securityStore";
import { sanitizeAnnotationLabel, XSSProtection } from "../utils/xss-protection";
import { isLoginEnabled } from "../utils/feature-flags";

// Viewport tool state interface
export interface ViewportToolState {
  toolName: string | null;
  fileType: 'dicom' | 'image' | null;
  isToolsEnabled: boolean;
}

// Annotation store interface
export interface AnnotationStoreState {
  // State
  annotations: AnnotationData[];
  selectedAnnotationUID: string | null;
  activeTool: string | null; // 하위 호환성을 위해 유지
  
  // New viewport-based state
  activeViewportId: string | null;
  viewportToolStates: Record<string, ViewportToolState>;

  // Actions
  setActiveTool: (toolName: string) => void;
  activateToolInViewport: (toolName: string, toolGroupRef: any) => boolean;
  
  // New viewport-based actions
  setActiveViewport: (viewportId: string) => void;
  setViewportToolState: (viewportId: string, toolState: ViewportToolState) => void;
  activateToolInActiveViewport: (toolName: string) => boolean;
  getActiveViewportToolState: () => ViewportToolState | null;
  addAnnotation: (annotation: RequiredAnnotationData) => void;
  updateAnnotation: (annotationUID: string, updates: Partial<AnnotationData>) => void;
  updateAnnotationLabel: (annotationUID: string, newLabel: string) => void;
  removeAnnotation: (annotationUID: string) => void;
  clearAllAnnotations: () => void;
  setSelectedAnnotation: (annotationUID: string | null) => void;
}

export const useAnnotationStore = create<AnnotationStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    annotations: [],
    selectedAnnotationUID: null,
    activeTool: 'Pan', // 기본 도구를 Pan으로 설정 (하위 호환성)
    
    // New viewport-based state
    activeViewportId: null,
    viewportToolStates: {},

    // Actions
    setActiveTool: (toolName: string) => {
      const currentTool = get().activeTool;
      if (currentTool !== toolName) {
        console.log(`Activating tool: ${toolName}`);
        
        // Security logging for tool activation - only if login is enabled
        if (isLoginEnabled()) {
          const securityStore = useSecurityStore.getState();
          if (securityStore.checkToolAccess(toolName)) {
            set({ activeTool: toolName });
          } else {
            console.warn(`Access denied for tool: ${toolName}`);
            return;
          }
        } else {
          // If login is disabled, allow all tools
          set({ activeTool: toolName });
        }
      }
    },

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

    // New viewport-based actions
    setActiveViewport: (viewportId: string) => {
      console.log(`🎯 활성 뷰포트 변경: ${viewportId}`);
      set({ activeViewportId: viewportId });
      
      // viewportStore와의 동기화는 DicomViewport 컴포넌트에서 처리
      
      // 활성 뷰포트의 도구 상태를 전역 activeTool에 동기화 (하위 호환성)
      const { viewportToolStates } = get();
      const viewportState = viewportToolStates[viewportId];
      if (viewportState && viewportState.toolName) {
        set({ activeTool: viewportState.toolName });
        console.log(`🔧 활성 뷰포트 변경으로 전역 activeTool 업데이트: ${viewportState.toolName}`);
      } else {
        // 뷰포트 상태가 없으면 Pan으로 기본 설정
        set({ activeTool: 'Pan' });
        console.log(`🔧 뷰포트 상태가 없어 Pan으로 기본 설정`);
      }
    },

    setViewportToolState: (viewportId: string, toolState: ViewportToolState) => {
      console.log(`🔧 뷰포트 도구 상태 설정: ${viewportId}`, toolState);
      set((state) => ({
        viewportToolStates: {
          ...state.viewportToolStates,
          [viewportId]: toolState
        }
      }));
      
      // 활성 뷰포트라면 전역 activeTool도 즉시 업데이트 (하위 호환성)
      const { activeViewportId } = get();
      if (activeViewportId === viewportId && toolState.toolName) {
        set({ activeTool: toolState.toolName });
        console.log(`🔧 활성 뷰포트 도구 상태 변경으로 전역 activeTool 업데이트: ${toolState.toolName}`);
      }
    },

    activateToolInActiveViewport: (toolName: string) => {
      const { activeViewportId, viewportToolStates } = get();
      
      if (!activeViewportId) {
        console.warn("활성 뷰포트가 없습니다");
        return false;
      }
      
      const viewportState = viewportToolStates[activeViewportId];
      if (!viewportState) {
        console.warn(`뷰포트 ${activeViewportId}의 상태를 찾을 수 없습니다`);
        return false;
      }
      
      // 파일 타입에 따른 도구 사용 가능 여부 확인
      if (!viewportState.isToolsEnabled) {
        console.warn(`뷰포트 ${activeViewportId}에서 도구 사용이 비활성화되어 있습니다 (파일 타입: ${viewportState.fileType})`);
        return false;
      }
      
      // 도구 그룹 참조 찾기
      const toolGroupRef = (window as any)[`cornerstoneToolGroup_${activeViewportId}`];
      if (!toolGroupRef) {
        console.warn(`뷰포트 ${activeViewportId}의 도구 그룹을 찾을 수 없습니다`);
        return false;
      }
      
      // 기존 activateToolInViewport 로직 재사용
      const success = get().activateToolInViewport(toolName, { current: toolGroupRef });
      
      if (success) {
        // 뷰포트 상태 업데이트
        get().setViewportToolState(activeViewportId, {
          ...viewportState,
          toolName: toolName
        });
        
        // 전역 activeTool도 업데이트 (UI 버튼 활성화 표시용)
        set({ activeTool: toolName });
      }
      
      return success;
    },

    getActiveViewportToolState: () => {
      const { activeViewportId, viewportToolStates } = get();
      if (!activeViewportId) return null;
      return viewportToolStates[activeViewportId] || null;
    },

    addAnnotation: (newAnnotation: RequiredAnnotationData) => {
      // XSS Protection: Sanitize annotation data before storing
      const sanitizedAnnotation = { ...newAnnotation };
      
      // Sanitize text/label fields if they exist
      if (sanitizedAnnotation.data?.label) {
        const originalLabel = sanitizedAnnotation.data.label;
        sanitizedAnnotation.data.label = sanitizeAnnotationLabel(originalLabel);
        
        // Log if sanitization occurred - only if login is enabled
        if (XSSProtection.wasModified(originalLabel, sanitizedAnnotation.data.label) && isLoginEnabled()) {
          const securityStore = useSecurityStore.getState();
          securityStore.logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: `New annotation label sanitized during creation`,
            severity: 'MEDIUM',
            userId: securityStore.currentUser?.username || 'unknown',
            metadata: {
              originalLabel,
              sanitizedLabel: sanitizedAnnotation.data.label,
              annotationType: sanitizedAnnotation.type || 'unknown'
            }
          });
        }
      }

      if (sanitizedAnnotation.data?.text) {
        const originalText = sanitizedAnnotation.data.text;
        sanitizedAnnotation.data.text = sanitizeAnnotationLabel(originalText);
        
        // Log if sanitization occurred - only if login is enabled
        if (XSSProtection.wasModified(originalText, sanitizedAnnotation.data.text) && isLoginEnabled()) {
          const securityStore = useSecurityStore.getState();
          securityStore.logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: `New annotation text sanitized during creation`,
            severity: 'MEDIUM',
            userId: securityStore.currentUser?.username || 'unknown',
            metadata: {
              originalText,
              sanitizedText: sanitizedAnnotation.data.text,
              annotationType: sanitizedAnnotation.type || 'unknown'
            }
          });
        }
      }

      // Ensure annotationUID is always present
      const annotationWithUID: AnnotationData = {
        ...sanitizedAnnotation,
        annotationUID: sanitizedAnnotation.annotationUID || uuidv4(),
      };

      set((state) => {
        // Check if annotation already exists to prevent duplicates
        const existingIndex = state.annotations.findIndex(
          ann => ann.annotationUID === annotationWithUID.annotationUID
        );
        
        if (existingIndex !== -1) {
          console.log(`⚠️ 중복 주석 방지: ${annotationWithUID.annotationUID} 이미 존재`);
          return {
            annotations: state.annotations,
            selectedAnnotationUID: annotationWithUID.annotationUID,
          };
        }
        
        return {
          annotations: [...state.annotations, annotationWithUID],
          selectedAnnotationUID: annotationWithUID.annotationUID,
        };
      });

      console.log(`📝 새 주석 추가 (XSS 보호 적용): ${annotationWithUID.annotationUID}`);
    },

    updateAnnotation: (
      annotationUID: string,
      updates: Partial<AnnotationData>
    ) => {
      if (typeof annotationUID !== "string" || !annotationUID) {
        console.error("Invalid annotationUID provided for update");
        return;
      }

      // XSS Protection: Sanitize update data
      const sanitizedUpdates = { ...updates };
      
      // Sanitize data.label if present
      if (sanitizedUpdates.data?.label) {
        const originalLabel = sanitizedUpdates.data.label;
        sanitizedUpdates.data.label = sanitizeAnnotationLabel(originalLabel);
        
        if (XSSProtection.wasModified(originalLabel, sanitizedUpdates.data.label) && isLoginEnabled()) {
          const securityStore = useSecurityStore.getState();
          securityStore.logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: `Annotation update: label sanitized`,
            severity: 'MEDIUM',
            userId: securityStore.currentUser?.username || 'unknown',
            metadata: {
              annotationUID,
              originalLabel,
              sanitizedLabel: sanitizedUpdates.data.label
            }
          });
        }
      }

      // Sanitize data.text if present
      if (sanitizedUpdates.data?.text) {
        const originalText = sanitizedUpdates.data.text;
        sanitizedUpdates.data.text = sanitizeAnnotationLabel(originalText);
        
        if (XSSProtection.wasModified(originalText, sanitizedUpdates.data.text) && isLoginEnabled()) {
          const securityStore = useSecurityStore.getState();
          securityStore.logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: `Annotation update: text sanitized`,
            severity: 'MEDIUM',
            userId: securityStore.currentUser?.username || 'unknown',
            metadata: {
              annotationUID,
              originalText,
              sanitizedText: sanitizedUpdates.data.text
            }
          });
        }
      }

      set((state) => ({
        annotations: state.annotations.map((ann) =>
          ann.annotationUID === annotationUID ? { ...ann, ...sanitizedUpdates } : ann
        ),
      }));

      console.log(`Updated annotation: ${annotationUID}`);
    },

    updateAnnotationLabel: (annotationUID: string, newLabel: string) => {
      if (typeof annotationUID !== "string" || !annotationUID) {
        console.error("Invalid annotationUID provided for label update");
        return;
      }

      if (typeof newLabel !== "string") {
        console.error("Invalid label provided for annotation update");
        return;
      }

      // XSS Protection: Validate and sanitize user input
      const validation = XSSProtection.validateInput(newLabel);
      if (!validation.isValid) {
        console.error("🚨 XSS attempt detected in annotation label:", validation.reason);
        
        // Log security event - only if login is enabled
        if (isLoginEnabled()) {
          const securityStore = useSecurityStore.getState();
          securityStore.logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: `XSS attempt detected in annotation label: ${validation.reason}`,
            severity: 'HIGH',
            userId: securityStore.currentUser?.username || 'unknown',
            metadata: {
              annotationUID,
              originalInput: newLabel.substring(0, 100), // Log first 100 chars for analysis
              reason: validation.reason
            }
          });
        }
        
        return; // Reject the input entirely
      }

      // Sanitize the input
      const sanitizedLabel = sanitizeAnnotationLabel(newLabel);
      
      // Check if sanitization modified the input
      if (XSSProtection.wasModified(newLabel, sanitizedLabel)) {
        console.warn("⚠️ Annotation label was sanitized:", {
          original: newLabel,
          sanitized: sanitizedLabel
        });
        
        // Log sanitization event - only if login is enabled
        if (isLoginEnabled()) {
          const securityStore = useSecurityStore.getState();
          securityStore.logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: `Annotation label sanitized - potentially malicious content removed`,
            severity: 'MEDIUM',
            userId: securityStore.currentUser?.username || 'unknown',
            metadata: {
              annotationUID,
              originalInput: newLabel,
              sanitizedInput: sanitizedLabel,
              stats: XSSProtection.getSanitizationStats(newLabel, sanitizedLabel)
            }
          });
        }
      }

      console.log(`📝 주석 라벨 업데이트: ${annotationUID} -> "${sanitizedLabel}"`);

      set((state) => ({
        annotations: state.annotations.map((ann) =>
          ann.annotationUID === annotationUID
            ? {
                ...ann,
                data: {
                  ...ann.data,
                  label: sanitizedLabel,
                  text: sanitizedLabel,
                },
              }
            : ann
        ),
      }));

      console.log(`✅ 주석 라벨 업데이트 완료: ${annotationUID}`);
    },

    removeAnnotation: (annotationUID: string) => {
      if (typeof annotationUID !== "string" || !annotationUID) {
        console.error("Invalid annotationUID provided for removal");
        return;
      }

      console.log(`🗑️ 주석 삭제 시작: ${annotationUID}`);

      // Remove from Cornerstone
      try {
        annotation.state.removeAnnotation(annotationUID);
        console.log(`✅ Cornerstone에서 주석 제거 완료: ${annotationUID}`);

        // Refresh viewport
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

      // Remove from store
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

    clearAllAnnotations: () => {
      const currentAnnotations = get().annotations;
      console.log(`🗑️ 모든 주석 지우기 시작: ${currentAnnotations.length}개`);

      // Remove from Cornerstone
      try {
        currentAnnotations.forEach((annotationData) => {
          try {
            annotation.state.removeAnnotation(annotationData.annotationUID);
            console.log(`✅ Cornerstone에서 주석 제거: ${annotationData.annotationUID}`);
          } catch (error) {
            console.error(`❌ 주석 제거 실패: ${annotationData.annotationUID}`, error);
          }
        });

        // Refresh viewport
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

      // Clear store
      set({ annotations: [], selectedAnnotationUID: null });
      console.log("✅ 모든 주석 지우기 완료");
    },

    setSelectedAnnotation: (annotationUID: string | null) => {
      set({ selectedAnnotationUID: annotationUID });
    },
  }))
);

// Selectors for better performance
export const selectAnnotations = (state: AnnotationStoreState) => state.annotations;
export const selectActiveTool = (state: AnnotationStoreState) => state.activeTool;
export const selectSelectedAnnotation = (state: AnnotationStoreState) => state.selectedAnnotationUID;