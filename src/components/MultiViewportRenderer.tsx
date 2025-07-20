/**
 * Multi-Viewport Renderer Component
 * 
 * 기존 뷰포트 내에서 동적 그리드 레이아웃을 제공하는 컴포넌트
 * 단일 이미지, 1x2, 2x2 레이아웃 지원
 * 
 * 수정: 각 뷰포트에 독립적인 DicomViewport 사용 (useDicomLoader 충돌 방지)
 */

import React, { useEffect, useRef, useState } from 'react';
import { DicomViewport } from './DicomViewport';
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
  // 🔍 디버그 로그
  console.log('🔍 MultiViewportRenderer Props:', {
    filesCount: files.length,
    selectedFilesCount: selectedFiles.length,
    layout,
    selectedFileNames: selectedFiles.map(f => f.name)
  });

  // 단일 이미지 처리 - DicomViewport 직접 사용 (useDicomLoader 충돌 방지)
  if (layout === 'single' || selectedFiles.length <= 1) {
    // 요구사항: 체크된 파일만 표시, 체크가 없으면 빈 상태
    const file = selectedFiles.length > 0 ? selectedFiles[0] : null;
    console.log('🔍 Single viewport - file:', file?.name || 'null');
    return (
      <div className={`single-viewport-container ${className}`} style={{ width: '100%', height: '100%' }}>
        {file ? (
          <DicomViewport
            viewportId="single-viewport"
            renderingEngineId="single-rendering-engine"
            file={file}
            onError={onError}
            onSuccess={onSuccess}
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
            fontSize: '16px'
          }}>
            {files.length > 0 ? 'Select files to display' : 'No files loaded'}
          </div>
        )}
      </div>
    );
  }

  // 다중 뷰포트 - CSS Grid로 레이아웃 분할하고 각각 독립적인 DicomViewport 사용
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
    <div className={`multi-viewport-container ${className}`} style={getGridStyle()}>
      {Array.from({ length: displayCount }).map((_, index) => {
        const file = displayFiles[index];
        const viewportId = `viewport-${index}`;
        const renderingEngineId = `rendering-engine-${index}`;
        
        return (
          <div key={`viewport-${index}`} style={{ 
            position: 'relative',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden',
            minHeight: '200px'
          }}>
            {/* 뷰포트 번호 */}
            <div style={{
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
            }}>
              {index + 1}
            </div>

            {/* 파일이 있으면 DicomViewport, 없으면 빈 상태 */}
            {file ? (
              <>
                <DicomViewport
                  viewportId={viewportId}
                  renderingEngineId={renderingEngineId}
                  file={file}
                  onError={onError}
                  onSuccess={onSuccess}
                />
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  zIndex: 10
                }}>
                  {file.name}
                </div>
              </>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666',
                fontSize: '14px'
              }}>
                <div>Viewport {index + 1}</div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                  No file selected
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MultiViewportRenderer;