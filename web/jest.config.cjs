/** Jest の設定。TypeScript は ts-jest で変換し、画面は jsdom の中で動かす。 */
module.exports = {
  testEnvironment: 'jest-fixed-jsdom',
  testEnvironmentOptions: { customExportConditions: [''] },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.(t|j|mj)sx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json', diagnostics: { ignoreCodes: [1343] } }],
  },
  // MSW が使う部品の一部は ESM(.mjs)だけで配られているので、.mjs は変換する
  transformIgnorePatterns: ['/node_modules/(?!until-async/).+\\.(js|cjs)$'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json'],
  moduleNameMapper: {
    '\\.(css)$': 'identity-obj-proxy',
    '^highcharts-react-official$': '<rootDir>/tests/highchartsReactStub.tsx',
    '^highcharts$': '<rootDir>/tests/highchartsStub.ts',
  },
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
};
