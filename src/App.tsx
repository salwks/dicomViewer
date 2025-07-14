import { useState, useEffect, useRef } from 'react';
import { Upload, Layout, Settings, Grid, FileText, Terminal, X } from 'lucide-react';
import { DicomRenderer } from './components/DicomRenderer';
import { debugLogger } from './utils/debug-logger';
import { useDicomStore } from './store/dicom-store';
import './App.css';

/**
 * 간단한 DICOM 뷰어 - 모든 복잡한 기능 제거
 * TypeScript 오류 없이 정상 작동하는 버전
 */
function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFiles, setLoadedFiles] = useState<File[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renderingSuccess, setRenderingSuccess] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Zustand store for tool management and sidebar controls
  const { 
    activeTool, 
    setActiveTool, 
    annotations, 
    annotationsVisible, 
    panZoomEnabled,
    toggleAnnotationsVisibility,
    setPanZoomEnabled,
    clearAllAnnotations,
    removeAnnotation,
    updateAnnotationLabel
  } = useDicomStore((state) => ({
    activeTool: state.activeTool,
    setActiveTool: state.setActiveTool,
    annotations: state.annotations,
    annotationsVisible: state.annotationsVisible,
    panZoomEnabled: state.panZoomEnabled,
    toggleAnnotationsVisibility: state.toggleAnnotationsVisibility,
    setPanZoomEnabled: state.setPanZoomEnabled,
    clearAllAnnotations: state.clearAllAnnotations,
    removeAnnotation: state.removeAnnotation,
    updateAnnotationLabel: state.updateAnnotationLabel
  }));

  // 주석은 이제 Zustand 스토어에서 관리됨

  // 주석 이름 편집 관련 함수들
  const startEditingAnnotation = (annotationUID: string, currentLabel: string) => {
    setEditingAnnotationId(annotationUID);
    setEditingValue(currentLabel || `${annotations.find(a => a.annotationUID === annotationUID)?.toolName} #${annotations.findIndex(a => a.annotationUID === annotationUID) + 1}`);
    debugLogger.log(`📝 주석 편집 시작: ${annotationUID}`, currentLabel);
  };

  const saveAnnotationEdit = () => {
    if (editingAnnotationId && editingValue.trim()) {
      updateAnnotationLabel(editingAnnotationId, editingValue.trim());
      debugLogger.log(`💾 주석 라벨 저장: ${editingAnnotationId} -> "${editingValue.trim()}"`);
    }
    setEditingAnnotationId(null);
    setEditingValue('');
  };

  const cancelAnnotationEdit = () => {
    setEditingAnnotationId(null);
    setEditingValue('');
    debugLogger.log('❌ 주석 편집 취소');
  };

  const handleAnnotationKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      saveAnnotationEdit();
    } else if (event.key === 'Escape') {
      cancelAnnotationEdit();
    }
  };

  // Initialize default tool
  useEffect(() => {
    if (!activeTool) {
      setActiveTool('WindowLevel'); // Set default tool to WindowLevel
      debugLogger.log('기본 도구로 WindowLevel 설정');
    }
  }, [activeTool, setActiveTool]);

  // 팬/줌 토글 핸들러 (toolGroupRef 접근을 위해)
  const handlePanZoomToggle = (enabled: boolean) => {
    const toolGroupRef = (window as any).cornerstoneToolGroupRef; // DicomViewport에서 설정
    setPanZoomEnabled(enabled, toolGroupRef);
  };

  // 파일 업로드 핸들러
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.dcm,application/dicom';
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        handleFiles(files);
      }
    };
    input.click();
  };

  // 파일 처리
  const handleFiles = async (files: File[]) => {
    const dicomFiles = files.filter(file => 
      file.name.toLowerCase().endsWith('.dcm') || 
      file.type === 'application/dicom'
    );

    if (dicomFiles.length === 0) {
      setError('DICOM 파일이 없습니다. .dcm 파일을 선택해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setRenderingSuccess(false);
      clearAllAnnotations(); // 새 파일 로드 시 주석 초기화  
      setLoadedFiles(dicomFiles);
      
      debugLogger.log(`📁 ${dicomFiles.length}개의 DICOM 파일 로드 시작...`);
      
      // DicomRenderer에서 실제 렌더링이 수행됩니다
      // 로딩 상태는 onRenderingSuccess/onRenderingError 콜백에서 해제됩니다
      
    } catch (error) {
      debugLogger.error('❌ 파일 처리 중 오류:', error);
      setError('파일 로드 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
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

  // DICOM 렌더링 성공 핸들러
  const handleRenderingSuccess = (message: string) => {
    debugLogger.success('App: 렌더링 성공', message);
    setRenderingSuccess(true);
    setIsLoading(false);
    setError(null);
  };

  // DICOM 렌더링 실패 핸들러
  const handleRenderingError = (errorMessage: string) => {
    debugLogger.error('App: 렌더링 실패', errorMessage);
    setRenderingSuccess(false);
    setIsLoading(false);
    setError(errorMessage);
  };

  // 디버그 콘솔 표시/숨김
  const showDebugConsole = () => {
    debugLogger.dumpLogs();
    alert('디버그 로그가 개발자 도구 콘솔에 출력되었습니다. F12를 눌러 확인하세요.');
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <Layout className="header-icon" />
            <h1>Modern DICOM Viewer</h1>
            <span className="version">v2.0</span>
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
        >
          {sidebarOpen ? '◀' : '▶'}
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
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background-color 0.2s',
                      opacity: isLoading ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.backgroundColor = '#3b82f6';
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
                      <span style={{ 
                        color: renderingSuccess ? '#10b981' : (isLoading ? '#f59e0b' : '#ef4444') 
                      }}>
                        {renderingSuccess ? '✅ 완료' : (isLoading ? '⏳ 진행중' : '❌ 실패')}
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
                  </div>
                ) : (
                  <p className="no-data">파일이 로드되지 않았습니다</p>
                )}
              </div>

              {/* 주석 정보 */}
              <div className="sidebar-section" style={{
                display: 'flex',
                flexDirection: 'column',
                height: '400px' // 고정 높이 설정
              }}>
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
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        padding: '8px',
                        marginBottom: '12px',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 #f1f5f9'
                      }}
                    >
                      {annotations.map((annotation, index) => (
                        <div 
                          key={annotation.annotationUID} 
                          className="annotation-item"
                          style={{
                            marginBottom: '4px',
                            padding: '4px 4px 0px 4px',
                            backgroundColor: '#242424'
                          }}
                        >
                          <div className="annotation-header" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                          }}>
                            <div className="annotation-info" style={{
                              display: 'flex',
                              flexDirection: 'column',
                              flex: 1
                            }}>
                              {/* 편집 가능한 주석 이름만 표시 */}
                              <div style={{ marginBottom: '2px' }}>
                                {editingAnnotationId === annotation.annotationUID ? (
                                  <input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onKeyPress={handleAnnotationKeyPress}
                                    onBlur={saveAnnotationEdit}
                                    autoFocus
                                    style={{
                                      border: '1px solid #3b82f6',
                                      borderRadius: '4px',
                                      padding: '4px 8px',
                                      fontSize: '14px',
                                      width: '100%',
                                      background: '#fff',
                                      outline: 'none',
                                      fontWeight: '500'
                                    }}
                                    placeholder="주석 이름 입력..."
                                  />
                                ) : (
                                  <span
                                    className="annotation-name"
                                    onClick={() => startEditingAnnotation(
                                      annotation.annotationUID,
                                      annotation.data?.label || annotation.data?.text || `${annotation.toolName} #${index + 1}`
                                    )}
                                    style={{
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      fontWeight: '500',
                                      color: 'rgb(16, 185, 129)',
                                      padding: '4px 6px',
                                      transition: 'background-color 0.2s',
                                      display: 'inline-block',
                                      minHeight: '24px',
                                      minWidth: '60px',
                                      width: '100%'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                    title="클릭하여 이름 편집"
                                  >
                                    {annotation.data?.label || annotation.data?.text || `${annotation.toolName} #${index + 1}`}
                                  </span>
                                )}
                              </div>
                              
                              {/* 도구 정보 div 숨김 처리 */}
                              <div style={{ display: 'none' }}>
                                <span className="annotation-tool" style={{ fontSize: '11px', color: '#888' }}>
                                  {annotation.toolName}
                                </span>
                                <span className="annotation-id" style={{ fontSize: '11px', color: '#888' }}>
                                  #{index + 1}
                                </span>
                              </div>
                            </div>
                            
                            <button
                              className="annotation-delete-btn"
                              onClick={() => {
                                debugLogger.log(`🗑️ 주석 삭제 요청: ${annotation.annotationUID}`);
                                removeAnnotation(annotation.annotationUID);
                              }}
                              title="주석 삭제"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 하단 고정 버튼 */}
                    <div style={{ 
                      paddingTop: '8px', 
                      borderTop: '1px solid #e5e7eb',
                      textAlign: 'center',
                      flexShrink: 0 // 버튼이 축소되지 않도록
                    }}>
                      <button 
                        onClick={clearAllAnnotations}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          width: '100%'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#dc2626';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ef4444';
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
                      <input 
                        type="checkbox" 
                        checked={annotationsVisible}
                        onChange={() => {
                          console.log('🔧 주석 표시 체크박스 클릭됨');
                          toggleAnnotationsVisibility();
                        }}
                      />
                      주석 표시
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      <input 
                        type="checkbox" 
                        checked={panZoomEnabled}
                        onChange={(e) => {
                          debugLogger.log(`🔧 팬/줌 모드 토글: ${e.target.checked}`);
                          handlePanZoomToggle(e.target.checked);
                        }}
                      />
                      팬/줌 활성화
                    </label>
                  </div>
                  <div className="setting-item">
                    <label>
                      활성 도구: <strong>{activeTool || 'None'}</strong>
                    </label>
                  </div>
                  {panZoomEnabled && (
                    <div className="setting-item">
                      <small style={{ color: '#888', fontSize: '12px' }}>
                        💡 왼쪽 버튼: Pan, 오른쪽 버튼: Zoom
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Main Viewer Area */}
        <main className={`main-content ${sidebarOpen ? 'with-sidebar' : ''}`}>
          {/* Toolbar */}
          <div className="toolbar">
            {/* Basic Tools Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">기본 도구</label>
              <div className="toolbar-group">
                {[
                  { tool: 'Pan', abbrev: 'P', tooltip: 'Pan Tool - 화면 이동' },
                  { tool: 'Zoom', abbrev: 'Z', tooltip: 'Zoom Tool - 확대/축소' },
                  { tool: 'WindowLevel', abbrev: 'W', tooltip: 'Window Level Tool - 창 레벨 조정' },
                  { tool: 'Magnify', abbrev: 'G', tooltip: 'Magnify Tool - 돋보기' },
                ].map(({ tool, abbrev, tooltip }) => (
                  <button
                    key={tool}
                    className={`toolbar-button ${activeTool === tool ? 'active' : ''}`}
                    onClick={() => setActiveTool(tool)}
                    disabled={isLoading}
                    title={tooltip}
                  >
                    <span className="toolbar-button-text">{abbrev}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Measurement Tools Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">측정 도구</label>
              <div className="toolbar-group">
                {[
                  { tool: 'Length', abbrev: 'L', tooltip: 'Length Tool - 길이 측정' },
                  { tool: 'Angle', abbrev: 'A', tooltip: 'Angle Tool - 각도 측정' },
                  { tool: 'CobbAngle', abbrev: 'C', tooltip: 'Cobb Angle Tool - 콥 각도' },
                  { tool: 'Bidirectional', abbrev: 'B', tooltip: 'Bidirectional Tool - 양방향 측정' },
                ].map(({ tool, abbrev, tooltip }) => (
                  <button
                    key={tool}
                    className={`toolbar-button ${activeTool === tool ? 'active' : ''}`}
                    onClick={() => setActiveTool(tool)}
                    disabled={isLoading}
                    title={tooltip}
                  >
                    <span className="toolbar-button-text">{abbrev}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ROI Tools Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">ROI 도구</label>
              <div className="toolbar-group">
                {[
                  { tool: 'RectangleROI', abbrev: 'R', tooltip: 'Rectangle ROI - 사각형 관심영역' },
                  { tool: 'EllipticalROI', abbrev: 'E', tooltip: 'Elliptical ROI - 타원형 관심영역' },
                  { tool: 'CircleROI', abbrev: 'O', tooltip: 'Circle ROI - 원형 관심영역' },
                ].map(({ tool, abbrev, tooltip }) => (
                  <button
                    key={tool}
                    className={`toolbar-button ${activeTool === tool ? 'active' : ''}`}
                    onClick={() => setActiveTool(tool)}
                    disabled={isLoading}
                    title={tooltip}
                  >
                    <span className="toolbar-button-text">{abbrev}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Drawing Tools Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">고급 그리기</label>
              <div className="toolbar-group">
                {[
                  { tool: 'PlanarFreehandROI', abbrev: 'F', tooltip: 'Freehand ROI - 자유곡선 그리기' },
                  { tool: 'SplineROI', abbrev: 'S', tooltip: 'Spline ROI - 스플라인 곡선' },
                ].map(({ tool, abbrev, tooltip }) => (
                  <button
                    key={tool}
                    className={`toolbar-button ${activeTool === tool ? 'active' : ''}`}
                    onClick={() => setActiveTool(tool)}
                    disabled={isLoading}
                    title={tooltip}
                  >
                    <span className="toolbar-button-text">{abbrev}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Annotation Tools Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">주석 도구</label>
              <div className="toolbar-group">
                {[
                  { tool: 'ArrowAnnotate', abbrev: 'T', tooltip: 'Text Annotation - 텍스트 주석 (화살표 + 텍스트)' },
                  { tool: 'Probe', abbrev: 'I', tooltip: 'Probe Tool - 정보 탐침' },
                ].map(({ tool, abbrev, tooltip }) => (
                  <button
                    key={tool}
                    className={`toolbar-button ${activeTool === tool ? 'active' : ''}`}
                    onClick={() => setActiveTool(tool)}
                    disabled={isLoading}
                    title={tooltip}
                  >
                    <span className="toolbar-button-text">{abbrev}</span>
                  </button>
                ))}
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
            className={`viewport-container ${isDragging ? 'dragging' : ''}`}
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

              {/* DICOM 렌더러 */}
              {loadedFiles.length > 0 && !isDragging && (
                <DicomRenderer 
                  files={loadedFiles}
                  onError={handleRenderingError}
                  onSuccess={handleRenderingSuccess}
                />
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

              {/* 렌더링 성공 표시 */}
              {renderingSuccess && !isDragging && (
                <div style={{ 
                  position: 'absolute', 
                  bottom: '20px', 
                  right: '20px', 
                  background: 'rgba(16, 185, 129, 0.9)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  zIndex: 1000
                }}>
                  ✓ {loadedFiles.length}개 파일 렌더링 완료
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;