# DICOM Viewer Comparison Mode Improvement - Product Requirements Document

## Executive Summary

현재 Cornerstone3D Viewer의 Study Comparison 기능은 UI 껍데기만 존재하며, 실제 의료 영상 비교에 필요한 핵심 기능들이 누락되어 있습니다. 이 프로젝트는 의료진이 실제 임상에서 사용할 수 있는 전문적인 비교 분석 도구로 개선하는 것을 목표로 합니다.

## Problem Statement

### 현재 구현의 문제점
1. **실제 DICOM 뷰어 통합 부족**: placeholder만 있고 실제 Cornerstone3D 뷰어 통합이 없음
2. **동기화 기능 부재**: 뷰포트 간 zoom, pan, scroll, 윈도우 레벨 동기화 없음  
3. **핵심 비교 기능 누락**: 교차 참조선, 다중 시계열 비교 기능 없음
4. **의료 영상 특화 기능 부재**: MPR 지원, DICOM modality별 최적화 없음

### 사용자 요구사항
- **방사선과 의사**: 과거/현재 검사 비교를 통한 병변 추적
- **심장내과 의사**: 시술 전후 혈관 상태 비교
- **종양내과 의사**: 치료 반응 평가를 위한 종양 크기 변화 추적

## Core User Scenarios

### 1. 시계열 비교 (Temporal Comparison)
- 같은 환자의 과거/현재 검사 비교
- 병변의 크기, 위치 변화 추적
- 치료 효과 평가

### 2. 모달리티 비교 (Modality Comparison)  
- CT/MRI, PET-CT 등 다른 영상 기법 비교
- 상호 보완적 정보 분석
- Fusion 영상을 통한 정확한 진단

### 3. 치료 전후 비교 (Pre/Post Treatment)
- 수술 전후 해부학적 변화
- 치료 반응 모니터링
- 합병증 조기 발견

## Technical Requirements

### Phase 1: MVP - Core Comparison Features
**목표**: 가장 기본적인 비교 기능을 완벽하게 구현

#### 1.1 기본 뷰어 통합
- StudyComparison 컴포넌트의 placeholder를 실제 DicomViewer로 교체
- 각 뷰포트가 독립적인 시리즈 로드 및 표시
- 로딩 상태 관리 및 에러 처리

#### 1.2 카메라 동기화
- Cornerstone3D SynchronizerManager 활용
- Zoom, Pan 동기화 구현
- 사용자 제어 가능한 동기화 토글

#### 1.3 슬라이스 동기화
- 마우스 휠 스크롤 시 모든 뷰포트 슬라이스 동기화
- Stack viewport와 Volume viewport 지원
- 해부학적 위치 기반 정확한 매핑

#### 1.4 교차 참조선 (Cross-Reference Lines)
- Cornerstone3D ReferenceLineTool 통합
- 마우스 커서 위치의 해부학적 좌표를 다른 뷰포트에 표시
- 실시간 위치 동기화

#### 1.5 기본 레이아웃
- Side-by-Side (1x2) 레이아웃을 기본값으로 설정
- 뷰포트 크기 조절 가능

### Phase 1.5: 기본 사용성 완성
**목표**: MVP의 사용성을 실용적 수준으로 향상

#### 1.5.1 키보드 단축키
- Sync 토글 (S키)
- 레이아웃 변경 (1, 2, 4키)
- 뷰포트 간 포커스 이동 (Tab키)

#### 1.5.2 독립적인 도구 사용
- 각 뷰포트에서 Pan, Zoom, Measure 독립 실행
- 도구 상태의 뷰포트별 관리
- 동기화와 독립 동작의 명확한 구분

#### 1.5.3 프리셋 관리
- 자주 사용하는 비교 설정 저장
- 기본 프리셋 제공 (Chest CT 비교, Brain MRI 비교 등)

### Phase 2: 표준 임상 도구
**목표**: 다양한 임상 시나리오 지원 및 작업 효율성 강화

#### 2.1 고급 동기화 옵션
- 윈도우 레벨(W/L) 동기화
- VOI LUT 동기화
- 카메라 회전 동기화 (3D 뷰)
- MPR 동기화

#### 2.2 유연한 레이아웃 시스템
- Quad View (2x2), 1x3, 1x4 레이아웃
- 사용자 정의 레이아웃 생성
- 드래그 앤 드롭으로 시리즈 배치

#### 2.3 타임라인 뷰
- 환자의 과거 검사 이력을 시간순 표시
- 직관적인 스터디 선택 인터페이스
- 검사 간 시간 간격 시각화

#### 2.4 이미지 퓨전/오버레이
- PET-CT, MRI-CT 등 다중 모달리티 융합
- 투명도 조절 슬라이더
- 색상 매핑 옵션

