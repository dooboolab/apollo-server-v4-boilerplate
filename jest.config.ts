import type {JestConfigWithTsJest} from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.mjs$': '$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(\\.{1,2}/.*)\\.ts$': '$1',
  },
  testMatch: ['**/tests/**/*.(test).(ts|js)', '**/?(*.)+(spec).ts?(x)'],
  setupFilesAfterEnv: ['./tests/testSetup.ts'],
  moduleFileExtensions: ['ts', '.mjs', 'json', 'js'],
  modulePathIgnorePatterns: [
    '<rootDir>/package.json',
    '<rootDir>/dist/package.json',
  ],
  testEnvironment: 'jest-environment-node',
  transform: {
    '^.+\\.m?[tj]sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  // ignore below patterns for `jwks-client` pkg
  transformIgnorePatterns: [
    'node_modules/(?!(jwks-client|node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)/)',
  ],
};

export default jestConfig;
