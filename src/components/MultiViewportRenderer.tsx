/**
 * Multi-Viewport Renderer Component
 * 
 * 기존 뷰포트 내에서 동적 그리드 레이아웃을 제공하는 컴포넌트
 * 단일 이미지, 1x2, 2x2 레이아웃 지원
 * 
 * 수정: WebGL 컨텍스트 과다 생성 방지를 위해 단일 DicomRenderer 사용
 */

import React, { useEffect, useRef, useState } from 'react';
import { DicomRenderer } from './DicomRenderer';
import { Grid, Monitor } from 'lucide-react';

interface MultiViewportRendererProps {
  files: File[];
  selectedFiles: File[];
  layout: 'single' | '1x2' | '2x2';
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
  className?: string;
}

const MultiViewportRenderer: React.FC<MultiViewportRendererProps> = ({
  files,
  selectedFiles,
  layout,
  onError,
  onSuccess,
  className = ''
}) => {
  // 단일 이미지 또는 레이아웃에 따라 처리
  if (layout === 'single' || selectedFiles.length <= 1) {
    // 단일 뷰포트 - 기존 DicomRenderer 사용
    return (
      <div className={`single-viewport-container ${className}`} style={{ width: '100%', height: '100%' }}>
        <DicomRenderer
          files={selectedFiles.length > 0 ? selectedFiles : files.slice(0, 1)}
          onError={onError}
          onSuccess={onSuccess}
        />
      </div>
    );
  }

  // 다중 뷰포트 - CSS Grid로 레이아웃 분할하고 단일 DicomRenderer 사용
  const getGridStyle = () => {
    switch (layout) {
      case '1x2':
        return {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr',
          gap: '4px',
          width: '100%',
          height: '100%'
        };
      case '2x2':
        return {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: '4px',
          width: '100%',
          height: '100%'
        };
      default:
        return {
          display: 'grid',
          gridTemplateColumns: '1fr',
          gridTemplateRows: '1fr',
          gap: '4px',
          width: '100%',
          height: '100%'
        };
    }
  };

  const displayCount = layout === '2x2' ? 4 : 2;
  const displayFiles = selectedFiles.slice(0, displayCount);

  // 뷰포트 오버레이 컴포넌트
  const ViewportOverlay: React.FC<{ file?: File; index: number }> = ({ file, index }) => (
    <div
      className="viewport-overlay"
      style={{
        position: 'relative',
        backgroundColor: file ? 'transparent' : '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* 뷰포트 번호 */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 10
        }}
      >
        {index + 1}
      </div>

      {/* 파일명 또는 빈 상태 */}
      {file ? (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            maxWidth: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}
        >
          {file.name}
        </div>
      ) : (
        <div style={{ color: '#666', fontSize: '14px', textAlign: 'center' }}>
          <Monitor size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <div>Viewport {index + 1}</div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>
            No file selected
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`multi-viewport-container ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 백그라운드 DicomRenderer - 첫 번째 파일만 */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <DicomRenderer
          files={[displayFiles[0]]}
          onError={onError}
          onSuccess={onSuccess}
        />
      </div>

      {/* 그리드 오버레이 */}
      <div style={{ ...getGridStyle(), position: 'absolute', top: 0, left: 0, zIndex: 2 }}>
        {Array.from({ length: displayCount }).map((_, index) => {
          const file = displayFiles[index];
          return (
            <ViewportOverlay key={`overlay-${index}`} file={file} index={index} />
          );
        })}
      </div>

      {/* 레이아웃 안내 */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          zIndex: 10
        }}
      >
        Layout: {layout.toUpperCase()} | Files: {displayFiles.length}/{displayCount}
      </div>
    </div>
  );
};

export default MultiViewportRenderer;