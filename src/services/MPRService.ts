/**
 * MPRService
 * Multi-Planar Reconstruction 관리 서비스
 * 3평면(Axial, Sagittal, Coronal) 재구성 및 동기화
 */

import {
  RenderingEngine,
  // type Types, // Currently unused
  Enums,
} from '@cornerstonejs/core';
import type { MPRConfig } from '@/types/viewer';
import { log } from '../utils/logger';

export interface MPRViewportData {
  viewportId: string;
  orientation: 'axial' | 'sagittal' | 'coronal';
  element: HTMLElement;
  sliceIndex: number;
  thickness: number;
}

export interface MPRSynchronizationPoint {
  worldPosition: [number, number, number]; // [number, number, number] not available
  imagePosition: [number, number, number]; // [number, number, number] not available
  sliceIndices: {
    axial: number;
    sagittal: number;
    coronal: number;
  };
}

export class MPRService {
  private renderingEngine: any | null = null; // Types.IRenderingEngine not available
  private viewports: Map<string, MPRViewportData> = new Map();
  private volumeId: string | null = null;
  private currentConfig: MPRConfig | null = null;
  private synchronizationEnabled = true;

  constructor(renderingEngineId = 'mprRenderingEngine') {
    this.initializeRenderingEngine(renderingEngineId);
  }

  /**
   * 렌더링 엔진 초기화
   */
  private async initializeRenderingEngine(renderingEngineId: string): Promise<void> {
    try {
      this.renderingEngine = new RenderingEngine(renderingEngineId);
      log.info(`MPR rendering engine initialized: ${renderingEngineId}`);
    } catch (error) {
      console.error('Failed to initialize MPR rendering engine:', error);
      throw error;
    }
  }

  /**
   * MPR 뷰포트 생성
   */
  async createMPRViewport(
    viewportId: string,
    element: HTMLElement,
    orientation: 'axial' | 'sagittal' | 'coronal',
    config: MPRConfig,
  ): Promise<void> {
    if (!this.renderingEngine) {
      throw new Error('Rendering engine not initialized');
    }

    try {
      const viewportInput = {
        viewportId,
        type: Enums.ViewportType.ORTHOGRAPHIC,
        element: element as HTMLDivElement,
        defaultOptions: {
          background: [0, 0, 0],
        },
      };

      this.renderingEngine.setViewports([viewportInput]);

      const viewport = this.renderingEngine.getViewport(viewportId);
      if (!viewport) {
        throw new Error(`Failed to create MPR viewport: ${viewportId}`);
      }

      // 뷰포트 데이터 저장
      const viewportData: MPRViewportData = {
        viewportId,
        orientation,
        element,
        sliceIndex: 0,
        thickness: config.thickness,
      };

      this.viewports.set(viewportId, viewportData);
      this.currentConfig = config;

      log.info(`MPR viewport created: ${viewportId} (${orientation})`);
    } catch (error) {
      console.error(`Failed to create MPR viewport ${viewportId}:`, error);
      throw error;
    }
  }

  /**
   * 볼륨 데이터 설정
   */
  async setVolumeForMPR(volumeId: string): Promise<void> {
    if (!this.renderingEngine) {
      throw new Error('Rendering engine not initialized');
    }

    try {
      this.volumeId = volumeId;

      // 각 뷰포트에 볼륨 설정
      const viewportIds = Array.from(this.viewports.keys());

      // TODO: 실제 Cornerstone3D setVolumesForViewports 사용
      // await setVolumesForViewports(
      //   this.renderingEngine,
      //   [{ volumeId }],
      //   viewportIds
      // )

      log.info(`Volume ${volumeId} set for MPR viewports:`, viewportIds);
    } catch (error) {
      console.error(`Failed to set volume for MPR: ${volumeId}`, error);
      throw error;
    }
  }

