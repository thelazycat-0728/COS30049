/**
 * Frontend MapScreen permission denied flow tests
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

process.env.EXPO_PUBLIC_API_BASE = 'http://localhost:3000';

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = ({ children, ...props }) => <View testID="mapview" {...props}>{children}</View>;
  const Marker = ({ children, ...props }) => <View testID="marker" {...props}>{children}</View>;
  const Heatmap = ({ children, ...props }) => <View testID="heatmap" {...props}>{children}</View>;
  return { __esModule: true, default: MapView, Marker, Heatmap };
});

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

jest.mock('expo-location', () => {
  const getForegroundPermissionsAsync = jest.fn();
  const requestForegroundPermissionsAsync = jest.fn();
  const getLastKnownPositionAsync = jest.fn();
  const getCurrentPositionAsync = jest.fn();
  return {
    getForegroundPermissionsAsync,
    requestForegroundPermissionsAsync,
    getLastKnownPositionAsync,
    getCurrentPositionAsync,
    Accuracy: { Balanced: 3, High: 5 },
    __mocks: {
      getForegroundPermissionsAsync,
      requestForegroundPermissionsAsync,
      getLastKnownPositionAsync,
      getCurrentPositionAsync,
    },
  };
});

import MapScreen from '../../frontend/src/screens/MapScreen';

describe('MapScreen permission denied flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('denied permission shows fallback region; no current position fetch', async () => {
    // Mock fetch for markers and families
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [] }) });

    const { __mocks } = require('expo-location');
    __mocks.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    __mocks.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    __mocks.getCurrentPositionAsync.mockResolvedValueOnce({ coords: { latitude: -1, longitude: -1 } });
    __mocks.getLastKnownPositionAsync.mockResolvedValueOnce(null);

    let tr;
    await act(async () => {
      tr = TestRenderer.create(<MapScreen />);
    });

    // Assert current position not fetched
    expect(__mocks.getCurrentPositionAsync).not.toHaveBeenCalled();

    // Fallback initial region remains default (Melbourne)
    const mapview = tr.root.findAll((n) => n.props && n.props.testID === 'mapview')[0];
    expect(mapview).toBeTruthy();
    const initial = mapview.props.initialRegion;
    expect(initial.latitude).toBeCloseTo(-37.8136);
    expect(initial.longitude).toBeCloseTo(144.9631);
  });
});