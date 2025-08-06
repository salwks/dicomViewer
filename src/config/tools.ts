/**
 * Cornerstone3D Tools Configuration & Management
 * 도구 그룹 관리 및 마우스/키보드 인터랙션 설정
 * Built with shadcn/ui components
 */

import { log } from '../utils/logger';
import {
  ToolGroupManager,
  addTool,
  PanTool,
  WindowLevelTool,
  StackScrollTool,
  ZoomTool,
  ProbeTool,
  RectangleROITool,
  EllipticalROITool,
  BidirectionalTool,
  LengthTool,
  AngleTool,
  CobbAngleTool,
  ArrowAnnotateTool,
  Enums as ToolEnums,
  annotation,
} from '@cornerstonejs/tools';
// 타입 import는 실제로 사용할 때만 추가
import { APP_CONFIG } from './index';

// 도구 타입 정의
export type ToolName =
  | 'Pan'
  | 'WindowLevel'
  | 'StackScroll'
  | 'Zoom'
  | 'Probe'
  | 'RectangleROI'
  | 'EllipticalROI'
  | 'Bidirectional'
  | 'Length'
  | 'Angle'
  | 'CobbAngle'
  | 'ArrowAnnotate';

export type MouseButton = 'PRIMARY' | 'SECONDARY' | 'AUXILIARY' | 'FOURTH' | 'FIFTH';

export interface ToolBinding {
  tool: ToolName;
  mouse: {
    mouseButton: MouseButton;
    modifierKey?: string;
  };
}

// 기본 도구 바인딩 설정 (현재 사용하지 않지만 향후 확장 가능)
// const DEFAULT_TOOL_BINDINGS: ToolBinding[] = [
//   {
//     tool: 'WindowLevel',
//     mouse: { mouseButton: 'PRIMARY' }
//   },
//   {
//     tool: 'Pan',
//     mouse: { mouseButton: 'SECONDARY' }
//   },
//   {
//     tool: 'Zoom',
//     mouse: { mouseButton: 'AUXILIARY' }
//   },
// ]

/**
 * 모든 도구 등록
 */
export function registerAllTools(): void {
  log.info('Registering Cornerstone3D tools...');

  try {
    // 기본 인터랙션 도구
    addTool(PanTool);
    addTool(WindowLevelTool);
    addTool(StackScrollTool);
    addTool(ZoomTool);
    addTool(ProbeTool);

    // 측정 도구
    addTool(LengthTool);
    addTool(AngleTool);
    addTool(CobbAngleTool);
    addTool(BidirectionalTool);

    // ROI 도구
    addTool(RectangleROITool);
    addTool(EllipticalROITool);

    // 어노테이션 도구
    addTool(ArrowAnnotateTool);

    log.info('✓ All tools registered successfully');
  } catch (error) {
    log.error('Failed to register tools:', error);
    throw new Error(`Tool registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 기본 도구 그룹 생성
 */
export function createDefaultToolGroup(toolGroupId?: string): void {
  const groupId = toolGroupId || APP_CONFIG.cornerstone.defaultToolGroupId;

  log.info(`Creating tool group: ${groupId}`);

  try {
    // 기존 도구 그룹이 있으면 삭제
    if (ToolGroupManager.getToolGroup(groupId)) {
      ToolGroupManager.destroyToolGroup(groupId);
    }

    // 새 도구 그룹 생성
    const toolGroup = ToolGroupManager.createToolGroup(groupId);

    if (!toolGroup) {
      throw new Error(`Failed to create tool group: ${groupId}`);
    }

    // 기본 도구들 추가
    toolGroup.addTool(PanTool.toolName);
    toolGroup.addTool(WindowLevelTool.toolName);
    toolGroup.addTool(StackScrollTool.toolName);
    toolGroup.addTool(ZoomTool.toolName);
    toolGroup.addTool(ProbeTool.toolName);

    // 측정 도구들 추가
    toolGroup.addTool(LengthTool.toolName);
    toolGroup.addTool(AngleTool.toolName);
    toolGroup.addTool(CobbAngleTool.toolName);
    toolGroup.addTool(BidirectionalTool.toolName);

    // ROI 도구들 추가
    toolGroup.addTool(RectangleROITool.toolName);
    toolGroup.addTool(EllipticalROITool.toolName);

    // 어노테이션 도구들 추가
    toolGroup.addTool(ArrowAnnotateTool.toolName);

    // 기본 도구 바인딩 설정
    setupDefaultToolBindings(toolGroup);

    log.info(`✓ Tool group created: ${groupId}`);
  } catch (error) {
    log.error('Failed to create tool group:', error);
    throw new Error(`Tool group creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 기본 도구 바인딩 설정
 */
function setupDefaultToolBindings(toolGroup: any): void {
  log.info('Setting up default tool bindings...');

  try {
    // 기본 활성 도구 설정
    toolGroup.setToolActive(WindowLevelTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
    });

    toolGroup.setToolActive(PanTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }],
    });

    toolGroup.setToolActive(ZoomTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }],
    });

    toolGroup.setToolActive(StackScrollTool.toolName);

    // 측정 도구들을 비활성 상태로 설정 (UI에서 활성화)
    toolGroup.setToolPassive(LengthTool.toolName);
    toolGroup.setToolPassive(AngleTool.toolName);
    toolGroup.setToolPassive(CobbAngleTool.toolName);
    toolGroup.setToolPassive(BidirectionalTool.toolName);
    toolGroup.setToolPassive(RectangleROITool.toolName);
    toolGroup.setToolPassive(EllipticalROITool.toolName);
    toolGroup.setToolPassive(ArrowAnnotateTool.toolName);
    toolGroup.setToolPassive(ProbeTool.toolName);

    log.info('✓ Default tool bindings configured');
  } catch (error) {
    log.error('Failed to setup tool bindings:', error);
    throw error;
  }
}

