import { useState, useEffect, useRef } from "react";
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
  RotateCcw as Reset,
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
  Brush,
  Target,
} from "lucide-react";
import { DicomRenderer } from "./components/DicomRenderer";
import { DicomMetaModal } from "./components/DicomMetaModal";
import { LicenseModal } from "./components/LicenseModal";
import { useDicomStore } from "./store/dicom-store";
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
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFiles, setLoadedFiles] = useState<File[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renderingSuccess, setRenderingSuccess] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(
    null
  );
  const [editingValue, setEditingValue] = useState("");
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Zustand store for tool management and sidebar controls
  const {
    activeTool,
    setActiveTool,
    annotations,
    clearAllAnnotations,
    removeAnnotation,
    updateAnnotationLabel,
    rotateImage,
    flipImage,
    resetImageTransform,
    currentRotation,
    isFlippedHorizontal,
    isFlippedVertical,
    currentDicomDataSet,
    isLicenseModalOpen,
    toggleLicenseModal,
  } = useDicomStore((state) => ({
    activeTool: state.activeTool,
    setActiveTool: state.setActiveTool,
    annotations: state.annotations,
    clearAllAnnotations: state.clearAllAnnotations,
    removeAnnotation: state.removeAnnotation,
    updateAnnotationLabel: state.updateAnnotationLabel,
    rotateImage: state.rotateImage,
    flipImage: state.flipImage,
    resetImageTransform: state.resetImageTransform,
    currentRotation: state.currentRotation,
    isFlippedHorizontal: state.isFlippedHorizontal,
    isFlippedVertical: state.isFlippedVertical,
    currentDicomDataSet: state.currentDicomDataSet,
    isLicenseModalOpen: state.isLicenseModalOpen,
    toggleLicenseModal: state.toggleLicenseModal,
  }));

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
    if (editingAnnotationId && editingValue.trim()) {
      updateAnnotationLabel(editingAnnotationId, editingValue.trim());
      console.log(
        `💾 주석 라벨 저장: ${editingAnnotationId} -> "${editingValue.trim()}"`
      );
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
        handleFiles(files);
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
    const { setLoading, setError: setStoreError } = useDicomStore.getState();
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
    handleFiles(files);
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
    const { setLoading, setError: setStoreError } = useDicomStore.getState();
    setLoading(false);
    setStoreError(null);

    // 🔥 Toast 메시지 표시
    setToastMessage(`✓ ${loadedFiles.length}개 파일 렌더링 완료`);
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
    const { setLoading, setError: setStoreError } = useDicomStore.getState();
    setLoading(false);
    setStoreError(errorMessage);

    console.log("💥 파일 로딩 실패 - 모든 상태 정리됨");
  };

  return (
    <>
      <div className="app">
        {/* Header */}
        <header className="app-header">
          <div className="header-content">
            <div className="header-left">
              <Layout className="header-icon" />
              <h1>Clarity</h1>
              <span className="version">Alpha</span>
            </div>

            <div className="header-right">
              <span className="status-ready">Ready</span>
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
                    파일 관리
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
                      title="DICOM 파일 업로드 (.dcm)"
                    >
                      <Upload size={16} />
                      <span>DICOM 파일 불러오기</span>
                    </button>
                  </div>
                </div>

                {/* Series Information */}
                <div className="sidebar-section">
                  <h3 className="sidebar-section-title">
                    <FileText size={16} />
                    파일 정보
                  </h3>
                  {loadedFiles.length > 0 ? (
                    <div className="series-info">
                      <div className="info-item">
                        <label>로드된 파일:</label>
                        <span>{loadedFiles.length}개</span>
                      </div>
                      <div className="info-item">
                        <label>렌더링 상태:</label>
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
                            ? "✅ 완료"
                            : isLoading
                            ? "⏳ 진행중"
                            : "❌ 실패"}
                        </span>
                      </div>
                      {loadedFiles.slice(0, 3).map((file, index) => (
                        <div key={index} className="info-item">
                          <label>파일 {index + 1}:</label>
                          <span>{file.name}</span>
                        </div>
                      ))}
                      {loadedFiles.length > 3 && (
                        <div className="info-item">
                          <span>... 및 {loadedFiles.length - 3}개 더</span>
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
                                ? "Meta Tag 창 닫기"
                                : "DICOM 파일의 모든 메타 태그 정보를 확인합니다"
                            }
                          >
                            <Tag size={14} />
                            <span>
                              {isMetaModalOpen
                                ? "Meta Tag 닫기"
                                : "Meta Tag 보기"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="no-data">파일이 로드되지 않았습니다</p>
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
                    주석 목록 ({annotations.length}개)
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
                                      placeholder="주석 이름 입력..."
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
                                      title="클릭하여 이름 편집"
                                    >
                                      {annotation.data?.label ||
                                        annotation.data?.text ||
                                        `${annotation.toolName} #${index + 1}`}
                                    </span>
                                  )}
                                </div>

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
                                title="주석 삭제"
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
                          title="모든 주석을 삭제합니다"
                        >
                          모든 주석 지우기
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="no-data">주석이 없습니다</p>
                  )}
                </div>

                {/* Settings */}
                <div className="sidebar-section">
                  <h3 className="sidebar-section-title">
                    <Settings size={16} />
                    설정
                  </h3>
                  <div className="settings-list">
                    <div className="setting-item">
                      <label>
                        활성 도구: <strong>{activeTool || "None"}</strong>
                      </label>
                    </div>
                  </div>
                </div>
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
                    Clarity v0.1.0
                  </p>
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
                    title="오픈소스 라이선스 정보 보기"
                  >
                    오픈소스 라이선스
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
                <label className="toolbar-label">기본 도구</label>
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
                      tooltip: "Window Level Tool - 창 레벨 조정",
                    },
                    {
                      tool: "Magnify",
                      icon: SearchIcon,
                      tooltip: "Magnify Tool - 돋보기",
                    },
                  ].map(({ tool, icon: Icon, tooltip }) => (
                    <button
                      key={tool}
                      className={`toolbar-button ${
                        activeTool === tool ? "active" : ""
                      }`}
                      onClick={() => setActiveTool(tool)}
                      disabled={isLoading}
                      title={tooltip}
                      style={commonButtonStyle}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Measurement Tools Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">측정 도구</label>
                <div className="toolbar-group">
                  {[
                    {
                      tool: "Length",
                      icon: Ruler,
                      tooltip: "Length Tool - 길이 측정",
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
                      tooltip: "Bidirectional Tool - 양방향 측정",
                    },
                  ].map(({ tool, icon: Icon, tooltip }) => (
                    <button
                      key={tool}
                      className={`toolbar-button ${
                        activeTool === tool ? "active" : ""
                      }`}
                      onClick={() => setActiveTool(tool)}
                      disabled={isLoading}
                      title={tooltip}
                      style={commonButtonStyle}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {/* ROI Tools Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">ROI 도구</label>
                <div className="toolbar-group">
                  {[
                    {
                      tool: "RectangleROI",
                      icon: Square,
                      tooltip: "Rectangle ROI - 사각형 관심영역",
                    },
                    {
                      tool: "EllipticalROI",
                      icon: CircleEllipsis,
                      tooltip: "Elliptical ROI - 타원형 관심영역",
                    },
                    {
                      tool: "CircleROI",
                      icon: Circle,
                      tooltip: "Circle ROI - 원형 관심영역",
                    },
                  ].map(({ tool, icon: Icon, tooltip }) => (
                    <button
                      key={tool}
                      className={`toolbar-button ${
                        activeTool === tool ? "active" : ""
                      }`}
                      onClick={() => setActiveTool(tool)}
                      disabled={isLoading}
                      title={tooltip}
                      style={commonButtonStyle}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Drawing Tools Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">고급 그리기</label>
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
                  ].map(({ tool, icon: Icon, tooltip }) => (
                    <button
                      key={tool}
                      className={`toolbar-button ${
                        activeTool === tool ? "active" : ""
                      }`}
                      onClick={() => setActiveTool(tool)}
                      disabled={isLoading}
                      title={tooltip}
                      style={commonButtonStyle}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Annotation Tools Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">주석 도구</label>
                <div className="toolbar-group">
                  {[
                    {
                      tool: "ArrowAnnotate",
                      icon: ArrowUpRight,
                      tooltip:
                        "Text Annotation - 텍스트 주석 (화살표 + 텍스트)",
                    },
                    {
                      tool: "Probe",
                      icon: Target,
                      tooltip: "Probe Tool - 정보 탐침",
                    },
                  ].map(({ tool, icon: Icon, tooltip }) => (
                    <button
                      key={tool}
                      className={`toolbar-button ${
                        activeTool === tool ? "active" : ""
                      }`}
                      onClick={() => setActiveTool(tool)}
                      disabled={isLoading}
                      title={tooltip}
                      style={commonButtonStyle}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Manipulation Section */}
              <div className="toolbar-section">
                <label className="toolbar-label">이미지 조작</label>
                <div className="toolbar-group">
                  <button
                    className={`toolbar-button ${
                      isFlippedHorizontal ? "active" : ""
                    }`}
                    onClick={() => flipImage("horizontal")}
                    disabled={isLoading}
                    title="수평 뒤집기 (Flip Horizontal)"
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
                    title="수직 뒤집기 (Flip Vertical)"
                    style={commonButtonStyle}
                  >
                    <FlipVertical size={16} />
                  </button>
                  <button
                    className="toolbar-button"
                    onClick={() => rotateImage("left")}
                    disabled={isLoading}
                    title="왼쪽으로 90도 회전 (Rotate Left)"
                    style={commonButtonStyle}
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className="toolbar-button"
                    onClick={() => rotateImage("right")}
                    disabled={isLoading}
                    title="오른쪽으로 90도 회전 (Rotate Right)"
                    style={commonButtonStyle}
                  >
                    <RotateCw size={16} />
                  </button>
                  <button
                    className="toolbar-button"
                    onClick={resetImageTransform}
                    disabled={isLoading}
                    title={`이미지 변환 리셋 (현재: ${currentRotation}도, H:${isFlippedHorizontal}, V:${isFlippedVertical})`}
                    style={commonButtonStyle}
                  >
                    <Reset size={16} />
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
                      <p>DICOM 파일을 여기에 드롭하세요</p>
                      <small>.dcm 파일을 지원합니다</small>
                    </div>
                  </div>
                )}

                {/* DICOM 렌더러 - Meta Tag 모달이 열려있지 않을 때만 표시 */}
                {loadedFiles.length > 0 && !isDragging && !isMetaModalOpen && (
                  <DicomRenderer
                    files={loadedFiles}
                    onError={handleRenderingError}
                    onSuccess={handleRenderingSuccess}
                  />
                )}

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
                    <h3>DICOM 이미지가 로드되지 않았습니다</h3>
                    <p>파일을 드래그하거나 "파일 불러오기" 버튼을 클릭하세요</p>
                    <small>지원 형식: .dcm</small>
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
    </>
  );
}

export default App;
