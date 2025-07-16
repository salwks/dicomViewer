/**
 * 검증 오류 처리 및 사용자 피드백 유틸리티
 * 일관된 오류 메시지와 사용자 피드백을 제공합니다
 */

import { ValidationResult } from './input-validation';
import { debugLogger } from './debug-logger';

// 사용자 친화적인 오류 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  'required': '필수 입력 항목입니다',
  'empty': '값을 입력해주세요',
  'too_long': '입력 값이 너무 깁니다',
  'too_short': '입력 값이 너무 짧습니다',
  'invalid_format': '올바른 형식이 아닙니다',
  'dangerous_pattern': '보안상 위험한 패턴이 감지되었습니다',
  'xss_attempt': 'XSS 공격이 감지되었습니다',
  'injection_attempt': '주입 공격이 감지되었습니다',
  'file_path_attack': '파일 경로 공격이 감지되었습니다',
  'invalid_dicom_tag': '유효하지 않은 DICOM 태그 형식입니다',
  'invalid_dicom_uid': '유효하지 않은 DICOM UID 형식입니다',
  'out_of_range': '허용된 범위를 벗어났습니다',
  'invalid_file_name': '유효하지 않은 파일명입니다',
  'reserved_name': '예약된 시스템 이름입니다',
  'invalid_username': '유효하지 않은 사용자명입니다',
  'numeric_only': '숫자만으로 구성할 수 없습니다'
};

// 경고 메시지 매핑
const WARNING_MESSAGES: Record<string, string> = {
  'html_tags': 'HTML 태그가 제거되었습니다',
  'sensitive_keyword': '민감한 키워드가 감지되었습니다',
  'file_extension': '권장하지 않는 파일 확장자입니다',
  'sanitized': '보안상 내용이 수정되었습니다',
  'length_warning': '권장 길이를 초과합니다'
};

// 보안 레벨별 아이콘 및 스타일
const SECURITY_LEVEL_CONFIG = {
  SAFE: {
    icon: '✅',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981'
  },
  WARNING: {
    icon: '⚠️',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: '#f59e0b'
  },
  DANGER: {
    icon: '🚨',
    color: '#dc2626',
    bgColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: '#dc2626'
  }
};

export interface ValidationFeedback {
  success: boolean;
  message: string;
  details?: string[];
  securityLevel: 'SAFE' | 'WARNING' | 'DANGER';
  sanitizedValue?: any;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * 검증 결과를 사용자 친화적인 피드백으로 변환
 */
export class ValidationErrorHandler {
  
  /**
   * 검증 결과를 처리하고 사용자 피드백을 생성
   */
  static handleValidationResult(
    result: ValidationResult,
    context: string = 'input'
  ): ValidationFeedback {
    const config = SECURITY_LEVEL_CONFIG[result.securityLevel];
    
    if (result.isValid) {
      return {
        success: true,
        message: '유효한 입력입니다',
        securityLevel: result.securityLevel,
        sanitizedValue: result.sanitizedValue,
        icon: config.icon,
        color: config.color,
        bgColor: config.bgColor,
        borderColor: config.borderColor,
        details: result.warnings.length > 0 ? result.warnings.map(w => 
          WARNING_MESSAGES[w] || w
        ) : undefined
      };
    } else {
      const primaryError = result.errors[0] || '알 수 없는 오류';
      const userMessage = this.getErrorMessage(primaryError, context);
      
      return {
        success: false,
        message: userMessage,
        details: result.errors.map(err => ERROR_MESSAGES[err] || err),
        securityLevel: result.securityLevel,
        icon: config.icon,
        color: config.color,
        bgColor: config.bgColor,
        borderColor: config.borderColor
      };
    }
  }