  /**
   * MPR 설정 적용
   */
  async applyMPRConfig(config: MPRConfig): Promise<void> {
    if (!this.renderingEngine) return;

    try {
      this.currentConfig = config;

      // 각 뷰포트의 가시성 설정
      this.viewports.forEach((viewportData, viewportId) => {
        const isVisible = this.getVisibilityForOrientation(viewportData.orientation, config);

        if (!isVisible) {
          // 뷰포트 숨기기
          viewportData.element.style.display = 'none';
        } else {
          // 뷰포트 표시
          viewportData.element.style.display = 'block';

          // 슬라이스 두께 설정
          viewportData.thickness = config.thickness;
          this.updateSliceThickness(viewportId, config.thickness);
        }
      });

      // 블렌드 모드 설정
      await this.setBlendMode(config.blendMode);

      log.info('MPR config applied:', config);
    } catch (error) {
      console.error('Failed to apply MPR config:', error);
      throw error;
    }
  }

  /**
   * 방향별 가시성 확인
   */
  private getVisibilityForOrientation(orientation: string, config: MPRConfig): boolean {
    switch (orientation) {
      case 'axial':
        return config.axialVisible;
      case 'sagittal':
        return config.sagittalVisible;
      case 'coronal':
        return config.coronalVisible;
      default:
        return false;
    }
  }

  /**
   * 슬라이스 두께 업데이트
   */
  private async updateSliceThickness(viewportId: string, thickness: number): Promise<void> {
    if (!this.renderingEngine) return;

    try {
      const viewport = this.renderingEngine.getViewport(viewportId);
      if (!viewport) return;

      // TODO: 실제 Cornerstone3D 슬라이스 두께 설정
      // viewport.setSlabThickness(thickness)

      const viewportData = this.viewports.get(viewportId);
      if (viewportData) {
        viewportData.thickness = thickness;
      }

      viewport.render();
      log.debug(`Slice thickness updated for ${viewportId}: ${thickness}mm`);
    } catch (error) {
      console.error(`Failed to update slice thickness for ${viewportId}:`, error);
    }
  }

  /**
   * 블렌드 모드 설정
   */
  private async setBlendMode(blendMode: MPRConfig['blendMode']): Promise<void> {
    // TODO: Cornerstone3D 블렌드 모드 구현
    const blendModeMap = {
      maximum: 'MAXIMUM_INTENSITY_PROJECTION',
      minimum: 'MINIMUM_INTENSITY_PROJECTION',
      average: 'AVERAGE_INTENSITY_PROJECTION',
    };

    // eslint-disable-next-line security/detect-object-injection -- Safe: blendMode is validated MPRBlendMode enum value
    const cornerstone3DBlendMode = blendModeMap[blendMode];
    log.info(`MPR blend mode set to: ${cornerstone3DBlendMode}`);
  }

  /**
   * 뷰포트 동기화
   */
  async synchronizeViewports(syncPoint: MPRSynchronizationPoint): Promise<void> {
    if (!this.synchronizationEnabled || !this.renderingEngine) return;

    try {
      // 각 뷰포트를 동기화 지점으로 업데이트
      this.viewports.forEach(async (viewportData, viewportId) => {
        const viewport = this.renderingEngine?.getViewport(viewportId);
        if (!viewport) return;

        const sliceIndex = syncPoint.sliceIndices[viewportData.orientation];

        // TODO: 실제 Cornerstone3D 슬라이스 인덱스 설정
        // viewport.setSliceIndex(sliceIndex)

        viewportData.sliceIndex = sliceIndex;
        viewport.render();
      });

      log.debug('MPR viewports synchronized:', syncPoint);
    } catch (error) {
      console.error('Failed to synchronize MPR viewports:', error);
    }
  }

  /**
   * 특정 뷰포트의 슬라이스 인덱스 설정
   */
  async setSliceIndex(viewportId: string, sliceIndex: number): Promise<void> {
    if (!this.renderingEngine) return;

    try {
      const viewport = this.renderingEngine.getViewport(viewportId);
      const viewportData = this.viewports.get(viewportId);

      if (!viewport || !viewportData) return;

      // TODO: 실제 Cornerstone3D 슬라이스 인덱스 설정
      // viewport.setSliceIndex(sliceIndex)

      viewportData.sliceIndex = sliceIndex;
      viewport.render();

      // 동기화가 활성화된 경우 다른 뷰포트도 업데이트
      if (this.synchronizationEnabled) {
        await this.updateCrossReferencedViewports(viewportId, sliceIndex);
      }

      log.debug(`Slice index set for ${viewportId}: ${sliceIndex}`);
    } catch (error) {
      console.error(`Failed to set slice index for ${viewportId}:`, error);
    }
  }

