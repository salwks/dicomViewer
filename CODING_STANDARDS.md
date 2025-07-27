# 🚨 코드 작성 필수 준수사항 (MANDATORY)

> ⚠️ **경고**: 이 문서의 규칙은 보안과 품질을 위해 **반드시** 준수해야 합니다.
> 위반 시 커밋이 자동으로 차단됩니다.

## 🔒 1. 보안 규칙 (SECURITY RULES)

### 1.1 Object Injection 방지
```typescript
// ❌ 절대 금지
const value = obj[userInput];
config[dynamicKey] = value;

// ✅ 필수 패턴
const safeMap = new Map();
safeMap.set(key, value);

// ✅ 또는
if (Object.prototype.hasOwnProperty.call(obj, key)) {
  const value = obj[key];
}
```

### 1.2 정규식 보안
```typescript
// ❌ ReDoS 취약 패턴 금지
/(a+)+b/
/(\w+)*$/

// ✅ 안전한 패턴
/a+b/
/\w+$/
```

### 1.3 경로 검증
```typescript
// ✅ 모든 파일 경로는 검증 필수
function validatePath(path: string): boolean {
  if (path.includes('..') || path.includes('//')) {
    throw new Error('Invalid path');
  }
  return true;
}
```

## 📝 2. TypeScript 규칙 (TYPE SAFETY)

### 2.1 any 타입 완전 금지
```typescript
// ❌ 컴파일 에러
function process(data: any) { }

// ✅ 필수
function process(data: unknown) {
  if (typeof data === 'string') {
    // 타입 가드 후 사용
  }
}
```

### 2.2 함수 반환 타입 명시
```typescript
// ❌ 금지
function calculate(a: number, b: number) {
  return a + b;
}

// ✅ 필수
function calculate(a: number, b: number): number {
  return a + b;
}
```

### 2.3 Null/Undefined 체크
```typescript
// ✅ 옵셔널 체이닝 사용
const value = data?.property?.value ?? defaultValue;

// ✅ 명시적 체크
if (value !== null && value !== undefined) {
  // 사용
}
```

## 🎨 3. 스타일 시스템 사용

### 3.1 StyleManager 필수 사용
```typescript
// ❌ 직접 스타일 수정 금지
annotation.style.color = '#FF0000';

// ✅ StyleManager 사용 필수
import { StyleManager } from '@/styles/StyleManager';
const manager = StyleManager.getInstance();
manager.applyStyle(annotation, 'hover');
```

## 📋 4. 로깅 규칙

### 4.1 console.log 완전 금지
```typescript
// ❌ 커밋 차단
console.log('debug info');

// ✅ 허용된 메서드
console.warn('경고');
console.error('에러');

// ✅ 개발 전용 로거
import { debugLogger } from '@/utils/debug-logger';
debugLogger.log('개발 환경 전용');
```

## 🛡️ 5. 의존성 관리

### 5.1 Cornerstone 버전 고정
```json
{
  "dependencies": {
    "@cornerstonejs/core": "1.86.1",      // ^ 없이 정확한 버전
    "@cornerstonejs/tools": "1.86.1",     // 모든 패키지 동일 버전
    "@cornerstonejs/dicom-image-loader": "1.86.0"
  }
}
```

### 5.2 Worker 경로
```typescript
// ✅ 올바른 경로
webWorkerPath: '/cornerstone-dicom-image-loader/index.worker.bundle.min.worker.js'
```

## 🚫 6. 절대 금지사항

1. **package-lock.json 수동 편집** ❌
2. **node_modules 직접 수정** ❌
3. **타입 에러 무시 (`// @ts-ignore`)** ❌
4. **eval() 또는 Function() 생성자** ❌
5. **innerHTML 직접 사용** ❌
6. **보안 경고 무시** ❌

## ✅ 7. 커밋 전 체크리스트

- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 에러 0개
- [ ] `npm audit` moderate 이상 신규 취약점 없음
- [ ] 모든 함수에 반환 타입 명시
- [ ] any 타입 사용하지 않음
- [ ] console.log 없음
- [ ] 테스트 코드 작성 (신규 기능)

## 🔧 8. 자동 검증 도구

### Pre-commit Hook
```bash
# .husky/pre-commit 자동 실행
- TypeScript 타입 체크
- ESLint 보안 규칙
- 금지 패턴 검사
- Prettier 포맷
```

### VS Code 설정
```json
// .vscode/settings.json 자동 적용
- 저장 시 ESLint 자동 수정
- TypeScript strict 모드
- 보안 규칙 실시간 검사
```

## 📚 9. 참고 자료

- [OWASP Secure Coding](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [React Security Guidelines](https://github.com/facebook/react/wiki/Security)

---

⚠️ **이 규칙을 위반한 코드는 자동으로 거부됩니다.**