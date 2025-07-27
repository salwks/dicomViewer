// 보안 강화 ESLint 설정 - 필수 준수사항 강제
module.exports = {
  extends: ['plugin:security/recommended'],
  plugins: ['security'],
  rules: {
    // 🔒 보안 규칙 - 절대 비활성화 금지
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-bidi-characters': 'error',
    
    // 🚫 위험한 패턴 차단
    'no-eval': 'error',
    'no-new-Function': 'error',
    'no-implied-eval': 'error',
    'no-script-url': 'error',
    'no-void': 'error',
    'no-with': 'error',
    
    // 📝 TypeScript 필수 규칙
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    
    // 🚨 콘솔 사용 제한
    'no-console': ['error', { 
      allow: ['warn', 'error', 'info'] 
    }],
    
    // ⚠️ 사용하지 않는 변수 금지
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    
    // 🛡️ 입력 검증 강제
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MemberExpression[computed=true][property.type="Identifier"]:not([object.type="ThisExpression"])',
        message: 'Computed property access with variable keys is forbidden. Use Map or hasOwnProperty check.'
      },
      {
        selector: 'MemberExpression[computed=true][property.type="MemberExpression"]',
        message: 'Nested computed property access is forbidden. Validate each level separately.'
      }
    ]
  },
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      rules: {
        // 테스트 파일에서만 완화
        '@typescript-eslint/no-explicit-any': 'warn',
        'security/detect-object-injection': 'warn'
      }
    }
  ]
};