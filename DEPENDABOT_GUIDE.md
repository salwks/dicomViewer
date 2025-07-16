# 📦 Dependabot 자동화 가이드

## 개요

이 문서는 GitHub Dependabot 설정 및 자동화된 보안 패치 관리 시스템에 대한 종합적인 가이드입니다.

## 🛠️ 설정된 구성 요소

### 1. Dependabot 설정 (`.github/dependabot.yml`)

#### 기본 설정
- **스캔 주기**: 매주 월요일 오전 9시 (한국 시간)
- **패키지 생태계**: npm, GitHub Actions
- **최대 PR 수**: 10개 (npm), 5개 (GitHub Actions)
- **대상 브랜치**: master

#### 보안 기능
- **자동 보안 패치**: 패치 레벨 보안 업데이트 자동 처리
- **그룹화**: 관련 의존성을 그룹별로 관리
- **라벨링**: 자동 라벨 부여 (dependencies, security, automated)

### 2. 자동화 워크플로우

#### Dependabot Auto-merge (`.github/workflows/dependabot-auto-merge.yml`)
- **보안 검증**: 자동 보안 감사 실행
- **자동 승인**: 패치 레벨 보안 업데이트 자동 승인
- **자동 병합**: 검증 통과 시 자동 병합
- **알림**: 수동 검토 필요 시 알림

#### Security Audit (`.github/workflows/security-audit.yml`)
- **일일 스캔**: 매일 자동 보안 감사
- **취약점 감지**: 새로운 취약점 자동 감지
- **이슈 생성**: 중요/고위험 취약점 발견 시 자동 이슈 생성
- **보고서 생성**: 상세한 보안 감사 보고서

## 🔄 자동화 프로세스

### 1. 주간 의존성 스캔
```
매주 월요일 09:00 (KST)
├── npm 의존성 스캔
├── GitHub Actions 스캔
├── 취약점 감지
└── PR 생성 (필요 시)
```

### 2. 보안 패치 자동 처리
```
Dependabot PR 생성
├── 보안 검증 실행
│   ├── npm audit
│   ├── 테스트 실행
│   ├── 빌드 검증
│   └── 보안 테스트
├── 자동 승인 (패치 레벨)
├── 자동 병합
└── 알림 및 라벨링
```

### 3. 수동 검토 프로세스
```
메이저/마이너 업데이트
├── 수동 검토 알림
├── 보안 체크리스트
├── 브레이킹 체인지 검토
├── 승인 및 병합
└── 문서 업데이트
```

## ⚙️ 설정 세부사항

### Dependabot 그룹 구성

#### 1. Cornerstone 보안 그룹
```yaml
cornerstone-security:
  patterns:
    - "@cornerstonejs/*"
  update-types:
    - "security"
    - "patch"
```

#### 2. 개발 의존성 그룹
```yaml
dev-dependencies:
  patterns:
    - "*"
  dependency-type: "development"
  update-types:
    - "security"
    - "patch"
```

#### 3. 프로덕션 보안 그룹
```yaml
production-security:
  patterns:
    - "*"
  dependency-type: "production"
  update-types:
    - "security"
```

### 자동 병합 조건

#### ✅ 자동 병합 가능
- 패치 레벨 보안 업데이트
- 보안 감사 통과
- 모든 테스트 통과
- 빌드 성공

#### ⚠️ 수동 검토 필요
- 메이저/마이너 버전 업데이트
- 브레이킹 체인지 포함
- 보안 검증 실패
- 테스트 실패

## 🔒 보안 기능

### 1. 취약점 감지
- **npm audit**: 의존성 취약점 스캔
- **보안 등급**: Critical, High, Medium, Low
- **CVSS 점수**: 취약점 심각도 평가
- **자동 알림**: 고위험 취약점 발견 시 즉시 알림

### 2. 자동 보안 패치
- **패치 우선순위**: 보안 패치 최우선 처리
- **검증 프로세스**: 자동 테스트 및 빌드 검증
- **롤백 기능**: 문제 발생 시 자동 롤백

### 3. 보안 모니터링
- **일일 스캔**: 새로운 취약점 일일 모니터링
- **보안 대시보드**: 실시간 보안 상태 확인
- **감사 로그**: 모든 보안 관련 활동 기록

## 📋 사용 가이드

### 1. Dependabot PR 처리

#### 자동 처리되는 경우
1. Dependabot이 보안 패치 PR 생성
2. 자동 보안 검증 실행
3. 검증 통과 시 자동 승인 및 병합
4. 슬랙/이메일 알림 (설정 시)

#### 수동 처리가 필요한 경우
1. PR 검토 및 변경사항 확인
2. 보안 체크리스트 완료
3. 테스트 실행 및 확인
4. 수동 승인 및 병합

### 2. 보안 알림 대응

#### 중요/고위험 취약점 발견 시
1. 자동 생성된 이슈 확인
2. 취약점 세부사항 검토
3. 패치 적용 계획 수립
4. 긴급 패치 배포 (필요 시)

### 3. 설정 커스터마이징

#### Dependabot 설정 수정
```yaml
# .github/dependabot.yml 파일 수정
schedule:
  interval: "daily"  # 일일 스캔으로 변경
  time: "09:00"
  timezone: "Asia/Seoul"
```

#### 자동 병합 조건 수정
```yaml
# 자동 병합 비활성화
allow:
  - dependency-type: "none"
```

## 🚨 문제 해결

### 일반적인 문제들

#### 1. Dependabot PR이 생성되지 않음
- GitHub 저장소 설정에서 Dependabot 활성화 확인
- `.github/dependabot.yml` 파일 문법 검증
- 권한 설정 확인

#### 2. 자동 병합이 작동하지 않음
- GitHub Actions 권한 확인
- 브랜치 보호 규칙 검토
- 워크플로우 실행 로그 확인

#### 3. 보안 검증 실패
- npm audit 결과 검토
- 테스트 실패 원인 분석
- 의존성 충돌 해결

### 디버깅 명령어

```bash
# 로컬에서 보안 감사 실행
npm audit

# 특정 심각도 이상 취약점만 표시
npm audit --audit-level=high

# JSON 형태로 상세 결과 출력
npm audit --json

# 자동 수정 시도
npm audit fix

# 강제 수정 (주의: 브레이킹 체인지 가능)
npm audit fix --force
```

## 📊 모니터링 및 리포팅

### 1. 보안 메트릭
- 발견된 취약점 수
- 패치 적용 시간
- 자동 처리 비율
- 수동 검토 필요 비율

### 2. 정기 리포트
- 주간 보안 요약
- 월간 의존성 업데이트 현황
- 분기별 보안 감사 결과

### 3. 알림 설정
- 중요/고위험 취약점 즉시 알림
- 자동 병합 완료 알림
- 수동 검토 필요 알림

## 🔧 고급 설정

### 1. 사용자 정의 보안 규칙
```yaml
# 특정 패키지 무시
ignore:
  - dependency-name: "example-package"
    versions: ["1.0.0"]
```

### 2. 브랜치별 설정
```yaml
# 개발 브랜치용 별도 설정
target-branch: "development"
```

### 3. 알림 통합
- Slack 통합
- Microsoft Teams 통합
- 이메일 알림

## 📚 참고 자료

- [GitHub Dependabot 공식 문서](https://docs.github.com/en/code-security/dependabot)
- [npm audit 가이드](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [보안 모범 사례](./SECURITY_IMPLEMENTATION.md)
- [GitHub Actions 워크플로우](https://docs.github.com/en/actions)

---

**마지막 업데이트**: 2025년 7월 15일  
**다음 검토 예정**: 2025년 10월 15일