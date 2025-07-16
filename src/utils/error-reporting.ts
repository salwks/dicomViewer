/**
 * 에러 리포팅 서비스 통합
 * 외부 에러 모니터링 서비스와 통합하여 에러를 추적하고 모니터링합니다.
 */

import { ErrorReport } from './error-handler';
import { debugLogger } from './debug-logger';

// 에러 리포팅 서비스 타입
export type ErrorReportingService = 'sentry' | 'rollbar' | 'bugsnag' | 'local';

// 에러 리포팅 설정
export interface ErrorReportingConfig {
  service: ErrorReportingService;
  apiKey?: string;
  projectId?: string;
  environment: 'development' | 'staging' | 'production';
  enableUserFeedback?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableSessionRecording?: boolean;
  sampleRate?: number;
  beforeSend?: (report: ErrorReport) => ErrorReport | null;
  onError?: (error: Error) => void;
}

// 기본 설정
const DEFAULT_CONFIG: ErrorReportingConfig = {
  service: 'local',
  environment: import.meta.env.PROD ? 'production' : 'development',
  enableUserFeedback: true,
  enablePerformanceMonitoring: false,
  enableSessionRecording: false,
  sampleRate: 1.0
};

// 리포팅 통계
interface ReportingStats {
  totalReports: number;
  successfulReports: number;
  failedReports: number;
  lastReportTime: number | null;
  errors: string[];
}

/**
 * 에러 리포팅 서비스 클래스
 */
export class ErrorReportingService {
  private static instance: ErrorReportingService;
  private config: ErrorReportingConfig;
  private stats: ReportingStats;
  private initialized = false;

