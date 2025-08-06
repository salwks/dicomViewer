# Cornerstone3D DICOM Viewer - Updated PRD (통합 뷰어 아키텍처)

## 1. 프로젝트 개요

Cornerstone3D v3.32.5 기반의 전문 의료 영상 뷰어로, 의료진의 실제 판독 워크플로우에 최적화된 통합 인터페이스를 제공합니다.

## 2. 핵심 설계 원칙

### 2.1 통합 뷰어 아키텍처
- **단일 뷰어 컨테이너**: 모든 기능이 하나의 통합된 인터페이스에서 동작
- **모드 기반 전환**: 페이지 이동 없이 레이아웃과 기능이 동적으로 변경
- **워크플로우 연속성**: 판독 과정의 흐름이 끊기지 않는 사용자 경험

### 2.2 의료진 워크플로우 최적화
- **시작**: 단일 뷰(1x1)에서 현재 스터디 집중 분석
- **비교 모드 전환**: 필요시 즉시 레이아웃 변경(1x2, 2x1, 2x2)
- **드래그 앤 드롭**: 스터디 브라우저에서 비교 영상을 뷰포트로 직접 드래그
- **컨텍스트 유지**: 모드 전환 시 뷰포트 상태(줌, 팬, W/L) 보존

## 3. 핵심 컴포넌트 아키텍처

### 3.1 UnifiedViewer (통합 뷰어)
```typescript
interface ViewerMode {
  type: 'single' | 'comparison' | 'advanced'
  layout: LayoutType
  syncEnabled: boolean
  crossReferenceEnabled: boolean
}

interface UnifiedViewerProps {
  initialMode?: ViewerMode
  onModeChange?: (mode: ViewerMode) => void
}
```

**주요 기능:**
- 뷰어 모드 상태 관리 (single/comparison/advanced)
- 모드별 기능 활성화/비활성화 제어
- 레이아웃 전환 애니메이션 및 상태 보존

### 3.2 ViewportGridManager (동적 레이아웃 관리자)
```typescript
interface ViewportGridProps {
  mode: ViewerMode
  layout: LayoutType // '1x1' | '1x2' | '2x1' | '2x2'
  viewports: ViewportConfig[]
  onLayoutChange: (layout: LayoutType) => void
}
```

**주요 기능:**
- 모드에 따른 동적 그리드 레이아웃 렌더링
- 뷰포트 상태 보존 및 복원
- 레이아웃 전환 시 부드러운 애니메이션

### 3.3 ModeController (모드 제어기)
```typescript
interface ModeControllerProps {
  currentMode: ViewerMode
  onModeChange: (mode: ViewerMode) => void
  availableLayouts: LayoutType[]
}
```

**주요 기능:**
- 모드 전환 UI 제공 (기존 ModeSelector 발전)
- 레이아웃 선택 드롭다운
- 동기화 및 교차 참조선 토글

### 3.4 StudyBrowser with Drag & Drop
```typescript
interface StudyBrowserProps {
  studies: StudyMetadata[]
  onSeriesDrop: (series: SeriesMetadata, targetViewport: number) => void
  dragEnabled: boolean
}
```

**주요 기능:**
- 스터디/시리즈 목록 표시
- 드래그 앤 드롭으로 뷰포트에 직접 로드
- 비교 모드에서만 다중 드롭 타겟 활성화

## 4. 기능별 상세 요구사항

### 4.1 Single Mode (단일 모드)
- **레이아웃**: 1x1 고정
- **기능**: 기본 DICOM 뷰잉 도구 (Pan, Zoom, W/L, Rotate)
- **측정 도구**: Length, Angle, Area, Annotation
- **비활성화**: 동기화, 교차 참조선

### 4.2 Comparison Mode (비교 모드)
- **레이아웃**: 1x2, 2x1, 2x2 선택 가능
- **기능**: Single 모드의 모든 기능 + 비교 전용 기능
- **동기화**: Camera, VOI, Scroll 동기화 옵션
- **교차 참조선**: 상호 위치 표시
- **측정 공유**: 뷰포트 간 측정 결과 비교

