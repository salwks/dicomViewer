import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
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
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        // React/TypeScript globals
        React: 'readonly',
        JSX: 'readonly',
        // DOM globals
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        File: 'readonly',
        FileList: 'readonly',
        EventListener: 'readonly',
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
    },
    plugins: {
      security,
      '@typescript-eslint': tseslint,
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

      // TypeScript security rules (disabled type-aware rules for simplicity)
      '@typescript-eslint/no-explicit-any': 'warn',

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
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
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
  {
    ignores: [
      'dist/',
      'build/',
      'node_modules/',
      '*.config.js',
      '*.config.ts',
      'public/',
      'debug-login.js',
      'fix-events.js',
      'login-debug.js',
      'validate-security-config.js',
      'vite-security-headers-plugin.ts',
      'scripts/*.js',
      'run-*.js',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
    ],
  },
];