  /**
   * 교차 참조된 뷰포트 업데이트
   */
  private async updateCrossReferencedViewports(sourceViewportId: string, sliceIndex: number): Promise<void> {
    // TODO: 다른 방향 뷰포트의 교차선 업데이트 로직
    const sourceViewport = this.viewports.get(sourceViewportId);
    if (!sourceViewport) return;

    log.debug(`Updating cross-referenced viewports from ${sourceViewportId}, slice: ${sliceIndex}`);
  }

  /**
   * 월드 좌표를 이미지 좌표로 변환
   */
  worldToImageCoordinates(
    worldPosition: [number, number, number],
    _orientation: 'axial' | 'sagittal' | 'coronal',
  ): [number, number, number] {
    // TODO: 실제 Cornerstone3D 좌표 변환 구현
    // utilities.worldToImageCoords()

    // 시뮬레이션 변환
    return [worldPosition[0] + 256, worldPosition[1] + 256, worldPosition[2] + 50];
  }

  /**
   * 이미지 좌표를 월드 좌표로 변환
   */
  imageToWorldCoordinates(
    imagePosition: [number, number, number],
    _orientation: 'axial' | 'sagittal' | 'coronal',
  ): [number, number, number] {
    // TODO: 실제 Cornerstone3D 좌표 변환 구현
    // utilities.imageToWorldCoords()

    // 시뮬레이션 변환
    return [imagePosition[0] - 256, imagePosition[1] - 256, imagePosition[2] - 50];
  }

  /**
   * 뷰포트에서 현재 슬라이스 정보 가져오기
   */
  getSliceInfo(viewportId: string): {
    sliceIndex: number;
    totalSlices: number;
    thickness: number;
    spacing: number;
  } | null {
    const viewportData = this.viewports.get(viewportId);
    if (!viewportData) return null;

    // TODO: 실제 볼륨 데이터에서 슬라이스 정보 가져오기
    return {
      sliceIndex: viewportData.sliceIndex,
      totalSlices: 100, // 예시값
      thickness: viewportData.thickness,
      spacing: 1.0, // 예시값
    };
  }

  /**
   * 동기화 활성화/비활성화
   */
  setSynchronizationEnabled(enabled: boolean): void {
    this.synchronizationEnabled = enabled;
    log.info(`MPR synchronization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 뷰포트 제거
   */
  removeViewport(viewportId: string): void {
    if (this.renderingEngine) {
      // TODO: 실제 Cornerstone3D 뷰포트 제거
      // this.renderingEngine.removeViewport(viewportId)
    }

    this.viewports.delete(viewportId);
    log.info(`MPR viewport removed: ${viewportId}`);
  }

  /**
   * 현재 설정 가져오기
   */
  getCurrentConfig(): MPRConfig | null {
    return this.currentConfig;
  }

  /**
   * 등록된 뷰포트 목록 가져오기
   */
  getViewports(): MPRViewportData[] {
    return Array.from(this.viewports.values());
  }

  /**
   * 볼륨 ID 가져오기
   */
  getVolumeId(): string | null {
    return this.volumeId;
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    try {
      // 모든 뷰포트 제거
      this.viewports.forEach((_, viewportId) => {
        this.removeViewport(viewportId);
      });

      // 렌더링 엔진 정리
      if (this.renderingEngine) {
        this.renderingEngine.destroy();
        this.renderingEngine = null;
      }

      this.volumeId = null;
      this.currentConfig = null;

      log.info('MPRService destroyed');
    } catch (error) {
      console.error('Error during MPRService cleanup:', error);
    }
  }
}
