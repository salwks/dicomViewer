/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_GA_MEASUREMENT_ID: string;
  // 다른 환경 변수들도 여기에 추가할 수 있습니다.
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}