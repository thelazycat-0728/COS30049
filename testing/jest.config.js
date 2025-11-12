const path = require('path');
const rnPreset = require.resolve('@react-native/babel-preset', {
  paths: [path.resolve(__dirname, '../frontend/node_modules')],
});

module.exports = {
  // Set root to the COS30049 repo (one level up from testing/)
  rootDir: path.resolve(__dirname, '..'),
  testEnvironment: 'node',
  // Allow resolving deps from the frontend workspace where RN deps live
  // Prefer resolving packages from frontend first to avoid duplicate React copies
  moduleDirectories: ['<rootDir>/frontend/node_modules', 'node_modules', '<rootDir>/backend/node_modules'],
  // Transform JSX/ESNext using babel-jest with React Native preset
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: [rnPreset] }],
  },
  // Ensure React and test renderer resolve from frontend to avoid duplicate React copies
  moduleNameMapper: {
    '^react$': '<rootDir>/frontend/node_modules/react',
    '^react/(.*)$': '<rootDir>/frontend/node_modules/react/$1',
    // Resolve test renderer from testing workspace to ensure it exists
    '^react-test-renderer$': '<rootDir>/testing/node_modules/react-test-renderer',
    '^react-dom$': '<rootDir>/frontend/node_modules/react-dom',
    '^react/jsx-runtime$': '<rootDir>/frontend/node_modules/react/jsx-runtime',
    '^react/jsx-dev-runtime$': '<rootDir>/frontend/node_modules/react/jsx-dev-runtime',
    // Ensure server-side libs resolve from backend to match Express versions
    '^http-errors$': '<rootDir>/backend/node_modules/http-errors',
    '^statuses$': '<rootDir>/backend/node_modules/statuses',
    '^express$': '<rootDir>/backend/node_modules/express',
    // Ensure superagent uses compatible mime from testing workspace
    '^mime$': '<rootDir>/testing/node_modules/mime',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(react-native-maps)/)'
  ],
  // Global setup mocks
  setupFiles: ['<rootDir>/testing/jest.setup.js'],
  // Crawl the repo root
  roots: ['<rootDir>'],
  // Only run tests in the testing folder under COS30049
  testMatch: ['<rootDir>/testing/**/*.test.js'],
};