# Cornerstone3D v3.32.5 완전 호환성 강제 준수 PRD

## 📋 프로젝트 개요

### 목적

Cornerstone3D v3.32.5 최신 버전의 Context7 공식 가이드와 100% 일치하는 코드로 전체 코드베이스를 리팩토링하여 버전 호환성 오류를 완전히 제거한다.

### 핵심 원칙

**⚠️ 절대 금지사항: 임의로 이전 버전 API나 패턴으로 변형 작성 금지**

- 모든 코드는 반드시 Context7 공식 문서의 예제와 100% 일치해야 함
- 추측이나 변형 없이 가이드 그대로 복사하여 사용
- 의심스러운 코드는 즉시 Context7에서 재검증 후 수정

## 🎯 핵심 작업 범위

### 1. 전체 코드베이스 Context7 가이드 대조 검증

- **src/components/DicomViewer/**: DICOM 뷰어 핵심 컴포넌트
- **src/services/cornerstoneInit.ts**: Cornerstone3D 초기화 로직
- **src/components/DicomViewer/hooks/**: 뷰포트, 툴, 이미지 네비게이션 훅들
- **src/config/cornerstone.ts**: 설정 파일
- **vite.config.ts**: 빌드 설정 (워커 파일, WASM 복사)

### 2. STACK Viewport 완전 재작성

**현재 문제**: Context7 가이드 미준수로 인한 destructuring 오류
**해결책**: Context7 공식 STACK viewport 패턴 100% 적용

#### Context7 공식 STACK 패턴 (절대 변경 금지)

```typescript
// ✅ 정확한 패턴 - Context7 문서 그대로
const viewportInput = {
  viewportId: 'CT_AXIAL_STACK',
  element,
  type: ViewportType.STACK,
  // defaultOptions 없음! (ORTHOGRAPHIC 전용)
}

renderingEngine.enableElement(viewportInput)
const viewport = renderingEngine.getViewport(viewportId)
viewport.setStack(imageIds, 60)
viewport.render()
```

### 3. DICOM Image Loader 초기화 재검증

**현재 상태**: v3.32.5 init() 함수 사용
**검증 필요**: Context7에서 최신 초기화 패턴 확인

### 4. Tool 설정 재검증

**검증 대상**:

- ToolGroup 생성 및 관리
- 개별 도구 등록 및 활성화
- 마우스/키보드 바인딩

### 5. 이미지 로딩 및 캐싱 재검증

**검증 대상**:

- ImageId 생성 패턴
- 이미지 캐시 관리
- Multi-frame DICOM 처리

## 📝 세부 작업 목록

### Phase 1: Context7 가이드 검증 및 문서화

1. **STACK Viewport 공식 패턴 문서화**
   - Context7에서 최신 STACK viewport 예제 수집
   - 현재 코드와 비교 분석
   - 차이점 및 수정 필요사항 문서화

2. **DICOM Image Loader 초기화 패턴 문서화**
   - v3.32.5 공식 초기화 방법 확인
   - Worker 파일 설정 방법 문서화
   - 현재 구현과 비교

3. **Tool 시스템 공식 패턴 문서화**
   - ToolGroup 생성 및 관리 패턴
   - 개별 도구 등록 패턴
   - 이벤트 바인딩 패턴

### Phase 2: 핵심 컴포넌트 리팩토링

1. **useViewportSetup.ts 완전 재작성**
   - Context7 공식 STACK 패턴 100% 적용
   - 모든 추측 코드 제거
   - 오류 처리 로직 Context7 가이드 준수

2. **useToolSetup.ts 재검증 및 수정**
   - Tool 등록 패턴 Context7 가이드 준수
   - ToolGroup 관리 패턴 검증
   - 마우스/키보드 이벤트 바인딩 검증

3. **cornerstoneInit.ts 재검증**
   - v3.32.5 초기화 패턴 100% 준수
   - DICOM Image Loader 설정 검증
   - Worker 파일 경로 설정 검증

### Phase 3: 통합 테스트 및 검증

1. **기능 테스트**
   - DICOM 파일 로딩 테스트
   - 뷰포트 렌더링 테스트
   - 도구 기능 테스트

2. **오류 제거 검증**
   - destructuring 오류 완전 해결 확인
   - Worker 404 오류 해결 확인
   - 콘솔 오류 0개 달성

3. **성능 테스트**
   - 이미지 로딩 성능 측정
   - 메모리 사용량 모니터링
   - 렌더링 성능 측정

## 🚫 절대 금지사항 (강제 준수)

### 1. 임의 변형 금지

- Context7 가이드를 임의로 해석하거나 변형하는 것 **절대 금지**
- 이전 버전 API나 패턴 사용 **절대 금지**
- 추측성 코드 작성 **절대 금지**

### 2. 검증 없는 코드 작성 금지

- Context7에서 확인하지 않은 코드 사용 금지
- 온라인 튜토리얼이나 예제 코드 무분별 사용 금지
- 이전 경험이나 관례에 의존한 코드 작성 금지

### 3. 버전 혼용 금지

- v1.x, v2.x 패턴과 v3.32.5 패턴 혼용 금지
- deprecated API 사용 금지
- legacy 코드 패턴 사용 금지

## ✅ 필수 검증 체크리스트

### 코드 작성 전 체크리스트

- [ ] Context7에서 해당 기능의 공식 예제 확인
- [ ] 예제 코드와 100% 일치하는지 검증
- [ ] 버전 호환성 확인 (v3.32.5)
- [ ] deprecated API 사용 여부 확인

### 코드 작성 후 체크리스트

- [ ] Context7 가이드와 완전 일치 확인
- [ ] 콘솔 오류 0개 확인
- [ ] TypeScript 컴파일 오류 0개 확인
- [ ] 기능 동작 정상 확인

## 📊 성공 기준

### 1차 목표: 오류 완전 제거

- [ ] `TypeError: Right side of assignment cannot be destructured` 오류 해결
- [ ] Worker 404 오류 해결
- [ ] 모든 콘솔 오류 해결

### 2차 목표: 기능 완전 동작

- [ ] DICOM 파일 정상 로딩
- [ ] STACK viewport 정상 렌더링
- [ ] 모든 도구 정상 동작

### 3차 목표: 코드 품질 향상

- [ ] Context7 가이드 100% 준수
- [ ] TypeScript 타입 안전성 확보
- [ ] ESLint 경고 최소화

## 🔄 작업 진행 방법

### 1. 단계별 접근

1. **분석**: Context7에서 해당 기능 공식 가이드 확인
2. **비교**: 현재 코드와 공식 가이드 차이점 분석
3. **수정**: 공식 가이드 패턴으로 완전 교체
4. **테스트**: 기능 동작 및 오류 해결 확인

### 2. 검증 방법

- 각 수정 후 즉시 테스트 실행
- Context7 문서와 코드 대조 검증
- 오류 로그 모니터링

### 3. 문서화

- 수정된 패턴과 이유 문서화
- Context7 참조 링크 명시
- 주의사항 및 제약사항 기록

## 📚 참고 자료

### Context7 핵심 문서

- STACK Viewport 가이드
- DICOM Image Loader 초기화 가이드
- Tool 시스템 가이드
- 마이그레이션 가이드 (v2.x → v3.x)

### 검증 도구

- Context7 공식 문서 검색
- 공식 예제 코드 참조
- TypeScript 컴파일러
- 브라우저 개발자 도구

## 🎯 최종 목표

**Cornerstone3D v3.32.5와 100% 호환되는 안정적인 DICOM 뷰어 구현**

- 모든 코드가 Context7 공식 가이드와 완벽 일치
- 버전 호환성 오류 0개
- 미래 업데이트 시에도 안정적 유지

---

**⚠️ 중요: 이 PRD의 모든 지침은 강제 준수사항입니다. 임의 변형이나 이전 버전 패턴 사용 시 즉시 수정해야 합니다.**
