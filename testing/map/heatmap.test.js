/**
 * Frontend MapScreen heatmap toggle tests
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

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

const findTouchableWithText = (root, text) => {
  const candidates = root.findAll((node) => node.type === TouchableOpacity);
  for (const node of candidates) {
    const hasTextChild = node.findAllByType(Text).some((t) => t.props.children === text);
    if (hasTextChild) return node;
  }
  return null;
};

describe('MapScreen heatmap toggle behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('toggle heatmap on/off and verify data counts', async () => {
    const locations = [
      { observation_id: 1, plant_id: 10, plant: { family: 'Fabaceae' }, coordinates: { lat: -37.8, lon: 144.96 } },
    ];
    // Keep density points within the auto-fit region around the marker
    const density = { points: [
      { latitude: -37.800, longitude: 144.960, observation_count: 3 },
      { latitude: -37.804, longitude: 144.964, observation_count: 1 },
    ], max_count: 3 };

    // Robust fetch mock: return density for the heatmap endpoint, locations otherwise
    global.fetch = jest.fn((url) => {
      const u = String(url || '');
      if (u.includes('/map/locations/density')) {
        return Promise.resolve({ ok: true, json: async () => density });
      }
      return Promise.resolve({ ok: true, json: async () => ({ locations }) });
    });

    let tr;
    await act(async () => {
      tr = TestRenderer.create(<MapScreen />);
    });

    // Toggle heatmap ON
    const toggleBtn = findTouchableWithText(tr.root, 'Heatmap Off');
    expect(toggleBtn).toBeTruthy();
    await act(async () => { toggleBtn.props.onPress(); });

    // Trigger a region change to invoke heatmap density fetch
    const mapview = tr.root.findAll((n) => n.props && n.props.testID === 'mapview')[0];
    expect(mapview).toBeTruthy();
    await act(async () => { mapview.props.onRegionChangeComplete(mapview.props.initialRegion); });

    // Heatmap rendered with correct points length
    const heatViews = tr.root.findAll((n) => n.props && n.props.testID === 'heatmap');
    expect(heatViews.length).toBeGreaterThanOrEqual(1);
    const props = heatViews[heatViews.length - 1].props;
    expect(Array.isArray(props.points)).toBe(true);
    expect(props.points.length).toBe(2);

    // Toggle heatmap OFF
    const toggleOnBtn = findTouchableWithText(tr.root, 'Heatmap On');
    expect(toggleOnBtn).toBeTruthy();
    await act(async () => { toggleOnBtn.props.onPress(); });

    const heatViewsAfter = tr.root.findAll((n) => n.props && n.props.testID === 'heatmap');
    expect(heatViewsAfter.length).toBe(0);
  });
});