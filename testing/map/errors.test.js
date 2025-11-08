/**
 * Frontend MapScreen error handling tests
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
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3, High: 5 },
}));

import MapScreen from '../../frontend/src/screens/MapScreen';

describe('MapScreen fetch error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('locations fetch failure logs error and preserves map state', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const initialLocations = { locations: [
      { observation_id: 1, plant_id: 10, plant: { family: 'Fabaceae' }, coordinates: { lat: -37.8, lon: 144.96 } },
    ]};
    const fetchSpy = jest.fn()
      // initial success to set markers
      .mockResolvedValueOnce({ ok: true, json: async () => initialLocations })
      // family options
      .mockResolvedValueOnce({ ok: true, json: async () => initialLocations })
      // subsequent failure on refresh
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) });
    global.fetch = fetchSpy;

    let tr;
    await act(async () => { tr = TestRenderer.create(<MapScreen />); });

    // Confirm location markers rendered (exclude dropped pin by pinColor)
    const markersBefore = tr.root
      .findAll((n) => n.props && n.props.testID === 'marker')
      .filter((n) => n.props.pinColor === '#ff0000ff');
    expect(markersBefore.length).toBeGreaterThanOrEqual(1);

    // Trigger refresh call which fails via RefreshControl
    const scrollView = tr.root.findAll((n) => n.props && n.props.refreshControl)[0];
    expect(scrollView).toBeTruthy();
    const refreshControl = scrollView.props.refreshControl;
    expect(refreshControl && refreshControl.props && refreshControl.props.onRefresh).toBeTruthy();
    await act(async () => { refreshControl.props.onRefresh(); });

    // Error logged with message (current implementation uses console.error)
    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((c) => String(c[0] || '')).join(' ');
    expect(logged).toMatch(/Error fetching locations/i);

    // Map remains in prior state (markers unchanged)
    const markersAfter = tr.root
      .findAll((n) => n.props && n.props.testID === 'marker')
      .filter((n) => n.props.pinColor === '#ff0000ff');
    expect(markersAfter.length).toBe(markersBefore.length);

    errorSpy.mockRestore();
  });
});