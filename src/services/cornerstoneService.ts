/**
 * Cornerstone3D Service
 * Cornerstone3D 통합 초기화 및 라이프사이클 관리 서비스
 * Built with medical-grade security and performance optimization
 */

import { initializeCornerstone, isCornerstone3DInitialized, cleanupCornerstone } from './cornerstoneInit';
import { registerAllTools, createDefaultToolGroup, cleanupToolGroups } from '@/config/tools';
import { createViewportManager, type ViewportManager } from '@/config/viewport';
import { log } from '../utils/logger';
import { APP_CONFIG } from '@/config/index';

export interface CornerstoneServiceState {
  isInitialized: boolean;
  isInitializing: boolean;
  renderingEngineId: string;
  toolGroupId: string;
  error: string | null;
  webGLSupported: boolean;
  gpuInfo: { total?: number; free?: number } | null;
}

/**
 * Cornerstone3D 통합 서비스 클래스
 */
export class CornerstoneService {
  private static instance: CornerstoneService | null = null;
  private _state: CornerstoneServiceState;
  private _viewportManager: ViewportManager | null = null;

  private constructor() {
    this._state = {
      isInitialized: false,
      isInitializing: false,
      renderingEngineId: APP_CONFIG.cornerstone.defaultRenderingEngineId,
      toolGroupId: APP_CONFIG.cornerstone.defaultToolGroupId,
      error: null,
      webGLSupported: true, // Mock WebGL support check
      gpuInfo: { total: 4096, free: 2048 }, // Mock GPU info
    };
  }

  /**
   * 싱글톤 인스턴스 가져오기
   */
  public static getInstance(): CornerstoneService {
    if (!CornerstoneService.instance) {
      CornerstoneService.instance = new CornerstoneService();
    }
    return CornerstoneService.instance;
  }

  /**
   * 현재 상태 가져오기
   */
  public getState(): CornerstoneServiceState {
    return { ...this._state };
  }

