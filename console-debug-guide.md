# Console.log 디버깅 가이드

## 문제: npm run dev에서 console.log가 표시되지 않음

### 원인:
1. 프로젝트에서 의료급 구조화된 로깅 시스템 사용
2. ESLint 규칙으로 console 사용 제한
3. 커스텀 Logger가 console.log를 대체

## 해결 방법:

### 방법 1: 구조화된 Logger 사용 (권장)
```typescript
import { log } from '@/utils/logger';

// 기존: console.log('Hello World');
// 변경: 
log.info('Hello World');
log.debug('디버그 메시지');
log.warn('경고 메시지');
log.error('에러 메시지');
```

### 방법 2: 임시로 console.log 활성화
```typescript
// ESLint 규칙 무시하고 console.log 사용
// eslint-disable-next-line no-console
console.log('임시 디버그 메시지');
```

### 방법 3: 개발 환경에서만 console.log 허용
```typescript
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.log('개발 환경 디버그');
}
```

### 방법 4: Logger 레벨 조정
```typescript
import { logger, LogLevel } from '@/utils/logger';

// 개발 환경에서 모든 로그 표시
logger.setLevel(LogLevel.DEBUG);
```

## Logger 시스템 활용:

### 기본 로깅:
```typescript
import { log } from '@/utils/logger';

log.debug('디버그 정보');
log.info('일반 정보');
log.warn('경고');
log.error('에러');
```

### 의료 관련 로깅:
```typescript
log.medical('DICOM 파일 로드 완료', {
  operation: 'loadDicom',
  imageId: 'image123',
  studyInstanceUID: 'study456'
});
```

### 성능 모니터링:
```typescript
const startTime = performance.now();
// ... 작업 수행
const duration = performance.now() - startTime;
log.performance('이미지 렌더링', duration, { imageId: 'image123' });
```

### 사용자 인터랙션 로깅:
```typescript
log.interaction('사용자가 이미지 확대', {
  component: 'DicomViewer',
  viewportId: 'viewport1'
});
```

## 브라우저 개발자 도구에서 확인:

1. 브라우저에서 F12 열기
2. Console 탭 선택
3. 필터에서 로그 레벨 확인:
   - 🔍 DEBUG (파란색)
   - 📄 INFO (기본색)
   - ⚠️ WARN (노란색)
   - ❌ ERROR (빨간색)

## 로그 레벨 설정:

### 개발 환경에서 모든 로그 보기:
```typescript
import { logger, LogLevel } from '@/utils/logger';
logger.setLevel(LogLevel.DEBUG);
```

### 운영 환경에서는 에러만:
```typescript
logger.setLevel(LogLevel.ERROR);
```

## 실시간 로그 확인:
```typescript
// 최근 로그 50개 확인
logger.getRecentLogs(50);

// 로그 내보내기
logger.exportLogs();
```