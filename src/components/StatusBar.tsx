/**
 * StatusBar Component
 * 시스템 상태 표시와 정보 디스플레이를 위한 하단 상태바
 * shadcn/ui 컴포넌트로 구축됨
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Button } from './ui/button';

interface StatusBarProps {
  className?: string;
  isCornerstone3DReady?: boolean;
}

interface SystemStatus {
  memoryUsage: number;
  renderingFPS: number;
  loadedImages: number;
  totalImages: number;
  activeTools: string[];
  currentViewport: string;
  zoomLevel: number;
  windowLevel: { width: number; center: number };
}

export const StatusBar: React.FC<StatusBarProps> = ({ className, isCornerstone3DReady = false }) => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    memoryUsage: 65,
    renderingFPS: 60,
    loadedImages: 45,
    totalImages: 120,
    activeTools: ['Pan', 'Zoom'],
    currentViewport: 'Axial',
    zoomLevel: 100,
    windowLevel: { width: 400, center: 40 },
  });

  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    // 현재 시간 업데이트
    const updateTime = (): void => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ko-KR'));
    };

    updateTime();
    const timeInterval = setInterval(updateTime, 1000);

    // 시스템 상태 시뮬레이션 (실제로는 Cornerstone3D에서 데이터를 가져와야 함)
    const statusInterval = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        memoryUsage: Math.max(30, Math.min(90, prev.memoryUsage + (Math.random() - 0.5) * 5)),
        renderingFPS: Math.max(30, Math.min(60, prev.renderingFPS + (Math.random() - 0.5) * 2)),
      }));
    }, 2000);

    return (): void => {
      clearInterval(timeInterval);
      clearInterval(statusInterval);
    };
  }, []);

  const getMemoryStatusColor = (usage: number): 'default' | 'secondary' | 'destructive' => {
    if (usage > 80) {
      return 'destructive';
    }
    if (usage > 60) {
      return 'secondary';
    }
    return 'default';
  };

  const getFPSStatusColor = (fps: number): 'default' | 'secondary' | 'destructive' => {
    if (fps < 30) {
      return 'destructive';
    }
    if (fps < 50) {
      return 'secondary';
    }
    return 'default';
  };

  return (
    <Card
      className={cn(
        'border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'rounded-none border-x-0 border-b-0',
        className,
      )}
    >
      <div className='px-4 py-2 flex items-center justify-between text-sm'>
        {/* 왼쪽: 시스템 상태 */}
        <div className='flex items-center space-x-4'>
          {/* Cornerstone3D 상태 */}
          <div className='flex items-center space-x-2'>
            <div className={cn('w-2 h-2 rounded-full', isCornerstone3DReady ? 'bg-green-500' : 'bg-yellow-500')} />
            <span className='text-xs'>{isCornerstone3DReady ? 'Cornerstone3D 준비됨' : '초기화 중...'}</span>
          </div>

          <Separator orientation='vertical' className='h-4' />

          {/* 메모리 사용량 */}
          <div className='flex items-center space-x-2'>
            <span className='text-xs text-muted-foreground'>메모리:</span>
            <Badge variant={getMemoryStatusColor(systemStatus.memoryUsage)} className='text-xs'>
              {systemStatus.memoryUsage.toFixed(0)}%
            </Badge>
          </div>

          {/* FPS */}
          <div className='flex items-center space-x-2'>
            <span className='text-xs text-muted-foreground'>FPS:</span>
            <Badge variant={getFPSStatusColor(systemStatus.renderingFPS)} className='text-xs'>
              {systemStatus.renderingFPS.toFixed(0)}
            </Badge>
          </div>

          {/* 이미지 로딩 상태 */}
          {systemStatus.totalImages > 0 && (
            <>
              <Separator orientation='vertical' className='h-4' />
              <div className='flex items-center space-x-2'>
                <span className='text-xs text-muted-foreground'>이미지:</span>
                <span className='text-xs font-mono'>
                  {systemStatus.loadedImages}/{systemStatus.totalImages}
                </span>
                <Progress value={(systemStatus.loadedImages / systemStatus.totalImages) * 100} className='w-16 h-2' />
              </div>
            </>
          )}
        </div>

        {/* 중앙: 뷰포트 정보 */}
        <div className='flex items-center space-x-4'>
          {/* 활성 도구 */}
          {systemStatus.activeTools.length > 0 && (
            <div className='flex items-center space-x-2'>
              <span className='text-xs text-muted-foreground'>도구:</span>
              <div className='flex space-x-1'>
                {systemStatus.activeTools.map(tool => (
                  <Badge key={tool} variant='outline' className='text-xs'>
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator orientation='vertical' className='h-4' />

          {/* 뷰포트 정보 */}
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-1'>
              <span className='text-xs text-muted-foreground'>뷰:</span>
              <Badge variant='secondary' className='text-xs'>
                {systemStatus.currentViewport}
              </Badge>
            </div>

            <div className='flex items-center space-x-1'>
              <span className='text-xs text-muted-foreground'>확대:</span>
              <span className='text-xs font-mono'>{systemStatus.zoomLevel}%</span>
            </div>

            <div className='flex items-center space-x-1'>
              <span className='text-xs text-muted-foreground'>W/L:</span>
              <span className='text-xs font-mono'>
                {systemStatus.windowLevel.width}/{systemStatus.windowLevel.center}
              </span>
            </div>
          </div>
        </div>

        {/* 오른쪽: 시간 및 컨트롤 */}
        <div className='flex items-center space-x-4'>
          <div className='text-xs text-muted-foreground'>DICOM 의료 영상 뷰어 v0.0.0</div>

          <Separator orientation='vertical' className='h-4' />

          <div className='text-xs font-mono'>{currentTime}</div>

          {/* 상태 설정 버튼 */}
          <Button variant='ghost' size='sm' className='h-6 px-2 text-xs'>
            설정
          </Button>
        </div>
      </div>
    </Card>
  );
};
