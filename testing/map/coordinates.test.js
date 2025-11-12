/**
 * Frontend MapScreen coordinate validation tests
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

describe('MapScreen uses only valid coordinates for markers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('filters out invalid coordinate entries', async () => {
    const locations = [
      { observation_id: 1, plant_id: 10, plant: { family: 'Fabaceae' }, coordinates: { lat: -37.8, lon: 144.96 } },
      { observation_id: 2, plant_id: 11, plant: { family: 'Rosaceae' }, coordinates: { lat: 'NaN', lon: 145.0 } },
      { observation_id: 3, plant_id: 12, plant: { family: 'Asteraceae' }, coordinates: { lat: -37.9, lon: null } },
      { observation_id: 4, plant_id: 13, plant: { family: 'Poaceae' }, coordinates: { lat: -37.7, lon: 145.1 } },
      { observation_id: 5, plant_id: 14, plant: { family: 'Rutaceae' }, coordinates: null },
    ];

    const fetchSpy = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations }) }); // for family options
    global.fetch = fetchSpy;

    let tr;
    await act(async () => {
      tr = TestRenderer.create(<MapScreen />);
    });

    // Count rendered markers
    const markers = tr.root.findAll((n) => n.props && n.props.testID === 'marker');
    expect(markers.length).toBe(2);
  });
});