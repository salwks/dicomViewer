/**
 * VolumeRenderingService
 * Cornerstone3D 볼륨 렌더링 관리 서비스
 * 3D 의료 이미징을 위한 볼륨 데이터 처리 및 렌더링
 */

import {
  RenderingEngine,
  // type Types, // Types not available
  Enums,
} from '@cornerstonejs/core';
import type { VolumeRenderingConfig } from '@/types/viewer';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';

export interface VolumeData {
  volumeId: string;
  imageIds: string[];
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin: [number, number, number];
  direction: number[];
  scalarData: ArrayBuffer;
}

export interface VolumeRenderingViewport {
  viewportId: string;
  renderingEngineId: string;
  element: HTMLElement;
  volumeData?: VolumeData;
}

export class VolumeRenderingService {
  private renderingEngine: any | null = null;
  private volumes: Map<string, any> = new Map();
  private viewports: Map<string, VolumeRenderingViewport> = new Map();
  private currentConfig: VolumeRenderingConfig | null = null;

  constructor(renderingEngineId = 'volumeRenderingEngine') {
    this.initializeRenderingEngine(renderingEngineId);
  }

  /**
   * 렌더링 엔진 초기화
   */
  private async initializeRenderingEngine(renderingEngineId: string): Promise<void> {
    try {
      this.renderingEngine = new RenderingEngine(renderingEngineId);
      log.info(`Volume rendering engine initialized: ${renderingEngineId}`);
    } catch (error) {
      console.error('Failed to initialize volume rendering engine:', error);
      throw error;
    }
  }

  /**
   * 볼륨 뷰포트 생성
   */
  async createVolumeViewport(viewportId: string, element: HTMLElement, config: VolumeRenderingConfig): Promise<void> {
    if (!this.renderingEngine) {
      throw new Error('Rendering engine not initialized');
    }

    try {
      const viewportInput = {
        viewportId,
        type: Enums.ViewportType.VOLUME_3D,
        element: element as HTMLDivElement,
        defaultOptions: {
          background: [0.1, 0.1, 0.1] as [number, number, number],
        },
      };

      this.renderingEngine.setViewports([viewportInput]);

      const viewport = this.renderingEngine.getViewport(viewportId) as any;
      if (!viewport) {
        throw new Error(`Failed to create volume viewport: ${viewportId}`);
      }

      // 뷰포트 등록
      this.viewports.set(viewportId, {
        viewportId,
        renderingEngineId: this.renderingEngine.id,
        element,
      });

      // 볼륨 설정 적용
      await this.applyVolumeConfig(viewportId, config);

      log.info(`Volume viewport created: ${viewportId}`);
    } catch (error) {
      console.error(`Failed to create volume viewport ${viewportId}:`, error);
      throw error;
    }
  }

  /**
   * 볼륨 데이터 로드
   */
  async loadVolumeData(volumeId: string, imageIds: string[]): Promise<VolumeData> {
    try {
      // TODO: 실제 Cornerstone3D volumeLoader 사용
      // const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds })

      // 현재는 시뮬레이션 데이터
      const volumeData: VolumeData = {
        volumeId,
        imageIds,
        dimensions: [512, 512, 100],
        spacing: [1.0, 1.0, 1.0],
        origin: [0, 0, 0],
        direction: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        scalarData: new ArrayBuffer(512 * 512 * 100 * 2), // 16-bit data
      };

      this.volumes.set(volumeId, volumeData);
      log.info(`Volume data loaded: ${volumeId}`);

      return volumeData;
    } catch (error) {
      console.error(`Failed to load volume data ${volumeId}:`, error);
      throw error;
    }
  }

  /**
   * 뷰포트에 볼륨 설정
   */
  async setVolumesForViewport(viewportId: string, volumeIds: string[]): Promise<void> {
    if (!this.renderingEngine) {
      throw new Error('Rendering engine not initialized');
    }

    try {
      // TODO: 실제 Cornerstone3D setVolumesForViewports 사용
      // await setVolumesForViewports(
      //   this.renderingEngine,
      //   volumeIds.map(volumeId => ({ volumeId })),
      //   [viewportId]
      // )

      const viewport = this.viewports.get(viewportId);
      if (viewport && volumeIds[0]) {
        viewport.volumeData = this.volumes.get(volumeIds[0]);
      }

      log.info(`Volumes set for viewport ${viewportId}:`, volumeIds);
    } catch (error) {
      console.error(`Failed to set volumes for viewport ${viewportId}:`, error);
      throw error;
    }
  }

