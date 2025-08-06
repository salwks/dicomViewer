# 작업 중심 인터페이스 리팩토링 PRD

## 프로젝트 개요

### 목표
현재의 "모드" 중심 뷰어 아키텍처를 "작업(Task)" 중심 아키텍처로 전면 리팩토링하여, 의료진의 직관적인 워크플로우에 맞는 사용자 경험을 제공

### 핵심 원칙
1. **명령이 아닌 상태 반영**: "비교 모드 전환" → "레이아웃 변경"
2. **예측 가능성**: 모든 기능이 항상 같은 위치, 불가능할 때는 disabled 처리
3. **직관적 상호작용**: 기본 작업은 클릭과 같은 간단한 액션으로 수행

## 현재 문제점 분석

### Mode-Based Architecture 문제점
- `mode: { type: 'single' | 'comparison' | 'multiplanar', layout: {...} }` 구조
- 개발자 중심의 추상적 개념으로 의료진에게 직관적이지 않음
- ModeSelector 컴포넌트가 사용자 의도와 분리된 기술적 선택지 제공
- 동기화 기능이 특정 모드에 종속되어 예측하기 어려움

### UX 문제점
- 시리즈 선택 → 모드 변경 → 배치의 복잡한 단계
- 기능의 가용성이 모드에 따라 예측하기 어렵게 변함
- 드래그앤드롭 같은 직관적 상호작용 부재

## 리팩토링 요구사항

## 1단계: Layout-Based Architecture 전환

### 1.1 ViewerContext 상태 구조 변경
```typescript
// 변경 전
interface ViewerState {
  mode: {
    type: 'single' | 'comparison' | 'multiplanar';
    layout: { rows: number; cols: number };
  };
}

// 변경 후  
interface ViewerState {
  layout: { rows: number; cols: number };
  // mode 필드 완전 제거
}
```

### 1.2 ModeSelector → LayoutSelector 변환
- HeaderNavigation의 ModeSelector 컴포넌트 리팩토링
- "모드 변경" UI → "뷰포트 그리드 레이아웃 변경" UI
- 제공 옵션: 1x1, 1x2, 2x1, 2x2 레이아웃 버튼

### 1.3 관련 훅 및 유틸리티 업데이트
- `useViewerMode()` → `useViewerLayout()` 변경
- URL 파라미터 핸들링에서 mode → layout 변경
- 모든 mode 참조를 layout 기반으로 변경

## 2단계: Select-to-Display 상호작용 구현

### 2.1 기본 클릭 액션
**요구사항**: 사이드 패널 시리즈 클릭 → 활성 뷰포트에 즉시 로드
- SidePanelSystem과 ViewportGridManager 연동
- 현재 활성 뷰포트 추적 및 시각적 표시
- 클릭 시 해당 뷰포트에 DICOM 이미지 로드

### 2.2 활성 뷰포트 관리
**요구사항**: 명확한 활성 뷰포트 표시 및 전환
- 활성 뷰포트 시각적 피드백 (테두리 색상 변경)
- 뷰포트 클릭으로 활성 상태 전환
- 활성 상태에 따른 도구 패널 동기화

### 2.3 드래그앤드롭 상호작용
**요구사항**: 시리즈 썸네일을 뷰포트로 드래그앤드롭
- HTML5 Drag and Drop API 활용
- 드롭 대상 뷰포트 하이라이트
- 드롭 시 해당 뷰포트 활성화 및 이미지 로드

## 3단계: 상시 표시 ComparisonToolbar 구현

### 3.1 ComparisonToolbar 컴포넌트 생성
**위치**: 뷰포트 영역 상단에 상시 표시
**포함 기능**:
- 동기화 토글 버튼 (카메라, 슬라이스, 윈도우/레벨)
- 교차 참조선 토글 버튼
- 기타 비교 분석 도구

### 3.2 동적 활성화 로직
**규칙**:
- 뷰포트 1개 (1x1): 모든 비교 관련 버튼 disabled
- 뷰포트 2개 이상: 모든 버튼 활성화
- 상태 변경 시 시각적 피드백 제공

## 4단계: 동기화 및 교차 참조선 로직 리팩토링

### 4.1 Layout-Based 활성화 로직
```typescript
useEffect(() => {
  const viewportCount = layout.rows * layout.cols;
  
  if (viewportCount >= 2) {
    // SynchronizerManager 활성화
    // ReferenceLineTool 활성화
  } else {
    // 동기화 시스템 비활성화
    // 교차 참조선 제거
  }
}, [layout]);
```

### 4.2 기존 Mode 종속성 제거
- SynchronizerManager에서 mode 체크 로직 제거
- ReferenceLineTool에서 comparison mode 종속성 제거
- 순수하게 뷰포트 수 기반으로 동작하도록 변경

## 구현 계획

### Phase 1: Core Architecture Refactoring
1. ViewerContext 상태 구조 변경
2. 모든 mode 참조를 layout 기반으로 변경
3. 기존 기능 유지하면서 내부 로직만 변경

### Phase 2: UI Component Refactoring  
1. ModeSelector → LayoutSelector 변환
2. ComparisonToolbar 컴포넌트 구현
3. 동적 활성화 로직 구현

### Phase 3: Interaction Enhancement
1. Select-to-Display 클릭 액션 구현
2. 활성 뷰포트 관리 시스템
3. 드래그앤드롭 상호작용 구현

### Phase 4: Logic Integration
1. 동기화 시스템 리팩토링
2. 교차 참조선 로직 업데이트
3. 전체 시스템 통합 테스트

## 기대 효과

### 사용자 경험 개선
- 직관적인 "레이아웃 → 시리즈 선택" 워크플로우
- 예측 가능한 기능 가용성
- 간단한 클릭/드래그 상호작용

### 개발자 경험 개선
- 명확한 상태 모델 (layout 기반)
- 모드 종속성 제거로 인한 코드 단순화
- 확장 가능한 레이아웃 시스템

### 의료진 워크플로우 최적화
- 기술적 개념(모드) 제거
- 작업 중심의 직관적 인터페이스
- 끊김 없는 비교 분석 경험

## 성공 지표

1. **직관성**: 새로운 사용자가 설명 없이 비교 분석 수행 가능
2. **효율성**: 시리즈 비교 작업 완료 시간 50% 단축
3. **예측 가능성**: 모든 기능이 상황에 맞게 적절히 활성화/비활성화
4. **일관성**: 동일한 액션이 항상 동일한 결과 제공

## 기술적 고려사항

### 보안
- 기존 보안 표준 유지
- 드래그앤드롭 시 XSS 방지
- DICOM 데이터 안전한 처리

### 성능
- 레이아웃 변경 시 최적화된 뷰포트 재구성
- 드래그앤드롭 시 부드러운 애니메이션
- 메모리 효율적인 이미지 로딩

### 접근성
- 키보드 네비게이션 지원
- 스크린 리더 호환성
- 고대비 모드 지원

## 마이그레이션 전략

### 점진적 전환
1. 내부 로직 변경 (사용자 영향 없음)
2. UI 컴포넌트 단계별 교체
3. 새로운 상호작용 점진적 도입

### 하위 호환성
- 기존 URL 파라미터 마이그레이션
- 저장된 사용자 설정 변환
- API 변경사항 문서화

이 리팩토링을 통해 의료 영상 뷰어가 진정한 전문가 도구로서의 직관성과 효율성을 갖추게 될 것입니다.