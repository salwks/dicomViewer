/**
 * ESLint Security Configuration
 * 보안 중심의 코딩 규칙을 정의합니다.
 */

module.exports = {
  languageOptions: {
    globals: {
      // Browser globals
      window: 'readonly',
      document: 'readonly',
      console: 'readonly',
      setTimeout: 'readonly',
      clearTimeout: 'readonly',
      setInterval: 'readonly',
      clearInterval: 'readonly',
      fetch: 'readonly',
      localStorage: 'readonly',
      sessionStorage: 'readonly',
      // Node.js globals
      process: 'readonly',
      Buffer: 'readonly',
      __dirname: 'readonly',
      __filename: 'readonly',
      require: 'readonly',
      module: 'readonly',
      exports: 'readonly',
      global: 'readonly',
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  plugins: {
    security: require('eslint-plugin-security'),
    '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Security-specific rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-bidi-characters': 'error',

    // TypeScript security rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',

    // General security best practices
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-proto': 'error',
    'no-iterator': 'error',
    'no-restricted-globals': [
      'error',
      {
        name: 'eval',
        message: 'eval() is dangerous and should not be used.',
      },
      {
        name: 'Function',
        message: 'Function constructor can be dangerous.',
      },
    ],

    // Prevent dangerous patterns
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error',

    // Input validation and sanitization
    'no-unused-vars': 'off', // TypeScript handles this
    '@typescript-eslint/no-unused-vars': 'warn',

    // Medical/DICOM specific security rules
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.name='localStorage'][arguments.0.type='Literal'][arguments.0.value=/password|token|key|secret/i]",
        message: 'Avoid storing sensitive data in localStorage without encryption.',
      },
      {
        selector: "CallExpression[callee.name='sessionStorage'][arguments.0.type='Literal'][arguments.0.value=/password|token|key|secret/i]",
        message: 'Avoid storing sensitive data in sessionStorage without encryption.',
      },
    ],

    // React security rules
    'react/no-danger': 'error',
    'react/no-danger-with-children': 'error',
    'react/jsx-no-script-url': 'error',
    'react/jsx-no-target-blank': ['error', { allowReferrer: false }],

    // Custom security rules for medical applications
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/node_modules/**'],
            message: 'Direct node_modules imports are not allowed.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-non-literal-require': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['src/utils/error-handler.ts', 'src/utils/debug-logger.ts'],
      rules: {
        'no-console': 'off', // Allow console usage in logging utilities
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'build/',
    'node_modules/',
    '*.config.js',
    '*.config.ts',
    'public/',
  ],
};