### Phase 3: 지능형 분석 도구
**목표**: AI와 자동화를 통한 진단 효율성 극대화

#### 3.1 자동 정렬 (Auto-Alignment)
- DICOM 좌표계 기반 자동 정렬
- 서로 다른 시기/장비 간 영상 매칭
- 수동 미세 조정 옵션

#### 3.2 측정 동기화
- 한쪽 뷰포트의 측정값을 다른 뷰포트에 자동 복제
- ROI 기반 정량 분석 동기화
- 변화량 자동 계산

#### 3.3 차이점 시각화
- 픽셀 레벨 차이 계산
- 히스토그램 기반 변화 감지
- 히트맵을 통한 변화 영역 강조

## Technical Architecture

### Component Structure
```
ComparisonMode/
├── ComparisonContainer.tsx          # 메인 컨테이너
├── ComparisonToolbar.tsx           # 동기화 컨트롤
├── LayoutSelector.tsx              # 레이아웃 선택
├── StudyTimeline.tsx               # 시간순 스터디 표시
├── ComparisonViewport.tsx          # 개별 뷰포트 래퍼
├── SynchronizationManager.ts       # 동기화 로직
└── ComparisonPresets.ts            # 프리셋 관리
```

### State Management
```typescript
interface ComparisonState {
  viewports: ComparisonViewport[];
  layout: LayoutConfiguration;
  syncSettings: SynchronizationSettings;
  activePreset: string;
  timeline: StudyTimelineData;
}
```

### Integration Points
- **DicomViewer 컴포넌트**: 기존 뷰어와의 호환성 확보
- **Cornerstone3D Tools**: SynchronizerManager, ReferenceLineTool 활용
- **Study Browser**: 시리즈 선택 및 로딩 연동

## Success Metrics

### Phase 1 Success Criteria
- 2개 뷰포트에서 동일한 zoom/pan 수준 유지 (동기화 정확도 95% 이상)
- 교차 참조선의 위치 정확도 (±1 픽셀 이내)
- 초기 로딩 시간 5초 이내
- 메모리 사용량 기존 대비 150% 이내

### Phase 2 Success Criteria  
- 4개 뷰포트 동시 동기화 지원
- 5가지 이상의 레이아웃 옵션 제공
- 프리셋 저장/불러오기 1초 이내

### Phase 3 Success Criteria
- 자동 정렬 정확도 90% 이상
- 차이점 감지 정확도 85% 이상 (의료진 검증 기준)

## Security & Compliance

### HIPAA Compliance
- 다중 스터디 비교 시 환자 정보 보호
- 비교 분석 과정의 감사 로그 기록
- 데이터 전송 중 암호화

### Performance Requirements
- 4개 뷰포트 동시 렌더링 시 60fps 유지
- 메모리 사용량 4GB 이하
- 동기화 지연시간 100ms 이내

## Implementation Timeline

### Phase 1: MVP (4-6 weeks)
- Week 1-2: 기본 뷰어 통합 및 카메라 동기화
- Week 3-4: 슬라이스 동기화 및 교차 참조선
- Week 5-6: 테스트 및 버그 수정

### Phase 1.5: 사용성 완성 (2-3 weeks)
- Week 1: 키보드 단축키 및 독립 도구
- Week 2-3: 프리셋 관리 및 UX 개선

### Phase 2: 표준 임상 도구 (6-8 weeks)
- Week 1-2: 고급 동기화 옵션
- Week 3-4: 유연한 레이아웃 시스템
- Week 5-6: 타임라인 뷰 및 이미지 퓨전
- Week 7-8: 통합 테스트

### Phase 3: 지능형 분석 (8-10 weeks)
- Week 1-3: 자동 정렬 알고리즘
- Week 4-6: 측정 동기화
- Week 7-8: 차이점 시각화
- Week 9-10: 전체 시스템 최적화

## Risk Assessment

### High Risk
- **Cornerstone3D 동기화 복잡성**: 다중 뷰포트 동기화의 기술적 난이도
- **성능 최적화**: 메모리 및 렌더링 성능 요구사항

### Medium Risk  
- **DICOM 표준 호환성**: 다양한 장비/vendor 간 호환성
- **사용자 인터페이스 복잡성**: 많은 기능을 직관적으로 배치

### Low Risk
- **기존 코드베이스 영향**: 기존 기능에 대한 영향 최소화
- **브라우저 호환성**: 표준 웹 기술 사용으로 위험도 낮음

## Conclusion

이 프로젝트는 단순한 UI 개선을 넘어서, 의료진의 실제 임상 워크플로우를 지원하는 전문적인 도구로 발전시키는 것을 목표로 합니다. 단계적 접근을 통해 위험을 최소화하면서도, 최종적으로는 업계 표준 수준의 비교 분석 기능을 제공할 수 있을 것입니다.