  /**
   * 에러 메시지를 컨텍스트에 맞게 변환
   */
  private static getErrorMessage(error: string, context: string): string {
    // 보안 관련 에러는 더 강한 메시지
    if (error.includes('Dangerous pattern') || error.includes('XSS')) {
      return '보안 위험이 감지되었습니다. 다른 값을 입력해주세요.';
    }
    
    // 컨텍스트별 맞춤 메시지
    if (context === 'annotation') {
      if (error.includes('too long')) return '주석 내용이 너무 깁니다 (최대 100자)';
      if (error.includes('empty')) return '주석 내용을 입력해주세요';
    }
    
    if (context === 'filename') {
      if (error.includes('dangerous characters')) return '파일명에 허용되지 않는 문자가 포함되어 있습니다';
      if (error.includes('path separators')) return '파일명에 경로 구분자가 포함될 수 없습니다';
    }
    
    if (context === 'dicom_tag') {
      if (error.includes('Invalid DICOM tag')) return 'DICOM 태그 형식이 올바르지 않습니다 (예: (0008,0020))';
    }
    
    if (context === 'username') {
      if (error.includes('too short')) return '사용자명이 너무 짧습니다 (최소 3자)';
      if (error.includes('can only contain')) return '사용자명에는 영문, 숫자, 하이픈, 밑줄만 사용할 수 있습니다';
    }
    
    if (context === 'numeric') {
      if (error.includes('out of medical range')) return '의료 데이터 범위를 벗어났습니다';
      if (error.includes('Must be a number')) return '숫자를 입력해주세요';
    }
    
    // 일반 에러 메시지
    return ERROR_MESSAGES[error] || error;
  }

  /**
   * 복수의 검증 결과를 처리 (배치 검증용)
   */
  static handleBatchValidation(
    results: Record<string, ValidationResult>
  ): Record<string, ValidationFeedback> {
    const feedback: Record<string, ValidationFeedback> = {};
    
    Object.entries(results).forEach(([field, result]) => {
      feedback[field] = this.handleValidationResult(result, field);
    });
    
    return feedback;
  }

  /**
   * 보안 이벤트 로깅 및 알림
   */
  static logSecurityEvent(
    result: ValidationResult,
    context: string,
    userInput: string
  ): void {
    if (result.securityLevel === 'DANGER') {
      debugLogger.error('보안 위험 감지', {
        context,
        input: userInput.substring(0, 100), // 처음 100자만
        errors: result.errors,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    } else if (result.securityLevel === 'WARNING') {
      debugLogger.warn('보안 경고', {
        context,
        warnings: result.warnings,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 실시간 검증 피드백 (타이핑 중)
   */
  static getRealTimeFeedback(
    value: string,
    validator: (value: string) => ValidationResult,
    context: string = 'input'
  ): ValidationFeedback | null {
    // 빈 값인 경우 피드백 없음
    if (!value || value.trim() === '') {
      return null;
    }
    
    // 너무 짧은 입력은 검증하지 않음
    if (value.length < 2) {
      return null;
    }
    
    const result = validator(value);
    
    // 성공이면서 경고도 없는 경우 피드백 숨김
    if (result.isValid && result.warnings.length === 0) {
      return null;
    }
    
    return this.handleValidationResult(result, context);
  }

  /**
   * Toast 메시지 생성
   */
  static createToastMessage(feedback: ValidationFeedback): string {
    const prefix = feedback.icon;
    
    if (feedback.success) {
      if (feedback.details && feedback.details.length > 0) {
        return `${prefix} 입력 완료 (${feedback.details.join(', ')})`;
      }
      return `${prefix} 입력이 완료되었습니다`;
    } else {
      return `${prefix} ${feedback.message}`;
    }
  }
}

// 편의 함수들
export const handleValidationResult = ValidationErrorHandler.handleValidationResult;
export const handleBatchValidation = ValidationErrorHandler.handleBatchValidation;
export const logSecurityEvent = ValidationErrorHandler.logSecurityEvent;
export const getRealTimeFeedback = ValidationErrorHandler.getRealTimeFeedback;
export const createToastMessage = ValidationErrorHandler.createToastMessage;

export default ValidationErrorHandler;