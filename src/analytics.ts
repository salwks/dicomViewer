import ReactGA from 'react-ga4';

// Google Analytics 측정 ID
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

// 쿠키 동의 상태를 확인하는 함수
const hasUserConsent = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // react-cookie-consent가 설정하는 쿠키 확인
  const consentCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('CookieConsent='));
  
  return consentCookie?.split('=')[1] === 'true';
};

// GA 초기화 상태 추적
let isGAInitialized = false;

/**
 * Google Analytics 초기화 함수 (쿠키 동의가 있을 때만 실행)
 */
export const initGA = (): void => {
  if (!GA_MEASUREMENT_ID) {
    console.warn('⚠️ Google Analytics: 측정 ID가 설정되지 않았습니다.');
    return;
  }

  if (!hasUserConsent()) {
    console.log('ℹ️ Google Analytics: 사용자 동의 대기 중...');
    return;
  }

  if (isGAInitialized) {
    console.log('ℹ️ Google Analytics: 이미 초기화됨');
    return;
  }

  try {
    ReactGA.initialize(GA_MEASUREMENT_ID, {
      testMode: import.meta.env.DEV, // 개발 환경에서는 테스트 모드
      debug: import.meta.env.DEV, // 개발 환경에서만 디버그 로그
    });
    
    isGAInitialized = true;
    console.log('✅ Google Analytics initialized successfully:', GA_MEASUREMENT_ID);
  } catch (error) {
    console.error('❌ Google Analytics initialization failed:', error);
  }
};

/**
 * 페이지뷰 추적 함수
 * @param page - 페이지 경로 (예: '/dashboard', '/settings')
 * @param title - 페이지 제목 (선택사항)
 */
export const trackPageView = (page: string, title?: string): void => {
  if (!GA_MEASUREMENT_ID || !hasUserConsent() || !isGAInitialized) {
    return;
  }

  try {
    ReactGA.send({
      hitType: 'pageview',
      page,
      title: title || document.title,
    });
    
    if (import.meta.env.DEV) {
      console.log('📊 GA PageView tracked:', { page, title });
    }
  } catch (error) {
    console.error('❌ Failed to track page view:', error);
  }
};

/**
 * 사용자 이벤트 추적 함수
 * @param action - 이벤트 액션 (예: 'click', 'download', 'upload')
 * @param category - 이벤트 카테고리 (예: 'UI', 'File', 'Tool')
 * @param label - 이벤트 라벨 (선택사항)
 * @param value - 이벤트 값 (선택사항)
 */
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
): void => {
  if (!GA_MEASUREMENT_ID || !hasUserConsent() || !isGAInitialized) {
    return;
  }

  try {
    ReactGA.event({
      action,
      category,
      label,
      value,
    });
    
    if (import.meta.env.DEV) {
      console.log('📊 GA Event tracked:', { action, category, label, value });
    }
  } catch (error) {
    console.error('❌ Failed to track event:', error);
  }
};

/**
 * 사용자 속성 설정 함수
 * @param properties - 사용자 속성 객체
 */
export const setUserProperties = (properties: Record<string, any>): void => {
  if (!GA_MEASUREMENT_ID || !hasUserConsent() || !isGAInitialized) {
    return;
  }

  try {
    ReactGA.set(properties);
    
    if (import.meta.env.DEV) {
      console.log('📊 GA User properties set:', properties);
    }
  } catch (error) {
    console.error('❌ Failed to set user properties:', error);
  }
};

/**
 * 맞춤 이벤트 추적 함수 (DICOM 뷰어 전용)
 */
export const trackDicomViewerEvents = {
  // 파일 관련 이벤트
  fileUpload: (fileCount: number, fileTypes: string[]) => {
    trackEvent('file_upload', 'File', `${fileCount}_files`, fileCount);
    trackEvent('file_types', 'File', fileTypes.join(','));
  },

  // 도구 사용 이벤트
  toolUsage: (toolName: string) => {
    trackEvent('tool_select', 'Tool', toolName);
  },

  // 키보드 단축키 사용 이벤트
  shortcutUsage: (shortcut: string, toolName: string) => {
    trackEvent('keyboard_shortcut', 'UI', `${shortcut}_${toolName}`);
  },

  // 언어 변경 이벤트
  languageChange: (language: string) => {
    trackEvent('language_change', 'UI', language);
  },

  // 피드백 제출 이벤트
  feedbackSubmit: (title: string) => {
    trackEvent('feedback_submit', 'User_Interaction', title);
  },

  // 이미지 조작 이벤트
  imageManipulation: (action: string) => {
    trackEvent('image_manipulation', 'Tool', action);
  },

  // 주석 관련 이벤트
  annotation: (action: string, toolType: string) => {
    trackEvent('annotation_action', 'Annotation', `${action}_${toolType}`);
  },

  // 오류 추적
  error: (errorType: string, errorMessage: string) => {
    trackEvent('error_occurred', 'Error', errorType);
  },
};

/**
 * Google Analytics가 활성화되어 있는지 확인
 */
export const isGAEnabled = (): boolean => {
  return !!GA_MEASUREMENT_ID;
};

export default {
  initGA,
  trackPageView,
  trackEvent,
  setUserProperties,
  trackDicomViewerEvents,
  isGAEnabled,
};