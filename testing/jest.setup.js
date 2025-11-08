// Global Jest setup for frontend and backend-integrated tests
// Load backend .env so DB-dependent tests have credentials
try {
  const path = require('path');
  const dotenv = require('dotenv');
  const backendEnv = path.resolve(__dirname, '../backend/.env');
  dotenv.config({ path: backendEnv });
} catch (e) {
  // If dotenv isn't available or .env missing, proceed; tests that require DB may fail
}

// Mock backend database pool to avoid real MySQL connections during tests
try {
  const path = require('path');
  const dbModulePath = path.resolve(__dirname, '../backend/src/config/database.js');
  jest.mock(dbModulePath, () => {
    const fakePool = {
      query: jest.fn(async () => [[]]),
      execute: jest.fn(async () => [{ insertId: 1 }]),
      getConnection: jest.fn(async () => ({ release: jest.fn() })),
    };
    return fakePool;
  });
} catch (e) {
  // If path resolution fails, continue without DB mock
}

// More robust: mock mysql2/promise used by database.js so createPool returns a stub
jest.mock('mysql2/promise', () => {
  return {
    createPool: jest.fn(() => ({
      query: jest.fn(async () => [[]]),
      execute: jest.fn(async () => [{ insertId: 1 }]),
      getConnection: jest.fn(async () => ({ release: jest.fn() })),
    })),
  };
});

// Mock @expo/vector-icons to simple stubs to avoid ESM transform issues
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const mk = (name) => (props) => React.createElement(name, props);
  return {
    Ionicons: mk('Ionicons'),
    MaterialIcons: mk('MaterialIcons'),
    FontAwesome5: mk('FontAwesome5'),
  };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const LinearGradient = (props) => React.createElement('LinearGradient', props);
  return { LinearGradient };
});

// Define RN global flags expected by react-native
global.__DEV__ = true;

// Note: Avoid mocking NativeAnimatedHelper when RN package layout may differ

// Provide a lightweight mock for react-native primitives used by MapScreen
jest.mock('react-native', () => {
  const StyleSheet = { create: (s) => s };
  const Platform = { OS: 'ios', select: (opts) => opts.ios };
  const AccessibilityInfo = { announceForAccessibility: jest.fn() };
  const Dimensions = { get: () => ({ width: 375, height: 812 }) };
  const Animated = {
    Value: function (v) { return { _value: v, setValue: jest.fn() }; },
    timing: jest.fn(() => ({ start: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
    View: 'Animated.View',
  };
  const BackHandler = {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  };
  return {
    StyleSheet,
    Text: 'Text',
    View: 'View',
    TouchableOpacity: 'TouchableOpacity',
    ActivityIndicator: 'ActivityIndicator',
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    RefreshControl: 'RefreshControl',
    StatusBar: 'StatusBar',
    SafeAreaView: 'SafeAreaView',
    TextInput: 'TextInput',
    Image: 'Image',
    Modal: 'Modal',
    Platform,
    AccessibilityInfo,
    Dimensions,
    Animated,
    BackHandler,
  };
});

// Mock AsyncStorage to avoid native dependency during tests
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
}));