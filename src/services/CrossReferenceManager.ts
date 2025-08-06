/**
 * CrossReferenceManager Service
 * Cornerstone3D 교차 참조선 관리 서비스
 * 다중 뷰포트 간 해부학적 위치 연결 및 동기화
 */

// import type { Types } from '@cornerstonejs/core'; // Currently unused
import type { CrossReferenceConfig, CrossReferencePosition } from '@/components/CrossReferenceLines';
import type { ViewportReference } from './ViewportSynchronizer';
import { log } from '../utils/logger';

export interface CrossReferenceViewport {
  viewportId: string;
  renderingEngineId: string;
  orientation: 'axial' | 'sagittal' | 'coronal';
  viewport?: any; // Types.IStackViewport not available in current @cornerstonejs/core version
}

export interface CrossReferenceLineData {
  startPoint: [number, number];
  endPoint: [number, number];
  color: string;
  width: number;
  opacity: number;
  orientation: string;
}

export class CrossReferenceManager {
  private viewports: Map<string, CrossReferenceViewport> = new Map();
  private currentPosition: CrossReferencePosition | null = null;
  private config: CrossReferenceConfig;
  private isEnabled = false;
  private eventListeners: Map<string, () => void> = new Map();

  constructor(initialConfig: CrossReferenceConfig) {
    this.config = { ...initialConfig };
  }

  /**
   * 뷰포트 등록
   */
  addViewport(viewportRef: ViewportReference, orientation: 'axial' | 'sagittal' | 'coronal'): void {
    const crossRefViewport: CrossReferenceViewport = {
      viewportId: viewportRef.viewportId,
      renderingEngineId: viewportRef.renderingEngineId,
      orientation,
    };

    this.viewports.set(viewportRef.viewportId, crossRefViewport);

    if (this.isEnabled) {
      this.setupViewportEvents(crossRefViewport);
    }

    log.info(`Cross-reference viewport added: ${viewportRef.viewportId} (${orientation})`);
  }

  /**
   * 뷰포트 제거
   */
  removeViewport(viewportId: string): void {
    this.cleanupViewportEvents(viewportId);
    this.viewports.delete(viewportId);
    log.info(`Cross-reference viewport removed: ${viewportId}`);
  }

  /**
   * 교차 참조 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    if (this.isEnabled === enabled) return;

    this.isEnabled = enabled;

    if (enabled) {
      this.setupAllViewportEvents();
      this.updateCrossReferenceLines();
    } else {
      this.cleanupAllEvents();
      this.clearAllLines();
    }

    log.info(`Cross-reference ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: CrossReferenceConfig): void {
    const configChanged = JSON.stringify(this.config) !== JSON.stringify(newConfig);
    this.config = { ...newConfig };

    if (configChanged && this.isEnabled) {
      this.updateCrossReferenceLines();
    }
  }

  /**
   * 현재 위치 업데이트
   */
  updatePosition(position: CrossReferencePosition): void {
    this.currentPosition = position;

    if (this.isEnabled && this.config.autoUpdate) {
      this.updateCrossReferenceLines();
    }
  }

  /**
   * 특정 뷰포트의 교차 참조선 계산
   */
  private calculateCrossReferenceLines(targetViewport: CrossReferenceViewport): CrossReferenceLineData[] {
    if (!this.currentPosition) return [];

    const lines: CrossReferenceLineData[] = [];
    const { worldPosition } = this.currentPosition;

    // 각 뷰포트의 방향에 따라 교차선 계산
    this.viewports.forEach((sourceViewport, sourceId) => {
      if (sourceId === targetViewport.viewportId) return;

      const lineData = this.calculateIntersectionLine(sourceViewport, targetViewport, worldPosition);

      if (lineData) {
        lines.push(lineData);
      }
    });

    return lines;
  }

  /**
   * 두 뷰포트 간의 교차선 계산
   */
  private calculateIntersectionLine(
    sourceViewport: CrossReferenceViewport,
    _targetViewport: CrossReferenceViewport,
    worldPosition: [number, number, number],
  ): CrossReferenceLineData | null {
    // 방향별 교차선 표시 여부 확인
    if (!this.shouldShowLineForOrientation(sourceViewport.orientation)) {
      return null;
    }

    try {
      // TODO: Cornerstone3D 실제 좌표 변환 로직 구현
      // 현재는 예시 계산
      const startPoint: [number, number] = [0, worldPosition[1] ?? 0];
      const endPoint: [number, number] = [512, worldPosition[1] ?? 0]; // 가정된 이미지 크기

      return {
        startPoint,
        endPoint,
        color: this.getColorForOrientation(sourceViewport.orientation),
        width: this.config.lineWidth,
        opacity: this.config.lineOpacity,
        orientation: sourceViewport.orientation,
      };
    } catch (error) {
      console.error('Error calculating intersection line:', error);
      return null;
    }
  }

  /**
   * 방향별 라인 표시 여부 확인
   */
  private shouldShowLineForOrientation(orientation: string): boolean {
    switch (orientation) {
      case 'axial':
        return this.config.showAxialLines;
      case 'sagittal':
        return this.config.showSagittalLines;
      case 'coronal':
        return this.config.showCoronalLines;
      default:
        return false;
    }
  }

