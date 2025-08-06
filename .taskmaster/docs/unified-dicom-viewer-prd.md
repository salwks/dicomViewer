# 통합 DICOM 뷰어 제품 요구사항 명세서 (PRD)

## 1. 제품 개요

### 1.1 제품 비전

- **타겟**: 의료진 및 의료 영상 전문가를 위한 차세대 웹 기반 DICOM 뷰어
- **목표**: 타사 제품(OHIF, Horos, Weasis) 대비 차별화된 싱글뷰어+비교뷰어 통합 솔루션
- **핵심 가치**: 단일 인터페이스에서 모든 영상 분석 작업 완성

### 1.2 기술 스택 강제 규칙

- **Frontend**: React 18+ with TypeScript 5+
- **UI Framework**: shadcn/ui (최신 버전) - CSS 직접 작성 금지
- **의료영상 엔진**: Cornerstone3D v3.32.5 (최신 버전)
- **빌드도구**: Vite (최신 호환 버전)
- **코드 품질**: ESLint + Prettier (zero-warning 정책)

## 2. 시장 분석 및 경쟁사 벤치마크

### 2.1 주요 경쟁사 분석

#### OHIF Viewer

- **강점**: React 기반, 플러그인 아키텍처, Cornerstone3D 사용
- **약점**: 복잡한 구성, 단일/비교 뷰 전환이 번거로움
- **UI/UX**: 반응형 디자인, 다중 모니터 지원

#### Horos (macOS)

- **강점**: 직관적 인터페이스, 강력한 3D/4D 렌더링
- **약점**: macOS 전용, 웹 기반 아님
- **UI/UX**: 네이티브 macOS 디자인

#### Weasis

- **강점**: 크로스 플랫폼, 고해상도 모니터 지원
- **약점**: Java 기반으로 웹 접근성 제한
- **UI/UX**: OS별 최적화된 인터페이스

### 2.2 차별화 전략

1. **통합 워크플로**: 싱글뷰어와 비교뷰어를 하나의 인터페이스에서 매끄럽게 전환
2. **현대적 웹 기술**: React + shadcn/ui + Cornerstone3D 조합으로 최적의 성능
3. **의료진 중심 UX**: 직관적인 도구 배치와 원클릭 기능 전환

## 3. 핵심 기능 명세

### 3.1 뷰어 모드 시스템

#### 3.1.1 싱글 뷰어 모드

- **레이아웃**: 중앙 대형 뷰포트 (80% 화면 점유)
- **지원 뷰타입**:
  - Stack Viewport (2D 슬라이스)
  - Orthographic Volume Viewport (Axial/Sagittal/Coronal)
  - 3D Volume Rendering
- **기본 조작**:
  - 마우스 좌클릭: Window/Level 조정
  - 마우스 우클릭: Pan (이동)
  - 마우스 휠: Zoom 및 슬라이스 스크롤
  - 키보드 단축키: 빠른 도구 전환

#### 3.1.2 비교 뷰어 모드

- **레이아웃**: 2x2 또는 1x2 그리드 뷰포트
- **동기화 기능**:
  - Camera Synchronizer: 동일한 위치/각도 동기화
  - VOI (Window/Level) Synchronizer: 윈도우 레벨 동기화
  - 스크롤 동기화: 슬라이스 위치 동기화
- **비교 시나리오**:
  - 시간별 변화 추적 (Before/After)
  - 다른 시퀀스 비교 (T1/T2 MRI)
  - 다른 환자 케이스 비교

#### 3.1.3 모드 전환 시스템

- **원클릭 전환**: 상단 토글 버튼으로 즉시 전환
- **상태 보존**: 전환 시 현재 뷰 상태 유지
- **레이아웃 기억**: 사용자 선호 레이아웃 저장

### 3.2 영상 조작 및 분석 도구

#### 3.2.1 기본 조작 도구 (Cornerstone3D v3.32.5 기반)

- **WindowLevelTool**: 콘트라스트 및 밝기 조정
- **PanTool**: 영상 이동
- **ZoomTool**: 확대/축소
- **RotateTool**: 영상 회전
- **FlipTool**: 수평/수직 뒤집기

#### 3.2.2 측정 및 주석 도구

- **LengthTool**: 거리 측정 (mm 단위)
- **AngleTool**: 각도 측정
- **RectangleROITool**: 사각형 관심영역
- **EllipticalROITool**: 타원형 관심영역
- **BidirectionalTool**: 양방향 측정
- **ArrowAnnotateTool**: 화살표 주석
- **ProbeTool**: 픽셀 값 조사

#### 3.2.3 고급 렌더링 기능

- **MIP (Maximum Intensity Projection)**: 최대강도투영
- **MinIP (Minimum Intensity Projection)**: 최소강도투영
- **Average Intensity Projection**: 평균강도투영
- **Volume Rendering**: 3D 볼륨 렌더링
- **Multiplanar Reconstruction (MPR)**: 다평면 재구성

### 3.3 데이터 관리 및 워크플로

#### 3.3.1 DICOM 데이터 로딩

- **지원 프로토콜**: WADO-RS, WADO-URI
- **스트리밍**: 대용량 볼륨 실시간 스트리밍
- **프리페칭**: 메타데이터 우선 로딩
- **캐싱**: 스마트 메모리 관리

#### 3.3.2 시리즈 및 스터디 관리

- **시리즈 브라우저**: 썸네일 기반 시리즈 선택
- **스터디 비교**: 동일 환자의 다른 시기 스터디
- **즐겨찾기**: 자주 사용하는 시리즈 북마크

## 4. 사용자 인터페이스 설계

### 4.1 전체 레이아웃 구조 (shadcn/ui 강제 사용)

```
┌─────────────────────────────────────────────────────────┐
│                     Header Navigation                   │
│  [Logo] [Mode Toggle] [Tools] [Settings] [User Menu]   │
├─────────────────────────────────────────────────────────┤
│ Side │                                        │ Right   │
│ Panel│            Main Viewport Area          │ Panel   │
│      │                                        │         │
│ Series│     ┌─────────┐  ┌─────────┐         │ Tools   │
│ Browser│    │Viewport1│  │Viewport2│         │ &       │
│ &      │    │         │  │         │         │ Info    │
│ Study  │    └─────────┘  └─────────┘         │         │
│ Info   │     ┌─────────┐  ┌─────────┐         │         │
│        │     │Viewport3│  │Viewport4│         │         │
│        │     │         │  │         │         │         │
│        │     └─────────┘  └─────────┘         │         │
├─────────────────────────────────────────────────────────┤
│                    Status Bar                           │
│ [Progress] [Messages] [System Info] [Performance]      │
└─────────────────────────────────────────────────────────┘
```

### 4.2 shadcn/ui 컴포넌트 매핑

#### 4.2.1 필수 shadcn/ui 컴포넌트

- **Navigation**: `NavigationMenu`, `Breadcrumb`
- **Layout**: `Card`, `Separator`, `ScrollArea`
- **Controls**: `Button`, `Toggle`, `Slider`, `Select`
- **Feedback**: `Progress`, `Badge`, `Alert`, `Tooltip`
- **Data Display**: `Table`, `Tabs`, `Sheet`
- **Dialogs**: `Dialog`, `AlertDialog`, `Popover`

#### 4.2.2 컴포넌트 계층 구조

```
App (shadcn Card)
├── HeaderNavigation (shadcn NavigationMenu)
│   ├── ModeToggle (shadcn Toggle)
│   ├── ToolSelector (shadcn Select)
│   └── UserMenu (shadcn Popover)
├── MainLayout (shadcn Card)
│   ├── SidePanel (shadcn Sheet)
│   │   ├── SeriesBrowser (shadcn ScrollArea)
│   │   └── StudyInfo (shadcn Tabs)
│   ├── ViewportGrid (Custom + shadcn Card)
│   │   └── ViewportCard[] (shadcn Card)
│   └── RightPanel (shadcn Sheet)
│       ├── ToolPanel (shadcn Tabs)
│       └── MeasurementList (shadcn Table)
└── StatusBar (shadcn Card)
    ├── ProgressIndicator (shadcn Progress)
    └── StatusBadges[] (shadcn Badge)
```

### 4.3 반응형 디자인 요구사항

- **데스크톱**: 최소 1920x1080 최적화
- **태블릿**: 1024x768 이상 지원
- **고해상도**: 4K 모니터 HiDPI 지원
- **다중 모니터**: 모니터별 개별 calibration 지원

## 5. 기술적 구현 요구사항

### 5.1 Cornerstone3D v3.32.5 기능 활용

#### 5.1.1 렌더링 엔진 구성

```typescript
// 필수 구현 패턴
const renderingEngine = new RenderingEngine('mainEngine')
const viewportInputs = [
  {
    viewportId: 'viewport1',
    type: ViewportType.ORTHOGRAPHIC,
    element: htmlElement,
    defaultOptions: {
      orientation: Enums.OrientationAxis.AXIAL,
    },
  },
]
renderingEngine.setViewports(viewportInputs)
```

#### 5.1.2 도구 그룹 관리

```typescript
// ToolGroup 기반 도구 관리
const toolGroup = ToolGroupManager.createToolGroup('mainTools')
toolGroup.addTool(WindowLevelTool.toolName)
toolGroup.addViewport('viewport1', 'mainEngine')
toolGroup.setToolActive(WindowLevelTool.toolName, {
  bindings: [{ mouseButton: MouseBindings.Primary }],
})
```

#### 5.1.3 동기화 시스템

```typescript
// 뷰포트 간 동기화
const cameraSync = createCameraSynchronizer('cameraSync')
const voiSync = createVOISynchronizer('voiSync')

viewportIds.forEach(viewportId => {
  cameraSync.addSource({ renderingEngineId, viewportId })
  voiSync.addTarget({ renderingEngineId, viewportId })
})
```

### 5.2 성능 요구사항

- **초기 로딩**: 3초 이내 앱 시작
- **이미지 렌더링**: 60fps 유지
- **메모리 사용량**: 4GB 이하 (일반적인 스터디)
- **네트워크**: 점진적 로딩으로 저대역폭 지원

### 5.3 호환성 요구사항

- **브라우저**: Chrome 100+, Firefox 100+, Safari 15+, Edge 100+
- **WebGL**: WebGL 2.0 지원 필수
- **DICOM**: DICOM Part 10, DICOMweb 표준 준수

## 6. 워크플로 및 사용자 여정

### 6.1 기본 워크플로

#### 6.1.1 싱글 스터디 분석

1. **스터디 로딩**: WADO-RS URL 또는 로컬 파일
2. **시리즈 선택**: 썸네일 기반 시리즈 브라우저
3. **뷰어 모드 선택**: 싱글/비교 모드 토글
4. **영상 분석**: 조작 및 측정 도구 사용
5. **결과 저장**: 주석 및 측정값 저장

#### 6.1.2 비교 분석 워크플로

1. **첫 번째 스터디 로딩**: 베이스라인 영상
2. **비교 모드 활성화**: 뷰포트 분할
3. **두 번째 스터디 로딩**: 팔로우업 영상
4. **동기화 설정**: 카메라/윈도우레벨 동기화
5. **비교 분석**: 변화 추적 및 측정
6. **레포트 생성**: 비교 결과 문서화

### 6.2 고급 사용 시나리오

#### 6.2.1 Multi-sequence MRI 분석

- T1, T2, FLAIR 시퀀스 동시 표시
- 같은 해부학적 위치 동기화
- 시퀀스별 최적 윈도우레벨 적용

