/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        module: 'commonjs',
        moduleResolution: 'node',
      },
    }],
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'scripts/**/*.js',
    '!src/**/*.d.ts',
    '!src/app/layout.tsx',
    '!src/app/providers.tsx',
  ],
  coverageThreshold: {
    // Thresholds for core functionality files
    './src/utils/deploymentMode.ts': {
      branches: 70,
      functions: 80,
      lines: 70,
      statements: 70,
    },
    './src/hooks/useLocalAbis.ts': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    './scripts/bundle-local-abis.js': {
      branches: 40,
      functions: 60,
      lines: 50,
      statements: 50,
    },
  },
};

module.exports = config;
