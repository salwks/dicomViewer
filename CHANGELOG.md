# 변경 기록 (Changelog)

이 프로젝트의 모든 주요 변경 사항은 이 파일에 기록됩니다.

이 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/) 가이드를 따릅니다.

---

## [Unreleased]

### Added (새로운 기능)

### Changed (기존 기능 변경)

### Fixed (버그 수정)

---

## [0.1.1] - 2025-07-17

### Fixed

- **DICOM 메타데이터 모달 문제 해결**: 메타데이터 모달을 열고 닫을 때 모든 주석(annotation)이 사라지는 현상 수정
  - 기존: 모달 상태 변경 시 DicomRenderer 컴포넌트가 완전히 언마운트되어 주석 손실
  - 해결: 조건부 렌더링 대신 `visibility: hidden`과 `pointerEvents: none`을 사용하여 컴포넌트 유지

### Added

- **중앙 버전 관리 시스템**: `package.json`을 활용한 통합 버전 관리 구현
  - 애플리케이션 헤더, 페이지 제목, Google Analytics 추적에 동적 버전 표시
  - TypeScript 타입 안전성 지원 (`vite-env.d.ts`)
  - 개발자 콘솔에 스타일링된 버전 정보 출력
  - 편리한 버전 업데이트 명령어 추가 (`npm run version:patch`, `version:minor`, `version:major`)

### Changed

- **성능 최적화**: ROI 그리기 성능 개선
  - 과도한 텍스트 업데이트 로직 최적화 (주석당 6개 setTimeout + 무한 setInterval → 최대 3회 재시도)
  - 100ms 디바운싱을 통한 연속 업데이트 그룹핑
  - 메모리 누수 방지를 위한 타이머 정리 시스템 구현

- **보안 강화**: 쿠키 동의 전 애플리케이션 접근 제한
  - 쿠키 동의하지 않은 경우 75% 투명도 오버레이로 애플리케이션 비활성화
  - 개인정보처리방침 페이지에서 쿠키 팝업 숨김 처리
  - GDPR 완전 준수 구현

---

## [0.1.0] - 2025-07-17

### Added

- **프로젝트 초기 설정**
  - Vite 기반 React + TypeScript 프로젝트 구성
  - 의료 영상 처리를 위한 보안 강화 설정
  - Cornerstone3D 라이브러리 통합

- **DICOM 뷰어 핵심 기능**
  - DICOM 파일 업로드 및 렌더링
  - 다양한 주석 도구 지원 (Length, Angle, ROI 등)
  - 실시간 측정값 mm 단위 표시
  - 메타데이터 모달을 통한 DICOM 태그 정보 표시

- **다국어 지원**
  - 한국어, 영어, 일본어, 중국어 지원
  - 언어별 개인정보처리방침 제공

- **Google Analytics 통합**
  - GA4 기반 사용자 행동 추적
  - 쿠키 동의 후에만 추적 활성화
  - 의료 영상 뷰어 특화 이벤트 추적

- **보안 기능**
  - XSS 방지 시스템
  - 의료 데이터 보호를 위한 보안 헤더
  - 사용자 인증 및 권한 관리 시스템 (선택적)

### Security

- **개인정보보호**
  - 쿠키 동의 시스템 구현
  - 개인정보처리방침 페이지 추가
  - GDPR 규정 준수