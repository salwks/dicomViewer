/**
 * Feature Flags 관리 유틸리티
 * 환경 변수를 통한 기능 활성화/비활성화 제어
 */

interface FeatureFlags {
  loginEnabled: boolean;
  securityDashboardEnabled: boolean;
  debugMode: boolean;
  annotationFeaturesEnabled: boolean;
  captureFeaturesEnabled: boolean;
}

/**
 * 환경 변수에서 boolean 값을 안전하게 파싱
 */
function parseEnvBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * 모든 기능 플래그를 환경 변수에서 읽어서 초기화
 */
export function initializeFeatureFlags(): FeatureFlags {
  const flags: FeatureFlags = {
    loginEnabled: parseEnvBoolean(import.meta.env.VITE_LOGIN_ENABLED, true),
    securityDashboardEnabled: parseEnvBoolean(import.meta.env.VITE_SECURITY_DASHBOARD_ENABLED, true),
    debugMode: parseEnvBoolean(import.meta.env.VITE_DEBUG_MODE, false),
    annotationFeaturesEnabled: parseEnvBoolean(import.meta.env.VITE_ANNOTATION_FEATURES_ENABLED, true),
    captureFeaturesEnabled: parseEnvBoolean(import.meta.env.VITE_CAPTURE_FEATURES_ENABLED, true),
  };

  // 개발 모드에서는 기능 플래그 상태를 콘솔에 출력
  if (import.meta.env.DEV) {
    console.log('🎌 Feature Flags initialized:', flags);
  }

  return flags;
}

/**
 * 개별 기능 플래그를 확인하는 헬퍼 함수들
 */
export const featureFlags = initializeFeatureFlags();

export function isLoginEnabled(): boolean {
  return featureFlags.loginEnabled;
}

export function isSecurityDashboardEnabled(): boolean {
  return featureFlags.securityDashboardEnabled;
}

export function isDebugMode(): boolean {
  return featureFlags.debugMode;
}

export function isAnnotationFeaturesEnabled(): boolean {
  return featureFlags.annotationFeaturesEnabled;
}

export function isCaptureFeaturesEnabled(): boolean {
  return featureFlags.captureFeaturesEnabled;
}

/**
 * 런타임에 기능 플래그 상태를 확인할 수 있는 디버깅 함수
 */
export function getFeatureFlagsStatus(): FeatureFlags {
  return { ...featureFlags };
}

// 개발자 도구에서 접근 가능하도록 전역에 등록
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).clarityFeatureFlags = {
    status: getFeatureFlagsStatus,
    isLoginEnabled,
    isSecurityDashboardEnabled,
    isDebugMode,
    isAnnotationFeaturesEnabled,
    isCaptureFeaturesEnabled
  };
}