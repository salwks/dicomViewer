/**
 * SimpleDicomTest - 간단한 DICOM 테스트 컴포넌트
 * 최소한의 코드로 DICOM 파일 로딩 테스트
 */

import React, { useState, useRef, useEffect } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import * as dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

// 글로벌 변수로 초기화 상태 관리
let isInitialized = false;
let renderingEngine: cornerstone.RenderingEngine | null = null;

interface SimpleDicomTestProps {
  onBackToMain?: () => void;
}

export const SimpleDicomTest: React.FC<SimpleDicomTestProps> = ({ onBackToMain }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready');
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cornerstone 초기화
  const initializeCornerstone = async () => {
    if (isInitialized) return;

    try {
      setStatus('Initializing Cornerstone...');
      
      // Cornerstone 초기화
      await cornerstone.init();
      
      // DICOM Image Loader 초기화  
      await dicomImageLoader.init({
        maxWebWorkers: 1,
      });
      
      // RenderingEngine 생성
      renderingEngine = new cornerstone.RenderingEngine('simple-test-engine');
      
      isInitialized = true;
      setStatus('Cornerstone initialized');
    } catch (error) {
      console.error('Cornerstone initialization failed:', error);
      setStatus(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // 뷰포트 설정
  const setupViewport = async () => {
    if (!renderingEngine || !viewportRef.current) return;

    try {
      setStatus('Setting up viewport...');
      
      const viewportInput = {
        viewportId: 'test-viewport',
        type: cornerstone.Enums.ViewportType.STACK,
        element: viewportRef.current,
      };

      renderingEngine.enableElement(viewportInput);
      setStatus('Viewport ready');
    } catch (error) {
      console.error('Viewport setup failed:', error);
      setStatus(`Viewport setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // 파일 로드
  const handleFileLoad = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !renderingEngine) return;

    setLoading(true);
    try {
      const file = files[0];
      setStatus(`Loading ${file.name}...`);

      // 파일을 fileManager에 추가
      const imageId = dicomImageLoader.wadouri.fileManager.add(file);
      console.log('Generated imageId:', imageId);

      // 뷰포트에 이미지 설정 - Context7 최신 패턴
      const viewport = renderingEngine.getViewport('test-viewport') as cornerstone.Types.IStackViewport;
      
      if (viewport) {
        // Context7 공식 패턴: setStack 후 즉시 render 호출
        viewport.setStack([imageId], 0);
        viewport.render();
        setStatus(`Loaded: ${file.name}`);
        
        console.log('✅ Image successfully loaded and rendered:', {
          imageId,
          viewportId: 'test-viewport',
          fileName: file.name
        });
      } else {
        setStatus('Error: Viewport not found');
        console.error('❌ Viewport not found');
      }
      
    } catch (error) {
      console.error('File loading failed:', error);
      setStatus(`Loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    const init = async () => {
      await initializeCornerstone();
      await setupViewport();
    };
    
    init();
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Simple DICOM Test</CardTitle>
              <p className="text-sm text-muted-foreground">
                Status: {status}
              </p>
            </div>
            {onBackToMain && (
              <Button variant="outline" size="sm" onClick={onBackToMain}>
                메인으로
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || !isInitialized}
              >
                {loading ? 'Loading...' : 'Select DICOM File'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dcm,.dicom,application/dicom"
                onChange={handleFileLoad}
                className="hidden"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div 
            ref={viewportRef}
            className="w-full h-96 bg-black"
            style={{ minHeight: '400px' }}
          />
        </CardContent>
      </Card>
    </div>
  );
};