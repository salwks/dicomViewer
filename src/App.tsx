import { useState, useEffect, useRef } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import CookieConsent from "react-cookie-consent";
import { trackPageView, trackDicomViewerEvents, initGA } from "./analytics";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import {
  Upload,
  Layout,
  Settings,
  Grid,
  FileText,
  Terminal,
  X,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  RotateCcw,
  RefreshCw as Reset,
  Tag,
  Ruler,
  Square,
  Circle,
  ArrowUpRight,
  Navigation,
  Triangle,
  Move3D,
  Spline,
  MousePointer,
  ZoomIn,
  Contrast,
  Search as SearchIcon,
  RectangleHorizontal,
  CircleEllipsis,
  CircleDot,
  MessageSquare,
  Brush,
  Target,
  Camera,
  Shield,
} from "lucide-react";
import { DicomRenderer } from "./components/DicomRenderer";
import { DicomMetaModal } from "./components/DicomMetaModal";
import { LicenseModal } from "./components/LicenseModal";
import { useAnnotationStore, useViewportStore, useUIStore, useSecurityStore } from "./store";
import { useTranslation } from "./utils/i18n";
import LanguageSelector from "./components/LanguageSelector";
import FeedbackModal from "./components/FeedbackModal";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import SecurityLogin from "./components/SecurityLogin";
import LoginModern from "./components/LoginModern";
import SecurityDashboard from "./components/SecurityDashboard";
import { sanitizeFileName, XSSProtection } from "./utils/xss-protection";
import { validateAnnotationLabel, validateFileName } from "./utils/input-validation";
import { SecureErrorBoundary, DicomErrorBoundary, AuthErrorBoundary } from "./components/SecureErrorBoundary";
import { initializeErrorReporting } from "./utils/error-reporting";
// 측정값 관련 import 제거 - 더 이상 사용하지 않음
import "./App.css";

/**
 * 간단한 DICOM 뷰어 - 모든 복잡한 기능 제거
 * TypeScript 오류 없이 정상 작동하는 버전
 */

// 공통 버튼 스타일 - 브라우저 간 통일된 디자인
const commonButtonStyle = {
  background: "transparent",
  border: "none",
  padding: "0",
  margin: "0",
  cursor: "pointer",
  outline: "none",
  WebkitAppearance: "none" as const,
  MozAppearance: "none" as const,
  appearance: "none" as const,
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  fontSize: "inherit",
  lineHeight: "inherit",
};

