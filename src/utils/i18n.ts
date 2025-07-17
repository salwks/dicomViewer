/**
 * 다국어 지원 유틸리티
 * 언어별 번역 텍스트 관리
 */

export type Language = "EN" | "KR" | "JP" | "CN";

export interface TranslationKeys {
  // Header
  ready: string;
  loading: string;

  // Toolbar
  upload: string;
  layout: string;
  settings: string;
  license: string;
  flipHorizontal: string;
  flipVertical: string;
  rotateClockwise: string;
  rotateCounterclockwise: string;
  reset: string;
  zoom: string;
  contrast: string;
  capture: string;
  invert: string;

  // Sidebar
  seriesInfo: string;
  patientId: string;
  patientName: string;
  studyDate: string;
  modality: string;
  seriesNumber: string;
  instanceNumber: string;
  annotations: string;
  noAnnotations: string;
  settings: string;
  about: string;

  // File upload
  dragAndDrop: string;
  clickToUpload: string;
  supportedFormats: string;

  // Error messages
  errorOccurred: string;
  fileLoadError: string;
  unsupportedFormat: string;

  // Annotation tools
  length: string;
  area: string;
  angle: string;
  rectangle: string;
  ellipse: string;
  arrow: string;
  freehand: string;

  // Common
  close: string;
  save: string;
  cancel: string;
  ok: string;
  yes: string;
  no: string;

  // Security (when login enabled)
  login: string;
  logout: string;
  username: string;
  password: string;
  securityDashboard: string;

  // Additional UI elements
  fileManagement: string;
  fileNotLoaded: string;
  basicTools: string;
  annotationTools: string;
  loadedFiles: string;
  renderingStatus: string;
  files: string;
  noData: string;
  deleteAnnotation: string;
  deleteAllAnnotations: string;
  editAnnotationName: string;
  enterAnnotationName: string;
  clickToEdit: string;
  aboutDescription: string;
  dicomViewer: string;
  openSourceLicense: string;
  metaTags: string;
  allMetaTags: string;
  windowLevel: string;
  probe: string;
  textAnnotation: string;
  informationProbe: string;

  // Tool categories
  measurementTools: string;
  roiTools: string;
  advancedDrawing: string;
  imageManipulation: string;

  // Specific tools
  lengthTool: string;
  bidirectionalTool: string;
  rectangleROI: string;
  ellipseROI: string;
  circleROI: string;
  sphereROI: string;
  rectangleScissor: string;
  circleScissor: string;
  sphereScissor: string;
  brushTool: string;
  magnifyTool: string;

  // Additional missing translations
  fileManagementSection: string;
  metaTagViewer: string;
  viewMetaTags: string;
  closeMetaTagWindow: string;
  tagsDisplayed: string;
  renderingSuccessful: string;
  renderingFailed: string;
  processing: string;
  noMetaData: string;
  metaTagInfo: string;
  systemError: string;
  tryAgainLater: string;
  annotationSaved: string;
  pleaseEnterAnnotationLabel: string;
  searchPlaceholder: string;
  noResults: string;
  success: string;
  failed: string;

  // License modal
  noLibraryInfo: string;
  licenseDescription: string;
  licenseConditions: string;
  andMoreFiles: string;

  // Meta modal
  closeMetaModal: string;
  noSearchResults: string;
  noDicomTagInfo: string;

  // Application branding
  appName: string;
  appVersion: string;
  appDescription: string;
  createdBy: string;
  versionInfo: string;
  modernDicomViewer: string;
  builtWith: string;
  techStack: string;

  // Modal titles and labels
  closeModal: string;
  dicomMetaTags: string;
  runtimeDependencies: string;
  developmentDependencies: string;
  versionLabel: string;
  tagId: string;
  tagName: string;
  copyToClipboard: string;

  // Data display
  sequenceData: string;
  binaryData: string;
  emptyValue: string;
  parsingFailed: string;

  // Toast messages
  labelSanitized: string;
  fileWarning: string;
  filesRendered: string;
  captureError: string;

  // Measurement toast messages
  measurementCompleted: string;
  measurementUpdated: string;
  measurementRemoved: string;
  toolActivated: string;
  toolDeactivated: string;
  measurementDeleted: string;
  measurementDeleteFailed: string;
  measurementsSelected: string;
  undoNotImplemented: string;
  redoNotImplemented: string;
  measurementCopied: string;

  // Login screen
  welcomeBack: string;
  authenticationSuccess: string;
  loginButton: string;
  loginSubtitle: string;
  accountLocked: string;
  usernamePlaceholder: string;
  passwordPlaceholder: string;
  authenticating: string;
  forgotPassword: string;
  demoAccounts: string;
  useButton: string;
  secureAuth: string;
  hipaaCompliant: string;
  professionalGrade: string;

  // Error messages
  usernameRequired: string;
  passwordRequired: string;
  accountLockedMessage: string;
  invalidCredentials: string;
  searchInputError: string;
  inputValidationFailed: string;
  fileNameError: string;
  noDicomFiles: string;
  fileLoadError: string;

  // Empty states
  noSeriesLoaded: string;

  // UI elements
  selectLanguage: string;
  userGreeting: string;
  fileNumber: string;

  // Alerts and warnings
  rotationAngleError: string;
  layoutCapacityWarning: string;
  minViewportWarning: string;
  viewportSelectionWarning: string;
  testComplete: string;
  testError: string;
  debugComplete: string;
  noImagesLoaded: string;
  debugError: string;

  // Feedback modal
  feedback: string;
  feedbackTitle: string;
  feedbackContent: string;
  feedbackTitlePlaceholder: string;
  feedbackContentPlaceholder: string;
  pleaseEnterFeedback: string;
  feedbackSent: string;
  feedbackError: string;
  send: string;

  // Privacy Policy and Cookie Consent
  privacyPolicy: string;
  privacyPolicyTitle: string;
  privacyPolicyContent: string;
  cookieConsent: string;
  cookieConsentMessage: string;
  acceptCookies: string;
  declineCookies: string;
  cookieNotice: string;
  learnMore: string;
}

export const translations: Record<Language, TranslationKeys> = {
  EN: {
    // Header
    ready: "Ready",
    loading: "Loading...",

    // Toolbar
    upload: "Upload",
    layout: "Layout",
    settings: "Settings",
    license: "License",
    flipHorizontal: "Flip Horizontal",
    flipVertical: "Flip Vertical",
    rotateClockwise: "Rotate Clockwise",
    rotateCounterclockwise: "Rotate Counterclockwise",
    reset: "Reset",
    zoom: "Zoom",
    contrast: "Contrast",
    capture: "Capture",
    invert: "Invert Colors",

    // Sidebar
    seriesInfo: "Series Information",
    patientId: "Patient ID",
    patientName: "Patient Name",
    studyDate: "Study Date",
    modality: "Modality",
    seriesNumber: "Series Number",
    instanceNumber: "Instance Number",
    annotations: "Annotations",
    noAnnotations: "No annotations",
    about: "About",

    // File upload
    dragAndDrop: "Drag and drop DICOM files here",
    clickToUpload: "or click to upload",
    supportedFormats: "Supported formats: DCM, DICOM",

    // Error messages
    errorOccurred: "An error occurred",
    fileLoadError: "Failed to load file",
    unsupportedFormat: "Unsupported file format",

    // Annotation tools
    length: "Length",
    area: "Area",
    angle: "Angle",
    rectangle: "Rectangle",
    ellipse: "Ellipse",
    arrow: "Arrow",
    freehand: "Freehand",

    // Common
    close: "Close",
    save: "Save",
    cancel: "Cancel",
    ok: "OK",
    yes: "Yes",
    no: "No",

    // Security
    login: "Login",
    logout: "Logout",
    username: "Username",
    password: "Password",
    securityDashboard: "Security Dashboard",

    // Additional UI elements
    fileManagement: "File Management",
    fileNotLoaded: "No files loaded",
    basicTools: "Basic",
    annotationTools: "Annotate",
    loadedFiles: "Loaded Files",
    renderingStatus: "Rendering Status",
    files: "files",
    noData: "No data",
    deleteAnnotation: "Delete Annotation",
    deleteAllAnnotations: "Delete All Annotations",
    editAnnotationName: "Edit Annotation Name",
    enterAnnotationName: "Enter annotation name...",
    clickToEdit: "Click to edit name",
    aboutDescription: "Modern React-based DICOM viewer using Cornerstone3D",
    dicomViewer: "DICOM Viewer",
    openSourceLicense: "Open Source License",
    metaTags: "Meta Tags",
    allMetaTags: "View all meta tag information for DICOM files",
    windowLevel: "Window Level",
    probe: "Probe",
    textAnnotation: "Text Annotation - Text annotation (arrow + text)",
    informationProbe: "Probe Tool - Information probe",

    // Tool categories
    measurementTools: "Measure",
    roiTools: "ROI", 
    advancedDrawing: "Draw",
    imageManipulation: "Image",

    // Specific tools
    lengthTool: "Length Tool - Linear measurement",
    bidirectionalTool: "Bidirectional Tool - Two-way measurement",
    rectangleROI: "Rectangle ROI - Rectangular region",
    ellipseROI: "Ellipse ROI - Elliptical region",
    circleROI: "Circle ROI - Circular region",
    sphereROI: "Sphere ROI - Spherical region",
    rectangleScissor: "Rectangle Scissor - Rectangle cutting",
    circleScissor: "Circle Scissor - Circle cutting",
    sphereScissor: "Sphere Scissor - Sphere cutting",
    brushTool: "Brush Tool - Free drawing",
    magnifyTool: "Magnify Tool - Magnifier",

    // Additional missing translations
    fileManagementSection: "File Management",
    metaTagViewer: "Meta Tag Viewer",
    viewMetaTags: "View Meta Tags",
    closeMetaTagWindow: "Close Meta Tag Window",
    tagsDisplayed: "tags displayed",
    renderingSuccessful: "Successful",
    renderingFailed: "Failed",
    processing: "Processing",
    noMetaData: "No metadata available",
    metaTagInfo: "Meta Tag Information",
    systemError: "System error occurred",
    tryAgainLater: "Please try again later",
    annotationSaved: "Annotation label saved",
    pleaseEnterAnnotationLabel: "Please enter annotation label",
    searchPlaceholder: "Search...",
    noResults: "No results found",
    success: "Success",
    failed: "Failed",

    // License modal
    noLibraryInfo: "No library information available",
    licenseDescription:
      "This application is built using the open source libraries listed above.",
    licenseConditions:
      "All libraries are used according to their respective license conditions.",
    andMoreFiles: "... and {count} more",

    // Meta modal
    closeMetaModal: "Close Meta Tags",
    noSearchResults: "No search results found.",
    noDicomTagInfo: "No DICOM tag information available.",

    // Application branding
    appName: "Clarity",
    appVersion: "Alpha",
    appDescription: "DICOM Medical Image Viewer",
    createdBy: "Created by stra2003@gmail.com",
    versionInfo: "Version 0.1.0 - Alpha Release",
    modernDicomViewer: "Modern DICOM Viewer v2.0",
    builtWith: "Built with Cornerstone3D",
    techStack: "React + TypeScript",

    // Modal titles and labels
    closeModal: "Close Modal",
    dicomMetaTags: "DICOM Meta Tags",
    runtimeDependencies: "Runtime Dependencies",
    developmentDependencies: "Development Dependencies",
    versionLabel: "Version",
    tagId: "Tag ID",
    tagName: "Tag Name",
    copyToClipboard: "Copy to clipboard",

    // Data display
    sequenceData: "[Sequence Data]",
    binaryData: "[Binary Data]",
    emptyValue: "(empty)",
    parsingFailed: "(parsing failed)",

    // Toast messages
    labelSanitized: "Label was sanitized for security",
    fileWarning: "File warning",
    filesRendered: "files rendered successfully",
    captureError: "Failed to capture screen",

    // Measurement toast messages
    measurementCompleted: "measurement completed",
    measurementUpdated: "measurement updated",
    measurementRemoved: "measurement removed",
    toolActivated: "tool activated",
    toolDeactivated: "tool deactivated",
    measurementDeleted: "Measurement deleted",
    measurementDeleteFailed: "Failed to delete measurement",
    measurementsSelected: "measurements selected",
    undoNotImplemented: "Undo not implemented yet",
    redoNotImplemented: "Redo not implemented yet",
    measurementCopied: "Measurement copied to clipboard",

    // Login screen
    welcomeBack: "Welcome Back!",
    authenticationSuccess:
      "🎉 Authentication successful! Access granted to DICOM viewer.",
    loginButton: "Login",
    loginSubtitle: "Securely access the medical imaging system",
    accountLocked: "Account is locked",
    usernamePlaceholder: "Enter your username",
    passwordPlaceholder: "Enter your password",
    authenticating: "Authenticating...",
    forgotPassword: "Forgot your password?",
    demoAccounts: "Demo Accounts",
    useButton: "Use",
    secureAuth: "Secure Authentication",
    hipaaCompliant: "HIPAA Compliant",
    professionalGrade: "Professional Grade",

    // Error messages
    usernameRequired: "Please enter your username.",
    passwordRequired: "Please enter your password.",
    accountLockedMessage: "Account is locked due to too many failed attempts.",
    invalidCredentials: "Invalid credentials. {count} attempts remaining.",
    searchInputError: "Search input error",
    inputValidationFailed: "Input validation failed",
    fileNameError: "File name error",
    noDicomFiles: "No DICOM files found. Please select .dcm files.",

    // Empty states
    noSeriesLoaded: "No series loaded",

    // UI elements
    selectLanguage: "Select Language",
    userGreeting: "Hello, {username}",
    fileNumber: "File {number}",

    // Alerts and warnings
    rotationAngleError: "Please enter a valid rotation angle (0-359 degrees)",
    layoutCapacityWarning: "Layout capacity warning",
    minViewportWarning: "Minimum viewport warning",
    viewportSelectionWarning: "Viewport selection warning",
    testComplete: "Test completed",
    testError: "Test error",
    debugComplete: "Debug completed",
    noImagesLoaded: "No images loaded",
    debugError: "Debug error",

    // Feedback modal
    feedback: "Feedback",
    feedbackTitle: "Feedback Title",
    feedbackContent: "Feedback Content", 
    feedbackTitlePlaceholder: "Enter feedback title...",
    feedbackContentPlaceholder: "Please share your feedback, suggestions, or report any issues...",
    pleaseEnterFeedback: "Please enter both title and content",
    feedbackSent: "Thank you! Your feedback email has been prepared. Please send it from your email client.",
    feedbackError: "Failed to prepare feedback email. Please try again.",
    send: "Send",

    // Privacy Policy and Cookie Consent
    privacyPolicy: "Privacy Policy",
    privacyPolicyTitle: "Clarity Privacy Policy",
    privacyPolicyContent: `**Last Updated: July 17, 2025**

This Privacy Policy explains how Clarity ("we," "us," or "our") collects, uses, and discloses information about you.

## 1. Information We Collect

We automatically collect the following information for service improvement using Google Analytics:

**Usage Information**: IP address, browser type, OS, pages viewed, and visit times.

**Data Collection Method**: Data is collected automatically via cookies and tracking scripts from Google Analytics. This information does not personally identify you.

## 2. How We Share Your Information

We share information with Google LLC for the sole purpose of analyzing service usage.

## 3. Your Choices and Opt-Out Rights

You can opt-out of data collection from Google Analytics by installing the Google Analytics Opt-out Browser Add-on, available at: https://tools.google.com/dlpage/gaoptout.

## 4. Contact Us

If you have any questions, please contact us at stra2003@gmail.com.`,
    cookieConsent: "Cookie Consent",
    cookieConsentMessage: "We use cookies and Google Analytics to improve our service. By clicking 'Accept', you consent to our use of cookies and analytics tracking. For more information, please read our",
    acceptCookies: "Accept",
    declineCookies: "Decline",
    cookieNotice: "Cookie Notice",
    learnMore: "Privacy Policy",
  },

  KR: {
    // Header
    ready: "준비됨",
    loading: "로딩 중...",

    // Toolbar
    upload: "업로드",
    layout: "레이아웃",
    settings: "설정",
    license: "라이선스",
    flipHorizontal: "좌우 반전",
    flipVertical: "상하 반전",
    rotateClockwise: "시계방향 회전",
    rotateCounterclockwise: "반시계방향 회전",
    reset: "초기화",
    zoom: "확대/축소",
    contrast: "대비",
    capture: "캡처",
    invert: "색상 반전",

    // Sidebar
    seriesInfo: "시리즈 정보",
    patientId: "환자 ID",
    patientName: "환자명",
    studyDate: "검사일자",
    modality: "모달리티",
    seriesNumber: "시리즈 번호",
    instanceNumber: "인스턴스 번호",
    annotations: "주석",
    noAnnotations: "주석 없음",
    about: "정보",

    // File upload
    dragAndDrop: "DICOM 파일을 여기에 끌어다 놓으세요",
    clickToUpload: "또는 클릭하여 업로드",
    supportedFormats: "지원 형식: DCM, DICOM",

    // Error messages
    errorOccurred: "오류가 발생했습니다",
    fileLoadError: "파일 로드 실패",
    unsupportedFormat: "지원하지 않는 파일 형식",

    // Annotation tools
    length: "길이",
    area: "면적",
    angle: "각도",
    rectangle: "직사각형",
    ellipse: "타원",
    arrow: "화살표",
    freehand: "자유곡선",

    // Common
    close: "닫기",
    save: "저장",
    cancel: "취소",
    ok: "확인",
    yes: "예",
    no: "아니오",

    // Security
    login: "로그인",
    logout: "로그아웃",
    username: "사용자명",
    password: "비밀번호",
    securityDashboard: "보안 대시보드",

    // Additional UI elements
    fileManagement: "파일 관리",
    fileNotLoaded: "파일이 로드되지 않았습니다",
    basicTools: "기본",
    annotationTools: "주석",
    loadedFiles: "로드된 파일",
    renderingStatus: "렌더링 상태",
    files: "개",
    noData: "데이터 없음",
    deleteAnnotation: "주석 삭제",
    deleteAllAnnotations: "모든 주석 지우기",
    editAnnotationName: "주석 이름 편집",
    enterAnnotationName: "주석 이름 입력...",
    clickToEdit: "클릭하여 이름 편집",
    aboutDescription: "Cornerstone3D를 사용한 현대적인 React 기반 DICOM 뷰어",
    dicomViewer: "DICOM 뷰어",
    openSourceLicense: "오픈소스 라이선스",
    metaTags: "메타 태그",
    allMetaTags: "DICOM 파일의 모든 메타 태그 정보를 확인합니다",
    windowLevel: "윈도우 레벨",
    probe: "정보 탐침",
    textAnnotation: "텍스트 주석 - 텍스트 주석 (화살표 + 텍스트)",
    informationProbe: "정보 탐침 도구 - 정보 탐침",

    // Tool categories
    measurementTools: "측정",
    roiTools: "ROI",
    advancedDrawing: "그리기",
    imageManipulation: "이미지",

    // Specific tools
    lengthTool: "길이 도구 - 직선 측정",
    bidirectionalTool: "양방향 도구 - 양방향 측정",
    rectangleROI: "사각형 ROI - 사각형 영역",
    ellipseROI: "타원 ROI - 타원형 영역",
    circleROI: "원형 ROI - 원형 영역",
    sphereROI: "구형 ROI - 구형 영역",
    rectangleScissor: "사각형 가위 - 사각형 자르기",
    circleScissor: "원형 가위 - 원형 자르기",
    sphereScissor: "구형 가위 - 구형 자르기",
    brushTool: "브러시 도구 - 자유 그리기",
    magnifyTool: "돋보기 도구 - 돋보기",

    // Additional missing translations
    fileManagementSection: "파일 관리",
    metaTagViewer: "메타 태그 뷰어",
    viewMetaTags: "메타 태그 보기",
    closeMetaTagWindow: "Meta Tag 창 닫기",
    tagsDisplayed: "개의 태그가 표시됨",
    renderingSuccessful: "성공",
    renderingFailed: "실패",
    processing: "처리 중",
    noMetaData: "메타데이터가 없습니다",
    metaTagInfo: "메타 태그 정보",
    systemError: "시스템 오류가 발생했습니다",
    tryAgainLater: "잠시 후 다시 시도해주세요",
    annotationSaved: "주석 라벨이 저장되었습니다",
    pleaseEnterAnnotationLabel: "주석 라벨을 입력해주세요",
    searchPlaceholder: "검색...",
    noResults: "결과가 없습니다",
    success: "성공",
    failed: "실패",

    // License modal
    noLibraryInfo: "라이브러리 정보가 없습니다",
    licenseDescription:
      "이 애플리케이션은 위에 나열된 오픈소스 라이브러리들을 사용하여 제작되었습니다",
    licenseConditions:
      "모든 라이브러리는 각각의 라이선스 조건에 따라 사용됩니다",
    andMoreFiles: "... 및 {count}개 더",

    // Meta modal
    closeMetaModal: "Meta Tag 닫기",
    noSearchResults: "검색 결과가 없습니다",
    noDicomTagInfo: "DICOM 태그 정보가 없습니다",

    // Application branding
    appName: "Clarity",
    appVersion: "Alpha",
    appDescription: "DICOM 의료 영상 뷰어",
    createdBy: "stra2003@gmail.com에서 제작",
    versionInfo: "버전 0.1.0 - Alpha 릴리스",
    modernDicomViewer: "모던 DICOM 뷰어 v2.0",
    builtWith: "Cornerstone3D로 구축",
    techStack: "React + TypeScript",

    // Modal titles and labels
    closeModal: "모달 닫기",
    dicomMetaTags: "DICOM 메타 태그",
    runtimeDependencies: "런타임 의존성",
    developmentDependencies: "개발 의존성",
    versionLabel: "버전",
    tagId: "태그 ID",
    tagName: "태그 이름",
    copyToClipboard: "클립보드에 복사",

    // Data display
    sequenceData: "[시퀀스 데이터]",
    binaryData: "[바이너리 데이터]",
    emptyValue: "(비어있음)",
    parsingFailed: "(파싱 실패)",

    // Toast messages
    labelSanitized: "라벨이 보안상 수정되었습니다",
    fileWarning: "파일 경고",
    filesRendered: "개 파일 렌더링 완료",
    captureError: "화면을 캡처하는 데 실패했습니다",

    // Measurement toast messages
    measurementCompleted: "측정 완료",
    measurementUpdated: "측정 업데이트됨",
    measurementRemoved: "측정 제거됨",
    toolActivated: "도구 활성화됨",
    toolDeactivated: "도구 비활성화됨",
    measurementDeleted: "측정 삭제됨",
    measurementDeleteFailed: "측정 삭제 실패",
    measurementsSelected: "개의 측정 선택됨",
    undoNotImplemented: "되돌리기 아직 구현되지 않음",
    redoNotImplemented: "다시실행 아직 구현되지 않음",
    measurementCopied: "측정값이 클립보드에 복사됨",

    // Login screen
    welcomeBack: "다시 오신 것을 환영합니다!",
    authenticationSuccess: "🎉 인증 성공! DICOM 뷰어에 접근이 허용되었습니다.",
    loginButton: "로그인",
    loginSubtitle: "의료 영상 시스템에 안전하게 접속하세요",
    accountLocked: "계정이 잠겼습니다",
    usernamePlaceholder: "사용자명을 입력하세요",
    passwordPlaceholder: "비밀번호를 입력하세요",
    authenticating: "인증 중...",
    forgotPassword: "비밀번호를 잊으셨나요?",
    demoAccounts: "데모 계정",
    useButton: "사용",
    secureAuth: "보안 인증",
    hipaaCompliant: "HIPAA 준수",
    professionalGrade: "전문가급",

    // Error messages
    usernameRequired: "사용자명을 입력해주세요.",
    passwordRequired: "비밀번호를 입력해주세요.",
    accountLockedMessage: "너무 많은 시도로 인해 계정이 잠겼습니다.",
    invalidCredentials: "잘못된 자격증명입니다. {count}번의 시도가 남았습니다.",
    searchInputError: "검색 입력 오류",
    inputValidationFailed: "입력 검증 실패",
    fileNameError: "파일명 오류",
    noDicomFiles: "DICOM 파일이 없습니다. .dcm 파일을 선택해주세요.",

    // Empty states
    noSeriesLoaded: "로드된 시리즈가 없습니다",

    // UI elements
    selectLanguage: "언어 선택",
    userGreeting: "안녕하세요, {username}님",
    fileNumber: "파일 {number}",

    // Alerts and warnings
    rotationAngleError: "유효한 회전 각도(0-359도)를 입력해주세요",
    layoutCapacityWarning: "레이아웃 용량 경고",
    minViewportWarning: "최소 뷰포트 경고",
    viewportSelectionWarning: "뷰포트 선택 경고",
    testComplete: "테스트 완료",
    testError: "테스트 오류",
    debugComplete: "디버그 완료",
    noImagesLoaded: "로드된 이미지가 없습니다",
    debugError: "디버그 오류",

    // Feedback modal
    feedback: "피드백",
    feedbackTitle: "피드백 제목",
    feedbackContent: "피드백 내용",
    feedbackTitlePlaceholder: "피드백 제목을 입력하세요...",
    feedbackContentPlaceholder: "피드백, 제안사항, 또는 문제점을 공유해주세요...",
    pleaseEnterFeedback: "제목과 내용을 모두 입력해주세요",
    feedbackSent: "감사합니다! 피드백 이메일이 준비되었습니다. 이메일 클라이언트에서 전송해주세요.",
    feedbackError: "피드백 이메일 준비에 실패했습니다. 다시 시도해주세요.",
    send: "전송",

    // Privacy Policy and Cookie Consent
    privacyPolicy: "개인정보처리방침",
    privacyPolicyTitle: "Clarity 개인정보처리방침",
    privacyPolicyContent: `**최종 수정일: 2025년 7월 17일**

Clarity(이하 '서비스')는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」을 준수하고 있습니다.

## 1. 수집하는 개인정보의 항목 및 수집 방법

본 서비스는 별도의 회원가입 절차 없이 운영되며, 서비스 품질 향상 및 이용 경험 개선을 위해 아래와 같은 정보가 자동으로 수집될 수 있습니다.

**수집 항목**: IP 주소, 브라우저 종류 및 OS, 방문 일시, 서비스 이용 기록(페이지뷰, 클릭 등)

**수집 방법**: Google Analytics를 통한 자동 수집

**개인 식별 정보**: 위 정보는 통계적 분석을 위해 사용될 뿐, 개인을 직접적으로 식별할 수 있는 정보는 수집하지 않습니다.

## 2. 개인정보의 국외 이전 및 제3자 제공

서비스는 이용자의 정보를 아래와 같이 국외의 제3자에게 제공(처리 위탁)하고 있습니다.

**이전받는 자**: Google LLC (Google Analytics)
**이전되는 국가**: 미국
**이전 항목**: 제1항에서 수집하는 모든 정보
**이용 목적**: 접속 통계 분석
**보유 및 이용 기간**: 위 이용 목적 달성 시까지

## 3. 분석 도구 차단 방법

이용자는 Google Analytics 차단 브라우저 부가 기능을 설치하여 자신의 정보가 수집되는 것을 거부할 수 있습니다.

## 4. 문의

기타 개인정보 관련 문의는 stra2003@gmail.com로 연락 주시기 바랍니다.`,
    cookieConsent: "쿠키 동의",
    cookieConsentMessage: "저희는 서비스 개선을 위해 쿠키와 Google Analytics를 사용합니다. '동의'를 클릭하시면 쿠키 사용과 분석 추적에 동의하는 것입니다. 자세한 내용은",
    acceptCookies: "동의",
    declineCookies: "거부",
    cookieNotice: "쿠키 알림",
    learnMore: "개인정보처리방침",
  },

  JP: {
    // Header
    ready: "準備完了",
    loading: "読み込み中...",

    // Toolbar
    upload: "アップロード",
    layout: "レイアウト",
    settings: "設定",
    license: "ライセンス",
    flipHorizontal: "水平反転",
    flipVertical: "垂直反転",
    rotateClockwise: "時計回り回転",
    rotateCounterclockwise: "反時計回り回転",
    reset: "リセット",
    zoom: "ズーム",
    contrast: "コントラスト",
    capture: "キャプチャ",
    invert: "色の反転",

    // Sidebar
    seriesInfo: "シリーズ情報",
    patientId: "患者ID",
    patientName: "患者名",
    studyDate: "検査日",
    modality: "モダリティ",
    seriesNumber: "シリーズ番号",
    instanceNumber: "インスタンス番号",
    annotations: "注釈",
    noAnnotations: "注釈なし",
    about: "情報",

    // File upload
    dragAndDrop: "DICOMファイルをここにドラッグ＆ドロップ",
    clickToUpload: "またはクリックしてアップロード",
    supportedFormats: "サポート形式: DCM, DICOM",

    // Error messages
    errorOccurred: "エラーが発生しました",
    fileLoadError: "ファイルの読み込みに失敗",
    unsupportedFormat: "サポートされていないファイル形式",

    // Annotation tools
    length: "長さ",
    area: "面積",
    angle: "角度",
    rectangle: "矩形",
    ellipse: "楕円",
    arrow: "矢印",
    freehand: "フリーハンド",

    // Common
    close: "閉じる",
    save: "保存",
    cancel: "キャンセル",
    ok: "OK",
    yes: "はい",
    no: "いいえ",

    // Security
    login: "ログイン",
    logout: "ログアウト",
    username: "ユーザー名",
    password: "パスワード",
    securityDashboard: "セキュリティダッシュボード",

    // Additional UI elements
    fileManagement: "ファイル管理",
    fileNotLoaded: "ファイルが読み込まれていません",
    basicTools: "基本",
    annotationTools: "注釈",
    loadedFiles: "読み込まれたファイル",
    renderingStatus: "レンダリング状態",
    files: "個",
    noData: "データなし",
    deleteAnnotation: "注釈を削除",
    deleteAllAnnotations: "すべての注釈を削除",
    editAnnotationName: "注釈名を編集",
    enterAnnotationName: "注釈名を入力...",
    clickToEdit: "クリックして名前を編集",
    aboutDescription:
      "Cornerstone3Dを使用した現代的なReactベースのDICOMビューア",
    dicomViewer: "DICOMビューア",
    openSourceLicense: "オープンソースライセンス",
    metaTags: "メタタグ",
    allMetaTags: "DICOMファイルのすべてのメタタグ情報を確認",
    windowLevel: "ウィンドウレベル",
    probe: "プローブ",
    textAnnotation: "テキスト注釈 - テキスト注釈（矢印＋テキスト）",
    informationProbe: "プローブツール - 情報プローブ",

    // Tool categories
    measurementTools: "測定",
    roiTools: "ROI",
    advancedDrawing: "描画",
    imageManipulation: "画像",

    // Specific tools
    lengthTool: "長さツール - 直線測定",
    bidirectionalTool: "双方向ツール - 双方向測定",
    rectangleROI: "矩形ROI - 矩形領域",
    ellipseROI: "楕円ROI - 楕円領域",
    circleROI: "円形ROI - 円形領域",
    sphereROI: "球形ROI - 球形領域",
    rectangleScissor: "矩形はさみ - 矩形切り取り",
    circleScissor: "円形はさみ - 円形切り取り",
    sphereScissor: "球形はさみ - 球形切り取り",
    brushTool: "ブラシツール - 自由描画",
    magnifyTool: "拡大ツール - 拡大鏡",

    // Additional missing translations
    fileManagementSection: "ファイル管理",
    metaTagViewer: "メタタグビューア",
    viewMetaTags: "メタタグを表示",
    closeMetaTagWindow: "メタタグウィンドウを閉じる",
    tagsDisplayed: "個のタグが表示されています",
    renderingSuccessful: "成功",
    renderingFailed: "失敗",
    processing: "処理中",
    noMetaData: "メタデータがありません",
    metaTagInfo: "メタタグ情報",
    systemError: "システムエラーが発生しました",
    tryAgainLater: "しばらくしてから再度お試しください",
    annotationSaved: "注釈ラベルが保存されました",
    pleaseEnterAnnotationLabel: "注釈ラベルを入力してください",
    searchPlaceholder: "検索...",
    noResults: "結果が見つかりません",
    success: "成功",
    failed: "失敗",

    // License modal
    noLibraryInfo: "ライブラリ情報がありません",
    licenseDescription:
      "このアプリケーションは上記のオープンソースライブラリを使用して構築されています",
    licenseConditions:
      "すべてのライブラリはそれぞれのライセンス条件に従って使用されています",
    andMoreFiles: "... および他{count}個",

    // Meta modal
    closeMetaModal: "メタタグを閉じる",
    noSearchResults: "検索結果が見つかりません",
    noDicomTagInfo: "DICOMタグ情報がありません",

    // Application branding
    appName: "Clarity",
    appVersion: "Alpha",
    appDescription: "DICOM医療画像ビューアー",
    createdBy: "stra2003@gmail.com によって作成",
    versionInfo: "バージョン 0.1.0 - Alpha リリース",
    modernDicomViewer: "モダンDICOMビューアー v2.0",
    builtWith: "Cornerstone3Dで構築",
    techStack: "React + TypeScript",

    // Modal titles and labels
    closeModal: "モーダルを閉じる",
    dicomMetaTags: "DICOMメタタグ",
    runtimeDependencies: "ランタイム依存関係",
    developmentDependencies: "開発依存関係",
    versionLabel: "バージョン",
    tagId: "タグID",
    tagName: "タグ名",
    copyToClipboard: "クリップボードにコピー",

    // Data display
    sequenceData: "[シーケンスデータ]",
    binaryData: "[バイナリデータ]",
    emptyValue: "(空)",
    parsingFailed: "(解析失敗)",

    // Toast messages
    labelSanitized: "ラベルがセキュリティ上修正されました",
    fileWarning: "ファイル警告",
    filesRendered: "個のファイルレンダリング完了",
    captureError: "画面キャプチャに失敗しました",

    // Measurement toast messages
    measurementCompleted: "測定完了",
    measurementUpdated: "測定更新済み",
    measurementRemoved: "測定削除済み",
    toolActivated: "ツール有効化",
    toolDeactivated: "ツール無効化",
    measurementDeleted: "測定削除完了",
    measurementDeleteFailed: "測定削除失敗",
    measurementsSelected: "個の測定選択済み",
    undoNotImplemented: "元に戻すはまだ実装されていません",
    redoNotImplemented: "やり直しはまだ実装されていません",
    measurementCopied: "測定値がクリップボードにコピーされました",

    // Login screen
    welcomeBack: "お帰りなさい！",
    authenticationSuccess:
      "🎉 認証成功！DICOMビューアーへのアクセスが許可されました。",
    loginButton: "ログイン",
    loginSubtitle: "医療画像システムに安全にアクセスしてください",
    accountLocked: "アカウントがロックされています",
    usernamePlaceholder: "ユーザー名を入力してください",
    passwordPlaceholder: "パスワードを入力してください",
    authenticating: "認証中...",
    forgotPassword: "パスワードをお忘れですか？",
    demoAccounts: "デモアカウント",
    useButton: "使用",
    secureAuth: "セキュア認証",
    hipaaCompliant: "HIPAA準拠",
    professionalGrade: "プロフェッショナル仕様",

    // Error messages
    usernameRequired: "ユーザー名を入力してください。",
    passwordRequired: "パスワードを入力してください。",
    accountLockedMessage:
      "試行回数が多すぎるためアカウントがロックされました。",
    invalidCredentials: "無効な認証情報です。残り{count}回の試行が可能です。",
    searchInputError: "検索入力エラー",
    inputValidationFailed: "入力検証に失敗しました",
    fileNameError: "ファイル名エラー",
    noDicomFiles:
      "DICOMファイルが見つかりません。.dcmファイルを選択してください。",

    // Empty states
    noSeriesLoaded: "読み込まれたシリーズがありません",

    // UI elements
    selectLanguage: "言語選択",
    userGreeting: "こんにちは、{username}さん",
    fileNumber: "ファイル {number}",

    // Alerts and warnings
    rotationAngleError: "有効な回転角度（0-359度）を入力してください",
    layoutCapacityWarning: "レイアウト容量警告",
    minViewportWarning: "最小ビューポート警告",
    viewportSelectionWarning: "ビューポート選択警告",
    testComplete: "テスト完了",
    testError: "テストエラー",
    debugComplete: "デバッグ完了",
    noImagesLoaded: "読み込まれた画像がありません",
    debugError: "デバッグエラー",

    // Feedback modal
    feedback: "フィードバック",
    feedbackTitle: "フィードバックタイトル",
    feedbackContent: "フィードバック内容",
    feedbackTitlePlaceholder: "フィードバックタイトルを入力してください...",
    feedbackContentPlaceholder: "フィードバック、提案、または問題点をお聞かせください...",
    pleaseEnterFeedback: "タイトルと内容の両方を入力してください",
    feedbackSent: "ありがとうございます！フィードバックメールが準備されました。メールクライアントから送信してください。",
    feedbackError: "フィードバックメールの準備に失敗しました。再度お試しください。",
    send: "送信",

    // Privacy Policy and Cookie Consent
    privacyPolicy: "プライバシーポリシー",
    privacyPolicyTitle: "Clarity プライバシーポリシー（個人情報保護方針）",
    privacyPolicyContent: `**最終更新日：2025年7月17日**

Clarity（以下「当サービス」）は、ユーザーの個人情報の重要性を認識し、「個人情報の保護に関する法律」を遵守します。

## 1. 収集する情報と利用目的

サービスの品質向上および利用状況の分析のため、Google Analyticsを通じて以下の情報を自動的に収集します。

**収集項目**: IPアドレス、ブラウザの種類、OS、閲覧ページ、アクセス日時等の利用記録

**利用目的**: サービスの安定提供、維持、改善のための統計的分析

## 2. 第三者への情報提供及び国外移転

Google Analyticsの利用に伴い、収集されたユーザーの情報が米Google LLC等の日本国外にある事業者に転送されることがあります。

## 3. データ収集の無効化（オプトアウト）

ユーザーは、以下のリンクからGoogle Analyticsによるデータ収集を無効化できます。

Google アナリティクス オプトアウト アドオン: https://tools.google.com/dlpage/gaoptout?hl=ja

## 4. お問い合わせ

本ポリシーに関するお問い合わせは、stra2003@gmail.comまでお願いいたします。`,
    cookieConsent: "クッキー同意",
    cookieConsentMessage: "サービス改善のため、クッキーとGoogle Analyticsを使用しています。「同意する」をクリックすると、クッキーの使用と分析追跡に同意したことになります。詳細については",
    acceptCookies: "同意する",
    declineCookies: "拒否",
    cookieNotice: "クッキー通知",
    learnMore: "プライバシーポリシー",
  },

  CN: {
    // Header
    ready: "就绪",
    loading: "加载中...",

    // Toolbar
    upload: "上传",
    layout: "布局",
    settings: "设置",
    license: "许可证",
    flipHorizontal: "水平翻转",
    flipVertical: "垂直翻转",
    rotateClockwise: "顺时针旋转",
    rotateCounterclockwise: "逆时针旋转",
    reset: "重置",
    zoom: "缩放",
    contrast: "对比度",
    capture: "捕获",
    invert: "反转颜色",

    // Sidebar
    seriesInfo: "系列信息",
    patientId: "患者ID",
    patientName: "患者姓名",
    studyDate: "检查日期",
    modality: "成像模式",
    seriesNumber: "系列号",
    instanceNumber: "实例号",
    annotations: "注释",
    noAnnotations: "无注释",
    about: "关于",

    // File upload
    dragAndDrop: "将DICOM文件拖放到此处",
    clickToUpload: "或点击上传",
    supportedFormats: "支持格式：DCM、DICOM",

    // Error messages
    errorOccurred: "发生错误",
    fileLoadError: "文件加载失败",
    unsupportedFormat: "不支持的文件格式",

    // Annotation tools
    length: "长度",
    area: "面积",
    angle: "角度",
    rectangle: "矩形",
    ellipse: "椭圆",
    arrow: "箭头",
    freehand: "自由画笔",

    // Common
    close: "关闭",
    save: "保存",
    cancel: "取消",
    ok: "确定",
    yes: "是",
    no: "否",

    // Security
    login: "登录",
    logout: "注销",
    username: "用户名",
    password: "密码",
    securityDashboard: "安全仪表板",

    // Additional UI elements
    fileManagement: "文件管理",
    fileNotLoaded: "文件未加载",
    basicTools: "基本",
    annotationTools: "注释",
    loadedFiles: "已加载文件",
    renderingStatus: "渲染状态",
    files: "个",
    noData: "无数据",
    deleteAnnotation: "删除注释",
    deleteAllAnnotations: "删除所有注释",
    editAnnotationName: "编辑注释名称",
    enterAnnotationName: "输入注释名称...",
    clickToEdit: "点击编辑名称",
    aboutDescription: "使用Cornerstone3D的现代React基础DICOM查看器",
    dicomViewer: "DICOM查看器",
    openSourceLicense: "开源许可证",
    metaTags: "元标签",
    allMetaTags: "查看DICOM文件的所有元标签信息",
    windowLevel: "窗口级别",
    probe: "探针",
    textAnnotation: "文本注释 - 文本注释（箭头 + 文本）",
    informationProbe: "探针工具 - 信息探针",

    // Tool categories
    measurementTools: "测量",
    roiTools: "ROI",
    advancedDrawing: "绘图",
    imageManipulation: "图像",

    // Specific tools
    lengthTool: "长度工具 - 直线测量",
    bidirectionalTool: "双向工具 - 双向测量",
    rectangleROI: "矩形ROI - 矩形区域",
    ellipseROI: "椭圆ROI - 椭圆区域",
    circleROI: "圆形ROI - 圆形区域",
    sphereROI: "球形ROI - 球形区域",
    rectangleScissor: "矩形剪刀 - 矩形切割",
    circleScissor: "圆形剪刀 - 圆形切割",
    sphereScissor: "球形剪刀 - 球形切割",
    brushTool: "画笔工具 - 自由绘图",
    magnifyTool: "放大工具 - 放大镜",

    // Additional missing translations
    fileManagementSection: "文件管理",
    metaTagViewer: "元标签查看器",
    viewMetaTags: "查看元标签",
    closeMetaTagWindow: "关闭元标签窗口",
    tagsDisplayed: "个标签已显示",
    renderingSuccessful: "成功",
    renderingFailed: "失败",
    processing: "处理中",
    noMetaData: "无元数据",
    metaTagInfo: "元标签信息",
    systemError: "系统错误已发生",
    tryAgainLater: "请稍后再试",
    annotationSaved: "注释标签已保存",
    pleaseEnterAnnotationLabel: "请输入注释标签",
    searchPlaceholder: "搜索...",
    noResults: "无结果",
    success: "成功",
    failed: "失败",

    // License modal
    noLibraryInfo: "无库信息",
    licenseDescription: "此应用程序使用上述开源库构建",
    licenseConditions: "所有库均按各自许可条件使用",
    andMoreFiles: "... 和其他{count}个",

    // Meta modal
    closeMetaModal: "关闭元标签",
    noSearchResults: "没有找到搜索结果",
    noDicomTagInfo: "没有DICOM标签信息",

    // Application branding
    appName: "Clarity",
    appVersion: "Alpha",
    appDescription: "DICOM医疗影像查看器",
    createdBy: "由 stra2003@gmail.com 创建",
    versionInfo: "版本 0.1.0 - Alpha 发布",
    modernDicomViewer: "现代DICOM查看器 v2.0",
    builtWith: "基于Cornerstone3D构建",
    techStack: "React + TypeScript",

    // Modal titles and labels
    closeModal: "关闭模态框",
    dicomMetaTags: "DICOM元标签",
    runtimeDependencies: "运行时依赖项",
    developmentDependencies: "开发依赖项",
    versionLabel: "版本",
    tagId: "标签ID",
    tagName: "标签名称",
    copyToClipboard: "复制到剪贴板",

    // Data display
    sequenceData: "[序列数据]",
    binaryData: "[二进制数据]",
    emptyValue: "(空)",
    parsingFailed: "(解析失败)",

    // Toast messages
    labelSanitized: "标签已出于安全考虑被修改",
    fileWarning: "文件警告",
    filesRendered: "个文件渲染完成",
    captureError: "屏幕截图失败",

    // Measurement toast messages
    measurementCompleted: "测量完成",
    measurementUpdated: "测量已更新",
    measurementRemoved: "测量已移除",
    toolActivated: "工具已激活",
    toolDeactivated: "工具已停用",
    measurementDeleted: "测量已删除",
    measurementDeleteFailed: "删除测量失败",
    measurementsSelected: "个测量已选择",
    undoNotImplemented: "撤销功能尚未实现",
    redoNotImplemented: "重做功能尚未实现",
    measurementCopied: "测量值已复制到剪贴板",

    // Login screen
    welcomeBack: "欢迎回来！",
    authenticationSuccess: "🎉 认证成功！已授予DICOM查看器访问权限。",
    loginButton: "登录",
    loginSubtitle: "安全访问医疗影像系统",
    accountLocked: "账户已锁定",
    usernamePlaceholder: "请输入用户名",
    passwordPlaceholder: "请输入密码",
    authenticating: "认证中...",
    forgotPassword: "忘记密码？",
    demoAccounts: "演示账户",
    useButton: "使用",
    secureAuth: "安全认证",
    hipaaCompliant: "HIPAA合规",
    professionalGrade: "专业级别",

    // Error messages
    usernameRequired: "请输入用户名。",
    passwordRequired: "请输入密码。",
    accountLockedMessage: "由于尝试次数过多，账户已被锁定。",
    invalidCredentials: "无效凭据。剩余{count}次尝试。",
    searchInputError: "搜索输入错误",
    inputValidationFailed: "输入验证失败",
    fileNameError: "文件名错误",
    noDicomFiles: "未找到DICOM文件。请选择.dcm文件。",

    // Empty states
    noSeriesLoaded: "未加载系列",

    // UI elements
    selectLanguage: "选择语言",
    userGreeting: "您好，{username}",
    fileNumber: "文件 {number}",

    // Alerts and warnings
    rotationAngleError: "请输入有效的旋转角度（0-359度）",
    layoutCapacityWarning: "布局容量警告",
    minViewportWarning: "最小视口警告",
    viewportSelectionWarning: "视口选择警告",
    testComplete: "测试完成",
    testError: "测试错误",
    debugComplete: "调试完成",
    noImagesLoaded: "未加载图像",
    debugError: "调试错误",

    // Feedback modal
    feedback: "反馈",
    feedbackTitle: "反馈标题",
    feedbackContent: "反馈内容",
    feedbackTitlePlaceholder: "请输入反馈标题...",
    feedbackContentPlaceholder: "请分享您的反馈、建议或报告问题...",
    pleaseEnterFeedback: "请输入标题和内容",
    feedbackSent: "谢谢！反馈邮件已准备就绪。请从您的邮件客户端发送。",
    feedbackError: "准备反馈邮件失败。请重试。",
    send: "发送",

    // Privacy Policy and Cookie Consent
    privacyPolicy: "隐私政策",
    privacyPolicyTitle: "Clarity 隐私政策",
    privacyPolicyContent: `**最后更新日期：2025年7月17日**

Clarity（下称"我们"或"本服务"）尊重并保护所有使用服务用户的个人隐私。

## 1. 我们如何收集和使用您的个人信息

为改善服务质量，我们通过第三方分析工具 Google Analytics 自动收集您的某些信息。

**我们收集的信息**: 设备和日志信息，例如IP地址、浏览器类型、操作系统和您的服务使用记录。

**我们如何使用信息**: 用于统计分析，以了解用户如何使用我们的服务，从而改进和优化用户体验。

## 2. 个人信息的跨境传输

请您知悉，我们使用的分析工具Google Analytics由位于美国的公司Google提供。因此，为实现本政策所述的分析目的，您的个人信息将会被传输至中华人民共和国境外。对于上述个人信息的出境，我们将在获取您的单独同意后进行。

## 3. 您的权利与选择

您可以选择拒绝数据被收集。我们建议在中国大陆的用户通过网络设置来管理第三方追踪脚本的执行。

## 4. 如何联系我们

如果您对本隐私政策有任何疑问，请通过以下方式与我们联系：
电子邮箱：stra2003@gmail.com`,
    cookieConsent: "Cookie同意",
    cookieConsentMessage: "我们使用cookies和Google Analytics来改善我们的服务。点击\"接受\"，您同意我们使用cookies和分析跟踪。更多信息请查看我们的",
    acceptCookies: "接受",
    declineCookies: "拒绝",
    cookieNotice: "Cookie通知",
    learnMore: "隐私政策",
  },
};

// 현재 선택된 언어를 기본값으로 설정
export const DEFAULT_LANGUAGE: Language = "EN";

// 번역 함수
export function useTranslation(language: Language) {
  const t = (key: keyof TranslationKeys): string => {
    return (
      translations[language][key] || translations[DEFAULT_LANGUAGE][key] || key
    );
  };

  return { t, language };
}

// 언어 옵션 목록
export const LANGUAGE_OPTIONS: {
  value: Language;
  label: string;
  flag: string;
}[] = [
  { value: "EN", label: "English", flag: "🇺🇸" },
  { value: "KR", label: "한국어", flag: "🇰🇷" },
  { value: "JP", label: "日本語", flag: "🇯🇵" },
  { value: "CN", label: "中文", flag: "🇨🇳" },
];
