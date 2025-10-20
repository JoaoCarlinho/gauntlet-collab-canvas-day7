module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true
  },
  extends: [
    'eslint:recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@typescript-eslint'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      // Test files
      files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*'],
      env: {
        jest: true,
        node: true,
      },
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    {
      // Utility files that use Node.js APIs
      files: ['src/utils/**/*', 'src/services/**/*'],
      env: {
        node: true,
        browser: false,
      },
      globals: {
        NodeJS: 'readonly',
        require: 'readonly',
        process: 'readonly',
        global: 'readonly',
      },
    },
    {
      // Component files
      files: ['src/components/**/*', 'src/hooks/**/*'],
      env: {
        browser: true,
        node: false,
      },
      globals: {
        PublicKeyCredential: 'readonly',
        AuthenticatorAssertionResponse: 'readonly',
      },
    },
  ],
  rules: {
    // React Refresh
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true 
      }
    ],
    
    // General rules
    'no-unused-vars': 'off', // Use TypeScript version instead
    'no-redeclare': 'off', // Use TypeScript version instead
    'no-undef': 'off', // TypeScript handles this
    'no-case-declarations': 'error',
    'no-control-regex': 'error',
    
    // Allow console in development
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    
    // Relax some rules for development
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
  },
}
