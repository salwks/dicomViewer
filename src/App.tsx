import { useState, useEffect, useRef } from 'react';
import { Upload, Layout, Settings, Grid, FileText, Terminal } from 'lucide-react';
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

  const containerRef = useRef<HTMLDivElement>(null);

  // Zustand store for tool management and sidebar controls
  const { 
    activeTool, 
    setActiveTool, 
    annotations, 
    annotationsVisible, 
    panZoomEnabled,
    layoutType,
    setAnnotationsVisible,
    setPanZoomEnabled,
    setLayout,
    clearAllAnnotations
  } = useDicomStore((state) => ({
    activeTool: state.activeTool,
    setActiveTool: state.setActiveTool,
    annotations: state.annotations,
    annotationsVisible: state.annotationsVisible,
    panZoomEnabled: state.panZoomEnabled,
    layoutType: state.layoutType,
    setAnnotationsVisible: state.setAnnotationsVisible,
    setPanZoomEnabled: state.setPanZoomEnabled,
    setLayout: state.setLayout,
    clearAllAnnotations: state.clearAllAnnotations
  }));

  // 주석은 이제 Zustand 스토어에서 관리됨

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
              <div className="sidebar-section">
                <h3 className="sidebar-section-title">
                  <FileText size={16} />
                  주석 목록 ({annotations.length}개)
                </h3>
                {annotations.length > 0 ? (
                  <div className="annotations-list">
                    {annotations.slice(0, 5).map((annotation, index) => (
                      <div key={annotation.annotationUID} className="annotation-item">
                        <div className="annotation-header">
                          <span className="annotation-tool">{annotation.toolName}</span>
                          <span className="annotation-id">
                            #{index + 1}
                          </span>
                        </div>
                        {annotation.data?.text && (
                          <div className="annotation-label">
                            {annotation.data.text}
                          </div>
                        )}
                        {annotation.data?.length && (
                          <div className="annotation-label">
                            길이: {annotation.data.length.toFixed(2)}mm
                          </div>
                        )}
                      </div>
                    ))}
                    {annotations.length > 5 && (
                      <div className="info-item">
                        <span>... 및 {annotations.length - 5}개 더</span>
                      </div>
                    )}
                    <button 
                      onClick={clearAllAnnotations}
                      className="toolbar-button"
                      style={{ marginTop: '8px', fontSize: '12px' }}
                    >
                      모든 주석 지우기
                    </button>
                  </div>
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
                        onChange={(e) => {
                          debugLogger.log(`🔧 주석 표시 토글: ${e.target.checked}`);
                          setAnnotationsVisible(e.target.checked);
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
            {/* File Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">파일</label>
              <div className="toolbar-group">
                <button
                  className="toolbar-button"
                  onClick={handleFileUpload}
                  disabled={isLoading}
                  title="DICOM 파일 업로드"
                >
                  <Upload size={16} />
                  <span className="toolbar-button-text">파일 불러오기</span>
                </button>
              </div>
            </div>

            {/* Basic Tools Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">기본 도구</label>
              <div className="toolbar-group">
                {['Pan', 'Zoom', 'WindowLevel'].map((tool) => (
                  <button
                    key={tool}
                    className={`toolbar-button ${activeTool === tool ? 'active' : ''}`}
                    onClick={() => setActiveTool(tool)}
                    disabled={isLoading}
                  >
                    <span className="toolbar-button-text">{tool}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Annotation Tools Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">주석 도구</label>
              <div className="toolbar-group">
                {['Length', 'RectangleROI', 'EllipticalROI', 'ArrowAnnotate'].map((tool) => (
                  <button
                    key={tool}
                    className={`toolbar-button ${activeTool === tool ? 'active' : ''}`}
                    onClick={() => setActiveTool(tool)}
                    disabled={isLoading}
                  >
                    <span className="toolbar-button-text">
                      {tool === 'Length' ? '길이 측정' :
                       tool === 'RectangleROI' ? '사각형 ROI' :
                       tool === 'EllipticalROI' ? '타원형 ROI' :
                       tool === 'ArrowAnnotate' ? '화살표 주석' : tool}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">레이아웃</label>
              <div className="toolbar-group">
                {(['1x1', '2x2'] as const).map((layout) => (
                  <button
                    key={layout}
                    className={`toolbar-button ${layoutType === layout ? 'active' : ''}`}
                    onClick={() => {
                      debugLogger.log(`🔄 레이아웃 변경 요청: ${layout}`);
                      setLayout(layout);
                    }}
                    disabled={isLoading}
                    title={`${layout} 레이아웃으로 변경`}
                  >
                    <Grid size={16} />
                    <span className="toolbar-button-text">{layout}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Debug Section */}
            <div className="toolbar-section">
              <label className="toolbar-label">디버그</label>
              <div className="toolbar-group">
                <button
                  className="toolbar-button"
                  onClick={showDebugConsole}
                  title="디버그 로그 보기 (개발자 도구 콘솔)"
                >
                  <Terminal size={16} />
                  <span className="toolbar-button-text">디버그 로그</span>
                </button>
              </div>
            </div>
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
                <span className="layout-indicator">Layout: {layoutType}</span>
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