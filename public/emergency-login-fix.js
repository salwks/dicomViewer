/**
 * 응급 로그인 수정 스크립트
 * 브라우저 콘솔에서 실행하여 로그인 문제를 해결합니다
 */

console.log('🚨 EMERGENCY LOGIN FIX');
console.log('='.repeat(40));

// 1. 스토어 상태 리셋 및 초기화
function resetStore() {
  console.log('🔄 Resetting store...');
  
  // localStorage 클리어
  localStorage.removeItem('security-store');
  
  if (window.useSecurityStore) {
    const store = window.useSecurityStore.getState();
    
    // 스토어 상태 강제 리셋
    window.useSecurityStore.setState({
      isAuthenticated: false,
      currentUser: null,
      loginAttempts: 0,
      isLocked: false,
      lockoutTime: null,
      securityEvents: []
    });
    
    console.log('✅ Store reset complete');
  }
}

// 2. 강제 로그인 함수
async function forceLogin() {
  console.log('🔐 FORCE LOGIN ATTEMPT');
  
  if (!window.useSecurityStore) {
    console.error('❌ useSecurityStore not found');
    return false;
  }
  
  // 스토어 리셋 먼저 수행
  resetStore();
  
  try {
    const store = window.useSecurityStore.getState();
    
    // 직접 상태 설정으로 로그인 시뮬레이션
    const userSession = {
      id: `emergency_session_${Date.now()}`,
      userId: 'admin',
      username: 'admin',
      role: 'ADMIN',
      permissions: ['*'],
      loginTime: Date.now(),
      lastActivity: Date.now(),
      ipAddress: 'localhost',
      userAgent: navigator.userAgent,
    };
    
    // 강제로 인증 상태 설정
    window.useSecurityStore.setState({
      isAuthenticated: true,
      currentUser: userSession,
      loginAttempts: 0,
      isLocked: false,
      lockoutTime: null,
    });
    
    console.log('✅ Force login successful!');
    
    // 상태 확인
    const newState = window.useSecurityStore.getState();
    console.log('New state:', {
      isAuthenticated: newState.isAuthenticated,
      currentUser: newState.currentUser?.username,
      role: newState.currentUser?.role
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Force login failed:', error);
    return false;
  }
}

// 3. 폼 요소 직접 조작
function directFormLogin() {
  console.log('📝 DIRECT FORM LOGIN');
  
  const usernameInput = document.querySelector('input[type="text"]');
  const passwordInput = document.querySelector('input[type="password"]');
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (!usernameInput || !passwordInput || !submitButton) {
    console.error('❌ Form elements not found');
    return false;
  }
  
  // 폼 필드 채우기
  usernameInput.value = 'admin';
  passwordInput.value = 'admin123';
  
  // React 이벤트 트리거
  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });
  
  usernameInput.dispatchEvent(inputEvent);
  usernameInput.dispatchEvent(changeEvent);
  passwordInput.dispatchEvent(inputEvent);
  passwordInput.dispatchEvent(changeEvent);
  
  console.log('✅ Form filled');
  
  // 제출 버튼 클릭
  setTimeout(() => {
    submitButton.click();
    console.log('✅ Form submitted');
  }, 500);
  
  return true;
}

// 4. 페이지 강제 리로드
function forceReload() {
  console.log('🔄 Force reloading page...');
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// 5. 종합 수정 시도
async function emergencyFix() {
  console.log('🆘 EMERGENCY FIX SEQUENCE');
  console.log('='.repeat(30));
  
  // 1단계: 스토어 리셋
  console.log('Step 1: Reset store');
  resetStore();
  
  // 2단계: 강제 로그인
  console.log('Step 2: Force login');
  const forceResult = await forceLogin();
  
  if (forceResult) {
    console.log('✅ Emergency fix successful!');
    console.log('💡 User should now be authenticated');
    
    // 상태 확인을 위해 잠시 대기
    setTimeout(() => {
      const state = window.useSecurityStore.getState();
      console.log('Final state check:', {
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser?.username
      });
      
      // 여전히 로그인 화면이면 페이지 리로드
      if (document.querySelector('input[type="text"]')) {
        console.log('🔄 Still on login page, reloading...');
        forceReload();
      }
    }, 2000);
    
  } else {
    console.log('❌ Force login failed, trying form method');
    
    // 3단계: 폼 직접 조작
    console.log('Step 3: Direct form login');
    directFormLogin();
    
    // 4단계: 그래도 안 되면 리로드
    setTimeout(() => {
      console.log('Step 4: Force reload if still failed');
      forceReload();
    }, 3000);
  }
}

// 전역 함수로 노출
window.emergencyLogin = {
  resetStore,
  forceLogin,
  directFormLogin,
  forceReload,
  emergencyFix
};

// 사용 안내
console.log('\n💡 EMERGENCY COMMANDS:');
console.log('- emergencyLogin.emergencyFix() - 전체 수정 시도');
console.log('- emergencyLogin.forceLogin() - 강제 로그인');
console.log('- emergencyLogin.resetStore() - 스토어 리셋');
console.log('- emergencyLogin.directFormLogin() - 폼 직접 조작');

// 자동 실행
console.log('\n🚀 AUTO-RUNNING EMERGENCY FIX...');
emergencyFix();