/**
 * 간단한 로그인 테스트 스크립트
 * 브라우저 콘솔에서 실행
 */

console.log('🧪 SIMPLE LOGIN TEST');
console.log('='.repeat(30));

// 1. 현재 상태 확인
console.log('1. Current state:');
if (window.useSecurityStore) {
  const state = window.useSecurityStore.getState();
  console.log('- isAuthenticated:', state.isAuthenticated);
  console.log('- currentUser:', state.currentUser?.username);
  console.log('- URL:', window.location.href);
} else {
  console.log('❌ useSecurityStore not found');
}

// 2. 로그인 함수
window.quickLogin = async function() {
  console.log('\n🔐 Quick Login Test');
  
  if (!window.useSecurityStore) {
    console.error('❌ useSecurityStore not found');
    return;
  }
  
  const store = window.useSecurityStore.getState();
  
  console.log('Before login:', {
    isAuthenticated: store.isAuthenticated,
    currentUser: store.currentUser
  });
  
  try {
    const result = await store.login('admin', 'admin123');
    console.log('Login result:', result);
    
    const newState = window.useSecurityStore.getState();
    console.log('After login:', {
      isAuthenticated: newState.isAuthenticated,
      currentUser: newState.currentUser?.username
    });
    
    if (result && newState.isAuthenticated) {
      console.log('✅ LOGIN SUCCESS!');
      console.log('💡 User should be authenticated now');
      
      // Check localStorage
      setTimeout(() => {
        console.log('LocalStorage check:', {
          stored: !!localStorage.getItem('security-store'),
          data: localStorage.getItem('security-store')?.substring(0, 100) + '...'
        });
      }, 100);
      
    } else {
      console.log('❌ LOGIN FAILED');
    }
    
  } catch (error) {
    console.error('Login error:', error);
  }
};

// 3. 스토어 상태 확인 함수
window.checkStore = function() {
  console.log('\n📊 Store Status:');
  if (window.useSecurityStore) {
    const state = window.useSecurityStore.getState();
    console.log('- isAuthenticated:', state.isAuthenticated);
    console.log('- currentUser:', state.currentUser);
    console.log('- loginAttempts:', state.loginAttempts);
    console.log('- isLocked:', state.isLocked);
    
    if (state.currentUser) {
      console.log('- User role:', state.currentUser.role);
      console.log('- Login time:', new Date(state.currentUser.loginTime).toLocaleString());
      console.log('- Last activity:', new Date(state.currentUser.lastActivity).toLocaleString());
    }
  } else {
    console.log('❌ useSecurityStore not found');
  }
};

// 4. 로그아웃 함수
window.quickLogout = function() {
  console.log('\n🚪 Quick Logout');
  if (window.useSecurityStore) {
    const store = window.useSecurityStore.getState();
    store.logout();
    console.log('✅ Logged out');
    setTimeout(() => checkStore(), 100);
  } else {
    console.log('❌ useSecurityStore not found');
  }
};

// 5. 자동 실행
console.log('\n💡 Available commands:');
console.log('- quickLogin() - Test login');
console.log('- checkStore() - Check store state');  
console.log('- quickLogout() - Logout');

console.log('\n🎯 Auto-checking initial state...');
window.checkStore();

// 6. 스토어 변경 감지
if (window.useSecurityStore) {
  window.useSecurityStore.subscribe(
    (state) => state.isAuthenticated,
    (isAuthenticated) => {
      console.log('🔄 Authentication state changed:', isAuthenticated);
    }
  );
  console.log('✅ Store subscription set up');
}

console.log('\n🚀 Test ready! Try quickLogin()');