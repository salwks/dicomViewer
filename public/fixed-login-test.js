/**
 * 수정된 로그인 테스트 스크립트
 * 페이지 새로고침 없이 로그인 테스트를 실행합니다
 */

console.log('🔧 FIXED LOGIN TEST');
console.log('='.repeat(40));

// 1. 기본 환경 체크
function checkEnvironment() {
  console.log('\n1. Environment Check:');
  console.log('- useSecurityStore available:', typeof window.useSecurityStore !== 'undefined');
  console.log('- Current URL:', window.location.href);
  console.log('- Login form present:', !!document.querySelector('form'));
  
  return typeof window.useSecurityStore !== 'undefined';
}

// 2. 현재 스토어 상태 확인
function checkCurrentState() {
  console.log('\n2. Current Store State:');
  
  if (!window.useSecurityStore) {
    console.error('❌ useSecurityStore not found');
    return false;
  }
  
  const state = window.useSecurityStore.getState();
  console.log('- isAuthenticated:', state.isAuthenticated);
  console.log('- currentUser:', state.currentUser);
  console.log('- loginAttempts:', state.loginAttempts);
  console.log('- isLocked:', state.isLocked);
  
  return state;
}

// 3. 로그인 테스트 (새로고침 방지)
async function testLoginWithoutRefresh() {
  console.log('\n3. Testing Login (No Refresh):');
  
  if (!window.useSecurityStore) {
    console.error('❌ useSecurityStore not found');
    return false;
  }
  
  try {
    // 로그인 실행
    console.log('🔐 Attempting login...');
    const result = await window.useSecurityStore.getState().login('admin', 'admin123');
    
    console.log('Login result:', result);
    
    // 로그인 후 상태 확인
    const newState = window.useSecurityStore.getState();
    console.log('After login:', {
      isAuthenticated: newState.isAuthenticated,
      currentUser: newState.currentUser?.username,
      role: newState.currentUser?.role
    });
    
    if (result && newState.isAuthenticated) {
      console.log('✅ LOGIN SUCCESS - No refresh needed!');
      console.log('💡 User should now be logged in');
      
      // 인증 상태 확인
      const authCheck = newState.checkAuthentication();
      console.log('Authentication check:', authCheck);
      
      return true;
    } else {
      console.log('❌ LOGIN FAILED');
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error);
    return false;
  }
}

// 4. localStorage 상태 확인
function checkLocalStorage() {
  console.log('\n4. LocalStorage Check:');
  
  try {
    const stored = localStorage.getItem('security-store');
    if (stored) {
      const data = JSON.parse(stored);
      console.log('Stored data:', {
        isAuthenticated: data.state?.isAuthenticated,
        currentUser: data.state?.currentUser?.username,
        version: data.version
      });
    } else {
      console.log('No stored data found');
    }
  } catch (error) {
    console.error('Error reading localStorage:', error);
  }
}

// 5. 메인 실행 함수
async function runFixedLoginTest() {
  console.log('🚀 Starting Fixed Login Test...');
  
  const envOk = checkEnvironment();
  if (!envOk) {
    console.error('❌ Environment check failed');
    return;
  }
  
  const currentState = checkCurrentState();
  if (!currentState) {
    console.error('❌ State check failed');
    return;
  }
  
  // 이미 로그인되어 있는지 확인
  if (currentState.isAuthenticated) {
    console.log('✅ Already logged in!');
    console.log('Current user:', currentState.currentUser?.username);
    return;
  }
  
  // 로그인 테스트 실행
  const loginSuccess = await testLoginWithoutRefresh();
  
  if (loginSuccess) {
    console.log('\n🎉 LOGIN TEST COMPLETE!');
    console.log('Check the app - user should be logged in now');
    
    // localStorage 상태 확인
    checkLocalStorage();
  } else {
    console.log('\n❌ LOGIN TEST FAILED');
  }
}

// 전역 함수로 노출
window.testFixedLogin = runFixedLoginTest;
window.checkAuth = checkCurrentState;
window.checkStorage = checkLocalStorage;

// 자동 실행
console.log('💡 Available commands:');
console.log('- testFixedLogin() - Run complete test');
console.log('- checkAuth() - Check current auth state');
console.log('- checkStorage() - Check localStorage');

console.log('\n🎯 Auto-running test...');
runFixedLoginTest();