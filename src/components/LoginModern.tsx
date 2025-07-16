import React, { useState, useEffect } from 'react';
import { Lock, User, Eye, EyeOff, Shield, AlertTriangle, CheckCircle, Heart, Monitor } from 'lucide-react';
import { useSecurityStore } from '../store';
import { validateUsername } from '../utils/input-validation';

interface LoginModernProps {
  onLoginSuccess?: () => void;
}

export const LoginModern: React.FC<LoginModernProps> = ({ onLoginSuccess }) => {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // 기본 입력 검증
      if (!username || username.trim() === '') {
        setError('사용자명을 입력해주세요.');
        setIsLoading(false);
        return;
      }

      if (!password || password.trim() === '') {
        setError('비밀번호를 입력해주세요.');
        setIsLoading(false);
        return;
      }

      // 사용자명 검증
      const usernameValidation = validateUsername(username, {
        logAttempts: true
      });

      if (!usernameValidation.isValid) {
        console.warn('Username validation warning:', usernameValidation.errors);
      }

      // 로그인 시도
      const result = await login(username.trim(), password);
      
      if (result) {
        setSuccess('Login successful!');
        setUsername('');
        setPassword('');
        
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        if (isLocked) {
          setError('Account is locked due to too many failed attempts.');
        } else {
          const remainingAttempts = settings.maxFailedAttempts - loginAttempts;
          setError(`Invalid credentials. ${remainingAttempts} attempts remaining.`);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
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
      case 'ADMIN': return 'text-red-400';
      case 'RADIOLOGIST': return 'text-blue-400';
      case 'TECHNICIAN': return 'text-green-400';
      case 'VIEWER': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  // Google Fonts import
  const fontLink = (
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
      rel="stylesheet"
    />
  );

  // Add font link to document head
  useEffect(() => {
    const existingLink = document.querySelector('link[href*="fonts.googleapis.com"]');
    if (!existingLink) {
      const link = document.createElement('link');
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  }, []);

  if (isAuthenticated && currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mb-6">
              <CheckCircle className="mx-auto text-green-400" size={64} />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-50 mb-2">
              Welcome Back!
            </h2>
            
            <p className="text-gray-400 mb-6">
              Hello, <strong className="text-gray-50">{currentUser.username}</strong>
            </p>
            
            <div className="bg-gray-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Role</span>
                <span className={`text-sm font-semibold ${getUserRoleColor(currentUser.role)}`}>
                  {currentUser.role}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Session ID</span>
                <span className="text-xs font-mono text-gray-300">
                  {currentUser.id}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Login Time</span>
                <span className="text-xs text-gray-300">
                  {new Date(currentUser.loginTime).toLocaleString()}
                </span>
              </div>
            </div>
            
            <div className="mt-6 p-3 bg-green-900/30 border border-green-700 rounded-lg">
              <p className="text-sm text-green-400">
                🎉 Authentication successful! Access granted to DICOM viewer.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* 중앙 컨테이너 - 완전히 중앙 정렬 */}
      <div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-5xl mx-auto">
        <div className="flex min-h-[700px]">
          
          {/* 왼쪽 브랜딩 영역 (40%) */}
          <div className="w-2/5 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 p-16 flex flex-col justify-center relative overflow-hidden">
            {/* 배경 패턴 - 더 세련되게 */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-8 left-8">
                <Shield size={140} className="text-white rotate-12" />
              </div>
              <div className="absolute bottom-8 right-8">
                <Heart size={100} className="text-white -rotate-12" />
              </div>
              <div className="absolute top-1/2 right-1/3 transform -translate-y-1/2">
                <Monitor size={80} className="text-white rotate-6" />
              </div>
            </div>
            
            {/* 브랜딩 콘텐츠 - 완전히 중앙 정렬 */}
            <div className="relative z-10 text-center">
              <div className="mb-12">
                <div className="mx-auto mb-6 w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Shield className="text-white" size={40} />
                </div>
                <h1 className="text-6xl font-bold text-white mb-6 tracking-tight">
                  Clarity
                </h1>
                <div className="w-24 h-1 bg-white/40 rounded-full mx-auto mb-8"></div>
                <p className="text-blue-100 text-xl leading-relaxed font-light">
                  Advanced DICOM<br />Medical Imaging Viewer
                </p>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-center text-blue-100">
                  <div className="w-3 h-3 bg-white rounded-full mr-4 opacity-60"></div>
                  <span className="text-base font-medium">Secure Authentication</span>
                </div>
                <div className="flex items-center justify-center text-blue-100">
                  <div className="w-3 h-3 bg-white rounded-full mr-4 opacity-60"></div>
                  <span className="text-base font-medium">HIPAA Compliant</span>
                </div>
                <div className="flex items-center justify-center text-blue-100">
                  <div className="w-3 h-3 bg-white rounded-full mr-4 opacity-60"></div>
                  <span className="text-base font-medium">Professional Grade</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* 오른쪽 폼 영역 (60%) */}
          <div className="w-3/5 p-16 flex flex-col justify-center bg-gray-800">
            <div className="max-w-md mx-auto w-full">
              
              {/* 폼 헤더 - 중앙 정렬 */}
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-semibold text-gray-50 mb-4">
                  로그인
                </h2>
                <p className="text-gray-400 text-base">
                  의료 영상 시스템에 안전하게 접속하세요
                </p>
                <div className="w-16 h-0.5 bg-blue-600 mx-auto mt-4"></div>
              </div>

              {/* 상태 메시지 */}
              {isLocked && lockoutCountdown > 0 && (
                <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-md">
                  <div className="flex items-center">
                    <AlertTriangle className="text-red-400 mr-3" size={20} />
                    <div>
                      <p className="font-semibold text-red-300">계정이 잠겼습니다</p>
                      <p className="text-sm text-red-400">
                        {formatCountdown(lockoutCountdown)} 후 다시 시도하세요
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-md">
                  <div className="flex items-center">
                    <AlertTriangle className="text-red-400 mr-3" size={16} />
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-md">
                  <div className="flex items-center">
                    <CheckCircle className="text-green-400 mr-3" size={16} />
                    <p className="text-sm text-green-300">{success}</p>
                  </div>
                </div>
              )}

              {/* 로그인 폼 */}
              <form onSubmit={handleLogin} className="space-y-8">
                
                {/* 사용자명 입력 */}
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-3">
                    사용자명
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-6 py-4 pl-12 text-gray-50 placeholder-gray-500 text-lg
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none
                               transition-all duration-200 ease-in-out
                               disabled:opacity-50 disabled:cursor-not-allowed
                               hover:border-gray-500"
                      placeholder="사용자명을 입력하세요"
                      required
                      disabled={isLoading || (isLocked && lockoutCountdown > 0)}
                    />
                  </div>
                </div>

                {/* 비밀번호 입력 */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-3">
                    비밀번호
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-6 py-4 pl-12 pr-12 text-gray-50 placeholder-gray-500 text-lg
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none
                               transition-all duration-200 ease-in-out
                               disabled:opacity-50 disabled:cursor-not-allowed
                               hover:border-gray-500"
                      placeholder="비밀번호를 입력하세요"
                      required
                      disabled={isLoading || (isLocked && lockoutCountdown > 0)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      disabled={isLoading || (isLocked && lockoutCountdown > 0)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* 로그인 버튼 */}
                <button
                  type="submit"
                  disabled={isLoading || (isLocked && lockoutCountdown > 0)}
                  className={`w-full py-4 px-6 rounded-lg font-bold text-lg text-white transition-all duration-300 ease-in-out
                    ${isLoading || (isLocked && lockoutCountdown > 0)
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:scale-105 focus:ring-4 focus:ring-blue-500/50 focus:outline-none active:scale-95'
                    }
                  `}
                >
                  <div className="flex items-center justify-center">
                    {isLoading && (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    )}
                    {isLoading ? '인증 중...' : '로그인'}
                  </div>
                </button>
              </form>

              {/* 하단 링크 */}
              <div className="mt-8 text-center">
                <a 
                  href="#" 
                  className="text-gray-400 hover:text-blue-500 text-base transition-colors duration-200 font-medium"
                  onClick={(e) => e.preventDefault()}
                >
                  비밀번호를 잊으셨나요?
                </a>
              </div>

              {/* 데모 계정 정보 */}
              <div className="mt-10 p-6 bg-gray-700/30 rounded-xl border border-gray-600/50 backdrop-blur-sm">
                <h4 className="text-base font-bold text-gray-300 mb-5 text-center">데모 계정</h4>
                <div className="space-y-3">
                  {[
                    { role: 'admin', pass: 'admin123', desc: '관리자', permissions: '모든 권한', color: 'bg-red-500' },
                    { role: 'radiologist', pass: 'radio123', desc: '방사선과 의사', permissions: '진단 권한', color: 'bg-blue-500' },
                    { role: 'technician', pass: 'tech123', desc: '기사', permissions: '촬영 권한', color: 'bg-green-500' },
                    { role: 'viewer', pass: 'view123', desc: '뷰어', permissions: '보기 전용', color: 'bg-gray-500' }
                  ].map((account, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-800/60 rounded-lg border border-gray-600/30 hover:bg-gray-800 transition-all duration-200">
                      <div className="flex items-center space-x-4">
                        <div className={`w-4 h-4 rounded-full ${account.color}`}></div>
                        <div>
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-300 font-bold text-sm">{account.role}</span>
                            <span className="text-gray-500">/</span>
                            <span className="text-gray-400 font-mono text-sm">{account.pass}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
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
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
                      >
                        사용
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 보안 정보 */}
              <div className="mt-8 text-center">
                <div className="inline-flex items-center text-sm text-gray-500 bg-gray-700/30 px-4 py-2 rounded-full">
                  <Shield className="mr-2" size={16} />
                  <span>
                    최대 시도: {settings.maxFailedAttempts}회 • 세션: {settings.sessionTimeout}분
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModern;