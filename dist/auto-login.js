/**
 * 자동 로그인 스크립트
 * 브라우저에서 자동으로 로그인을 시도합니다
 */

console.log('🤖 AUTO LOGIN SCRIPT');
console.log('='.repeat(30));

// 페이지 로드 완료 대기
function waitForPageReady() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve(true);
    } else {
      window.addEventListener('load', () => resolve(true));
    }
  });
}

// useSecurityStore 대기
function waitForSecurityStore() {
  return new Promise((resolve) => {
    const checkStore = () => {
      if (window.useSecurityStore) {
        resolve(true);
      } else {
        setTimeout(checkStore, 100);
      }
    };
    checkStore();
  });
}

// 폼 요소 대기
function waitForFormElements() {
  return new Promise((resolve) => {
    const checkForm = () => {
      const usernameInput = document.querySelector('input[type="text"]');
      const passwordInput = document.querySelector('input[type="password"]');
      const submitButton = document.querySelector('button[type="submit"]');
      
      if (usernameInput && passwordInput && submitButton) {
        resolve({ usernameInput, passwordInput, submitButton });
      } else {
        setTimeout(checkForm, 100);
      }
    };
    checkForm();
  });
}

// 자동 로그인 실행
async function performAutoLogin() {
  console.log('🔄 Starting auto login process...');
  
  try {
    // 1. 페이지 로드 대기
    console.log('1. Waiting for page ready...');
    await waitForPageReady();
    
    // 2. 보안 스토어 대기
    console.log('2. Waiting for security store...');
    await waitForSecurityStore();
    
    // 3. 폼 요소 대기
    console.log('3. Waiting for form elements...');
    const { usernameInput, passwordInput, submitButton } = await waitForFormElements();
    
    // 4. 이미 로그인되어 있는지 확인
    const store = window.useSecurityStore.getState();
    if (store.isAuthenticated) {
      console.log('✅ Already logged in as:', store.currentUser?.username);
      return;
    }
    
    // 5. 로그인 시도
    console.log('4. Attempting login...');
    
    // 폼 채우기
    usernameInput.value = 'admin';
    passwordInput.value = 'admin123';
    
    // React 이벤트 트리거
    const inputEvent = new Event('input', { bubbles: true });
    const changeEvent = new Event('change', { bubbles: true });
    
    usernameInput.dispatchEvent(inputEvent);
    usernameInput.dispatchEvent(changeEvent);
    passwordInput.dispatchEvent(inputEvent);
    passwordInput.dispatchEvent(changeEvent);
    
    console.log('5. Form filled, submitting...');
    
    // 폼 제출
    const form = document.querySelector('form');
    if (form) {
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
    } else {
      // 폼이 없으면 버튼 직접 클릭
      submitButton.click();
    }
    
    // 6. 로그인 결과 확인
    setTimeout(() => {
      const newStore = window.useSecurityStore.getState();
      if (newStore.isAuthenticated) {
        console.log('✅ Auto login successful!');
        console.log('User:', newStore.currentUser?.username);
        console.log('Role:', newStore.currentUser?.role);
      } else {
        console.log('❌ Auto login failed');
        console.log('Store state:', {
          isAuthenticated: newStore.isAuthenticated,
          loginAttempts: newStore.loginAttempts,
          isLocked: newStore.isLocked
        });
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ Auto login error:', error);
  }
}

// 수동 로그인 버튼 추가
function addManualLoginButton() {
  const existingButton = document.getElementById('manual-login-btn');
  if (existingButton) {
    existingButton.remove();
  }
  
  const button = document.createElement('button');
  button.id = 'manual-login-btn';
  button.textContent = '🔐 Manual Login (admin)';
  button.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 9999;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  button.onclick = () => {
    console.log('🔐 Manual login button clicked');
    performAutoLogin();
  };
  
  document.body.appendChild(button);
  console.log('✅ Manual login button added');
}

// 메인 실행
async function main() {
  console.log('🚀 Starting auto login script...');
  
  // 수동 로그인 버튼 추가
  addManualLoginButton();
  
  // 자동 로그인 시도
  await performAutoLogin();
}

// 전역 함수로 노출
window.autoLogin = performAutoLogin;
window.addLoginButton = addManualLoginButton;

// 자동 실행
main();

console.log('💡 Commands available:');
console.log('- autoLogin() - Try auto login');
console.log('- addLoginButton() - Add manual login button');
console.log('- Look for the blue login button in top-right corner');