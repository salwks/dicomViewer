import React, { useState, useEffect } from 'react';
import { Lock, User, Eye, EyeOff, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { useSecurityStore } from '../store';
import { validateUsername } from '../utils/input-validation';

interface SecurityLoginProps {
  onLoginSuccess?: () => void;
}

export const SecurityLogin: React.FC<SecurityLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { 
    login, 
    isAuthenticated, 
    currentUser, 
    isLocked, 
    lockoutTime, 
    loginAttempts,
    settings 
  } = useSecurityStore();

  // Check if account is locked and show countdown
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  useEffect(() => {
    if (isLocked && lockoutTime) {
      const updateCountdown = () => {
        const remaining = Math.max(0, lockoutTime - Date.now());
        setLockoutCountdown(remaining);
        
        if (remaining <= 0) {
          setError('');
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [isLocked, lockoutTime]);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      setSuccess(`Welcome back, ${currentUser.username}!`);
      onLoginSuccess?.();
    }
  }, [isAuthenticated, currentUser, onLoginSuccess]);

  // 폼 제출 이벤트 디버깅
  useEffect(() => {
    const form = document.querySelector('form');
    if (form) {
      console.log('🔐 Form element found, adding event listener');
      
      const handleFormSubmit = async (e: Event) => {
        console.log('🔐 Form submit event detected');
        e.preventDefault();
        
        // 수동으로 로그인 처리
        const usernameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
        
        if (usernameInput && passwordInput) {
          const usernameValue = usernameInput.value;
          const passwordValue = passwordInput.value;
          
          console.log('🔐 Manual form submission with values:', {
            username: usernameValue,
            password: passwordValue ? '***' : 'empty'
          });
          
          // 직접 로그인 로직 실행
          if (!usernameValue || !passwordValue) {
            console.log('🔐 Empty credentials, skipping login');
            return;
          }
          
          setError('');
          setSuccess('');
          setIsLoading(true);
          
          try {
            console.log('🔐 Calling login function directly...');
            const result = await login(usernameValue, passwordValue);
            console.log('🔐 Direct login result:', result);
            
            if (result) {
              setSuccess('Login successful!');
              setUsername('');
              setPassword('');
              if (onLoginSuccess) {
                onLoginSuccess();
              }
            } else {
              setError('Login failed. Please check your credentials.');
            }
          } catch (err) {
            console.error('🔐 Direct login error:', err);
            setError('Login failed. Please try again.');
          } finally {
            setIsLoading(false);
          }
        }
      };
      
      form.addEventListener('submit', handleFormSubmit);
      
      return () => {
        form.removeEventListener('submit', handleFormSubmit);
      };
    }
  }, [login, onLoginSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔐 handleLogin called');
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // 기본 입력 검증 (빈 값 체크)
      if (!username || username.trim() === '') {
        console.log('🔐 Login failed: empty username');
        setError('사용자명을 입력해주세요.');
        setIsLoading(false);
        return;
      }

      if (!password || password.trim() === '') {
        console.log('🔐 Login failed: empty password');
        setError('비밀번호를 입력해주세요.');
        setIsLoading(false);
        return;
      }

      // 사용자명 검증 (로그인 시에는 덜 엄격하게)
      const usernameValidation = validateUsername(username, {
        logAttempts: true
      });

      // 검증 실패 시 경고만 하고 로그인 시도는 계속 진행
      if (!usernameValidation.isValid) {
        console.warn('🔐 Username validation warning:', usernameValidation.errors);
      }

      // 원본 사용자명으로 로그인 시도 (sanitized 값 대신)
      console.log('🔐 Attempting login with:', { username: username.trim(), hasPassword: !!password });
      
      // 로그인 함수 호출
      const result = await login(username.trim(), password);
      console.log('🔐 Login result:', result);
      
      if (result) {
        console.log('🔐 Login successful, setting success message');
        setSuccess('Login successful!');
        setUsername('');
        setPassword('');
        
        // 로그인 성공 콜백 호출
        if (onLoginSuccess) {
          console.log('🔐 Calling onLoginSuccess callback');
          onLoginSuccess();
        }
      } else {
        console.log('🔐 Login failed, checking lock status:', { isLocked, loginAttempts });
        if (isLocked) {
          setError('Account is locked due to too many failed attempts.');
        } else {
          const remainingAttempts = settings.maxFailedAttempts - loginAttempts;
          setError(`Invalid credentials. ${remainingAttempts} attempts remaining.`);
        }
      }
    } catch (err) {
      console.error('🔐 Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getUserRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'text-red-600';
      case 'RADIOLOGIST': return 'text-blue-600';
      case 'TECHNICIAN': return 'text-green-600';
      case 'VIEWER': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (isAuthenticated && currentUser) {
    return (
      <div className="security-login-success min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-8">
            <div className="text-center">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-green-600 rounded-full blur-md opacity-20 animate-pulse"></div>
                <CheckCircle className="relative mx-auto text-green-600" size={64} />
              </div>
              
              <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                Welcome Back!
              </h2>
              
              <p className="text-gray-700 mb-6 text-lg">
                Hello, <strong className="text-green-700">{currentUser.username}</strong>
              </p>
              
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Role</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getUserRoleColor(currentUser.role)} bg-white shadow-sm`}>
                    {currentUser.role}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Session ID</span>
                  <span className="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded shadow-sm">
                    {currentUser.id}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Login Time</span>
                  <span className="text-xs text-gray-700">
                    {new Date(currentUser.loginTime).toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <p className="text-sm text-green-700 font-medium">
                  🎉 Authentication successful! You can now access the DICOM viewer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="security-login-container min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-md">
          {/* Main Login Card */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-8 space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-blue-600 rounded-full blur-md opacity-20"></div>
                <Shield className="relative mx-auto mb-4 text-blue-600" size={56} />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Clarity DICOM
              </h1>
              <p className="text-gray-600 mt-2 font-medium">
                Medical Imaging Viewer
              </p>
              <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mx-auto mt-3"></div>
            </div>

            {/* Status Messages */}
            {isLocked && lockoutCountdown > 0 && (
              <div className="relative overflow-hidden p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="text-red-600" size={24} />
                  </div>
                  <div className="ml-3">
                    <p className="font-semibold text-red-800">Account Locked</p>
                    <p className="text-sm text-red-700">
                      Too many failed attempts. Try again in {formatCountdown(lockoutCountdown)}
                    </p>
                  </div>
                </div>
                <div className="absolute top-0 left-0 w-full h-1 bg-red-200">
                  <div 
                    className="h-full bg-red-500 transition-all duration-1000"
                    style={{ width: `${Math.max(0, 100 - ((lockoutCountdown / (5 * 60 * 1000)) * 100))}%` }}
                  ></div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl">
                <div className="flex items-center">
                  <AlertTriangle className="text-red-600 mr-3" size={20} />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl">
                <div className="flex items-center">
                  <CheckCircle className="text-green-600 mr-3" size={20} />
                  <p className="text-sm text-green-700 font-medium">{success}</p>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-4">
                <div className="group">
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl 
                               bg-gray-50/50 backdrop-blur-sm
                               placeholder-gray-400 text-gray-900
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white
                               transition-all duration-200 ease-in-out
                               disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Enter your username"
                      required
                      disabled={isLoading || (isLocked && lockoutCountdown > 0)}
                    />
                  </div>
                </div>

                <div className="group">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl 
                               bg-gray-50/50 backdrop-blur-sm
                               placeholder-gray-400 text-gray-900
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white
                               transition-all duration-200 ease-in-out
                               disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Enter your password"
                      required
                      disabled={isLoading || (isLocked && lockoutCountdown > 0)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      disabled={isLoading || (isLocked && lockoutCountdown > 0)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || (isLocked && lockoutCountdown > 0)}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 ease-in-out
                  ${isLoading || (isLocked && lockoutCountdown > 0)
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  }
                  ${isLoading ? 'animate-pulse' : ''}
                `}
              >
                <div className="flex items-center justify-center">
                  {isLoading && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  )}
                  {isLoading ? 'Authenticating...' : 'Sign In'}
                </div>
              </button>
            </form>

            {/* Demo Users Info */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                  <User className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-800">Demo Accounts</h3>
              </div>
              
              <div className="grid gap-3">
                {[
                  { role: 'admin', pass: 'admin123', desc: '관리자', permissions: '모든 권한', color: 'from-red-500 to-red-600' },
                  { role: 'radiologist', pass: 'radio123', desc: '방사선과 의사', permissions: '보기, 측정, 내보내기', color: 'from-blue-500 to-blue-600' },
                  { role: 'technician', pass: 'tech123', desc: '기사', permissions: '보기, 측정', color: 'from-green-500 to-green-600' },
                  { role: 'viewer', pass: 'view123', desc: '뷰어', permissions: '보기 전용', color: 'from-gray-500 to-gray-600' }
                ].map((account, index) => (
                  <div key={index} className="bg-white rounded-lg p-3 border border-gray-200 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`h-3 w-3 bg-gradient-to-r ${account.color} rounded-full mr-2`}></div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-gray-800">{account.role}</span>
                            <span className="text-xs text-gray-500">/</span>
                            <span className="text-xs font-mono text-gray-600">{account.pass}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {account.desc} - {account.permissions}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUsername(account.role);
                          setPassword(account.pass);
                        }}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        사용
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="flex items-center">
                  <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                    <span className="text-white text-xs">💡</span>
                  </div>
                  <p className="text-xs text-blue-700 font-medium">
                    위 계정 중 하나를 선택하거나 직접 입력하여 로그인하세요.
                  </p>
                </div>
              </div>
            </div>

            {/* Security Info */}
            <div className="text-center">
              <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-full">
                <Shield className="h-4 w-4 text-gray-500 mr-2" />
                <span className="text-xs text-gray-600 font-medium">
                  Max attempts: {settings.maxFailedAttempts} • Session: {settings.sessionTimeout}min
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityLogin;