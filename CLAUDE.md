# Cornerstone3D DICOM Viewer - Development Guide

## ⚠️ 강제 준수 규정 (MANDATORY COMPLIANCE RULES)

### 🚨 CORNERSTONE3D 버전 호환성 체크리스트 (코드 수정 전 필수 확인)

**모든 Cornerstone3D 관련 코드 작성/수정 시 반드시 다음을 확인할 것:**

#### 1. **버전 확인 강제 절차**
```bash
# 코드 작성 전 MANDATORY 체크
npm list @cornerstonejs/core @cornerstonejs/dicom-image-loader @cornerstonejs/tools
```

#### 2. **API 패턴 강제 검증**
**❌ 절대 사용 금지 (v1.x 패턴):**
- `cornerstone.loadAndCacheImage()` 
- `cornerstone.displayImage()`
- `cornerstone.loadImage()`
- 직접 blob URL 사용: `imageId = URL.createObjectURL(file)`

**✅ 반드시 사용 (v3.x 패턴):**
- `dicomImageLoader.wadouri.fileManager.add(file)`
- `viewport.setStack([imageId], 0)`
- `renderingEngine.getViewport(id)`
- `new cornerstone.RenderingEngine(id)`

#### 3. **초기화 패턴 강제 규칙**
```typescript
// ✅ MANDATORY: 싱글톤 패턴으로 RenderingEngine 관리
let renderingEngine: cornerstone.RenderingEngine | null = null;

// ❌ FORBIDDEN: 매번 새로운 인스턴스 생성
const renderingEngine = new cornerstone.RenderingEngine(`random-${Date.now()}`);
```

#### 4. **Context7 문서 검증 강제**
**Cornerstone3D 관련 코드 작성 시 반드시:**
1. Context7에서 최신 문서 확인
2. 예제 코드와 비교 검증  
3. 버전별 차이점 확인

#### 5. **단순화 우선 원칙**
**복잡한 구조 대신 단순 구조 우선:**
- 최소 의존성으로 독립 테스트 컴포넌트 작성
- 성공 후 점진적 통합
- 각 단계별 검증 필수

### 🔒 코드 수정 전 강제 체크리스트

**모든 Cornerstone3D 관련 수정 전 반드시 확인:**
- [ ] 현재 설치된 라이브러리 버전 확인
- [ ] Context7에서 해당 버전 문서 확인  
- [ ] v1.x 패턴 사용하지 않았는지 검증
- [ ] 싱글톤 패턴으로 RenderingEngine 관리하는지 확인
- [ ] 단순한 테스트 컴포넌트부터 시작하는지 확인

### 📋 실패 패턴 기록 (학습용)

**절대 반복하지 말 것:**
1. **버전 불일치**: v3.x 라이브러리에 v1.x API 사용
2. **복잡한 아키텍처**: 처음부터 복잡한 컴포넌트 통합 시도  
3. **WebGL Context 오버플로우**: RenderingEngine 중복 생성
4. **비동기 처리 누락**: 초기화 완료 전 이미지 로딩 시도
5. **잘못된 ImageId**: wadouri 프로토콜 미사용

### 🎯 강제 개발 프로세스 (MANDATORY DEVELOPMENT PROCESS)

**Cornerstone3D 관련 모든 작업 시 다음 순서를 강제로 준수:**

#### Step 1: 사전 검증 (PRE-VALIDATION)
```bash
# 1. 버전 확인
npm list @cornerstonejs/core @cornerstonejs/dicom-image-loader @cornerstonejs/tools

# 2. Context7 문서 확인 필수
# Cornerstone3D 최신 패턴 및 예제 검토
```

#### Step 2: 격리된 테스트 컴포넌트 작성 (ISOLATED TESTING)
```typescript
// 반드시 독립적인 테스트 컴포넌트부터 시작
// 예: SimpleDicomTest.tsx, MinimalCornerstoneTest.tsx
// 복잡한 기존 컴포넌트 수정 금지
```

#### Step 3: 단계별 통합 (GRADUAL INTEGRATION)  
```typescript
// 테스트 성공 후에만 기존 컴포넌트 통합
// 한 번에 하나씩 점진적 통합
// 각 단계마다 동작 검증
```

#### Step 4: 검증 및 문서화 (VALIDATION & DOCUMENTATION)
```typescript
// 성공 패턴을 문서화하여 재사용
// 실패 패턴을 기록하여 재발 방지
```

### 🚫 금지 행위 (FORBIDDEN ACTIONS)

**다음 행위는 절대 금지:**
1. **버전 확인 없이** Cornerstone3D 코드 작성
2. **Context7 문서 확인 없이** API 사용
3. **격리 테스트 없이** 복잡한 컴포넌트에 직접 통합
4. **이전 실패 패턴 재사용** (v1.x API 등)
5. **WebGL Context 관리 무시** (RenderingEngine 중복 생성)

### ⚡ 응급 디버깅 프로토콜 (EMERGENCY DEBUGGING)

**Cornerstone3D 관련 문제 발생 시:**
1. **즉시 격리**: 문제 컴포넌트를 독립 테스트로 분리
2. **버전 재확인**: `npm list` 로 설치된 버전 확인
3. **Context7 재검토**: 해당 기능의 최신 문서 확인
4. **단순화**: 최소 기능으로 축소하여 테스트
5. **단계적 복원**: 성공 후 점진적으로 기능 추가

---

## Project Overview

Advanced medical imaging viewer built on Cornerstone3D v3.x architecture providing comprehensive DICOM visualization, annotation, measurement, and analysis capabilities for healthcare professionals.

## Key Features

### Core Capabilities
- **DICOM Loading & Display**: Support for 95+ DICOM SOP classes
- **Multi-viewport Management**: Stack and volume viewport rendering
- **Annotation Tools**: Length, angle, area measurements with mm precision
- **Volume Rendering**: 3D visualization with MPR support
- **Security**: Medical-grade security and HIPAA compliance

### Technology Stack
- **Frontend**: React 18+ with TypeScript 5+
- **Rendering**: Cornerstone3D v3.x
- **Build Tool**: Vite with TypeScript
- **State Management**: Zustand
- **Medical Imaging**: CornerstoneJS Tools for annotations

## Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Production build
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # TypeScript checking
```

## Project Structure

```
src/
├── components/         # React components
│   ├── DicomViewer.tsx    # Main DICOM viewer
│   ├── Viewport.tsx       # Viewport management
│   └── Toolbar.tsx        # Tool selection
├── core/              # Cornerstone3D integration
│   ├── init.ts           # Cornerstone initialization
│   ├── imageLoader.ts    # DICOM image loading
│   └── viewport.ts       # Viewport management
├── tools/             # Annotation tools
│   ├── measurementTools.ts
│   └── annotationManager.ts
├── utils/             # Utilities
└── types/             # TypeScript definitions
```

## Core Dependencies

```json
{
  "@cornerstonejs/core": "^1.77.9",
  "@cornerstonejs/tools": "^1.77.9", 
  "@cornerstonejs/dicom-image-loader": "^1.77.9",
  "react": "^18.2.0",
  "typescript": "^5.2.2"
}
```

## Security Considerations

- Medical-grade security headers
- Input validation and sanitization
- XSS protection mechanisms
- HIPAA compliance measures
- Secure DICOM data handling

## Performance Requirements

- **Initial Load**: <3 seconds for application startup
- **Image Loading**: <2 seconds for average DICOM image  
- **Viewport Rendering**: 60fps for smooth interactions
- **Memory Usage**: <2GB for typical study viewing

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
