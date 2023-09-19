const path = require('path');

module.exports = {
  root: true,
  extends: ['@dooboo/eslint-config-node', 'plugin:i18n-json/recommended'],
  plugins: ['simple-import-sort'],
  rules: {
    'eslint-comments/no-unlimited-disable': 0,
    'eslint-comments/no-unused-disable': 0,
    'prettier/prettier': 'error',
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          ['^\\u0000'],
          ['^react', '^@?\\w'],
          ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
          ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
        ],
      },
    ],
    'i18n-json/identical-keys': [
      2,
      {
        filePath: path.resolve('./locales/ko.json'),
      },
    ],
    'i18n-json/sorted-keys': [
      2,
      {
        order: 'asc',
        indentSpaces: 2,
      },
    ],
    'i18n-json/valid-message-syntax': [
      2,
      {
        syntax: path.resolve('./custom-syntax-validator.ts'),
      },
    ],
  },
};
