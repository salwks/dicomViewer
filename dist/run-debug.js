/**
 * 로그인 디버깅 실행 스크립트
 * 이 스크립트를 브라우저 콘솔에 붙여넣어 실행하세요
 */

// 1. login-debug.js 스크립트 동적 로드
function loadLoginDebugScript() {
  const script = document.createElement('script');
  script.src = '/login-debug.js';
  script.onload = function() {
    console.log('✅ Login debug script loaded successfully');
  };
  script.onerror = function() {
    console.error('❌ Failed to load login debug script');
    console.log('📋 Running inline debug instead...');
    runInlineDebug();
  };
  document.head.appendChild(script);
}

// 2. 인라인 디버깅 함수 (스크립트 로드 실패 시)
function runInlineDebug() {
  console.log('🔍 INLINE LOGIN DEBUG');
  console.log('='.repeat(40));
  
  // 기본 환경 체크
  console.log('1. Environment Check:');
  console.log('- useSecurityStore available:', typeof window.useSecurityStore !== 'undefined');
  console.log('- Login form present:', !!document.querySelector('form'));
  console.log('- Username input present:', !!document.querySelector('input[type="text"]'));
  console.log('- Password input present:', !!document.querySelector('input[type="password"]'));
  
  // 스토어 상태 체크
  if (window.useSecurityStore) {
    console.log('\n2. Store State:');
    const state = window.useSecurityStore.getState();
    console.log('- isAuthenticated:', state.isAuthenticated);
    console.log('- currentUser:', state.currentUser);
    console.log('- loginAttempts:', state.loginAttempts);
    console.log('- isLocked:', state.isLocked);
    
    // 직접 로그인 테스트
    console.log('\n3. Direct Login Test:');
    window.useSecurityStore.getState().login('admin', 'admin123').then(result => {
      console.log('- Login result:', result);
      const newState = window.useSecurityStore.getState();
      console.log('- After login isAuthenticated:', newState.isAuthenticated);
      console.log('- After login currentUser:', newState.currentUser);
    });
  } else {
    console.error('❌ useSecurityStore not found in window');
  }
}

// 3. 메인 실행 함수
function runDebug() {
  console.log('🚀 STARTING LOGIN DEBUG');
  console.log('='.repeat(50));
  
  // 잠시 대기 후 디버깅 시작 (페이지 로드 완료 대기)
  setTimeout(() => {
    if (typeof window.useSecurityStore !== 'undefined') {
      console.log('✅ useSecurityStore found, loading debug script...');
      loadLoginDebugScript();
    } else {
      console.log('⏳ useSecurityStore not found, waiting...');
      setTimeout(runDebug, 1000);
    }
  }, 500);
}

// 자동 실행
runDebug();

console.log('💡 Debug script loaded. If this doesn\'t work, try:');
console.log('1. Refresh the page');
console.log('2. Make sure you\'re on the login page');
console.log('3. Check if the app is running properly');
console.log('4. Try manual login with: admin / admin123');