function App() {
  // Router location for conditional rendering
  const location = useLocation();
  
  // Cookie consent state
  const [hasCookieConsent, setHasCookieConsent] = useState(false);
  
  // Security state - check authentication first
  const { isAuthenticated, currentUser, checkAuthentication } = useSecurityStore();
  const [showSecurityDashboard, setShowSecurityDashboard] = useState(false);
  
  // UI Store - get login enabled flag and language
  const {
    isLicenseModalOpen,
    toggleLicenseModal,
    isLoginEnabled,
    currentLanguage,
  } = useUIStore();

  // 색상 반전 함수
  const handleInvertColors = () => {
    const renderingEngine = (window as any).cornerstoneRenderingEngine;
    if (renderingEngine) {
      const viewport = renderingEngine.getViewport('dicom-viewport');
      if (viewport) {
        try {
          const properties = viewport.getProperties();
          
          // 현재 반전 상태 확인 및 토글
          const currentInvert = properties?.invert || false;
          viewport.setProperties({
            ...properties,
            invert: !currentInvert
          });
          viewport.render();
          
          console.log(`🔄 Color invert toggled: ${!currentInvert}`);
          showToastMessage(`${t('invert')}: ${!currentInvert ? 'ON' : 'OFF'}`);
        } catch (error) {
          console.error('Failed to invert colors:', error);
          showToastMessage(t('failed'));
        }
      }
    }
  };

  // 디버깅을 위해 전역으로 노출
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).useSecurityStore = useSecurityStore;
      console.log('🔧 useSecurityStore exposed to window for debugging');
    }
  }, []);
  
  // Check authentication on app load (only if login is enabled)
  useEffect(() => {
    if (isLoginEnabled) {
      console.log('🔐 App: Checking authentication on load');
      const authResult = checkAuthentication();
      console.log('🔐 App: Authentication check result:', authResult);
    } else {
      console.log('🔐 App: Login disabled - skipping authentication check');
    }
    
    // Initialize error reporting
    initializeErrorReporting({
      service: 'local',
      environment: import.meta.env.PROD ? 'production' : 'development',
      enableUserFeedback: true,
      sampleRate: 1.0
    }).catch(error => {
      console.error('Failed to initialize error reporting:', error);
    });
  }, [checkAuthentication, isLoginEnabled]);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFiles, setLoadedFiles] = useState<File[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renderingSuccess, setRenderingSuccess] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(
    null
  );
  const [editingValue, setEditingValue] = useState("");
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Toast message function
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Zustand stores for tool management and sidebar controls
  const {
    activeTool,
    setActiveTool,
    annotations,
    clearAllAnnotations,
    removeAnnotation,
    updateAnnotationLabel,
  } = useAnnotationStore();

  const {
    rotateImage,
    flipImage,
    resetImageTransform,
    currentRotation,
    isFlippedHorizontal,
    isFlippedVertical,
    currentDicomDataSet,
    captureViewportAsPng,
  } = useViewportStore();

  // 번역 함수
  const { t } = useTranslation(currentLanguage);

  // 키보드 단축키 설정
  const { getShortcutForTool } = useKeyboardShortcuts({
    onToolSelect: (toolName) => {
      console.log(`🎯 Shortcut activated: ${toolName}`);
      setActiveTool(toolName);
      // Google Analytics 키보드 단축키 사용 추적
      const shortcut = getShortcutForTool(toolName);
      if (shortcut) {
        trackDicomViewerEvents.shortcutUsage(shortcut, toolName);
      }
    },
    onInvert: () => {
      console.log('🎯 Shortcut activated: Invert');
      handleInvertColors();
      // Google Analytics 이미지 조작 추적
      trackDicomViewerEvents.imageManipulation('invert_colors');
      trackDicomViewerEvents.shortcutUsage('I', 'Invert');
    },
    enabled: !isLicenseModalOpen && !showFeedbackModal && !isMetaModalOpen
  });

  // 쿠키 동의 상태 확인 및 Google Analytics 초기화
  useEffect(() => {
    // 🚀 동적 페이지 제목 설정
    document.title = `${import.meta.env.VITE_APP_NAME} v${import.meta.env.VITE_APP_VERSION}`;
    
    // 🎨 개발자 콘솔에 버전 정보 출력
    console.log(
      `%c${import.meta.env.VITE_APP_NAME} v${import.meta.env.VITE_APP_VERSION}`,
      'color: #3b82f6; font-size: 20px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);'
    );
    console.log(
      `%c🏥 Modern React-based DICOM viewer using Cornerstone3D`,
      'color: #10b981; font-size: 14px; font-weight: normal;'
    );
    console.log(
      `%c📊 Performance optimized for medical imaging`,
      'color: #8b5cf6; font-size: 12px; font-weight: normal;'
    );
    
    const consentCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('CookieConsent='));
    
    const hasConsent = consentCookie?.split('=')[1] === 'true';
    setHasCookieConsent(hasConsent);
    
    if (hasConsent) {
      initGA();
      trackPageView('/', `${import.meta.env.VITE_APP_NAME} v${import.meta.env.VITE_APP_VERSION} - Home`);
      trackDicomViewerEvents.languageChange(currentLanguage);
    }
  }, []);

  // 언어 변경 추적
  useEffect(() => {
    if (currentLanguage) {
      trackDicomViewerEvents.languageChange(currentLanguage);
    }
  }, [currentLanguage]);

  // 주석은 이제 Zustand 스토어에서 관리됨

  // 주석 이름 편집 관련 함수들
  const startEditingAnnotation = (
    annotationUID: string,
    currentLabel: string
  ) => {
    setEditingAnnotationId(annotationUID);
    setEditingValue(
      currentLabel ||
        `${
          annotations.find((a) => a.annotationUID === annotationUID)?.toolName
        } #${
          annotations.findIndex((a) => a.annotationUID === annotationUID) + 1
        }`
    );
    console.log(`📝 주석 편집 시작: ${annotationUID}`, currentLabel);
  };

  const saveAnnotationEdit = () => {
    if (!editingAnnotationId || !editingValue.trim()) {
      setError(t('pleaseEnterAnnotationLabel'));
      return;
    }

    // 입력 검증 수행
    const validation = validateAnnotationLabel(editingValue, {
      maxLength: 100,
      minLength: 1,
      sanitize: true,
      logAttempts: true
    });

    if (!validation.isValid) {
      setError(`입력 검증 실패: ${validation.errors.join(', ')}`);
      console.warn("❌ 주석 라벨 검증 실패:", validation.errors);
      return;
    }

    if (validation.warnings.length > 0) {
      console.warn("⚠️ 주석 라벨 경고:", validation.warnings);
    }

    // 검증된 값으로 업데이트
    const sanitizedLabel = validation.sanitizedValue || editingValue.trim();
    updateAnnotationLabel(editingAnnotationId, sanitizedLabel);
    
    console.log(
      `💾 주석 라벨 저장 (검증됨): ${editingAnnotationId} -> "${sanitizedLabel}"`
    );

    if (sanitizedLabel !== editingValue.trim()) {
      setToastMessage(`⚠️ ${t('labelSanitized')}: "${sanitizedLabel}"`);
      setShowToast(true);
    } else {
      setToastMessage(`✓ ${t('annotationSaved')}`);
      setShowToast(true);
    }
    
    setEditingAnnotationId(null);
    setEditingValue("");
  };

  const cancelAnnotationEdit = () => {
    setEditingAnnotationId(null);
    setEditingValue("");
    console.log("❌ 주석 편집 취소");
  };

  const handleAnnotationKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      saveAnnotationEdit();
    } else if (event.key === "Escape") {
      cancelAnnotationEdit();
    }
  };

  // Initialize default tool
  useEffect(() => {
    if (!activeTool) {
      setActiveTool("WindowLevel"); // Set default tool to WindowLevel
      console.log("기본 도구로 WindowLevel 설정");
    }
  }, [activeTool, setActiveTool]);

  // 파일 업로드 핸들러
  const handleFileUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".dcm,application/dicom";
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        // Security check for file access with enhanced validation (only if login is enabled)
        const securityStore = useSecurityStore.getState();
        const validFiles = files.filter(file => {
          // 1. 보안 검사 (로그인 기능이 활성화된 경우에만)
          if (isLoginEnabled) {
            const hasAccess = securityStore.checkFileAccess(file.name);
            if (!hasAccess) {
              console.warn(`Access denied for file: ${file.name}`);
              return false;
            }
          }

          // 2. 파일명 검증
          const fileValidation = validateFileName(file.name, {
            logAttempts: true
          });

          if (!fileValidation.isValid) {
            console.error(`파일명 검증 실패: ${file.name}`, fileValidation.errors);
            setError(`파일명 오류 (${file.name}): ${fileValidation.errors.join(', ')}`);
            return false;
          }

          if (fileValidation.warnings.length > 0) {
            console.warn(`파일명 경고 (${file.name}):`, fileValidation.warnings);
            setToastMessage(`⚠️ ${t('fileWarning')}: ${fileValidation.warnings.join(', ')}`);
            setShowToast(true);
          }

          return true;
        });
        
        if (validFiles.length > 0) {
          handleFiles(validFiles);
        } else {
          const errorMessage = isLoginEnabled 
            ? "Access denied: Invalid file type or insufficient permissions"
            : "Invalid file type. Please select a DICOM file (.dcm)";
          setError(errorMessage);
        }
      }
      // 🔥 핵심: input 요소 초기화로 같은 파일 재선택 허용
      (e.target as HTMLInputElement).value = "";
    };
    input.click();
  };

  // 파일 처리 (무한 로딩 완전 해결)
  const handleFiles = async (files: File[]) => {
    console.log("🔄 파일 처리 시작 - 완전한 상태 초기화");

    // 🔥 핵심: 절대적으로 깨끗한 상태 초기화 (순서 중요!)

    // 1단계: 모든 React 상태 초기화
    setIsLoading(false); // 기존 로딩 해제
    setError(null); // 에러 초기화
    setRenderingSuccess(false); // 렌더링 상태 초기화
    setLoadedFiles([]); // 기존 파일 목록 초기화

    // 2단계: Zustand 스토어 완전 초기화
    clearAllAnnotations(); // 주석 초기화

    // 3단계: 추가 상태 초기화 (Zustand 스토어에서)
    const { setLoading, setError: setStoreError } = useUIStore.getState();
    setLoading(false); // 스토어 로딩 상태 초기화
    setStoreError(null); // 스토어 에러 상태 초기화

    console.log("✅ 모든 상태 초기화 완료");

    const dicomFiles = files.filter(
      (file) =>
        file.name.toLowerCase().endsWith(".dcm") ||
        file.type === "application/dicom"
    );

    if (dicomFiles.length === 0) {
      setError("DICOM 파일이 없습니다. .dcm 파일을 선택해주세요.");
      return;
    }

    try {
      console.log(`📁 ${dicomFiles.length}개의 DICOM 파일 처리 시작`);

      // 4단계: 새로운 로딩 시작 (잠시 대기 후 실행으로 상태 변화 보장)
      await new Promise((resolve) => setTimeout(resolve, 50));

      setIsLoading(true);
      setLoadedFiles(dicomFiles);

      console.log("🎯 DicomRenderer로 파일 전달 완료");

      // DicomRenderer에서 실제 렌더링이 수행됩니다
      // 로딩 상태는 onRenderingSuccess/onRenderingError 콜백에서 해제됩니다
    } catch (error) {
      console.error("❌ 파일 처리 중 오류:", error);
      setError("파일 로드 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  // 드래그 앤 드롭 핸들러 (동일한 상태 초기화 적용)
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    console.log("🎯 드래그앤드롭으로 파일 처리 시작");
    
    // Security check for file access with enhanced validation (only if login is enabled)
    const securityStore = useSecurityStore.getState();
    const validFiles = files.filter(file => {
      // 1. 보안 검사 (로그인 기능이 활성화된 경우에만)
      if (isLoginEnabled) {
        const hasAccess = securityStore.checkFileAccess(file.name);
        if (!hasAccess) {
          console.warn(`Access denied for file: ${file.name}`);
          return false;
        }
      }

      // 2. 파일명 검증 (드래그앤드롭에도 동일한 검증 적용)
      const fileValidation = validateFileName(file.name, {
        logAttempts: true
      });

      if (!fileValidation.isValid) {
        console.error(`드래그앤드롭 파일명 검증 실패: ${file.name}`, fileValidation.errors);
        setError(`파일명 오류 (${file.name}): ${fileValidation.errors.join(', ')}`);
        return false;
      }

      if (fileValidation.warnings.length > 0) {
        console.warn(`드래그앤드롭 파일명 경고 (${file.name}):`, fileValidation.warnings);
        setToastMessage(`⚠️ ${t('fileWarning')}: ${fileValidation.warnings.join(', ')}`);
        setShowToast(true);
      }

      return true;
    });
    
    if (validFiles.length > 0) {
      handleFiles(validFiles);
    } else {
      const errorMessage = isLoginEnabled 
        ? "Access denied: Invalid file type or insufficient permissions"
        : "Invalid file type. Please select a DICOM file (.dcm)";
      setError(errorMessage);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // DICOM 렌더링 성공 핸들러 (Toast 표시)
  const handleRenderingSuccess = (message: string) => {
    console.log("✅ App: 렌더링 성공", message);
    setRenderingSuccess(true);
    setIsLoading(false); // 🔥 핵심: 반드시 로딩 해제
    setError(null);

    // 스토어 상태도 동기화
    const { setLoading, setError: setStoreError } = useUIStore.getState();
    setLoading(false);
    setStoreError(null);

    // 🔥 Toast 메시지 표시
    setToastMessage(`✓ ${loadedFiles.length}${t('filesRendered')}`);
    setShowToast(true);

    // 5초 후 toast 자동 숨김
    setTimeout(() => {
      setShowToast(false);
    }, 5000);

    console.log("🎉 파일 로딩 완전히 완료 - 모든 상태 정리됨");
  };

  // DICOM 렌더링 실패 핸들러 (강화된 상태 관리)
  const handleRenderingError = (errorMessage: string) => {
    console.error("❌ App: 렌더링 실패", errorMessage);
    setRenderingSuccess(false);
    setIsLoading(false); // 🔥 핵심: 반드시 로딩 해제
    setError(errorMessage);

    // 스토어 상태도 동기화
    const { setLoading, setError: setStoreError } = useUIStore.getState();
    setLoading(false);
    setStoreError(errorMessage);

    console.log("💥 파일 로딩 실패 - 모든 상태 정리됨");
  };

  // Security gate - show login if not authenticated (only if login feature is enabled)
  if (isLoginEnabled && !isAuthenticated) {
    return (
      <AuthErrorBoundary>
        <LoginModern onLoginSuccess={() => setShowSecurityDashboard(false)} />
      </AuthErrorBoundary>
    );
  }

  // Show security dashboard if requested
  if (showSecurityDashboard) {
    return (
      <SecureErrorBoundary>
        <SecurityDashboard />
      </SecureErrorBoundary>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/" element={
          <SecureErrorBoundary>
      <div className="app">
        {/* Header */}
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <Layout className="header-icon" />
              <h1>{import.meta.env.VITE_APP_NAME}</h1>
              <span className="version">v{import.meta.env.VITE_APP_VERSION}</span>
            </div>

            <div className="header-right">
              {isLoginEnabled && (
                <div className="security-info">
                  <span className="user-info">
                    {currentUser?.username} ({currentUser?.role})
                  </span>
                  <button
                    onClick={() => setShowSecurityDashboard(true)}
                    className="security-dashboard-btn"
                    style={{
                      ...commonButtonStyle,
                      padding: "8px 12px",
                      backgroundColor: "#1f2937",
                      color: "white",
                      borderRadius: "6px",
                      fontSize: "12px",
                      marginRight: "8px",
                    }}
                    title={t('securityDashboard')}
                  >
                    <Shield size={14} />
                  </button>
                </div>
              )}
              <LanguageSelector className="mr-3" />
              <span className="status-ready">{t('ready')}</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="app-content">
          {/* Sidebar Toggle */}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={commonButtonStyle}
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>

          {/* Sidebar */}
          {sidebarOpen && (
            <aside className="sidebar">
              <div className="sidebar-content">
                {/* File Upload Section - Moved from Toolbar */}
                <div className="sidebar-section">
                  <h3 className="sidebar-section-title">
                    <Upload size={16} />
                    {t('fileManagementSection')}
                  </h3>
                  <div className="file-upload-section">
                    <button
                      className="file-upload-button"
                      onClick={handleFileUpload}
                      disabled={isLoading}
                      style={{
                        ...commonButtonStyle,
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "#3b82f6",
                        color: "white",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        transition: "background-color 0.2s",
                        opacity: isLoading ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isLoading) {
                          e.currentTarget.style.backgroundColor = "#2563eb";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isLoading) {
                          e.currentTarget.style.backgroundColor = "#3b82f6";
                        }
                      }}
                      title={t('upload')}
                    >
                      <Upload size={16} />
                      <span>{t('upload')}</span>
                    </button>
                  </div>
                </div>

                {/* Series Information */}
                <div className="sidebar-section">
                  <h3 className="sidebar-section-title">
                    <FileText size={16} />
{t('seriesInfo')}
                  </h3>
                  {loadedFiles.length > 0 ? (
                    <div className="series-info">
                      <div className="info-item">
                        <label>{t('loadedFiles')}:</label>
                        <span>{loadedFiles.length}{t('files')}</span>
                      </div>
                      <div className="info-item">
                        <label>{t('renderingStatus')}:</label>
                        <span
                          style={{
                            color: renderingSuccess
                              ? "#10b981"
                              : isLoading
                              ? "#f59e0b"
                              : "#ef4444",
                          }}
                        >
                          {renderingSuccess
                            ? `✅ ${t('success')}`
                            : isLoading
                            ? `⏳ ${t('processing')}`
                            : `❌ ${t('failed')}`}
                        </span>
                      </div>
                      {loadedFiles.slice(0, 3).map((file, index) => (
                        <div key={index} className="info-item">
                          <label>{t('fileNumber').replace('{number}', String(index + 1))}:</label>
                          <span>{file.name}</span>
                        </div>
                      ))}
                      {loadedFiles.length > 3 && (
                        <div className="info-item">
                          <span>{t('andMoreFiles').replace('{count}', String(loadedFiles.length - 3))}</span>
                        </div>
                      )}

                      {/* Meta Tag 토글 버튼 */}
                      {renderingSuccess && currentDicomDataSet && (
                        <div
                          className="info-item"
                          style={{ marginTop: "12px" }}
                        >
                          <button
                            onClick={() => setIsMetaModalOpen(!isMetaModalOpen)}
                            style={{
                              ...commonButtonStyle,
                              width: "100%",
                              padding: "8px 12px",
                              backgroundColor: isMetaModalOpen
                                ? "#dc2626"
                                : "#059669",
                              color: "white",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: "500",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              transition: "background-color 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                isMetaModalOpen ? "#b91c1c" : "#047857";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                isMetaModalOpen ? "#dc2626" : "#059669";
                            }}
                            title={
                              isMetaModalOpen
                                ? t('closeMetaTagWindow')
                                : t('allMetaTags')
                            }
                          >
                            <Tag size={14} />
                            <span>
                              {isMetaModalOpen
                                ? t('closeMetaModal')
                                : t('viewMetaTags')}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="no-data">{t('fileNotLoaded')}</p>
                  )}
                </div>

                {/* 주석 정보 */}
                <div
                  className="sidebar-section"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "400px", // 고정 높이 설정
                  }}
                >
                  <h3 className="sidebar-section-title">
                    <FileText size={16} />
{t('annotations')} ({annotations.length})
                  </h3>

                  {annotations.length > 0 ? (
                    <>
                      {/* 스크롤 가능한 주석 목록 */}
                      <div
                        className="annotations-list"
                        style={{
                          flexGrow: 1,
                          overflowY: "auto",
                          overflowX: "hidden",
                          padding: "8px",
                          marginBottom: "12px",
                          scrollbarWidth: "thin",
                          scrollbarColor: "#cbd5e1 #f1f5f9",
                        }}
                      >
                        {annotations.map((annotation, index) => (
                          <div
                            key={annotation.annotationUID}
                            className="annotation-item"
                            style={{
                              marginBottom: "4px",
                              padding: "4px 4px 0px 4px",
                              backgroundColor: "#242424",
                            }}
                          >
                            <div
                              className="annotation-header"
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "4px",
                              }}
                            >
                              <div
                                className="annotation-info"
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  flex: 1,
                                }}
                              >
                                {/* 편집 가능한 주석 이름만 표시 */}
                                <div style={{ marginBottom: "2px" }}>
                                  {editingAnnotationId ===
                                  annotation.annotationUID ? (
                                    <input
                                      type="text"
                                      value={editingValue}
                                      onChange={(e) =>
                                        setEditingValue(e.target.value)
                                      }
                                      onKeyPress={handleAnnotationKeyPress}
                                      onBlur={saveAnnotationEdit}
                                      autoFocus
                                      style={{
                                        border: "1px solid #3b82f6",
                                        borderRadius: "4px",
                                        padding: "4px 8px",
                                        fontSize: "14px",
                                        width: "100%",
                                        background: "#fff",
                                        outline: "none",
                                        fontWeight: "500",
                                      }}
                                      placeholder={t('enterAnnotationName')}
                                    />
                                  ) : (
                                    <span
                                      className="annotation-name"
                                      onClick={() =>
                                        startEditingAnnotation(
                                          annotation.annotationUID,
                                          annotation.data?.label ||
                                            annotation.data?.text ||
                                            `${annotation.toolName} #${
                                              index + 1
                                            }`
                                        )
                                      }
                                      style={{
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        fontWeight: "500",
                                        color: "rgb(16, 185, 129)",
                                        padding: "4px 6px",
                                        transition: "background-color 0.2s",
                                        display: "inline-block",
                                        minHeight: "24px",
                                        minWidth: "60px",
                                        width: "100%",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor =
                                          "rgba(16, 185, 129, 0.1)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor =
                                          "transparent";
                                      }}
                                      title={t('clickToEdit')}
                                    >
                                      {annotation.data?.label ||
                                        `${annotation.toolName} #${index + 1}`}
                                    </span>
                                  )}
                                </div>

                                {/* 측정값 완전 제거 - ID와 편집 가능한 이름만 표시 */}

                                {/* 도구 정보 div 숨김 처리 */}
                                <div style={{ display: "none" }}>
                                  <span
                                    className="annotation-tool"
                                    style={{ fontSize: "11px", color: "#888" }}
                                  >
                                    {annotation.toolName}
                                  </span>
                                  <span
                                    className="annotation-id"
                                    style={{ fontSize: "11px", color: "#888" }}
                                  >
                                    #{index + 1}
                                  </span>
                                </div>
                              </div>

                              <button
                                className="annotation-delete-btn"
                                onClick={() => {
                                  console.log(
                                    `🗑️ 주석 삭제 요청: ${annotation.annotationUID}`
                                  );
                                  removeAnnotation(annotation.annotationUID);
                                }}
                                title={t('deleteAnnotation')}
                                style={{
                                  ...commonButtonStyle,
                                  color: "#ef4444",
                                  padding: "4px",
                                  borderRadius: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "background-color 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "rgba(239, 68, 68, 0.1)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "transparent";
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 하단 고정 버튼 */}
                      <div
                        style={{
                          paddingTop: "8px",
                          borderTop: "1px solid #e5e7eb",
                          textAlign: "center",
                          flexShrink: 0, // 버튼이 축소되지 않도록
                        }}
                      >
                        <button
                          onClick={clearAllAnnotations}
                          style={{
                            ...commonButtonStyle,
                            background: "#ef4444",
                            color: "white",
                            borderRadius: "6px",
                            padding: "8px 16px",
                            fontSize: "12px",
                            fontWeight: "500",
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                            width: "100%",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#dc2626";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ef4444";
                          }}
                          title={t('deleteAllAnnotations')}
                        >
{t('deleteAllAnnotations')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="no-data">{t('noAnnotations')}</p>
                  )}
                </div>

                {/* Settings */}
                {/* 단위 설정 제거 - mm로 고정 */}
              </div>

              {/* Footer */}
              <div
                style={{
                  borderTop: "1px solid #404040",
                  padding: "12px 16px",
                  marginTop: "auto",
                  backgroundColor: "#2d2d2d",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#a1a1aa",
                      margin: 0,
                    }}
                  >
                    {t('appName')} v0.1.0
                  </p>
                  
                  {/* Feedback Button */}
                  <button
                    onClick={() => {
                      setShowFeedbackModal(true);
                      trackDicomViewerEvents.feedbackSubmit('modal_opened');
                    }}
                    style={{
                      ...commonButtonStyle,
                      color: "#10b981",
                      fontSize: "8px",
                      textDecoration: "underline",
                      padding: "2px 0",
                      transition: "color 0.2s",
                      marginBottom: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#059669";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#10b981";
                    }}
                    title={t('feedback')}
                  >
                    <MessageSquare size={10} />
                    {t('feedback')}
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log(
                        "🔗 라이선스 버튼 클릭됨, 현재 상태:",
                        isLicenseModalOpen
                      );
                      toggleLicenseModal();
                      console.log("🔗 토글 후 상태 변경 요청됨");
                    }}
                    style={{
                      ...commonButtonStyle,
                      color: "#3b82f6",
                      fontSize: "8px",
                      textDecoration: "underline",
                      padding: "2px 0",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#2563eb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#3b82f6";
                    }}
                    title={t('license')}
                  >
{t('license')}
                  </button>
                </div>
              </div>
            </aside>
          )}

          {/* Main Viewer Area */}
          <main className={`main-content ${sidebarOpen ? "with-sidebar" : ""}`}>
            {/* Toolbar */}
            <div className="toolbar">
              {/* Basic Tools Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">{t('basicTools')}</label>
                <div className="toolbar-group">
                  {[
                    {
                      tool: "Pan",
                      icon: MousePointer,
                      tooltip: "Pan Tool - 화면 이동",
                    },
                    {
                      tool: "Zoom",
                      icon: ZoomIn,
                      tooltip: "Zoom Tool - 확대/축소",
                    },
                    {
                      tool: "WindowLevel",
                      icon: Contrast,
                      tooltip: t('windowLevel'),
                    },
                    {
                      tool: "Magnify",
                      icon: SearchIcon,
                      tooltip: t('magnifyTool'),
                    },
                  ].map(({ tool, icon: Icon, tooltip }) => {
                    const shortcut = getShortcutForTool(tool);
                    const tooltipWithShortcut = shortcut ? `${tooltip} (${shortcut})` : tooltip;
                    return (
                      <button
                        key={tool}
                        className={`toolbar-button ${
                          activeTool === tool ? "active" : ""
                        }`}
                        onClick={() => {
                          setActiveTool(tool);
                          trackDicomViewerEvents.toolUsage(tool);
                        }}
                        disabled={isLoading}
                        title={tooltipWithShortcut}
                        style={commonButtonStyle}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Measurement Tools Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">{t('measurementTools')}</label>
                <div className="toolbar-group">
                  {[
                    {
                      tool: "Length",
                      icon: Ruler,
                      tooltip: t('lengthTool'),
                    },
                    {
                      tool: "Angle",
                      icon: Triangle,
                      tooltip: "Angle Tool - 각도 측정",
                    },
                    {
                      tool: "CobbAngle",
                      icon: Navigation,
                      tooltip: "Cobb Angle Tool - 콥 각도",
                    },
                    {
                      tool: "Bidirectional",
                      icon: Move3D,
                      tooltip: t('bidirectionalTool'),
                    },
                  ].map(({ tool, icon: Icon, tooltip }) => {
                    const shortcut = getShortcutForTool(tool);
                    const tooltipWithShortcut = shortcut ? `${tooltip} (${shortcut})` : tooltip;
                    return (
                      <button
                        key={tool}
                        className={`toolbar-button ${
                          activeTool === tool ? "active" : ""
                        }`}
                        onClick={() => {
                          setActiveTool(tool);
                          trackDicomViewerEvents.toolUsage(tool);
                        }}
                        disabled={isLoading}
                        title={tooltipWithShortcut}
                        style={commonButtonStyle}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ROI Tools Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">{t('roiTools')}</label>
                <div className="toolbar-group">
                  {[
                    {
                      tool: "RectangleROI",
                      icon: Square,
                      tooltip: t('rectangleROI'),
                    },
                    {
                      tool: "EllipticalROI",
                      icon: CircleEllipsis,
                      tooltip: "Elliptical ROI - 타원형 관심영역",
                    },
                    {
                      tool: "CircleROI",
                      icon: Circle,
                      tooltip: t('circleROI'),
                    },
                  ].map(({ tool, icon: Icon, tooltip }) => {
                    const shortcut = getShortcutForTool(tool);
                    const tooltipWithShortcut = shortcut ? `${tooltip} (${shortcut})` : tooltip;
                    return (
                      <button
                        key={tool}
                        className={`toolbar-button ${
                          activeTool === tool ? "active" : ""
                        }`}
                        onClick={() => {
                          setActiveTool(tool);
                          trackDicomViewerEvents.toolUsage(tool);
                        }}
                        disabled={isLoading}
                        title={tooltipWithShortcut}
                        style={commonButtonStyle}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Drawing Tools Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">{t('advancedDrawing')}</label>
                <div className="toolbar-group">
                  {[
                    {
                      tool: "PlanarFreehandROI",
                      icon: Brush,
                      tooltip: "Freehand ROI - 자유곡선 그리기",
                    },
                    {
                      tool: "SplineROI",
                      icon: Spline,
                      tooltip: "Spline ROI - 스플라인 곡선",
                    },
                  ].map(({ tool, icon: Icon, tooltip }) => {
                    const shortcut = getShortcutForTool(tool);
                    const tooltipWithShortcut = shortcut ? `${tooltip} (${shortcut})` : tooltip;
                    return (
                      <button
                        key={tool}
                        className={`toolbar-button ${
                          activeTool === tool ? "active" : ""
                        }`}
                        onClick={() => {
                          setActiveTool(tool);
                          trackDicomViewerEvents.toolUsage(tool);
                        }}
                        disabled={isLoading}
                        title={tooltipWithShortcut}
                        style={commonButtonStyle}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Annotation Tools Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">{t('annotationTools')}</label>
                <div className="toolbar-group">
                  {[
                    {
                      tool: "ArrowAnnotate",
                      icon: ArrowUpRight,
                      tooltip:
                        t('textAnnotation'),
                    },
                    {
                      tool: "Probe",
                      icon: Target,
                      tooltip: t('informationProbe'),
                    },
                  ].map(({ tool, icon: Icon, tooltip }) => {
                    const shortcut = getShortcutForTool(tool);
                    const tooltipWithShortcut = shortcut ? `${tooltip} (${shortcut})` : tooltip;
                    return (
                      <button
                        key={tool}
                        className={`toolbar-button ${
                          activeTool === tool ? "active" : ""
                        }`}
                        onClick={() => {
                          setActiveTool(tool);
                          trackDicomViewerEvents.toolUsage(tool);
                        }}
                        disabled={isLoading}
                        title={tooltipWithShortcut}
                        style={commonButtonStyle}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Image Manipulation Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">{t('imageManipulation')}</label>
                <div className="toolbar-group">
                  <button
                    className={`toolbar-button ${
                      isFlippedHorizontal ? "active" : ""
                    }`}
                    onClick={() => flipImage("horizontal")}
                    disabled={isLoading}
                    title={t('flipHorizontal')}
                    style={commonButtonStyle}
                  >
                    <FlipHorizontal size={16} />
                  </button>
                  <button
                    className={`toolbar-button ${
                      isFlippedVertical ? "active" : ""
                    }`}
                    onClick={() => flipImage("vertical")}
                    disabled={isLoading}
                    title={t('flipVertical')}
                    style={commonButtonStyle}
                  >
                    <FlipVertical size={16} />
                  </button>
                  <button
                    className="toolbar-button"
                    onClick={() => rotateImage("left")}
                    disabled={isLoading}
                    title={t('rotateCounterclockwise')}
                    style={commonButtonStyle}
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className="toolbar-button"
                    onClick={() => rotateImage("right")}
                    disabled={isLoading}
                    title={t('rotateClockwise')}
                    style={commonButtonStyle}
                  >
                    <RotateCw size={16} />
                  </button>
                  <button
                    className="toolbar-button"
                    onClick={resetImageTransform}
                    disabled={isLoading}
                    title={t('reset')}
                    style={commonButtonStyle}
                  >
                    <Reset size={16} />
                  </button>
                  <button
                    className="toolbar-button"
                    onClick={() => {
                      console.log("📸 화면 캡처 버튼 클릭됨");
                      captureViewportAsPng();
                    }}
                    disabled={isLoading || !renderingSuccess}
                    title={t('capture')}
                    style={commonButtonStyle}
                  >
                    <Camera size={16} />
                  </button>
                </div>
              </div>

              {/* Layout Section Removed for Stability */}
              {/* Debug Section Removed for Production */}
            </div>

            {/* Error Display */}
            {error && (
              <div className="error-banner">
                <span>⚠️ {error}</span>
                <button
                  onClick={() => setError(null)}
                  className="error-close"
                  style={commonButtonStyle}
                >
                  ×
                </button>
              </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
              <div className="loading-overlay">
                <div className="loading-content">
                  <div className="loading-spinner">⟳</div>
                  <p>로딩 중...</p>
                </div>
              </div>
            )}

            {/* Viewport Container */}
            <div
              ref={containerRef}
              className={`viewport-container ${isDragging ? "dragging" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="viewport-container-inner">
                {/* Viewport info */}
                <div className="viewport-info">
                  <span className="engine-indicator">Tool: {activeTool}</span>
                </div>

                {/* Drop Zone Overlay */}
                {isDragging && (
                  <div className="drop-overlay">
                    <div className="drop-message">
                      <Layout className="drop-icon" />
                      <p>{t('dragAndDrop')}</p>
                      <small>{t('supportedFormats')}</small>
                    </div>
                  </div>
                )}

                {/* DICOM 렌더러 - Meta Tag 모달이 열려있을 때 숨김 처리 (언마운트하지 않음) */}
                <div style={{ 
                  visibility: isMetaModalOpen ? 'hidden' : 'visible',
                  pointerEvents: isMetaModalOpen ? 'none' : 'auto',
                  width: '100%',
                  height: '100%'
                }}>
                  {loadedFiles.length > 0 && !isDragging && (
                    <DicomErrorBoundary>
                      <DicomRenderer
                        files={loadedFiles}
                        onError={handleRenderingError}
                        onSuccess={handleRenderingSuccess}
                      />
                    </DicomErrorBoundary>
                  )}
                </div>

                {/* Meta Tag 창 - 뷰포트와 같은 위치에 표시 */}
                {isMetaModalOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "#222222",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      overflow: "hidden",
                    }}
                  >
                    <DicomMetaModal
                      isOpen={true}
                      onClose={() => setIsMetaModalOpen(false)}
                      dataSet={currentDicomDataSet}
                      inline={true}
                    />
                  </div>
                )}

                {/* Content Area - Empty State */}
                {!isLoading && !error && loadedFiles.length === 0 && (
                  <div className="empty-state">
                    <Layout className="empty-icon" />
                    <h3>{t('clickToUpload')}</h3>
                    <p>{t('dragAndDrop')}</p>
                    <small>{t('supportedFormats')}</small>
                  </div>
                )}

                {/* Toast 알림 */}
                {showToast && (
                  <div
                    style={{
                      position: "fixed",
                      bottom: "20px",
                      right: "20px",
                      background: "rgba(16, 185, 129, 0.95)",
                      color: "white",
                      padding: "12px 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                      zIndex: 1001,
                      animation: "fadeInUp 0.3s ease-out",
                      backdropFilter: "blur(8px)",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span>{toastMessage}</span>
                    <button
                      onClick={() => setShowToast(false)}
                      style={{
                        ...commonButtonStyle,
                        color: "rgba(255, 255, 255, 0.8)",
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        lineHeight: "1",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(255, 255, 255, 0.2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      title="닫기"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* License Modal Popup - 완전히 독립적인 오버레이 */}
      {console.log(
        "🎯 모달 렌더 체크, isLicenseModalOpen:",
        isLicenseModalOpen
      )}
      {isLicenseModalOpen && (
        <LicenseModal
          isOpen={isLicenseModalOpen}
          onClose={() => {
            console.log("🎯 모달 닫기 클릭됨");
            toggleLicenseModal();
          }}
          inline={false}
        />
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => {
            setShowFeedbackModal(false);
            trackDicomViewerEvents.feedbackSubmit('modal_closed');
          }}
          language={currentLanguage}
        />
      )}
          </SecureErrorBoundary>
        } />
      </Routes>

      {/* 쿠키 동의 전 화면 비활성화 오버레이 */}
      {!hasCookieConsent && location.pathname === '/' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 9999,
          pointerEvents: 'none',
        }} />
      )}
      
      {/* Cookie Consent - 개인정보처리방침 페이지에서는 숨김 */}
      {location.pathname !== '/privacy-policy' && (
    <CookieConsent
      location="bottom"
      buttonText={t('acceptCookies')}
      declineButtonText={t('declineCookies')}
      enableDeclineButton
      cookieName="CookieConsent"
      style={{
        background: "#2d2d2d",
        fontSize: "14px",
        color: "#e5e7eb",
        padding: "20px",
        borderTop: "1px solid #404040",
        boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.3)",
        zIndex: "10000",
        left: "280px",
        right: "0",
        width: "calc(100% - 280px)",
      }}
      buttonStyle={{
        background: "#3b82f6",
        color: "white",
        fontSize: "14px",
        fontWeight: "500",
        borderRadius: "6px",
        border: "none",
        padding: "10px 20px",
        marginLeft: "16px",
        cursor: "pointer",
      }}
      declineButtonStyle={{
        background: "#6b7280",
        color: "white",
        fontSize: "14px",
        fontWeight: "500",
        borderRadius: "6px",
        border: "none",
        padding: "10px 20px",
        marginLeft: "8px",
        cursor: "pointer",
      }}
      onAccept={() => {
        console.log('🍪 쿠키 동의됨 - Google Analytics 초기화');
        setHasCookieConsent(true);
        initGA();
        trackPageView('/', `${import.meta.env.VITE_APP_NAME} v${import.meta.env.VITE_APP_VERSION} - Home`);
      }}
      onDecline={() => {
        console.log('🍪 쿠키 거부됨 - Google Analytics 비활성화');
      }}
    >
      {t('cookieConsentMessage')}{' '}
      <Link 
        to="/privacy-policy" 
        style={{ 
          color: "#3b82f6", 
          textDecoration: "underline" 
        }}
      >
        {t('learnMore')}
      </Link>
      .
    </CookieConsent>
      )}
    </>
  );
}

export default App;