  private constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      totalReports: 0,
      successfulReports: 0,
      failedReports: 0,
      lastReportTime: null,
      errors: []
    };
  }

  static getInstance(config?: Partial<ErrorReportingConfig>): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService(config);
    }
    return ErrorReportingService.instance;
  }

  /**
   * 에러 리포팅 서비스 초기화
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      debugLogger.log('에러 리포팅 서비스 초기화 시작', {
        service: this.config.service,
        environment: this.config.environment
      });

      switch (this.config.service) {
        case 'sentry':
          await this.initializeSentry();
          break;
        case 'rollbar':
          await this.initializeRollbar();
          break;
        case 'bugsnag':
          await this.initializeBugsnag();
          break;
        case 'local':
          await this.initializeLocal();
          break;
        default:
          throw new Error(`Unsupported error reporting service: ${this.config.service}`);
      }

      this.initialized = true;
      debugLogger.success('에러 리포팅 서비스 초기화 완료');
    } catch (error) {
      debugLogger.error('에러 리포팅 서비스 초기화 실패', error);
      // 초기화 실패 시 로컬 서비스로 fallback
      this.config.service = 'local';
      await this.initializeLocal();
      this.initialized = true;
    }
  }

  /**
   * 에러 리포트 전송
   */
  async reportError(errorReport: ErrorReport): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.stats.totalReports++;

    try {
      // 샘플링 적용
      if (Math.random() > this.config.sampleRate!) {
        debugLogger.log('에러 리포트 샘플링으로 인해 건너뜀');
        return true;
      }

      // beforeSend 훅 실행
      let processedReport = errorReport;
      if (this.config.beforeSend) {
        const result = this.config.beforeSend(errorReport);
        if (result === null) {
          debugLogger.log('에러 리포트가 beforeSend 훅에 의해 취소됨');
          return true;
        }
        processedReport = result;
      }

      // 서비스별 리포팅
      let success = false;
      switch (this.config.service) {
        case 'sentry':
          success = await this.reportToSentry(processedReport);
          break;
        case 'rollbar':
          success = await this.reportToRollbar(processedReport);
          break;
        case 'bugsnag':
          success = await this.reportToBugsnag(processedReport);
          break;
        case 'local':
          success = await this.reportToLocal(processedReport);
          break;
      }

      if (success) {
        this.stats.successfulReports++;
        this.stats.lastReportTime = Date.now();
        debugLogger.log('에러 리포트 전송 성공', { errorId: errorReport.id });
      } else {
        this.stats.failedReports++;
        debugLogger.warn('에러 리포트 전송 실패', { errorId: errorReport.id });
      }

      return success;
    } catch (error) {
      this.stats.failedReports++;
      this.stats.errors.push(`Report failed: ${error}`);
      debugLogger.error('에러 리포트 전송 중 오류 발생', error);
      
      if (this.config.onError) {
        this.config.onError(error instanceof Error ? error : new Error(String(error)));
      }
      
      return false;
    }
  }

  /**
   * Sentry 초기화
   */
  private async initializeSentry(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Sentry API key is required');
    }

    // 실제 환경에서는 @sentry/browser 패키지 사용
    debugLogger.log('Sentry 초기화 시뮬레이션 완료');
  }

  /**
   * Rollbar 초기화
   */
  private async initializeRollbar(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Rollbar API key is required');
    }

    // 실제 환경에서는 rollbar 패키지 사용
    debugLogger.log('Rollbar 초기화 시뮬레이션 완료');
  }

  /**
   * Bugsnag 초기화
   */
  private async initializeBugsnag(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Bugsnag API key is required');
    }

    // 실제 환경에서는 @bugsnag/js 패키지 사용
    debugLogger.log('Bugsnag 초기화 시뮬레이션 완료');
  }

  /**
   * 로컬 저장소 초기화
   */
  private async initializeLocal(): Promise<void> {
    try {
      // 로컬 저장소 초기화
      if (!localStorage.getItem('error_reports')) {
        localStorage.setItem('error_reports', JSON.stringify([]));
      }
      debugLogger.log('로컬 에러 리포팅 초기화 완료');
    } catch (error) {
      debugLogger.error('로컬 에러 리포팅 초기화 실패', error);
      throw error;
    }
  }

  /**
   * Sentry로 에러 리포트 전송
   */
  private async reportToSentry(errorReport: ErrorReport): Promise<boolean> {
    try {
      // 실제 환경에서는 Sentry SDK 사용
      const sentryPayload = {
        message: errorReport.message,
        level: this.mapSeverityToSentryLevel(errorReport.severity),
        tags: {
          category: errorReport.category,
          environment: errorReport.environment,
          errorId: errorReport.id
        },
        extra: {
          context: errorReport.context,
          userAgent: errorReport.userAgent,
          url: errorReport.url,
          timestamp: errorReport.timestamp
        },
        user: errorReport.userId ? { id: errorReport.userId } : undefined
      };

      // 시뮬레이션: 실제로는 Sentry.captureMessage() 사용
      debugLogger.log('Sentry 전송 시뮬레이션', sentryPayload);
      return true;
    } catch (error) {
      debugLogger.error('Sentry 전송 실패', error);
      return false;
    }
  }

  /**
   * Rollbar로 에러 리포트 전송
   */
  private async reportToRollbar(errorReport: ErrorReport): Promise<boolean> {
    try {
      // 실제 환경에서는 Rollbar SDK 사용
      const rollbarPayload = {
        message: errorReport.message,
        level: this.mapSeverityToRollbarLevel(errorReport.severity),
        custom: {
          category: errorReport.category,
          errorId: errorReport.id,
          context: errorReport.context
        },
        person: errorReport.userId ? { id: errorReport.userId } : undefined,
        request: {
          url: errorReport.url,
          user_agent: errorReport.userAgent
        }
      };

      // 시뮬레이션: 실제로는 Rollbar.error() 사용
      debugLogger.log('Rollbar 전송 시뮬레이션', rollbarPayload);
      return true;
    } catch (error) {
      debugLogger.error('Rollbar 전송 실패', error);
      return false;
    }
  }

  /**
   * Bugsnag로 에러 리포트 전송
   */
  private async reportToBugsnag(errorReport: ErrorReport): Promise<boolean> {
    try {
      // 실제 환경에서는 Bugsnag SDK 사용
      const bugsnagPayload = {
        message: errorReport.message,
        severity: this.mapSeverityToBugsnagLevel(errorReport.severity),
        metaData: {
          error: {
            category: errorReport.category,
            errorId: errorReport.id,
            context: errorReport.context
          },
          request: {
            url: errorReport.url,
            userAgent: errorReport.userAgent
          }
        },
        user: errorReport.userId ? { id: errorReport.userId } : undefined
      };

      // 시뮬레이션: 실제로는 Bugsnag.notify() 사용
      debugLogger.log('Bugsnag 전송 시뮬레이션', bugsnagPayload);
      return true;
    } catch (error) {
      debugLogger.error('Bugsnag 전송 실패', error);
      return false;
    }
  }

  /**
   * 로컬 저장소로 에러 리포트 전송
   */
  private async reportToLocal(errorReport: ErrorReport): Promise<boolean> {
    try {
      const reports = JSON.parse(localStorage.getItem('error_reports') || '[]');
      reports.push({
        ...errorReport,
        reportedAt: Date.now()
      });

      // 최대 100개까지만 저장
      if (reports.length > 100) {
        reports.shift();
      }

      localStorage.setItem('error_reports', JSON.stringify(reports));
      debugLogger.log('로컬 에러 리포트 저장 완료', { errorId: errorReport.id });
      return true;
    } catch (error) {
      debugLogger.error('로컬 에러 리포트 저장 실패', error);
      return false;
    }
  }

  /**
   * 사용자 피드백 수집
   */
  async collectUserFeedback(errorId: string, feedback: string, userInfo?: any): Promise<boolean> {
    if (!this.config.enableUserFeedback) {
      return false;
    }

    try {
      const feedbackData = {
        errorId,
        feedback,
        userInfo,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      // 피드백 저장
      const feedbacks = JSON.parse(localStorage.getItem('error_feedbacks') || '[]');
      feedbacks.push(feedbackData);
      
      if (feedbacks.length > 50) {
        feedbacks.shift();
      }
      
      localStorage.setItem('error_feedbacks', JSON.stringify(feedbacks));
      
      debugLogger.log('사용자 피드백 수집 완료', { errorId, feedback: feedback.substring(0, 100) });
      return true;
    } catch (error) {
      debugLogger.error('사용자 피드백 수집 실패', error);
      return false;
    }
  }

  /**
   * 리포팅 통계 반환
   */
  getStats(): ReportingStats {
    return { ...this.stats };
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<ErrorReportingConfig>): void {
    this.config = { ...this.config, ...config };
    debugLogger.log('에러 리포팅 설정 업데이트', config);
  }

  /**
   * 서비스 상태 확인
   */
  getStatus(): { initialized: boolean; service: ErrorReportingService; config: ErrorReportingConfig } {
    return {
      initialized: this.initialized,
      service: this.config.service,
      config: { ...this.config }
    };
  }

  /**
   * 심각도를 Sentry 레벨로 변환
   */
  private mapSeverityToSentryLevel(severity: string): string {
    switch (severity) {
      case 'critical': return 'fatal';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'error';
    }
  }

  /**
   * 심각도를 Rollbar 레벨로 변환
   */
  private mapSeverityToRollbarLevel(severity: string): string {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'error';
    }
  }

  /**
   * 심각도를 Bugsnag 레벨로 변환
   */
  private mapSeverityToBugsnagLevel(severity: string): string {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'error';
    }
  }
}

// 전역 에러 리포팅 서비스 인스턴스
export const errorReportingService = ErrorReportingService.getInstance();

// 편의 함수들
export async function initializeErrorReporting(config?: Partial<ErrorReportingConfig>): Promise<void> {
  const service = ErrorReportingService.getInstance(config);
  await service.initialize();
}

export async function reportError(errorReport: ErrorReport): Promise<boolean> {
  return errorReportingService.reportError(errorReport);
}

export async function reportUserFeedback(errorId: string, feedback: string, userInfo?: any): Promise<boolean> {
  return errorReportingService.collectUserFeedback(errorId, feedback, userInfo);
}

export function getReportingStats(): ReportingStats {
  return errorReportingService.getStats();
}

export function updateReportingConfig(config: Partial<ErrorReportingConfig>): void {
  errorReportingService.updateConfig(config);
}

export default ErrorReportingService;