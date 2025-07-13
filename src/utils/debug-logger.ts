/**
 * 강화된 디버깅 로거
 * DICOM 렌더링 과정의 모든 단계를 상세히 로깅합니다
 */

export class DebugLogger {
  private static instance: DebugLogger;
  private logs: Array<{ timestamp: string; level: string; message: string; data?: any }> = [];
  
  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  private formatTimestamp(): string {
    return new Date().toISOString().split('T')[1].slice(0, -1);
  }

  log(message: string, data?: any) {
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: 'INFO',
      message,
      data
    };
    
    this.logs.push(logEntry);
    console.log(`🔍 [${logEntry.timestamp}] ${message}`, data || '');
  }

  error(message: string, error?: any) {
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: 'ERROR',
      message,
      data: error
    };
    
    this.logs.push(logEntry);
    console.error(`❌ [${logEntry.timestamp}] ${message}`, error || '');
    
    // 오류의 상세 정보도 로깅
    if (error) {
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      } else {
        console.error('Error object:', error);
      }
    }
  }

  warn(message: string, data?: any) {
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: 'WARN',
      message,
      data
    };
    
    this.logs.push(logEntry);
    console.warn(`⚠️ [${logEntry.timestamp}] ${message}`, data || '');
  }

  success(message: string, data?: any) {
    const logEntry = {
      timestamp: this.formatTimestamp(),
      level: 'SUCCESS',
      message,
      data
    };
    
    this.logs.push(logEntry);
    console.log(`✅ [${logEntry.timestamp}] ${message}`, data || '');
  }

  // 진행 상황 표시
  progress(step: string, current: number, total: number, details?: string) {
    const percentage = Math.round((current / total) * 100);
    const message = `${step}: ${current}/${total} (${percentage}%)${details ? ` - ${details}` : ''}`;
    
    this.log(message);
  }

  // 모든 로그 출력
  dumpLogs() {
    console.group('🔍 DICOM 렌더링 디버그 로그');
    this.logs.forEach(log => {
      const style = this.getLogStyle(log.level);
      console.log(`[${log.timestamp}] ${log.level}: ${log.message}`, log.data || '');
    });
    console.groupEnd();
  }

  // 오류만 출력
  dumpErrors() {
    const errors = this.logs.filter(log => log.level === 'ERROR');
    if (errors.length > 0) {
      console.group('❌ DICOM 렌더링 오류 요약');
      errors.forEach(error => {
        console.error(`[${error.timestamp}] ${error.message}`, error.data || '');
      });
      console.groupEnd();
    }
  }

  // 최근 로그 가져오기
  getRecentLogs(count: number = 10) {
    return this.logs.slice(-count);
  }

  // 로그 지우기
  clear() {
    this.logs = [];
    console.clear();
    this.log('디버그 로그가 초기화되었습니다');
  }

  private getLogStyle(level: string): string {
    switch (level) {
      case 'ERROR': return 'color: #ef4444; font-weight: bold;';
      case 'WARN': return 'color: #f59e0b; font-weight: bold;';
      case 'SUCCESS': return 'color: #10b981; font-weight: bold;';
      default: return 'color: #6b7280;';
    }
  }

  // 특정 단계의 성능 측정
  time(label: string) {
    console.time(`⏱️ ${label}`);
    this.log(`시간 측정 시작: ${label}`);
  }

  timeEnd(label: string) {
    console.timeEnd(`⏱️ ${label}`);
    this.log(`시간 측정 종료: ${label}`);
  }

  // 메모리 사용량 로깅
  logMemoryUsage() {
    if (performance.memory) {
      const memory = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };
      
      this.log('메모리 사용량', memory);
    }
  }
}

// 전역 인스턴스 생성
export const debugLogger = DebugLogger.getInstance();

// 개발자 도구에서 접근할 수 있도록 전역에 등록
if (typeof window !== 'undefined') {
  (window as any).dicomDebugLogger = debugLogger;
}