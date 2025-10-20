// Progressive ESLint Configuration for Phase 4
// This configuration implements a progressive linting strategy that allows warnings
// while gradually improving code quality over time.

module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['react-refresh', '@typescript-eslint', 'react', 'react-hooks'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      // Test files - more lenient rules
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
      rules: {
        // Allow any types in tests for flexibility
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
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
    
    // React rules
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+
    'react/prop-types': 'off', // Using TypeScript for prop validation
    'react/display-name': 'warn',
    'react/no-unescaped-entities': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // TypeScript specific rules - PROGRESSIVE STRATEGY
    '@typescript-eslint/no-unused-vars': [
      'warn',
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
    
    // PHASE 4 PROGRESSIVE STRATEGY - All TypeScript rules as warnings
    // This allows the build to continue while gradually improving code quality
    
    // Phase 1: Allow all current warnings (Current Phase)
    '@typescript-eslint/no-explicit-any': 'warn', // Will become error in Phase 2
    '@typescript-eslint/no-non-null-assertion': 'warn', // Will become error in Phase 2
    '@typescript-eslint/ban-ts-comment': 'warn', // Will become error in Phase 2
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/prefer-as-const': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/ban-types': 'warn',
    '@typescript-eslint/no-extra-semi': 'warn',
    '@typescript-eslint/no-this-alias': 'warn',
    
    // Phase 2: Will be enabled in future phases
    // '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    // '@typescript-eslint/no-unsafe-assignment': 'warn',
    // '@typescript-eslint/no-unsafe-call': 'warn',
    // '@typescript-eslint/no-unsafe-member-access': 'warn',
    // '@typescript-eslint/no-unsafe-return': 'warn',
    // '@typescript-eslint/restrict-template-expressions': 'warn',
    // '@typescript-eslint/unbound-method': 'warn',
  },
}
