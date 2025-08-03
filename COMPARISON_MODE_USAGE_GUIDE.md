# Comparison Mode 사용 가이드

## 개요

Comparison Mode는 여러 DICOM 스터디를 동시에 비교할 수 있는 기능입니다. 의료진이 이전 검사와 현재 검사를 비교하거나, 서로 다른 시퀀스의 영상을 동시에 분석할 때 사용됩니다.

## 기본 사용법

### 1. Comparison Mode 활성화

```tsx
import { ComparisonModeToggle } from './components';

function App() {
  const [currentMode, setCurrentMode] = useState<'single' | 'comparison'>('single');
  const [availableStudies, setAvailableStudies] = useState([]);

  return (
    <div>
      <ComparisonModeToggle
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        studyCount={availableStudies.length}
        maxStudies={4}
        showLabels={true}
        variant="default"
      />
    </div>
  );
}
```

### 2. 스터디 할당 및 관리

```tsx
import { DragDropStudyAssignment, ComparisonViewportManager } from './components';

function ComparisonView() {
  const [availableStudies, setAvailableStudies] = useState([
    {
      studyInstanceUID: '1.2.3.4.5',
      patientId: 'P001',
      patientName: '홍길동',
      studyDate: '2024-01-15',
      modality: 'CT',
      seriesCount: 5
    },
    {
      studyInstanceUID: '1.2.3.4.6',
      patientId: 'P001',
      patientName: '홍길동',
      studyDate: '2024-08-15',
      modality: 'CT',
      seriesCount: 6
    }
  ]);

  const [viewportSlots, setViewportSlots] = useState([
    { id: 'viewport-1', position: 0, isActive: true, label: 'Left' },
    { id: 'viewport-2', position: 1, isActive: false, label: 'Right' },
    { id: 'viewport-3', position: 2, isActive: false, label: 'Bottom Left' },
    { id: 'viewport-4', position: 3, isActive: false, label: 'Bottom Right' }
  ]);

  const handleStudyAssignment = (slotId: string, study: StudyInfo | null) => {
    setViewportSlots(prev => prev.map(slot => 
      slot.id === slotId 
        ? { ...slot, assignedStudy: study }
        : slot
    ));
  };

  return (
    <DragDropStudyAssignment
      availableStudies={availableStudies}
      viewportSlots={viewportSlots}
      onAssignment={handleStudyAssignment}
      layout="2x2"
      showInstructions={true}
    />
  );
}
```

### 3. 뷰포트 동기화 설정

```tsx
import { ComparisonViewportManager } from '../services';

// ComparisonViewportManager 인스턴스 생성
const comparisonManager = new ComparisonViewportManager({
  enableCrossReferenceLines: true,
  enableAutoAlignment: true,
  maxStudiesPerComparison: 4,
  enablePatientSafetyChecks: true,
  defaultComparisonLayout: '2x2'
});

// 동기화 그룹 생성
const syncGroupId = comparisonManager.createSynchronizationGroup('main-comparison', {
  enableScrollSync: true,
  enableWindowLevelSync: true,
  enableZoomPanSync: true,
  masterViewportId: 'viewport-1'
});
```

## 고급 사용법

### 1. 성능 모니터링과 함께 사용

```tsx
import { PerformanceMonitorDashboard } from './components';

function ComparisonWithMonitoring() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* 메인 비교 뷰어 */}
      <div className="lg:col-span-3">
        <ComparisonView />
      </div>
      
      {/* 성능 모니터링 대시보드 */}
      <div className="lg:col-span-1">
        <PerformanceMonitorDashboard 
          compact={true}
          autoRefresh={true}
          showOptimizationControls={false}
        />
      </div>
    </div>
  );
}
```

### 2. 스터디 메타데이터 표시

```tsx
import { StudyMetadataPanel } from './components';

function ComparisonWithMetadata() {
  const [selectedStudies, setSelectedStudies] = useState([]);

  return (
    <div className="space-y-4">
      <ComparisonView />
      
      <StudyMetadataPanel
        studies={selectedStudies}
        mode="comparison"
        showPatientSafety={true}
        showClinicalContext={true}
      />
    </div>
  );
}
```

### 3. 완전한 비교 뷰어 구현