#### 6.2.2 Longitudinal Study 추적

- 시간 순서별 스터디 배열
- 병변 크기 변화 측정
- 치료 반응 평가

## 7. 데이터 모델 및 상태 관리

### 7.1 애플리케이션 상태 구조

```typescript
interface AppState {
  viewerMode: 'single' | 'comparison'
  layout: LayoutConfig
  studies: StudyData[]
  viewports: ViewportState[]
  tools: ToolState
  settings: UserSettings
}

interface ViewportState {
  id: string
  studyInstanceUID?: string
  seriesInstanceUID?: string
  viewReference: ViewReference
  presentation: ViewPresentation
  annotations: Annotation[]
}
```

### 7.2 이벤트 처리 및 상호작용

- **마우스 이벤트**: Cornerstone3D 도구 시스템 활용
- **키보드 단축키**: 도구 빠른 전환
- **터치 이벤트**: 태블릿 지원
- **동기화 이벤트**: 뷰포트 간 실시간 동기화

## 8. 품질 보증 및 테스트

### 8.1 코드 품질 강제 규칙

- **TypeScript**: strict 모드, any 타입 금지
- **ESLint**: zero-warning 정책
- **Prettier**: 자동 포맷팅
- **단위 테스트**: 80% 이상 커버리지

### 8.2 성능 테스트

- **대용량 데이터**: 500MB+ 볼륨 테스트
- **다중 뷰포트**: 4개 동시 렌더링
- **메모리 누수**: 장시간 사용 시나리오
- **네트워크 지연**: 다양한 네트워크 환경

### 8.3 의료 기기 규정 준수

- **DICOM 표준**: Part 3, 4, 6, 10 준수
- **보안**: HIPAA, GDPR 고려
- **정확성**: 픽셀 값 정확도 검증

## 9. 개발 마일스톤

### 9.1 Phase 1: 기반 구조 (2주)

- shadcn/ui 기반 UI 컴포넌트 구현
- Cornerstone3D 통합 및 기본 뷰어
- 싱글 뷰어 모드 완성

### 9.2 Phase 2: 비교 기능 (2주)

- 비교 뷰어 모드 구현
- 동기화 시스템 구축
- 뷰포트 관리 시스템

### 9.3 Phase 3: 고급 기능 (2주)

- 모든 측정/주석 도구 구현
- 고급 렌더링 기능
- 성능 최적화

### 9.4 Phase 4: 완성도 향상 (1주)

- 반응형 디자인 완성
- 접근성 개선
- 최종 테스트 및 버그 수정

## 10. 성공 지표

### 10.1 기술적 KPI

- **렌더링 성능**: 60fps 유지율 95%+
- **로딩 시간**: 평균 2초 이하
- **메모리 효율**: 타사 대비 30% 적은 메모리 사용
- **코드 품질**: ESLint warning 0개 유지

### 10.2 사용자 경험 KPI

- **워크플로 효율**: 비교 분석 시간 50% 단축
- **학습 곡선**: 5분 이내 기본 기능 습득
- **오류율**: 사용자 실수로 인한 오류 최소화

## 11. 위험 요소 및 대응 방안

### 11.1 기술적 위험

- **Cornerstone3D 호환성**: 정기적인 업데이트 추적
- **성능 저하**: 프로파일링 기반 최적화
- **메모리 누수**: 정기적인 메모리 감시

### 11.2 완화 전략

- **단계적 개발**: MVP 우선, 점진적 기능 추가
- **지속적 테스트**: 자동화된 테스트 파이프라인
- **피드백 루프**: 조기 사용자 테스트

---

**최종 업데이트**: 2025년 8월 3일
**작성자**: Claude AI (Cornerstone3D v3.32.5 + shadcn/ui 전용)
**승인 필요**: 기술 검토 및 의료진 피드백
