/**
 * Frontend MapScreen navigation to PlantDetail tests
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

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  return { useNavigation: () => ({ navigate }), __navigateMock: navigate };
});
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3, High: 5 },
}));

import MapScreen from '../../frontend/src/screens/MapScreen';

describe('MapScreen navigation to PlantDetail from plant card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('pressing “View Details” navigates with correct params', async () => {
    const loc = {
      observation_id: 123,
      plant_id: 456,
      plant: {
        common_name: 'Sample Plant',
        scientific_name: 'Plantus Sampleus',
        family: 'Fabaceae',
        image_url: 'http://img',
        description: 'desc',
      },
      coordinates: { lat: -37.8, lon: 144.96 },
    };

    const fetchSpy = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [loc] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [loc] }) });
    global.fetch = fetchSpy;

    let tr;
    await act(async () => {
      tr = TestRenderer.create(<MapScreen />);
    });

    // Tap marker to trigger handleLocationPress
    const marker = tr.root.findAll((n) => n.props && n.props.testID === 'marker')[0];
    expect(marker).toBeTruthy();
    await act(async () => { marker.props.onPress(); });

    // Simulate region change complete to show card (closeEnough)
    const mapview = tr.root.findAll((n) => n.props && n.props.testID === 'mapview')[0];
    const targetRegion = { latitude: loc.coordinates.lat, longitude: loc.coordinates.lon };
    await act(async () => { mapview.props.onRegionChangeComplete(targetRegion); });

    // Find "View Details" button by text and press its parent TouchableOpacity
    const textNodes = tr.root.findAllByType(Text);
    const detailsTextNode = textNodes.find((t) => t.props.children === 'View Details');
    expect(detailsTextNode).toBeTruthy();
    // Find the nearest TouchableOpacity ancestor containing this text
    const touchables = tr.root.findAll((n) => n.type === TouchableOpacity && n.props.onPress);
    const targetTouchable = touchables.find((n) => n.findAllByType(Text).some((t) => t.props.children === 'View Details'));
    expect(targetTouchable).toBeTruthy();
    await act(async () => { targetTouchable.props.onPress(); });

    // Verify navigation call via exported mock
    const { __navigateMock } = require('@react-navigation/native');
    expect(__navigateMock).toHaveBeenCalledTimes(1);
    const [routeName, params] = __navigateMock.mock.calls[0];
    expect(routeName).toBe('PlantDetail');
    expect(params.origin).toBe('Map');
    expect(params.plant).toBeTruthy();
    expect(params.plant.common_name).toBe('Sample Plant');
    expect(params.plant.scientific_name).toBe('Plantus Sampleus');
  });
});