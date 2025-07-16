Clarity DICOM 뷰어 사이버 보안 강화 작업 지시서

프로젝트 목표: 현재 개발된 'Clarity' DICOM 뷰어에 최신 웹 표준에 맞는 사이버 보안 체계를 적용하여, 사용자가 안심하고 사용할 수 있는 안전한 애플리케이션으로 강화한다.

1단계: 의존성 취약점 분석 및 관리

설명:
우리가 사용하는 오픈소스 라이브러리(@cornerstonejs/tools 등)에서 알려진 보안 취약점이 있는지 확인하고 조치하는 과정입니다.

작업 내용:

프로젝트의 루트 디렉터리에서 npm audit 명령어를 실행하여 현재 설치된 모든 의존성의 보안 취약점을 스캔합니다.

심각한(High, Critical) 취약점이 발견될 경우, npm audit fix 명령어로 자동 수정을 시도하거나, 해당 라이브러리의 안전한 버전으로 직접 업데이트합니다.

(권장) GitHub 저장소에 Dependabot 설정을 활성화하여, 앞으로 새로운 취약점이 발견될 경우 자동으로 알림을 받고 패치 Pull Request를 생성하도록 시스템을 구축합니다.

2단계: XSS (Cross-Site Scripting) 방어 강화

설명:
사용자가 입력하는 값(예: 주석 이름)에 악성 스크립트가 포함되어, 다른 사용자의 브라우저에서 실행되는 것을 방지합니다. React는 대부분의 XSS 공격을 기본적으로 방어하지만, 추가적인 방어 로직을 구현하여 안정성을 높입니다.

작업 내용:

라이브러리 설치: HTML을 안전하게 정화(Sanitize)하는 가장 표준적인 라이브러리인 dompurify 와 관련 타입 정의를 설치합니다.

Bash
npm install dompurify
npm install --save-dev @types/dompurify
입력값 검증 로직 추가:

사용자가 주석 이름을 수정하는(updateAnnotationLabel) 로직을 찾습니다.

스토어에 저장하기 전에, DOMPurify.sanitize() 함수를 사용하여 사용자가 입력한 newLabel 값에서 모든 잠재적인 HTML 및 스크립트 태그를 제거하는 코드를 추가합니다.

3. 보안 HTTP 헤더 적용

설명:
브라우저가 잠재적으로 위험한 동작을 하지 못하도록, 서버가 응답에 특정 보안 규칙(헤더)을 포함하여 전송하도록 설정합니다. 이는 클릭재킹, 데이터 주입 등 다양한 공격을 방어하는 데 효과적입니다.

작업 내용:

Vite 플러그인 설치: Vite 환경에서 보안 헤더를 쉽게 추가할 수 있도록 도와주는 플러그인을 설치합니다.

Bash
npm install --save-dev vite-plugin-security-headers
vite.config.ts 설정:

vite.config.ts 파일에 플러그인을 추가하고, 가장 중요한 CSP(Content-Security-Policy) 를 포함한 보안 헤더를 설정합니다. CSP는 신뢰할 수 있는 소스에서만 스크립트나 이미지를 로드하도록 제한하는 강력한 보안 장치입니다.

설정 예시 (vite.config.ts):

TypeScript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { securityHeaders } from 'vite-plugin-security-headers';

export default defineConfig({
plugins: [
react(),
securityHeaders({
'Content-Security-Policy': {
'default-src': ["'self'"],
'script-src': ["'self'", "'unsafe-inline'"], // 인라인 스크립트 허용 (필요시 조정)
'style-src': ["'self'", "'unsafe-inline'"],
'img-src': ["'self'", 'data:', 'blob:'], // 캡처 기능 등을 위해 data:, blob: 허용
'connect-src': ["'self'"]
},
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
'X-Content-Type-Options': 'nosniff',
'X-Frame-Options': 'DENY',
'Referrer-Policy': 'strict-origin-when-cross-origin'
})
]
}); 4. 프로덕션 환경 로그 관리

설명:
개발 중에 유용했던 상세한 디버그 로그가, 실제 사용자가 사용하는 프로덕션 환경에서는 민감한 정보를 노출하거나 성능을 저하시킬 수 있습니다.

작업 내용:

src/utils/debug-logger.ts 파일을 수정합니다.

log, success, error, warn 등 모든 로깅 함수 내부 로직의 시작 부분에, 현재 환경이 프로덕션인지 확인하는 조건문을 추가합니다.

import.meta.env.PROD 값이 true일 경우 (즉, 프로덕션 빌드일 경우), 콘솔에 아무것도 출력하지 않고 즉시 함수를 종료(return)하도록 코드를 수정합니다.

최종 목표:
위 4단계를 모두 적용하여, 알려진 보안 취약점이 없고, XSS 공격으로부터 안전하며, 강력한 보안 정책하에 실행되고, 운영 환경에서는 불필요한 정보를 노출하지 않는 전문가 수준의 보안이 적용된 DICOM 뷰어를 완성해주세요.
