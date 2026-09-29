import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      '.vercel/**',
      '.claude/**',
      'next-env.d.ts',
      // Plain Node (CommonJS) build script for the extension's icons, not app code.
      'chrome-extension/scripts/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Disable rules that are too strict for Next.js projects
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn', // Changed to "warn" so it doesn't fail builds
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Auto-fixable rules
      'prefer-const': 'warn',
      'no-console': 'off',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'semi': ['warn', 'always'],
      'comma-dangle': ['warn', 'always-multiline'],
    },
  },
);
