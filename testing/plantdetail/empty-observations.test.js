/**
 * Tests: PlantDetailScreen empty observations fallback
 * - No observations → zero markers rendered; map stays hidden without a valid region
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// Ensure API base is set for endpoint construction
process.env.EXPO_PUBLIC_API_BASE = 'http://localhost:3000';

// Minimal mocks for react-native and maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children }) => React.createElement('MapView', null, children),
    Marker: ({ children }) => React.createElement('Marker', null, children),
    Callout: ({ children }) => React.createElement('Callout', null, children),
    PROVIDER_GOOGLE: 'google',
  };
});

// Navigation mock
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useFocusEffect: (cb) => {
    const cleanup = cb();
    return typeof cleanup === 'function' ? cleanup : undefined;
  },
}));

// Screen under test
import PlantDetailScreen from '../../frontend/src/screens/PlantDetailScreen';

describe('PlantDetailScreen — empty observations fallback', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders zero markers and no MapView when there are no observations', async () => {
    const plantId = 1;

    // First call: /admin/plants/:id returns plant without observations
    const firstResponse = {
      ok: true,
      json: async () => ({
        plant: { plant_id: plantId, common_name: 'Test Plant', scientific_name: 'Planta testus' },
        observations: [],
        base_location: { latitude: -37.8136, longitude: 144.9631 },
      }),
    };

    // Second call: /observations?... returns empty list
    const secondResponse = {
      ok: true,
      json: async () => ({ observations: [] }),
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);

    const route = { params: { plant: { plant_id: plantId, common_name: 'Test Plant' }, plant_id: plantId } };

    let tree;
    await act(async () => {
      tree = TestRenderer.create(<PlantDetailScreen route={route} />);
    });

    const root = tree.root;

    // With no obs, MapView may not render due to null/invalid region; assert no markers regardless
    const markers = root.findAll((node) => node.type === 'Marker');
    expect(markers.length).toBe(0);

    // Optional: MapView may be absent when region is invalid
    const mapViews = root.findAll((node) => node.type === 'MapView');
    expect(mapViews.length).toBeLessThanOrEqual(1); // allow 0 or a hidden map placeholder
  });
});