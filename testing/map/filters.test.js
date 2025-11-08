/**
 * Frontend MapScreen filter composition tests
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

// Ensure API base is set for tests
process.env.EXPO_PUBLIC_API_BASE = 'http://localhost:3000';

// Mock react-native-maps to simple Views
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = ({ children, ...props }) => (
    <View testID="mapview" {...props}>{children}</View>
  );
  const Marker = ({ children, ...props }) => (
    <View testID="marker" {...props}>{children}</View>
  );
  const Heatmap = ({ children, ...props }) => (
    <View testID="heatmap" {...props}>{children}</View>
  );
  return { __esModule: true, default: MapView, Marker, Heatmap };
});

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// Mock expo-location minimal (avoid auto-calls)
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3, High: 5 },
}));

// Utility to find touchable by child text
const findTouchableWithText = (root, text) => {
  const candidates = root.findAll((node) => node.type === TouchableOpacity);
  for (const node of candidates) {
    const hasTextChild = node.findAllByType(Text).some((t) => t.props.children === text);
    if (hasTextChild) return node;
  }
  return null;
};

// Import after mocks
import MapScreen from '../../frontend/src/screens/MapScreen';

describe('MapScreen filters: URLSearchParams composition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('populates family, conservation_status, start_date, end_date only when valid', async () => {
    const families = ['Fabaceae', 'Rosaceae'];
    const initialLocations = [
      { observation_id: 1, plant_id: 10, plant: { family: 'Fabaceae', common_name: 'Wattle', scientific_name: 'Acacia' }, coordinates: { lat: -37.8, lon: 144.96 } },
    ];

    const fetchSpy = jest.fn()
      // Initial markers fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: initialLocations }) })
      // Family options fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: initialLocations }) })
      // Refetch after filters applied
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: initialLocations }) })
      // Refetch after clearing filters
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: initialLocations }) });
    global.fetch = fetchSpy;

    let tr;
    await act(async () => {
      tr = TestRenderer.create(<MapScreen />);
    });

    // Open Filters modal
    const filterButton = findTouchableWithText(tr.root, 'Filter');
    expect(filterButton).toBeTruthy();
    await act(async () => { filterButton.props.onPress(); });

    // Open family dropdown
    const openFamily = tr.root.findAll((n) => n.type === TouchableOpacity && n.props.accessibilityLabel === 'Open plant family selector')[0];
    expect(openFamily).toBeTruthy();
    await act(async () => { openFamily.props.onPress(); });

    // Select single family (Fabaceae) and Save
    const famOption = tr.root.findAll((n) => n.type === TouchableOpacity && n.props.accessibilityLabel === families[0])[0];
    expect(famOption).toBeTruthy();
    await act(async () => { famOption.props.onPress(); });
    const saveFamilies = tr.root.findAll((n) => n.type === TouchableOpacity && n.props.accessibilityLabel === 'Apply selected families')[0];
    expect(saveFamilies).toBeTruthy();
    await act(async () => { saveFamilies.props.onPress(); });

    // Select statuses Vulnerable and Endangered
    const vulnerableBtn = findTouchableWithText(tr.root, 'Vulnerable');
    const endangeredBtn = findTouchableWithText(tr.root, 'Endangered');
    expect(vulnerableBtn && endangeredBtn).toBeTruthy();
    await act(async () => { vulnerableBtn.props.onPress(); });
    await act(async () => { endangeredBtn.props.onPress(); });

    // Choose date preset Last 7 days
    const last7Btn = tr.root.findAll((n) => n.type === TouchableOpacity && n.props.accessibilityLabel === 'Select Last 7 days')[0];
    expect(last7Btn).toBeTruthy();
    await act(async () => { last7Btn.props.onPress(); });

    // Apply filters
    const applyBtn = findTouchableWithText(tr.root, 'Apply');
    expect(applyBtn).toBeTruthy();
    await act(async () => { applyBtn.props.onPress(); });

    // Inspect the latest locations fetch call URL for query composition
    const locationCalls = fetchSpy.mock.calls.filter(([u]) => String(u).includes('/map/locations/public'));
    expect(locationCalls.length).toBeGreaterThan(0);
    const lastTarget = locationCalls[locationCalls.length - 1][0];
    const href = typeof lastTarget === 'string' ? lastTarget : (lastTarget && lastTarget.url ? lastTarget.url : String(lastTarget));
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toMatch(/\/map\/locations\/public$/);
    const qs = url.searchParams;
    expect(qs.get('limit')).toBe('500');
    expect(['Fabaceae', 'Rosaceae']).toContain(qs.get('family')); // only single family selected is set
    expect(qs.get('conservation_status')).toBe('vulnerable,endangered');
    expect(qs.get('start_date')).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(qs.get('end_date')).toMatch(/\d{4}-\d{2}-\d{2}/);

    // Clear filters and ensure params are removed
    const clearBtn = findTouchableWithText(tr.root, 'Clear Filters');
    expect(clearBtn).toBeTruthy();
    await act(async () => { clearBtn.props.onPress(); });

    // The latest locations call after clearing should only have limit
    const clearedCalls = fetchSpy.mock.calls.filter(([u]) => String(u).includes('/map/locations/public'));
    expect(clearedCalls.length).toBeGreaterThan(0);
    const clearedTarget = clearedCalls[clearedCalls.length - 1][0];
    const href2 = typeof clearedTarget === 'string' ? clearedTarget : (clearedTarget && clearedTarget.url ? clearedTarget.url : String(clearedTarget));
    const url2 = new URL(href2, 'http://localhost');
    const qs2 = url2.searchParams;
    expect(qs2.get('limit')).toBe('500');
    expect(qs2.get('family')).toBeNull();
    expect(qs2.get('conservation_status')).toBeNull();
    expect(qs2.get('start_date')).toBeNull();
    expect(qs2.get('end_date')).toBeNull();
  });
});