  /**
   * 방향별 색상 가져오기
   */
  private getColorForOrientation(orientation: string): string {
    switch (orientation) {
      case 'axial':
        return this.config.axialColor;
      case 'sagittal':
        return this.config.sagittalColor;
      case 'coronal':
        return this.config.coronalColor;
      default:
        return '#ffffff';
    }
  }

  /**
   * 모든 뷰포트에 이벤트 리스너 설정
   */
  private setupAllViewportEvents(): void {
    this.viewports.forEach(viewport => {
      this.setupViewportEvents(viewport);
    });
  }

  /**
   * 특정 뷰포트에 이벤트 리스너 설정
   */
  private setupViewportEvents(viewport: CrossReferenceViewport): void {
    // TODO: Cornerstone3D 이벤트 리스너 구현
    // - MOUSE_MOVE: 마우스 이동 시 교차선 업데이트
    // - MOUSE_CLICK: 클릭 시 다른 뷰포트 동기화 (interactive 모드)
    // - CAMERA_MODIFIED: 카메라 변경 시 교차선 재계산

    const eventHandler = (): void => {
      if (this.config.autoUpdate) {
        this.updateCrossReferenceLines();
      }
    };

    this.eventListeners.set(viewport.viewportId, eventHandler);

    log.info(`Events setup for viewport: ${viewport.viewportId}`);
  }

  /**
   * 특정 뷰포트의 이벤트 리스너 정리
   */
  private cleanupViewportEvents(viewportId: string): void {
    const eventHandler = this.eventListeners.get(viewportId);
    if (eventHandler) {
      // TODO: Cornerstone3D 이벤트 리스너 제거
      this.eventListeners.delete(viewportId);
    }
  }

  /**
   * 모든 이벤트 리스너 정리
   */
  private cleanupAllEvents(): void {
    this.eventListeners.forEach((_, viewportId) => {
      this.cleanupViewportEvents(viewportId);
    });
    this.eventListeners.clear();
  }

  /**
   * 교차 참조선 업데이트
   */
  private updateCrossReferenceLines(): void {
    if (!this.isEnabled || !this.currentPosition) return;

    this.viewports.forEach(viewport => {
      const lines = this.calculateCrossReferenceLines(viewport);
      this.renderCrossReferenceLines(viewport, lines);
    });
  }

  /**
   * 뷰포트에 교차 참조선 렌더링
   */
  private renderCrossReferenceLines(viewport: CrossReferenceViewport, lines: CrossReferenceLineData[]): void {
    try {
      // TODO: Cornerstone3D Canvas/SVG 오버레이에 라인 그리기
      // 1. 기존 교차선 제거
      // 2. 새 교차선 그리기
      // 3. 스타일 적용 (색상, 두께, 투명도)

      log.debug(`Rendering ${lines.length} cross-reference lines for ${viewport.viewportId}`);
    } catch (error) {
      console.error(`Error rendering cross-reference lines for ${viewport.viewportId}:`, error);
    }
  }

  /**
   * 모든 교차 참조선 제거
   */
  private clearAllLines(): void {
    this.viewports.forEach(viewport => {
      this.clearViewportLines(viewport);
    });
  }

  /**
   * 특정 뷰포트의 교차 참조선 제거
   */
  private clearViewportLines(viewport: CrossReferenceViewport): void {
    try {
      // TODO: Cornerstone3D 오버레이에서 교차선 제거
      log.debug(`Clearing cross-reference lines for ${viewport.viewportId}`);
    } catch (error) {
      console.error(`Error clearing lines for ${viewport.viewportId}:`, error);
    }
  }

  /**
   * 뷰포트 클릭 핸들러 (인터랙티브 모드)
   */
  handleViewportClick(viewportId: string, clickPosition: [number, number]): void {
    if (!this.config.interactive) return;

    // TODO: 클릭된 위치를 다른 뷰포트에 전파
    log.info(`Cross-reference click on ${viewportId}:`, clickPosition);
  }

  /**
   * 현재 설정 반환
   */
  getConfig(): CrossReferenceConfig {
    return { ...this.config };
  }

  /**
   * 등록된 뷰포트 목록 반환
   */
  getViewports(): CrossReferenceViewport[] {
    return Array.from(this.viewports.values());
  }

  /**
   * 현재 위치 반환
   */
  getCurrentPosition(): CrossReferencePosition | null {
    return this.currentPosition;
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    this.cleanupAllEvents();
    this.clearAllLines();
    this.viewports.clear();
    log.info('CrossReferenceManager destroyed');
  }
}

/**
 * CrossReferenceManager 팩토리
 */
export class CrossReferenceFactory {
  private static instances: Map<string, CrossReferenceManager> = new Map();

  static createManager(managerId: string, config: CrossReferenceConfig): CrossReferenceManager {
    if (!this.instances.has(managerId)) {
      const manager = new CrossReferenceManager(config);
      this.instances.set(managerId, manager);
    }

    return this.instances.get(managerId)!;
  }

  static getManager(managerId: string): CrossReferenceManager | null {
    return this.instances.get(managerId) ?? null;
  }

  static destroyManager(managerId: string): void {
    const manager = this.instances.get(managerId);
    if (manager) {
      manager.destroy();
      this.instances.delete(managerId);
    }
  }

  static destroyAll(): void {
    this.instances.forEach(manager => {
      manager.destroy();
    });
    this.instances.clear();
  }
}