  /**
   * 완전 초기화 (권장 방법)
   */
  public async initialize(): Promise<void> {
    if (this._state.isInitialized) {
      console.warn('Cornerstone3D already initialized');
      return;
    }

    if (this._state.isInitializing) {
      console.warn('Cornerstone3D initialization already in progress');
      return;
    }

    log.info('🚀 Starting Cornerstone3D Service initialization...');

    this._state.isInitializing = true;
    this._state.error = null;

    try {
      // WebGL 지원 확인
      if (!this._state.webGLSupported) {
        throw new Error('WebGL is not supported in this browser');
      }

      // 1. Cornerstone3D Core 초기화
      await initializeCornerstone();

      // 2. 도구 등록 및 도구 그룹 생성
      registerAllTools();
      createDefaultToolGroup(this._state.toolGroupId);

      // 3. 뷰포트 매니저 생성
      this._viewportManager = createViewportManager(this._state.renderingEngineId);

      // 상태 업데이트
      this._state.isInitialized = true;
      this._state.isInitializing = false;

      log.info('✅ Cornerstone3D Service initialization complete');

      // GPU 정보 로깅
      if (this._state.gpuInfo) {
        log.info('GPU Memory Info:', this._state.gpuInfo);
      }
    } catch (error) {
      this._state.error = error instanceof Error ? error.message : 'Unknown initialization error';
      this._state.isInitializing = false;

      console.error('❌ Cornerstone3D Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * 뷰포트 매니저 가져오기
   */
  public getViewportManager(): ViewportManager {
    if (!this._viewportManager) {
      throw new Error('Cornerstone3D Service not initialized. Call initialize() first.');
    }
    return this._viewportManager;
  }

  /**
   * 렌더링 엔진 인스턴스 가져오기
   */
  public getRenderingEngine() {
    if (!this._state.isInitialized) {
      throw new Error('Cornerstone3D Service not initialized. Call initialize() first.');
    }
    // Mock rendering engine instance
    log.info('Mock getRenderingEngineInstance - API not available yet');
    return { id: this._state.renderingEngineId } as any;
  }

  /**
   * 초기화 상태 확인
   */
  public isInitialized(): boolean {
    return this._state.isInitialized && isCornerstone3DInitialized();
  }

  /**
   * 뷰포트 생성 (편의 메서드)
   */
  public async createViewport(viewportId: string, element: HTMLDivElement, type: 'stack' | 'volume' = 'stack') {
    const viewportManager = this.getViewportManager();
    return await viewportManager.createViewport({
      viewportId,
      element,
      type,
      toolGroupId: this._state.toolGroupId,
      renderingEngineId: this._state.renderingEngineId,
    });
  }

  /**
   * 뷰포트 제거 (편의 메서드)
   */
  public destroyViewport(viewportId: string): void {
    if (!this._viewportManager) {
      console.warn('ViewportManager not available');
      return;
    }
    this._viewportManager.destroyViewport(viewportId);
  }

  /**
   * 모든 뷰포트 가져오기 (편의 메서드)
   */
  public getAllViewports() {
    if (!this._viewportManager) {
      return [];
    }
    return this._viewportManager.getAllViewports();
  }

  /**
   * 시스템 정보 수집
   */
  public getSystemInfo() {
    return {
      webGLSupported: this._state.webGLSupported,
      gpuInfo: this._state.gpuInfo,
      isInitialized: this._state.isInitialized,
      renderingEngineId: this._state.renderingEngineId,
      toolGroupId: this._state.toolGroupId,
      viewportCount: this.getAllViewports().length,
    };
  }

  /**
   * 성능 정보 수집
   */
  public getPerformanceInfo() {
    try {
      const renderingEngine = this.getRenderingEngine();
      const viewports = this.getAllViewports();

      return {
        viewportCount: viewports.length,
        memoryUsage: this._getMemoryUsage(),
        renderingEngineId: renderingEngine?.id || 'unknown',
        frameRate: this._getCurrentFrameRate(),
      };
    } catch (error) {
      console.error('Failed to get performance info:', error);
      return {
        viewportCount: 0,
        memoryUsage: 0,
        renderingEngineId: 'unknown',
        frameRate: 0,
      };
    }
  }

  /**
   * 메모리 사용량 추정 (근사값)
   */
  private _getMemoryUsage(): number {
    try {
      // Performance API를 사용하여 메모리 사용량 추정
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return memory.usedJSHeapSize || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * 현재 프레임레이트 추정
   */
  private _getCurrentFrameRate(): number {
    // 실제 프레임레이트 측정은 복잡하므로 기본값 반환
    // 추후 실제 렌더링 성능 측정 로직 추가 가능
    return APP_CONFIG.performance.targetFrameRate;
  }

  /**
   * 상태 재설정 (오류 복구용)
   */
  public reset(): void {
    log.info('Resetting Cornerstone3D Service...');

    try {
      // 기존 상태 정리
      this.cleanup();

      // 상태 초기화
      this._state = {
        isInitialized: false,
        isInitializing: false,
        renderingEngineId: APP_CONFIG.cornerstone.defaultRenderingEngineId,
        toolGroupId: APP_CONFIG.cornerstone.defaultToolGroupId,
        error: null,
        webGLSupported: true, // Mock WebGL support check
        gpuInfo: { total: 4096, free: 2048 }, // Mock GPU info
      };

      this._viewportManager = null;

      log.info('✓ Cornerstone3D Service reset complete');
    } catch (error) {
      console.error('Error during service reset:', error);
    }
  }

  /**
   * 리소스 정리 및 메모리 해제
   */
  public cleanup(): void {
    log.info('Cleaning up Cornerstone3D Service...');

    try {
      // 뷰포트 매니저 정리
      if (this._viewportManager) {
        const viewports = this._viewportManager.getAllViewports();
        viewports.forEach(viewport => {
          this._viewportManager?.destroyViewport(viewport.id);
        });
        this._viewportManager = null;
      }

      // 도구 그룹 정리
      cleanupToolGroups();

      // Cornerstone3D 정리
      cleanupCornerstone();

      // 상태 초기화
      this._state.isInitialized = false;
      this._state.isInitializing = false;
      this._state.error = null;

      log.info('✓ Cornerstone3D Service cleanup complete');
    } catch (error) {
      console.error('Error during service cleanup:', error);
    }
  }

  /**
   * 오류 상태 클리어
   */
  public clearError(): void {
    this._state.error = null;
  }
}

// 편의를 위한 기본 인스턴스 export
export const cornerstoneService = CornerstoneService.getInstance();

// React Hook에서 사용할 수 있는 유틸리티 함수들
export const useCornerstoneService = () => {
  const service = CornerstoneService.getInstance();

  return {
    initialize: () => service.initialize(),
    getState: () => service.getState(),
    isInitialized: () => service.isInitialized(),
    getViewportManager: () => service.getViewportManager(),
    createViewport: (viewportId: string, element: HTMLDivElement, type?: 'stack' | 'volume') =>
      service.createViewport(viewportId, element, type),
    destroyViewport: (viewportId: string) => {
      service.destroyViewport(viewportId);
    },
    getAllViewports: () => service.getAllViewports(),
    getSystemInfo: () => service.getSystemInfo(),
    getPerformanceInfo: () => service.getPerformanceInfo(),
    reset: () => {
      service.reset();
    },
    cleanup: () => {
      service.cleanup();
    },
    clearError: () => {
      service.clearError();
    },
  };
};
