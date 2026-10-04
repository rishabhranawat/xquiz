import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'dist-safari/', 'safari/XQuizApp/', 'node_modules/', 'assets/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions, __XQUIZ_DEBUG__: 'readonly' },
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['scripts/**', 'tests/**', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
