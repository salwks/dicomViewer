/**
 * 로그인 디버깅 종합 진단 도구
 * 브라우저 콘솔에서 실행하여 로그인 문제를 분석합니다
 */

console.log('🔍 LOGIN DEBUGGING SUITE');
console.log('='.repeat(60));

// 1. 환경 체크
function checkEnvironment() {
  console.log('\n1️⃣ ENVIRONMENT CHECK');
  console.log('-'.repeat(30));
  
  const checks = {
    'React': typeof React !== 'undefined',
    'Zustand useSecurityStore': typeof window.useSecurityStore !== 'undefined',
    'Login form': !!document.querySelector('form'),
    'Username input': !!document.querySelector('input[type="text"]'),
    'Password input': !!document.querySelector('input[type="password"]'),
    'Login button': !!document.querySelector('button[type="submit"]'),
    'Current URL': window.location.href,
    'User Agent': navigator.userAgent
  };
  
  Object.entries(checks).forEach(([key, value]) => {
    const status = typeof value === 'boolean' ? (value ? '✅' : '❌') : '📋';
    console.log(`${status} ${key}:`, value);
  });
  
  return checks;
}

// 2. 스토어 상태 체크
function checkStoreState() {
  console.log('\n2️⃣ STORE STATE CHECK');
  console.log('-'.repeat(30));
  
  if (!window.useSecurityStore) {
    console.error('❌ useSecurityStore not found in window');
    return null;
  }
  
  try {
    const store = window.useSecurityStore.getState();
    console.log('Store state:', {
      isAuthenticated: store.isAuthenticated,
      currentUser: store.currentUser,
      loginAttempts: store.loginAttempts,
      isLocked: store.isLocked,
      lockoutTime: store.lockoutTime,
      settings: store.settings
    });
    
    return store;
  } catch (error) {
    console.error('❌ Error getting store state:', error);
    return null;
  }
}

// 3. 모의 사용자 데이터 체크
function checkMockUsers() {
  console.log('\n3️⃣ MOCK USERS CHECK');
  console.log('-'.repeat(30));
  
  const expectedUsers = {
    'admin': { password: 'admin123', role: 'ADMIN' },
    'radiologist': { password: 'radio123', role: 'RADIOLOGIST' },
    'technician': { password: 'tech123', role: 'TECHNICIAN' },
    'viewer': { password: 'view123', role: 'VIEWER' }
  };
  
  console.log('Expected users:', expectedUsers);
  
  // 스토어 코드에서 실제 사용자 데이터 추출 시도
  try {
    const storeCode = window.useSecurityStore.toString();
    console.log('Store contains mockUsers:', storeCode.includes('mockUsers'));
    console.log('Store contains admin:', storeCode.includes('admin'));
    console.log('Store contains admin123:', storeCode.includes('admin123'));
  } catch (error) {
    console.warn('Could not analyze store code:', error);
  }
  
  return expectedUsers;
}

// 4. 폼 상태 체크
function checkFormState() {
  console.log('\n4️⃣ FORM STATE CHECK');
  console.log('-'.repeat(30));
  
  const usernameInput = document.querySelector('input[type="text"]');
  const passwordInput = document.querySelector('input[type="password"]');
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (!usernameInput || !passwordInput || !submitButton) {
    console.error('❌ Form elements not found');
    return null;
  }
  
  const formState = {
    usernameValue: usernameInput.value,
    passwordValue: passwordInput.value,
    usernameDisabled: usernameInput.disabled,
    passwordDisabled: passwordInput.disabled,
    buttonDisabled: submitButton.disabled,
    buttonText: submitButton.textContent
  };
  
  console.log('Form state:', formState);
  return formState;
}

// 5. 로그인 함수 직접 테스트
async function testLoginFunction(username, password) {
  console.log(`\n5️⃣ TESTING LOGIN FUNCTION: ${username}`);
  console.log('-'.repeat(30));
  
  if (!window.useSecurityStore) {
    console.error('❌ useSecurityStore not available');
    return false;
  }
  
  try {
    const store = window.useSecurityStore.getState();
    console.log('Before login - store state:', {
      isAuthenticated: store.isAuthenticated,
      loginAttempts: store.loginAttempts,
      isLocked: store.isLocked
    });
    
    console.log('🔐 Calling login function...');
    const result = await store.login(username, password);
    
    console.log('Login function result:', result);
    
    const afterStore = window.useSecurityStore.getState();
    console.log('After login - store state:', {
      isAuthenticated: afterStore.isAuthenticated,
      currentUser: afterStore.currentUser,
      loginAttempts: afterStore.loginAttempts,
      isLocked: afterStore.isLocked
    });
    
    return result;
  } catch (error) {
    console.error('❌ Error in login function:', error);
    return false;
  }
}