```tsx
import React, { useState, useEffect } from 'react';
import {
  ComparisonModeToggle,
  DragDropStudyAssignment,
  StudyMetadataPanel,
  PerformanceMonitorDashboard
} from './components';
import { ComparisonViewportManager } from './services';

export function ComparisonViewer() {
  const [mode, setMode] = useState<'single' | 'comparison'>('single');
  const [studies, setStudies] = useState([]);
  const [viewportSlots, setViewportSlots] = useState([
    { id: 'vp-1', position: 0, isActive: true, label: 'Previous Study' },
    { id: 'vp-2', position: 1, isActive: false, label: 'Current Study' }
  ]);
  
  const [comparisonManager] = useState(() => 
    new ComparisonViewportManager({
      enableCrossReferenceLines: true,
      enableAutoAlignment: true,
      maxStudiesPerComparison: 4,
      enablePatientSafetyChecks: true,
      defaultComparisonLayout: '1x2'
    })
  );

  // 스터디 로드
  useEffect(() => {
    loadAvailableStudies();
  }, []);

  const loadAvailableStudies = async () => {
    // 실제 구현에서는 DICOM 서버나 로컬 파일에서 스터디 목록을 가져옴
    const mockStudies = [
      {
        studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.78',
        patientId: 'PAT001',
        patientName: '김철수',
        studyDate: '2024-01-15',
        modality: 'CT',
        institution: '서울대학교병원',
        description: 'Chest CT',
        seriesCount: 4
      },
      {
        studyInstanceUID: '1.2.840.113619.2.5.1762583153.215519.978957063.79',
        patientId: 'PAT001', 
        patientName: '김철수',
        studyDate: '2024-08-15',
        modality: 'CT',
        institution: '서울대학교병원',
        description: 'Chest CT Follow-up',
        seriesCount: 5
      }
    ];
    setStudies(mockStudies);
  };

  const handleStudyAssignment = async (slotId: string, study: StudyInfo | null) => {
    if (study) {
      // 뷰포트에 스터디 할당
      await comparisonManager.assignStudyToViewport(slotId, study, 'normal');
      
      // UI 상태 업데이트
      setViewportSlots(prev => prev.map(slot => 
        slot.id === slotId 
          ? { ...slot, assignedStudy: study, isActive: true }
          : slot
      ));
    } else {
      // 스터디 할당 해제
      comparisonManager.unassignStudyFromViewport(slotId);
      
      setViewportSlots(prev => prev.map(slot => 
        slot.id === slotId 
          ? { ...slot, assignedStudy: undefined, isActive: false }
          : slot
      ));
    }
  };

  const handleModeChange = (newMode: 'single' | 'comparison') => {
    setMode(newMode);
    
    if (newMode === 'comparison') {
      // 비교 모드 활성화 시 동기화 그룹 생성
      comparisonManager.createSynchronizationGroup('main-sync', {
        enableScrollSync: true,
        enableWindowLevelSync: true,
        enableZoomPanSync: false,
        masterViewportId: 'vp-1'
      });
    }
  };

  const assignedStudies = viewportSlots
    .filter(slot => slot.assignedStudy)
    .map(slot => slot.assignedStudy!);

  return (
    <div className="h-screen flex flex-col">
      {/* 헤더 */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">DICOM Comparison Viewer</h1>
          
          <ComparisonModeToggle
            currentMode={mode}
            onModeChange={handleModeChange}
            studyCount={studies.length}
            maxStudies={4}
            variant="default"
          />
        </div>
      </div>

      {/* 메인 컨텐트 */}
      <div className="flex-1 flex">
        {/* 사이드 패널 */}
        <div className="w-80 border-r bg-muted/30 p-4 space-y-4 overflow-y-auto">
          {/* 성능 모니터링 */}
          <PerformanceMonitorDashboard
            compact={true}
            autoRefresh={true}
            showOptimizationControls={false}
          />

          {/* 스터디 할당 */}
          {mode === 'comparison' && (
            <DragDropStudyAssignment
              availableStudies={studies}
              viewportSlots={viewportSlots}
              onAssignment={handleStudyAssignment}
              layout={viewportSlots.length === 2 ? '1x2' : '2x2'}
              showInstructions={true}
            />
          )}

          {/* 스터디 메타데이터 */}
          {assignedStudies.length > 0 && (
            <StudyMetadataPanel
              studies={assignedStudies}
              mode={mode}
              showPatientSafety={true}
              showClinicalContext={true}
            />
          )}
        </div>

        {/* 뷰포트 영역 */}
        <div className="flex-1 bg-black">
          {mode === 'single' ? (
            <div className="w-full h-full">
              {/* 단일 뷰포트 */}
              <div id="viewport-single" className="w-full h-full" />
            </div>
          ) : (
            <div className={`grid h-full gap-1 ${
              viewportSlots.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'
            }`}>
              {viewportSlots.map((slot) => (
                <div
                  key={slot.id}
                  id={slot.id}
                  className={`relative border-2 ${
                    slot.isActive ? 'border-blue-500' : 'border-gray-600'
                  }`}
                >
                  {!slot.assignedStudy && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/60">
                      <div className="text-center">
                        <div className="text-lg mb-2">{slot.label}</div>
                        <div className="text-sm">드래그로 스터디를 할당하세요</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## 주요 기능

### 1. **모드 전환**
- `single`: 단일 스터디 뷰어
- `comparison`: 다중 스터디 비교 뷰어

### 2. **드래그 앤 드롭**
- 사용 가능한 스터디 목록에서 뷰포트로 드래그
- 뷰포트 간 스터디 재배치 가능
- 시각적 피드백 제공

### 3. **동기화**
- **Scroll Sync**: 슬라이스 스크롤 동기화
- **Window/Level Sync**: 윈도우/레벨 설정 동기화  
- **Zoom/Pan Sync**: 확대/이동 동기화

### 4. **레이아웃**
- `1x2`: 좌우 2분할
- `2x2`: 4분할
- `3x3`: 9분할 (고급 비교용)

### 5. **환자 안전**
- 동일 환자 검증
- 서로 다른 환자 비교 시 경고
- 임상 컨텍스트 정보 제공

## 성능 최적화

### 지연 로딩
```tsx
// 뷰포트가 보이는 경우에만 스터디 로드
const loadingPriority = viewportIsVisible ? 'high' : 'low';
await comparisonManager.assignStudyToViewport(viewportId, study, loadingPriority);
```

### 메모리 관리
```tsx
// 사용하지 않는 뷰포트 자동 정리
comparisonManager.setAutoCleanup(true);

// 메모리 압박 시 우선순위 낮은 뷰포트 해제
comparisonManager.on('memory-pressure', () => {
  comparisonManager.cleanupInactiveViewports();
});
```

## 실제 통합 예시

실제 애플리케이션에서는 다음과 같이 통합할 수 있습니다:

```tsx
// src/App.tsx
import { ComparisonViewer } from './components/ComparisonViewer';

function App() {
  return (
    <div className="App">
      <ComparisonViewer />
    </div>
  );
}

export default App;
```

이제 comparison 기능을 완전히 활용할 수 있습니다! 🎉