/**
 * 뷰포트에 도구 그룹 연결
 */
export function addViewportToToolGroup(viewportId: string, renderingEngineId: string, toolGroupId?: string): void {
  const groupId = toolGroupId || APP_CONFIG.cornerstone.defaultToolGroupId;

  log.info(`Adding viewport ${viewportId} to tool group ${groupId}`);

  try {
    const toolGroup = ToolGroupManager.getToolGroup(groupId);

    if (!toolGroup) {
      throw new Error(`Tool group not found: ${groupId}`);
    }

    toolGroup.addViewport(viewportId, renderingEngineId);
    log.info(`✓ Viewport ${viewportId} added to tool group`);
  } catch (error) {
    log.error('Failed to add viewport to tool group:', error);
    throw error;
  }
}

/**
 * 뷰포트에서 도구 그룹 연결 해제
 */
export function removeViewportFromToolGroup(viewportId: string, renderingEngineId: string, toolGroupId?: string): void {
  const groupId = toolGroupId || APP_CONFIG.cornerstone.defaultToolGroupId;

  try {
    const toolGroup = ToolGroupManager.getToolGroup(groupId);

    if (!toolGroup) {
      log.warn(`Tool group not found: ${groupId}`);
      return;
    }

    toolGroup.removeViewports(renderingEngineId, viewportId);
    log.info(`✓ Viewport ${viewportId} removed from tool group`);
  } catch (error) {
    log.error('Failed to remove viewport from tool group:', error);
  }
}

/**
 * 활성 도구 변경
 */
export function setActiveTool(toolName: ToolName, toolGroupId?: string, mouseButton?: ToolEnums.MouseBindings): void {
  const groupId = toolGroupId || APP_CONFIG.cornerstone.defaultToolGroupId;

  try {
    const toolGroup = ToolGroupManager.getToolGroup(groupId);

    if (!toolGroup) {
      throw new Error(`Tool group not found: ${groupId}`);
    }

    // 기존 활성 도구들을 passive로 설정
    const currentActiveTools = ['WindowLevel', 'Pan', 'Zoom', 'Length', 'Angle', 'RectangleROI', 'EllipticalROI'];
    currentActiveTools.forEach(tool => {
      try {
        toolGroup.setToolPassive(tool);
      } catch {
        // 도구가 없으면 무시
      }
    });

    // 새 도구를 활성화
    const binding = mouseButton ? { bindings: [{ mouseButton }] } : undefined;
    toolGroup.setToolActive(toolName, binding);

    log.info(`✓ Active tool changed to: ${toolName}`);
  } catch (error) {
    log.error('Failed to set active tool:', error);
    throw error;
  }
}

/**
 * 도구 그룹 정리
 */
export function cleanupToolGroups(): void {
  try {
    const toolGroups = ToolGroupManager.getAllToolGroups();

    toolGroups.forEach(toolGroup => {
      ToolGroupManager.destroyToolGroup(toolGroup.id);
    });

    log.info('✓ All tool groups cleaned up');
  } catch (error) {
    log.error('Error during tool groups cleanup:', error);
  }
}

/**
 * 어노테이션 상태 관리
 */
export const annotationManager = {
  /**
   * 특정 뷰포트의 모든 어노테이션 가져오기
   */
  getAnnotations: () => {
    try {
      return annotation.state.getAllAnnotations();
    } catch (error) {
      log.error('Failed to get annotations:', error);
      return [];
    }
  },

  /**
   * 어노테이션 삭제
   */
  removeAnnotation: (annotationUID: string) => {
    try {
      annotation.state.removeAnnotation(annotationUID);
      log.info(`✓ Annotation removed: ${annotationUID}`);
    } catch (error) {
      log.error('Failed to remove annotation:', error);
    }
  },

  /**
   * 모든 어노테이션 지우기
   */
  clearAllAnnotations: () => {
    try {
      annotation.state.removeAllAnnotations();
      log.info('✓ All annotations cleared');
    } catch (error) {
      log.error('Failed to clear annotations:', error);
    }
  },
};

// 기본 도구 이름들 내보내기
export const ToolNames = {
  Pan: PanTool.toolName,
  WindowLevel: WindowLevelTool.toolName,
  StackScroll: StackScrollTool.toolName,
  Zoom: ZoomTool.toolName,
  Probe: ProbeTool.toolName,
  Length: LengthTool.toolName,
  Angle: AngleTool.toolName,
  CobbAngle: CobbAngleTool.toolName,
  Bidirectional: BidirectionalTool.toolName,
  RectangleROI: RectangleROITool.toolName,
  EllipticalROI: EllipticalROITool.toolName,
  ArrowAnnotate: ArrowAnnotateTool.toolName,
} as const;
