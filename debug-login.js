/**
 * 로그인 디버깅 스크립트
 * 브라우저 콘솔에서 실행 가능한 로그인 테스트
 */

console.log('🔐 Login Debug Script');
console.log('='.repeat(40));

// 사용 가능한 테스트 계정들
const testAccounts = [
  { username: 'admin', password: 'admin123', role: 'ADMIN' },
  { username: 'radiologist', password: 'radio123', role: 'RADIOLOGIST' },
  { username: 'technician', password: 'tech123', role: 'TECHNICIAN' },
  { username: 'viewer', password: 'view123', role: 'VIEWER' }
];

console.log('📋 Available Test Accounts:');
testAccounts.forEach((account, index) => {
  console.log(`${index + 1}. ${account.username} / ${account.password} (${account.role})`);
});

// 로그인 테스트 함수
window.testLogin = function(username, password) {
  console.log(`\n🔐 Testing login for: ${username}`);
  
  // 사용자명 필드 찾기
  const usernameField = document.querySelector('input[type="text"]');
  const passwordField = document.querySelector('input[type="password"]');
  const loginButton = document.querySelector('button[type="submit"]');
  
  if (!usernameField || !passwordField || !loginButton) {
    console.error('❌ Login form elements not found!');
    return;
  }
  
  // 필드 값 설정
  usernameField.value = username;
  passwordField.value = password;
  
  // 입력 이벤트 트리거
  usernameField.dispatchEvent(new Event('input', { bubbles: true }));
  passwordField.dispatchEvent(new Event('input', { bubbles: true }));
  
  console.log(`✅ Filled form with: ${username} / ${password}`);
  
  // 로그인 버튼 클릭
  setTimeout(() => {
    loginButton.click();
    console.log('🚀 Login button clicked');
  }, 100);
};

// 빠른 테스트 함수들
window.testAdmin = () => testLogin('admin', 'admin123');
window.testRadiologist = () => testLogin('radiologist', 'radio123');
window.testTechnician = () => testLogin('technician', 'tech123');
window.testViewer = () => testLogin('viewer', 'view123');

// 로그인 상태 확인 함수
window.checkLoginStatus = function() {
  console.log('\n🔍 Checking login status...');
  
  // 스토어에서 상태 확인
  if (window.useSecurityStore) {
    const store = window.useSecurityStore.getState();
    console.log('Security Store State:', {
      isAuthenticated: store.isAuthenticated,
      currentUser: store.currentUser,
      loginAttempts: store.loginAttempts,
      isLocked: store.isLocked
    });
  }
  
  // DOM 상태 확인
  const loginForm = document.querySelector('form');
  const userInfo = document.querySelector('.user-info');
  
  console.log('DOM State:', {
    loginFormVisible: !!loginForm,
    userInfoVisible: !!userInfo,
    currentUrl: window.location.href
  });
};

// 초기 상태 확인
console.log('\n🔍 Initial Status Check:');
checkLoginStatus();

console.log('\n💡 Usage Instructions:');
console.log('- testAdmin() - Test admin login');
console.log('- testRadiologist() - Test radiologist login');
console.log('- testTechnician() - Test technician login');
console.log('- testViewer() - Test viewer login');
console.log('- testLogin(username, password) - Test custom login');
console.log('- checkLoginStatus() - Check current login status');

console.log('\n🚀 Ready for testing!');