  /**
   * 볼륨 렌더링 설정 적용
   */
  async applyVolumeConfig(viewportId: string, config: VolumeRenderingConfig): Promise<void> {
    if (!this.renderingEngine) {
      throw new Error('Rendering engine not initialized');
    }

    try {
      const viewport = this.renderingEngine.getViewport(viewportId) as any;
      if (!viewport) {
        throw new Error(`Viewport not found: ${viewportId}`);
      }

      // 볼륨 속성 설정
      this.getVolumeProperties(config);
      this.getColorMap(config.colorMap);

      // TODO: 실제 Cornerstone3D Volume 속성 적용
      // const volume = viewport.getDefaultActor()?.actor
      // if (volume) {
      //   volume.getProperty().set(properties)
      // }

      // Window/Level 설정
      viewport.setProperties({
        voiRange: {
          lower: config.windowLevel.level - config.windowLevel.window / 2,
          upper: config.windowLevel.level + config.windowLevel.window / 2,
        },
      });

      this.currentConfig = config;

      // 렌더링 업데이트
      viewport.render();

      log.info(`Volume config applied to viewport ${viewportId}:`, config);
    } catch (error) {
      console.error(`Failed to apply volume config to ${viewportId}:`, error);
      throw error;
    }
  }

  /**
   * 프리셋별 볼륨 속성 가져오기
   */
  private getVolumeProperties(config: VolumeRenderingConfig): Record<string, number> {
    return {
      opacity: config.opacity,
      ambient: config.ambient,
      diffuse: config.diffuse,
      specular: config.specular,
      specularPower: config.specularPower,
      shade: config.shade ? 1 : 0,
    };
  }

  /**
   * 컬러맵 설정 가져오기
   */
  private getColorMap(colorMapName: string): any {
    // TODO: 실제 Cornerstone3D 컬러맵 구현
    const colorMaps: Record<string, any> = {
      rainbow: { name: 'rainbow' },
      hot: { name: 'hot' },
      cool: { name: 'cool' },
      grayscale: { name: 'grayscale' },
      bone: { name: 'bone' },
    };

    return safePropertyAccess(colorMaps, colorMapName) ?? colorMaps['grayscale'];
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
    log.info(`Volume viewport removed: ${viewportId}`);
  }

  /**
   * 카메라 제어
   */
  async setCameraProperties(
    viewportId: string,
    cameraProps: {
      position?: [number, number, number];
      focalPoint?: [number, number, number];
      viewUp?: [number, number, number];
    },
  ): Promise<void> {
    if (!this.renderingEngine) return;

    try {
      const viewport = this.renderingEngine.getViewport(viewportId) as any;
      if (!viewport) return;

      const camera = viewport.getCamera();
      const newCamera = {
        ...camera,
        ...cameraProps,
      };

      viewport.setCamera(newCamera);
      viewport.render();

      log.debug(`Camera updated for viewport ${viewportId}:`, cameraProps);
    } catch (error) {
      console.error(`Failed to set camera for ${viewportId}:`, error);
    }
  }

  /**
   * 렌더링 품질 설정
   */
  setRenderingQuality(quality: 'low' | 'medium' | 'high'): void {
    // TODO: Cornerstone3D 렌더링 품질 설정
    const qualitySettings = {
      low: { interactiveSampleDistance: 2.0, staticSampleDistance: 1.0 },
      medium: { interactiveSampleDistance: 1.0, staticSampleDistance: 0.5 },
      high: { interactiveSampleDistance: 0.5, staticSampleDistance: 0.25 },
    };

    // eslint-disable-next-line security/detect-object-injection -- Safe: quality is validated RenderingQuality enum value
    const settings = qualitySettings[quality];
    log.info(`Rendering quality set to ${quality}:`, settings);
  }

  /**
   * 볼륨 통계 정보 가져오기
   */
  getVolumeStatistics(volumeId: string): {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  } | null {
    const volume = this.volumes.get(volumeId);
    if (!volume) return null;

    // TODO: 실제 볼륨 데이터 통계 계산
    return {
      min: 0,
      max: 4095,
      mean: 1200,
      stdDev: 400,
    };
  }

  /**
   * 현재 설정 가져오기
   */
  getCurrentConfig(): VolumeRenderingConfig | null {
    return this.currentConfig;
  }

  /**
   * 등록된 뷰포트 목록 가져오기
   */
  getViewports(): VolumeRenderingViewport[] {
    return Array.from(this.viewports.values());
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

      // 볼륨 데이터 정리
      this.volumes.clear();

      // 렌더링 엔진 정리
      if (this.renderingEngine) {
        this.renderingEngine.destroy();
        this.renderingEngine = null;
      }

      log.info('VolumeRenderingService destroyed');
    } catch (error) {
      console.error('Error during VolumeRenderingService cleanup:', error);
    }
  }
}
