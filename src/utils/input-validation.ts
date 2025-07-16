/**
 * DICOM 매개변수 및 사용자 입력 검증 유틸리티
 * 주입 공격 방지 및 데이터 무결성 보장
 * 
 * 보안 특징:
 * - DICOM 표준 준수 검증
 * - SQL/NoSQL 주입 방지
 * - XSS 방지 (기존 XSSProtection과 연동)
 * - 의료 데이터 형식 검증
 * - 파일 시스템 공격 방지
 */

import { XSSProtection } from './xss-protection';
import { debugLogger } from './debug-logger';

// 검증 결과 인터페이스
export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: any;
  errors: string[];
  warnings: string[];
  securityLevel: 'SAFE' | 'WARNING' | 'DANGER';
}

// 검증 옵션
export interface ValidationOptions {
  required?: boolean;
  allowEmpty?: boolean;
  customPattern?: RegExp;
  maxLength?: number;
  minLength?: number;
  sanitize?: boolean;
  logAttempts?: boolean;
}

// DICOM 태그 형식 상수
const DICOM_TAG_PATTERN = /^\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)$/;
const DICOM_UID_PATTERN = /^[0-9]+(\.[0-9]+)*$/;
const DICOM_DATE_PATTERN = /^[0-9]{8}$/;
const DICOM_TIME_PATTERN = /^[0-9]{6}(\.[0-9]{1,6})?$/;
const DICOM_DATETIME_PATTERN = /^[0-9]{8}[0-9]{6}(\.[0-9]{1,6})?$/;

// 의료 측정값 범위
const MEDICAL_RANGES = {
  windowLevel: { min: -2048, max: 4095 },
  windowWidth: { min: 1, max: 8191 },
  angle: { min: 0, max: 360 },
  length: { min: 0, max: 10000 }, // mm
  zoom: { min: 0.1, max: 20 },
  opacity: { min: 0, max: 1 },
  thickness: { min: 0.1, max: 50 } // mm
};

