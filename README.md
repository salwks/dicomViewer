# 🏥 CornerstoneJS DICOM Viewer

A modern, web-based DICOM medical imaging viewer built with CornerstoneJS 3D, featuring advanced measurement tools and annotation capabilities.

## 📋 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [설치 방법](#설치-방법)
- [사용 방법](#사용-방법)
- [프로젝트 구조](#프로젝트-구조)
- [API 참조](#api-참조)
- [기술 스택](#기술-스택)
- [개발 및 빌드](#개발-및-빌드)
- [변경사항 리포트](#변경사항-리포트)

## 개요

CornerstoneJS DICOM Viewer는 의료 영상을 웹 브라우저에서 직접 볼 수 있는 강력한 DICOM 뷰어입니다. 
CornerstoneJS 3D 라이브러리를 기반으로 구축되어 고성능 의료 영상 처리와 다양한 측정 도구를 제공합니다.

### 🎯 주요 특징

- **웹 기반**: 별도 설치 없이 브라우저에서 바로 사용
- **실시간 측정**: mm 단위의 정확한 길이 측정
- **다양한 도구**: 길이, 면적, 각도 측정 및 주석 기능
- **직관적 UI**: 드래그 앤 드롭으로 간편한 파일 로딩
- **고성능 렌더링**: GPU 가속을 통한 부드러운 영상 처리

## 주요 기능

### 🔧 핵심 기능

#### DICOM 파일 지원
- **다양한 포맷**: .dcm, .dicom 등 표준 DICOM 파일 지원
- **드래그 앤 드롭**: 파일을 브라우저로 끌어다 놓기만 하면 로딩
- **메타데이터 확인**: DICOM 태그 정보 상세 조회

#### 영상 조작 도구
- **윈도우/레벨 조정**: 영상 밝기와 대비 실시간 조정
- **확대/축소**: 마우스 휠로 자유로운 확대/축소
- **팬**: 드래그로 영상 이동
- **회전/반전**: 90도 회전 및 수평/수직 반전

#### 측정 및 주석 도구
- **길이 측정**: mm 단위의 정확한 거리 측정
- **면적 측정**: 사각형, 원형, 자유형 ROI 면적 계산
- **각도 측정**: 두 선분 간의 각도 측정
- **주석 관리**: 측정값에 라벨 추가 및 편집

#### 고급 기능
- **뷰포트 캡처**: 주석이 포함된 PNG 이미지 저장
- **라이선스 정보**: 오픈소스 라이선스 확인
- **반응형 UI**: 다양한 화면 크기에 최적화

### 📱 사용자 인터페이스

- **어두운 테마**: 의료 영상 관찰에 적합한 다크 테마 적용
- **직관적인 툴바**: 도구별 그룹화 및 아이콘 기반 인터페이스
- **사이드바**: 파일 업로드, 상태 정보, 주석 관리 통합
- **반응형 레이아웃**: 다양한 화면 크기에 최적화된 인터페이스

## 설치 방법

### 시스템 요구사항

- **Node.js**: 16.0 이상
- **npm**: 7.0 이상
- **브라우저**: Chrome 80+, Firefox 75+, Safari 13+

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/cornerstone3d-viewer.git
cd cornerstone3d-viewer
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

### 4. 프로덕션 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

## 사용 방법

### 🚀 기본 사용법

#### 1. DICOM 파일 로딩

**방법 1: 드래그 앤 드롭**
1. DICOM 파일(.dcm)을 준비합니다
2. 브라우저 창으로 파일을 끌어다 놓습니다
3. 자동으로 파일이 로딩되고 영상이 표시됩니다

**방법 2: 파일 선택**
1. 상단의 "Upload" 버튼을 클릭합니다
2. 파일 탐색기에서 DICOM 파일을 선택합니다
3. "열기"를 클릭하여 파일을 로딩합니다

#### 2. 영상 조작

**기본 조작**
- **확대/축소**: 마우스 휠 사용
- **이동**: 마우스 왼쪽 버튼으로 드래그
- **윈도우/레벨**: 마우스 오른쪽 버튼으로 드래그

**도구 사용**
- **팬 도구**: 영상을 자유롭게 이동
- **줌 도구**: 특정 영역을 확대
- **윈도우/레벨**: 영상의 밝기와 대비 조정

#### 3. 측정 도구 사용

**길이 측정**
1. 툴바에서 "Length" 도구를 선택합니다
2. 측정 시작점을 클릭합니다
3. 측정 끝점을 클릭하여 완료합니다
4. 결과가 mm 단위로 표시됩니다

**면적 측정**
1. "Rectangle ROI" 또는 "Circle ROI" 도구를 선택합니다
2. 측정할 영역을 드래그하여 선택합니다
3. 면적이 자동으로 계산되어 표시됩니다

**각도 측정**
1. "Angle" 도구를 선택합니다
2. 각도의 꼭짓점을 클릭합니다
3. 첫 번째 선분의 끝점을 클릭합니다
4. 두 번째 선분의 끝점을 클릭하여 완료합니다

#### 4. 주석 관리

**주석 편집**
1. 사이드바의 주석 목록에서 편집할 주석을 클릭합니다
2. 새로운 이름을 입력하고 Enter를 누릅니다
3. 변경사항이 자동으로 저장됩니다

**주석 삭제**
1. 삭제할 주석 옆의 "✕" 버튼을 클릭합니다
2. 해당 주석이 영상과 목록에서 제거됩니다

### 📸 화면 캡처

1. 원하는 측정과 주석을 완료합니다
2. 툴바의 카메라 아이콘을 클릭합니다
3. 주석이 포함된 PNG 이미지가 자동으로 다운로드됩니다

### 📊 메타데이터 확인

1. 사이드바의 "Meta Tags" 버튼을 클릭합니다
2. DICOM 파일의 상세 정보를 확인할 수 있습니다
3. 환자 정보, 촬영 조건 등의 메타데이터를 볼 수 있습니다

## 프로젝트 구조

```
src/
├── components/               # React 컴포넌트
│   ├── DicomRenderer.tsx    # 메인 DICOM 렌더러
│   ├── DicomViewport.tsx    # 뷰포트 및 도구 관리
│   ├── DicomMetaModal.tsx   # 메타데이터 모달
│   └── LicenseModal.tsx     # 라이선스 정보 모달
├── store/                   # 상태 관리
│   └── dicom-store.ts      # Zustand 스토어
├── utils/                   # 유틸리티 함수
│   ├── debug-logger.ts     # 디버깅 로거
│   ├── cornerstone-global-init.ts # CornerstoneJS 초기화
│   ├── measurement-converter.ts   # 측정값 변환
│   └── display-unit-converter.ts  # 단위 표시 변환
├── types/                   # TypeScript 타입 정의
│   └── index.ts            # 공통 타입
├── App.tsx                 # 메인 애플리케이션
├── App.css                 # 스타일시트
└── main.tsx               # 애플리케이션 진입점
```

### 주요 컴포넌트 설명

#### DicomRenderer.tsx
- DICOM 파일 로딩 및 파싱 처리
- 파일 드래그 앤 드롭 기능
- 전역 에러 처리

#### DicomViewport.tsx
- CornerstoneJS 뷰포트 관리
- 도구 그룹 설정 및 활성화
- 주석 이벤트 처리
- 측정값 단위 변환

#### dicom-store.ts
- 애플리케이션 전역 상태 관리
- 주석 데이터 저장 및 관리
- 도구 상태 관리
- 파일 캡처 기능

## API 참조

### DicomStore 주요 메서드

#### 도구 관리
```typescript
// 도구 활성화
setActiveTool(toolName: string): void

// 뷰포트에서 도구 활성화
activateToolInViewport(toolName: string, toolGroupRef?: any): boolean
```

#### 주석 관리
```typescript
// 주석 추가
addAnnotation(annotation: RequiredAnnotationData): void

// 주석 업데이트
updateAnnotation(annotationUID: string, updates: Partial<AnnotationData>): void

// 주석 라벨 업데이트
updateAnnotationLabel(annotationUID: string, newLabel: string): void

// 주석 삭제
removeAnnotation(annotationUID: string): void

// 모든 주석 삭제
clearAllAnnotations(): void
```

#### 이미지 조작
```typescript
// 이미지 회전
rotateImage(direction: 'left' | 'right'): void

// 이미지 반전
flipImage(direction: 'horizontal' | 'vertical'): void

// 변환 초기화
resetImageTransform(): void
```

#### 캡처 기능
```typescript
// 뷰포트 PNG 캡처
captureViewportAsPng(): Promise<void>
```

### 측정값 변환

CornerstoneJS에서 제공하는 측정 데이터는 다음과 같은 구조를 가집니다:

```typescript
// CornerstoneJS 측정 데이터 구조
const stats = {
  'imageId:wadouri:blob:...': {
    length: 155.973,    // mm 단위로 이미 계산됨
    unit: "mm",
    area: 6374.482      // mm² 단위로 이미 계산됨
  }
}
```

## 기술 스택

### 프론트엔드
- **React 18**: UI 라이브러리
- **TypeScript**: 정적 타입 지원
- **Vite**: 빌드 도구 및 개발 서버
- **Zustand**: 상태 관리

### 의료 영상 처리
- **CornerstoneJS 3D**: 의료 영상 렌더링 엔진
- **CornerstoneJS Tools**: 측정 및 주석 도구
- **DICOM Parser**: DICOM 파일 파싱

### UI/UX
- **Lucide React**: 아이콘 라이브러리
- **CSS3**: 커스텀 다크 테마 스타일링
- **HTML2Canvas**: 화면 캡처

### 개발 도구
- **ESLint**: 코드 품질 관리
- **Prettier**: 코드 포맷팅
- **TypeScript**: 타입 안전성

## 개발 및 빌드

### 개발 환경 설정

```bash
# 개발 모드로 실행
npm run dev

# 타입 체크
npm run type-check

# 코드 린팅
npm run lint

# 코드 포맷팅
npm run format
```

### 빌드 및 배포

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview

# 정적 파일 서빙
npm run serve
```

### 커스터마이징

#### 새로운 측정 도구 추가

1. `DicomViewport.tsx`에서 도구 등록:
```typescript
const allTools = [
  // 기존 도구들...
  'NewMeasurementTool'
];
```

2. 툴바에 버튼 추가 (`App.tsx`):
```typescript
<button onClick={() => setActiveTool('NewMeasurementTool')}>
  <NewToolIcon size={20} />
</button>
```

#### 새로운 단위 지원

`updateAnnotationText` 함수를 수정하여 다른 측정 타입 지원:
```typescript
// Area 측정 추가
if (measurementData?.area !== undefined && measurementData.area > 0) {
  const mmSquaredText = `${measurementData.area.toFixed(1)} mm²`;
  annotation.data.text = mmSquaredText;
}
```

### 디버깅

애플리케이션은 상세한 디버깅 로그를 제공합니다:

```javascript
// 브라우저 콘솔에서 확인 가능한 로그들
console.log('📏 길이를 mm로 변환: 155.2 mm');
console.log('🔄 주석 완료 후 렌더링');
console.log('✅ 새 주석을 스토어에 추가');
```

## 브라우저 호환성

| 브라우저 | 최소 버전 | 권장 버전 |
|---------|----------|----------|
| Chrome  | 80+      | 최신      |
| Firefox | 75+      | 최신      |
| Safari  | 13+      | 최신      |
| Edge    | 80+      | 최신      |

### 알려진 제한사항

- **Internet Explorer**: 지원하지 않음
- **모바일 브라우저**: 터치 제스처 제한적 지원
- **파일 크기**: 500MB 이상의 대용량 DICOM 파일은 성능 저하 가능

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

### 오픈소스 라이브러리

- [CornerstoneJS](https://cornerstonejs.org/) - MIT License
- [React](https://reactjs.org/) - MIT License
- [Vite](https://vitejs.dev/) - MIT License

## 기여하기

프로젝트에 기여를 원하시는 분들은 다음 절차를 따라주세요:

1. 저장소를 포크합니다
2. 새로운 기능 브랜치를 생성합니다 (`git checkout -b feature/new-feature`)
3. 변경사항을 커밋합니다 (`git commit -am 'Add new feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/new-feature`)
5. Pull Request를 생성합니다

## 문의 및 지원

- **이슈 신고**: [GitHub Issues](https://github.com/your-username/cornerstone3d-viewer/issues)
- **기능 요청**: [GitHub Discussions](https://github.com/your-username/cornerstone3d-viewer/discussions)
- **문서**: [프로젝트 위키](https://github.com/your-username/cornerstone3d-viewer/wiki)

---

## 변경사항 리포트

### 🚀 최근 해결된 문제들

### 핵심 문제 해결 ✅

**1. DICOM 파일 로딩 문제**
- **문제**: 첫 번째 DICOM 파일이 무시되고 두 번째 파일부터 로드됨
- **해결**: `use-dicom-loader.ts`의 파일 처리 로직을 분석하고 0-기반 인덱싱 확인
- **파일**: 파일 처리 순서 및 상태 관리 최적화

**2. 무한 로딩 상태 문제**
- **문제**: 파일 로드 후 로딩 상태가 해제되지 않음
- **해결**: 완전한 상태 초기화 로직 구현
- **파일**: `App.tsx`의 `handleFiles` 함수 개선

**3. 보안 인증 시스템**
- **문제**: 사용자 인증 및 권한 관리 필요
- **해결**: JWT 기반 인증 시스템 구현
- **파일**: `SecurityLogin.tsx`, `LoginModern.tsx`, `SecurityDashboard.tsx`

**4. 입력 검증 및 XSS 방어**
- **문제**: 사용자 입력에 대한 보안 검증 필요
- **해결**: 포괄적인 입력 검증 시스템 구현
- **파일**: `input-validation.ts`, `xss-protection.ts`

**5. 측정 단위 표시 개선**
- **문제**: 측정 도구가 픽셀 단위로 표시됨
- **해결**: Length 도구에서 mm 단위 표시 구현
- **파일**: `DicomViewport.tsx`의 측정값 변환 로직

### 주요 기능 추가 🆕

**보안 강화 시스템**
```typescript
// 파일 접근 검사
const hasAccess = securityStore.checkFileAccess(file.name);

// 입력 검증
const validation = validateFileName(file.name, {
  logAttempts: true
});
```

**다크 테마 UI**
- **🎨 의료 영상 최적화**: 어두운 배경으로 영상 관찰 최적화
- **🔧 도구 그룹화**: 기본 도구, 측정 도구, ROI 도구 등 카테고리별 분류
- **📱 반응형 디자인**: 다양한 화면 크기에 대응

**주석 관리 시스템**
```typescript
// 주석 라벨 편집
const startEditingAnnotation = (annotationUID: string, currentLabel: string) => {
  // 보안 검증 후 편집 허용
  const validation = validateAnnotationLabel(editingValue, {
    maxLength: 100,
    sanitize: true
  });
};
```

**통합 상태 관리**
- ✅ **Zustand 스토어**: 전역 상태 관리 시스템
- ✅ **주석 관리**: 실시간 주석 추가/편집/삭제
- ✅ **이미지 조작**: 회전, 반전, 확대/축소 상태 관리
- ✅ **보안 상태**: 인증 및 권한 관리

### 기술 구현 세부사항

**측정값 mm 변환 함수**
```typescript
const updateAnnotationText = (annotation: any) => {
  try {
    if (!annotation.data?.cachedStats) return;
    
    const stats = annotation.data.cachedStats;
    const imageId = Object.keys(stats)[0];
    const measurementData = stats[imageId];
    
    if (measurementData?.length !== undefined && measurementData.length > 0) {
      const mmText = `${measurementData.length.toFixed(1)} mm`;
      annotation.data.text = mmText;
    }
  } catch (error) {
    console.log('⚠️ mm 변환 실패, 기본 표시 유지');
  }
};
```

**CornerstoneJS 데이터 구조 이해**
```typescript
// CornerstoneJS 측정 데이터 구조
stats = {
  'imageId:wadouri:blob:...': {
    length: 155.973453683961,  // 이미 mm 단위로 계산됨
    unit: "mm",
    area: 6374.482242475729    // 이미 mm² 단위로 계산됨
  }
}
```

### 보안 기능

**강화된 보안 시스템**
- **🔐 인증 시스템**: JWT 기반 사용자 인증
- **🛡️ 입력 검증**: XSS 및 악성 입력 방어
- **📝 로깅**: 보안 이벤트 추적
- **🔒 에러 처리**: 보안 정보 노출 방지

### 프로젝트 구조

**주요 수정 파일**
- `src/App.tsx` - 메인 애플리케이션 컴포넌트
- `src/App.css` - 다크 테마 스타일링
- `src/components/DicomViewport.tsx` - 핵심 렌더링 및 측정 로직
- `src/store/` - Zustand 상태 관리 스토어들
- `src/utils/` - 보안 및 유틸리티 함수들

### 현재 상태

**✅ 작동 중인 기능**
1. **DICOM 파일 로딩**: 드래그 앤 드롭 및 파일 선택
2. **측정 도구**: 길이, 각도, 면적 측정 (mm 단위)
3. **주석 관리**: 실시간 편집 및 삭제
4. **이미지 조작**: 회전, 반전, 확대/축소
5. **화면 캡처**: PNG 이미지 저장
6. **보안 인증**: 사용자 로그인 및 권한 관리

**⚪ 향후 개선사항**
1. **추가 측정 도구**: 더 많은 측정 도구 지원
2. **3D 볼륨 렌더링**: 3D 의료 영상 지원
3. **PACS 연동**: 의료 영상 시스템 통합
4. **다국어 지원**: 영어 및 기타 언어 지원

---

**Built with ❤️ using CornerstoneJS for medical imaging excellence**