### 4.3 Advanced Mode (고급 모드)
- **레이아웃**: 모든 레이아웃 지원 + 커스텀 배치
- **3D 렌더링**: Volume Rendering, MIP, MinIP
- **MPR**: Multi-Planar Reconstruction
- **고급 동기화**: Stack 동기화, Image 동기화

## 5. 상태 관리 구조

### 5.1 ViewerState
```typescript
interface ViewerState {
  mode: ViewerMode
  viewports: ViewportState[]
  synchronizers: SynchronizerConfig[]
  measurements: MeasurementData[]
  ui: UIState
}
```

### 5.2 상태 지속성
- **모드 전환**: 현재 뷰포트 상태 보존
- **세션 저장**: 판독 중 브라우저 새로고침 대응
- **설정 기억**: 사용자 선호 레이아웃 및 설정

## 6. 사용자 시나리오

### 6.1 기본 판독 워크플로우
1. **시작**: 환자 선택 → 최신 스터디가 Single 모드(1x1)로 자동 로드
2. **집중 분석**: 기본 도구로 영상 분석, 측정 수행
3. **비교 필요성 인지**: 병변 발견 또는 변화 확인 필요
4. **모드 전환**: ModeController에서 Comparison 모드 선택
5. **레이아웃 변경**: 1x1 → 1x2 자동 전환 (현재 영상 좌측 유지)
6. **비교 영상 로드**: StudyBrowser에서 과거 스터디를 우측 뷰포트로 드래그
7. **동기화 분석**: 동기화 기능으로 동일 위치 비교
8. **결과 정리**: 측정 및 소견 정리
9. **복귀**: Single 모드로 복귀하여 판독 계속

### 6.2 긴급 상황 대응
1. **응급실 요청**: 응급 스터디 우선 로드
2. **즉시 비교**: 이전 응급 스터디와 즉시 비교 (2x1 레이아웃)
3. **빠른 판독**: 동기화된 스크롤로 신속한 변화 확인

## 7. 기술적 구현 요구사항

### 7.1 성능 최적화
- **지연 로딩**: 비활성 뷰포트는 메모리 효율적 관리
- **캐싱**: 자주 사용되는 영상의 스마트 캐싱
- **렌더링 최적화**: 60fps 부드러운 상호작용

### 7.2 보안 및 표준
- **DICOM 표준**: 완전한 DICOM 호환성
- **HIPAA 준수**: 의료 정보 보안 강화
- **감사 로그**: 모든 사용자 행동 기록

### 7.3 접근성
- **키보드 네비게이션**: 모든 기능의 키보드 접근
- **고대비 모드**: 의료진의 다양한 환경 지원
- **다국어**: 한국어 우선, 다국어 확장 준비

## 8. 구현 우선순위

### Phase 1: 핵심 통합 뷰어 (Task 74-76)
1. UnifiedViewer 컨테이너 구현
2. ViewportGridManager 동적 레이아웃
3. 기본 Single/Comparison 모드 전환
4. Cornerstone3D 기본 렌더링 엔진 통합

### Phase 2: 고급 기능 (Task 77-79)
1. 동기화 매니저 구현
2. 드래그 앤 드롭 StudyBrowser
3. 측정 및 주석 도구
4. 상태 보존 및 세션 관리

### Phase 3: 최적화 및 확장 (Task 80-82)
1. 성능 최적화 및 메모리 관리
2. 고급 3D 렌더링 기능
3. 사용자 설정 및 커스터마이징
4. 종합 테스트 및 품질 보증

## 9. 성공 지표

### 9.1 사용성 측정
- **모드 전환 시간**: 3초 이내 완료
- **상태 보존율**: 99% 이상
- **사용자 만족도**: 의료진 피드백 8/10 이상

### 9.2 기술적 지표
- **렌더링 성능**: 60fps 유지
- **메모리 사용량**: 2GB 이하
- **로딩 시간**: 대용량 스터디 10초 이내

이 PRD는 실제 의료진의 판독 워크플로우를 반영하여, 효율적이고 직관적인 통합 DICOM 뷰어 구현을 목표로 합니다.