// 위험한 패턴들
const DANGEROUS_PATTERNS = [
  // SQL 주입 패턴
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
  // NoSQL 주입 패턴  
  /(\$where|\$regex|\$ne|\$gt|\$lt)/i,
  // JavaScript 주입 패턴
  /(javascript:|data:text\/html|vbscript:|on\w+\s*=)/i,
  // 파일 시스템 공격
  /(\.\.\/|\.\.\%2f|\.\.\\|\.\.\%5c)/i,
  // 명령 주입
  /(\||&|;|`|\$\(|\${)/,
  // LDAP 주입
  /(\*|\(|\)|\||&)/
];

// 민감한 키워드
const SENSITIVE_KEYWORDS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'key', 'auth',
  'credential', 'session', 'cookie', 'admin', 'root'
];

/**
 * DICOM 입력 검증 클래스
 */
export class DICOMInputValidator {
  
  /**
   * DICOM 태그 검증
   * 형식: (XXXX,XXXX) where X is hexadecimal
   */
  static validateDicomTag(tag: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      securityLevel: 'SAFE'
    };

    // 기본 보안 검사
    const securityCheck = DICOMInputValidator.performSecurityCheck(tag, 'DICOM Tag');
    if (!securityCheck.isValid) {
      return securityCheck;
    }

    // 필수 필드 검사
    if (options.required && (!tag || tag.trim() === '')) {
      result.errors.push('DICOM tag is required');
      result.securityLevel = 'WARNING';
      return result;
    }

    // 빈 값 허용 검사
    if (!tag || tag.trim() === '') {
      if (options.allowEmpty) {
        result.isValid = true;
        result.sanitizedValue = '';
        return result;
      } else {
        result.errors.push('DICOM tag cannot be empty');
        return result;
      }
    }

    // DICOM 태그 형식 검증
    if (!DICOM_TAG_PATTERN.test(tag.trim())) {
      result.errors.push('Invalid DICOM tag format. Expected: (XXXX,XXXX)');
      result.securityLevel = 'DANGER';
      return result;
    }

    // 성공
    result.isValid = true;
    result.sanitizedValue = tag.trim().toUpperCase();
    
    // 로깅
    if (options.logAttempts) {
      debugLogger.debug(`DICOM tag validated: ${tag}`, { sanitized: result.sanitizedValue });
    }

    return result;
  }

  /**
   * DICOM UID 검증
   * 형식: 숫자와 점으로 구성된 문자열
   */
  static validateDicomUID(uid: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      securityLevel: 'SAFE'
    };

    // 기본 보안 검사
    const securityCheck = DICOMInputValidator.performSecurityCheck(uid, 'DICOM UID');
    if (!securityCheck.isValid) {
      return securityCheck;
    }

    if (!uid || uid.trim() === '') {
      if (options.allowEmpty) {
        result.isValid = true;
        result.sanitizedValue = '';
        return result;
      } else {
        result.errors.push('DICOM UID cannot be empty');
        return result;
      }
    }

    // UID 길이 검사 (최대 64자)
    if (uid.length > 64) {
      result.errors.push('DICOM UID too long (max 64 characters)');
      result.securityLevel = 'DANGER';
      return result;
    }

    // UID 형식 검증
    if (!DICOM_UID_PATTERN.test(uid.trim())) {
      result.errors.push('Invalid DICOM UID format. Must contain only numbers and dots');
      result.securityLevel = 'DANGER';
      return result;
    }

    // 점으로 시작하거나 끝나면 안됨
    if (uid.startsWith('.') || uid.endsWith('.')) {
      result.errors.push('DICOM UID cannot start or end with a dot');
      result.securityLevel = 'DANGER';
      return result;
    }

    // 연속된 점 검사
    if (uid.includes('..')) {
      result.errors.push('DICOM UID cannot contain consecutive dots');
      result.securityLevel = 'DANGER';
      return result;
    }

    result.isValid = true;
    result.sanitizedValue = uid.trim();
    
    if (options.logAttempts) {
      debugLogger.debug(`DICOM UID validated: ${uid}`);
    }

    return result;
  }

  /**
   * 숫자 입력 검증 (윈도우/레벨, 측정값 등)
   */
  static validateNumericInput(
    value: string | number, 
    type: keyof typeof MEDICAL_RANGES,
    options: ValidationOptions = {}
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      securityLevel: 'SAFE'
    };

    // 문자열인 경우 보안 검사
    if (typeof value === 'string') {
      const securityCheck = DICOMInputValidator.performSecurityCheck(value, `Numeric ${type}`);
      if (!securityCheck.isValid) {
        return securityCheck;
      }
    }

    // 숫자 변환
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      result.errors.push(`Invalid ${type} value. Must be a number`);
      result.securityLevel = 'WARNING';
      return result;
    }

    // 범위 검사
    const range = MEDICAL_RANGES[type];
    if (range) {
      if (numValue < range.min || numValue > range.max) {
        result.errors.push(
          `${type} value out of medical range (${range.min} - ${range.max})`
        );
        result.securityLevel = 'WARNING';
        return result;
      }
    }

    // 무한대 및 특수값 검사
    if (!isFinite(numValue)) {
      result.errors.push(`${type} value must be finite`);
      result.securityLevel = 'DANGER';
      return result;
    }

    result.isValid = true;
    result.sanitizedValue = numValue;
    
    if (options.logAttempts) {
      debugLogger.debug(`Numeric ${type} validated: ${value} -> ${numValue}`);
    }

    return result;
  }

  /**
   * 주석 라벨 검증
   */
  static validateAnnotationLabel(label: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      securityLevel: 'SAFE'
    };

    // 기본 보안 검사
    const securityCheck = DICOMInputValidator.performSecurityCheck(label, 'Annotation Label');
    if (!securityCheck.isValid) {
      return securityCheck;
    }

    if (!label || label.trim() === '') {
      if (options.allowEmpty) {
        result.isValid = true;
        result.sanitizedValue = '';
        return result;
      } else {
        result.errors.push('Annotation label cannot be empty');
        return result;
      }
    }

    // 길이 검사
    const maxLength = options.maxLength || 100;
    const minLength = options.minLength || 1;
    
    if (label.length > maxLength) {
      result.errors.push(`Annotation label too long (max ${maxLength} characters)`);
      result.securityLevel = 'WARNING';
      return result;
    }

    if (label.length < minLength) {
      result.errors.push(`Annotation label too short (min ${minLength} characters)`);
      result.securityLevel = 'WARNING';
      return result;
    }

    // XSS 방지 및 새니타이제이션
    let sanitizedLabel = label.trim();
    if (options.sanitize !== false) {
      // XSSProtection과 연동
      const xssValidation = XSSProtection.validateInput(sanitizedLabel);
      if (!xssValidation.isValid) {
        result.errors.push(`XSS attempt detected: ${xssValidation.reason}`);
        result.securityLevel = 'DANGER';
        return result;
      }
      
      // 추가 새니타이제이션
      sanitizedLabel = XSSProtection.sanitizeStrict(sanitizedLabel);
    }

    // HTML 태그 검사
    if (/<[^>]*>/g.test(sanitizedLabel)) {
      result.warnings.push('HTML tags detected and will be removed');
      sanitizedLabel = sanitizedLabel.replace(/<[^>]*>/g, '');
      result.securityLevel = 'WARNING';
    }

    result.isValid = true;
    result.sanitizedValue = sanitizedLabel;
    
    if (options.logAttempts) {
      debugLogger.debug(`Annotation label validated: "${label}" -> "${sanitizedLabel}"`);
    }

    return result;
  }

  /**
   * 파일명 검증
   */
  static validateFileName(fileName: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      securityLevel: 'SAFE'
    };

    // 기본 보안 검사
    const securityCheck = DICOMInputValidator.performSecurityCheck(fileName, 'File Name');
    if (!securityCheck.isValid) {
      return securityCheck;
    }

    if (!fileName || fileName.trim() === '') {
      result.errors.push('File name cannot be empty');
      return result;
    }

    // 파일명 길이 검사
    if (fileName.length > 255) {
      result.errors.push('File name too long (max 255 characters)');
      result.securityLevel = 'DANGER';
      return result;
    }

    // 위험한 문자 검사
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(fileName)) {
      result.errors.push('File name contains dangerous characters');
      result.securityLevel = 'DANGER';
      return result;
    }

    // 경로 순회 공격 방지
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      result.errors.push('File name cannot contain path separators');
      result.securityLevel = 'DANGER';
      return result;
    }

    // 예약된 파일명 검사 (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const baseName = fileName.split('.')[0].toUpperCase();
    if (reservedNames.includes(baseName)) {
      result.errors.push('File name uses reserved system name');
      result.securityLevel = 'DANGER';
      return result;
    }

    // DICOM 파일 확장자 검사
    const allowedExtensions = ['.dcm', '.dicom', '.nii', '.nii.gz'];
    const hasValidExtension = allowedExtensions.some(ext => 
      fileName.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      result.warnings.push('File extension not recognized as medical imaging format');
      result.securityLevel = 'WARNING';
    }

    result.isValid = true;
    result.sanitizedValue = fileName.trim();
    
    if (options.logAttempts) {
      debugLogger.debug(`File name validated: ${fileName}`);
    }

    return result;
  }

  /**
   * 사용자명 검증 (로그인용)
   */
  static validateUsername(username: string, options: ValidationOptions = {}): ValidationResult {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      securityLevel: 'SAFE'
    };

    // 기본 보안 검사
    const securityCheck = DICOMInputValidator.performSecurityCheck(username, 'Username');
    if (!securityCheck.isValid) {
      return securityCheck;
    }

    if (!username || username.trim() === '') {
      result.errors.push('Username cannot be empty');
      return result;
    }

    // 길이 검사
    if (username.length < 3 || username.length > 50) {
      result.errors.push('Username must be 3-50 characters long');
      result.securityLevel = 'WARNING';
      return result;
    }

    // 허용된 문자만 사용 (영문, 숫자, 하이픈, 언더스코어)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      result.errors.push('Username can only contain letters, numbers, hyphens, and underscores');
      result.securityLevel = 'WARNING';
      return result;
    }

    // 숫자로만 구성되면 안됨
    if (/^\d+$/.test(username)) {
      result.errors.push('Username cannot be numeric only');
      result.securityLevel = 'WARNING';
      return result;
    }

    result.isValid = true;
    result.sanitizedValue = username.trim().toLowerCase();
    
    if (options.logAttempts) {
      debugLogger.debug(`Username validated: ${username}`);
    }

    return result;
  }

  /**
   * 기본 보안 검사 수행
   */
  private static performSecurityCheck(input: string, context: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityLevel: 'SAFE'
    };

    if (!input || typeof input !== 'string') {
      return result;
    }

    // 위험한 패턴 검사
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        result.isValid = false;
        result.errors.push(`Dangerous pattern detected in ${context}`);
        result.securityLevel = 'DANGER';
        
        // 보안 이벤트 로깅
        debugLogger.error(`Security threat detected in ${context}`, {
          input: input.substring(0, 100), // 처음 100자만 로깅
          pattern: pattern.source,
          timestamp: new Date().toISOString()
        });
        
        return result;
      }
    }

    // 민감한 키워드 검사
    const lowerInput = input.toLowerCase();
    for (const keyword of SENSITIVE_KEYWORDS) {
      if (lowerInput.includes(keyword)) {
        result.warnings.push(`Sensitive keyword detected in ${context}: ${keyword}`);
        result.securityLevel = 'WARNING';
      }
    }

    // 비정상적으로 긴 입력 검사
    if (input.length > 10000) {
      result.isValid = false;
      result.errors.push(`Input too long in ${context} (max 10000 characters)`);
      result.securityLevel = 'DANGER';
      return result;
    }

    // 제어 문자 검사
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(input)) {
      result.isValid = false;
      result.errors.push(`Control characters detected in ${context}`);
      result.securityLevel = 'DANGER';
      return result;
    }

    return result;
  }

  /**
   * 배치 검증 - 여러 입력값을 한번에 검증
   */
  static validateBatch(validations: Array<{
    value: any;
    validator: (value: any, options?: ValidationOptions) => ValidationResult;
    options?: ValidationOptions;
    field: string;
  }>): { isValid: boolean; results: Record<string, ValidationResult> } {
    
    const results: Record<string, ValidationResult> = {};
    let allValid = true;

    for (const validation of validations) {
      const result = validation.validator(validation.value, validation.options);
      results[validation.field] = result;
      
      if (!result.isValid) {
        allValid = false;
      }
    }

    return { isValid: allValid, results };
  }
}

// 편의 함수들
export const validateDicomTag = DICOMInputValidator.validateDicomTag;
export const validateDicomUID = DICOMInputValidator.validateDicomUID; 
export const validateNumericInput = DICOMInputValidator.validateNumericInput;
export const validateAnnotationLabel = DICOMInputValidator.validateAnnotationLabel;
export const validateFileName = DICOMInputValidator.validateFileName;
export const validateUsername = DICOMInputValidator.validateUsername;
export const validateBatch = DICOMInputValidator.validateBatch;

export default DICOMInputValidator;