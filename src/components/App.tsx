/**
 * Main App Component
 * 메인 애플리케이션 컴포넌트 - Cornerstone3D 통합 포함
 */

import { cn } from '@/lib/utils';
import { useCornerstone } from '@/hooks/useCornerstone';
import { UnifiedViewer } from './UnifiedViewer';

export function App(): React.JSX.Element {
  const { isInitialized } = useCornerstone();

  if (!isInitialized) {
    return (
      <div className={cn('min-h-screen bg-background text-foreground flex items-center justify-center p-8')}>
        <div className='max-w-md text-center'>
          <h1 className='text-2xl font-bold mb-4'>초기화 중...</h1>
          <div className='bg-card p-6 rounded-lg border'>
            <p>Cornerstone3D를 초기화하고 있습니다</p>
            <p className='text-sm text-muted-foreground mt-2'>잠시만 기다려주세요...</p>
          </div>
        </div>
      </div>
    );
  }

  return <UnifiedViewer />;
}
