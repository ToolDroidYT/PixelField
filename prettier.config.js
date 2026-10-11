/** @type {import('prettier').Config} */
export default {
  // JavaScript / TypeScript
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',

  // Layout
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,

  // JSX / HTML
  jsxSingleQuote: true,
  bracketSameLine: false,
  bracketSpacing: true,

  // Keep experimental formatting disabled
  experimentalTernaries: false,

  // Import organization
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],

  importOrder: [
    '^react$',
    '^react-dom$',
    '^@sonrise/',
    '^@tooldroid/',
    '^@/',
    '<THIRD_PARTY_MODULES>',
    '^\\.\\./',
    '^\\./',
  ],

  importOrderParserPlugins: ['typescript', 'jsx'],
  importOrderTypeScriptVersion: '5.0.0',

  // Tailwind class sorting in utility helpers
  tailwindFunctions: ['cn', 'cva', 'clsx', 'twMerge'],
};
