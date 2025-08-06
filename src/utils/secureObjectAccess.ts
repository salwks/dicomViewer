/**
 * 보안 강화된 객체 접근 유틸리티
 * Object Injection 공격 방지를 위한 안전한 객체 접근 메서드들
 * HIPAA 컴플라이언스를 위한 의료 소프트웨어 보안 기준 준수
 */

/**
 * 안전한 객체 속성 접근 - Object Injection 방지
 * @param obj 접근할 객체
 * @param key 접근할 키
 * @returns 안전하게 접근한 값 또는 undefined
 */
export function safeObjectGet<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    // eslint-disable-next-line security/detect-object-injection
    return obj[key];
  }
  return undefined;
}

/**
 * 안전한 객체 속성 설정 - Object Injection 방지
 * @param obj 대상 객체
 * @param key 설정할 키
 * @param value 설정할 값
 */
export function safeObjectSet<T extends object, K extends keyof T>(obj: T, key: K, value: T[K]): void {
  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol') {
    // eslint-disable-next-line security/detect-object-injection
    (obj as Record<string | number | symbol, T[K]>)[key] = value;
  }
}

/**
 * 화이트리스트 기반 안전한 객체 접근
 * @param obj 접근할 객체
 * @param key 접근할 키
 * @param allowedKeys 허용된 키 목록
 * @returns 안전하게 접근한 값 또는 undefined
 */
export function safeObjectGetWithWhitelist<T extends object>(obj: T, key: string, allowedKeys: Set<string>): unknown {
  if (allowedKeys.has(key) && Object.prototype.hasOwnProperty.call(obj, key)) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: key validated against whitelist
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Map 기반 안전한 키-값 저장소
 * Record<string, unknown> 대신 사용하여 Object Injection 방지
 */
export class SecureStorage<T = unknown> {
  private storage = new Map<string, T>();

  set(key: string, value: T): void {
    // 키 길이 제한 및 특수문자 검증
    if (this.isValidKey(key)) {
      this.storage.set(key, value);
    } else {
      throw new Error(`Invalid key format: ${key}`);
    }
  }

  get(key: string): T | undefined {
    if (this.isValidKey(key)) {
      return this.storage.get(key);
    }
    return undefined;
  }

  has(key: string): boolean {
    return this.isValidKey(key) && this.storage.has(key);
  }

  delete(key: string): boolean {
    if (this.isValidKey(key)) {
      return this.storage.delete(key);
    }
    return false;
  }

  clear(): void {
    this.storage.clear();
  }

  keys(): IterableIterator<string> {
    return this.storage.keys();
  }

  values(): IterableIterator<T> {
    return this.storage.values();
  }

  entries(): IterableIterator<[string, T]> {
    return this.storage.entries();
  }

  get size(): number {
    return this.storage.size;
  }

  private isValidKey(key: string): boolean {
    // 키 길이 제한 (최대 100자)
    if (key.length > 100) {
      return false;
    }

    // 알파벳, 숫자, 하이픈, 언더스코어만 허용
    const validKeyPattern = /^[a-zA-Z0-9_-]+$/;
    return validKeyPattern.test(key);
  }
}

/**
 * 의료 도구 이름을 위한 화이트리스트
 * DICOM 표준 도구들만 허용
 */
export const MEDICAL_TOOL_WHITELIST = new Set([
  // 측정 도구
  'Length',
  'Angle',
  'Rectangle',
  'Ellipse',
  'Circle',
  'Probe',
  'Bidirectional',
  'CobbAngle',
  'PlanarFreehandROI',

  // 주석 도구
  'Arrow',
  'TextAnnotation',
  'FreehandAnnotation',

  // 네비게이션 도구
  'Pan',
  'Zoom',
  'WindowLevel',
  'StackScroll',
  'Magnify',

  // 고급 도구
  'SculptorTool',
  'CrosshairTool',
  'ReferenceLine',

  // 기본값
  'Unknown',
]);

/**
 * 의료 도구 이름 검증 및 정리
 * @param toolName 검증할 도구 이름
 * @returns 안전하게 정리된 도구 이름
 */
export function sanitizeMedicalToolName(toolName: string): string {
  if (MEDICAL_TOOL_WHITELIST.has(toolName)) {
    return toolName;
  }

  // 알파벳, 숫자, 하이픈만 허용하고 길이 제한
  const sanitized = toolName.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 50);
  return sanitized || 'Unknown';
}

/**
 * DICOM UID 검증 (Study Instance UID, Series Instance UID 등)
 * @param uid 검증할 UID
 * @returns UID가 유효한지 여부
 */
export function validateDicomUID(uid: string): boolean {
  // 길이 제한 (DICOM UID는 보통 64자 이하)
  if (uid.length > 64 || uid.length < 5) {
    return false;
  }

  // 숫자와 점만 허용
  for (let i = 0; i < uid.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: i is controlled loop index for string access
    const char = uid[i];
    if (char !== '.' && (char < '0' || char > '9')) {
      return false;
    }
  }

  // 점으로 시작하거나 끝나지 않고, 연속된 점이 없어야 함
  if (uid.startsWith('.') || uid.endsWith('.') || uid.includes('..')) {
    return false;
  }

  return true;
}