// 6. UI 로그인 시뮬레이션
function simulateUILogin(username, password) {
  console.log(`\n6️⃣ SIMULATING UI LOGIN: ${username}`);
  console.log('-'.repeat(30));
  
  const usernameInput = document.querySelector('input[type="text"]');
  const passwordInput = document.querySelector('input[type="password"]');
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (!usernameInput || !passwordInput || !submitButton) {
    console.error('❌ Form elements not found');
    return false;
  }
  
  // 폼 필드 채우기
  usernameInput.value = username;
  passwordInput.value = password;
  
  // 이벤트 발생시키기
  usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
  usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
  passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  console.log('✅ Form filled with:', { username, password });
  
  // 제출 버튼 클릭
  setTimeout(() => {
    console.log('🔐 Clicking submit button...');
    submitButton.click();
    
    // 결과 확인
    setTimeout(() => {
      const store = window.useSecurityStore?.getState();
      console.log('UI Login result:', {
        isAuthenticated: store?.isAuthenticated || false,
        currentUser: store?.currentUser || null
      });
    }, 1000);
  }, 500);
  
  return true;
}

// 7. 종합 진단
async function runFullDiagnosis() {
  console.log('\n🏥 RUNNING FULL DIAGNOSIS');
  console.log('='.repeat(60));
  
  const env = checkEnvironment();
  const store = checkStoreState();
  const users = checkMockUsers();
  const form = checkFormState();
  
  if (!env['Zustand useSecurityStore']) {
    console.error('🚨 CRITICAL: useSecurityStore not found. Check if security store is properly initialized.');
    return;
  }
  
  if (!env['Login form']) {
    console.error('🚨 CRITICAL: Login form not found. Are you on the login page?');
    return;
  }
  
  // 각 테스트 사용자로 로그인 테스트
  const testUsers = [
    { username: 'admin', password: 'admin123' },
    { username: 'radiologist', password: 'radio123' }
  ];
  
  for (const user of testUsers) {
    console.log(`\n🧪 Testing user: ${user.username}`);
    const result = await testLoginFunction(user.username, user.password);
    console.log(`Result for ${user.username}:`, result ? '✅ SUCCESS' : '❌ FAILED');
    
    if (result) {
      console.log('🎉 Login successful! Stopping tests.');
      break;
    }
    
    // 다음 테스트를 위해 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// 8. 실시간 로그 모니터링
function startLogMonitoring() {
  console.log('\n📊 STARTING LOG MONITORING');
  console.log('-'.repeat(30));
  
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  console.log = function(...args) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('🔐')) {
      originalConsoleLog.apply(console, ['[LOGIN LOG]', ...args]);
    } else {
      originalConsoleLog.apply(console, args);
    }
  };
  
  console.warn = function(...args) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('🔐')) {
      originalConsoleWarn.apply(console, ['[LOGIN WARN]', ...args]);
    } else {
      originalConsoleWarn.apply(console, args);
    }
  };
  
  console.error = function(...args) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('🔐')) {
      originalConsoleError.apply(console, ['[LOGIN ERROR]', ...args]);
    } else {
      originalConsoleError.apply(console, args);
    }
  };
  
  console.log('✅ Log monitoring started. Login-related logs will be highlighted.');
  
  // 복구 함수
  window.stopLogMonitoring = function() {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.log('✅ Log monitoring stopped.');
  };
}

// 9. 빠른 수정 시도
function quickFixes() {
  console.log('\n🔧 ATTEMPTING QUICK FIXES');
  console.log('-'.repeat(30));
  
  try {
    const store = window.useSecurityStore?.getState();
    if (store) {
      // 계정 잠금 해제
      if (store.isLocked) {
        console.log('🔓 Unlocking account...');
        window.useSecurityStore.setState({
          isLocked: false,
          lockoutTime: null,
          loginAttempts: 0
        });
      }
      
      // 인증 상태 확인
      console.log('🔍 Checking authentication...');
      const authResult = store.checkAuthentication();
      console.log('Authentication result:', authResult);
    }
  } catch (error) {
    console.error('❌ Quick fixes failed:', error);
  }
}

// 메인 실행 함수들을 전역으로 노출
window.loginDebug = {
  checkEnvironment,
  checkStoreState,
  checkMockUsers,
  checkFormState,
  testLoginFunction,
  simulateUILogin,
  runFullDiagnosis,
  startLogMonitoring,
  quickFixes
};

// 자동 실행
console.log('🚀 AUTO-RUNNING BASIC DIAGNOSIS...');
runFullDiagnosis();

console.log('\n💡 AVAILABLE COMMANDS:');
console.log('- loginDebug.runFullDiagnosis() - Full diagnosis');
console.log('- loginDebug.testLoginFunction("admin", "admin123") - Test login function');
console.log('- loginDebug.simulateUILogin("admin", "admin123") - Simulate UI login');
console.log('- loginDebug.startLogMonitoring() - Monitor login logs');
console.log('- loginDebug.quickFixes() - Attempt quick fixes');
console.log('- stopLogMonitoring() - Stop log monitoring');

console.log('\n🎯 DEBUGGING COMPLETE!');