/**
 * Tests: PlantDetailScreen callout/marker interactions
 * - Tapping a marker triggers the handler and opens side panel overlay
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

process.env.EXPO_PUBLIC_API_BASE = 'http://localhost:3000';

// Maps mock that forwards props to elements so we can trigger onPress
jest.mock('react-native-maps', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, ...props }) => React.createElement('MapView', props, children),
    Marker: ({ children, ...props }) => React.createElement('Marker', props, children),
    Callout: ({ children, ...props }) => React.createElement('Callout', props, children),
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useFocusEffect: (cb) => {
    const cleanup = cb();
    return typeof cleanup === 'function' ? cleanup : undefined;
  },
}));

import PlantDetailScreen from '../../frontend/src/screens/PlantDetailScreen';

describe('PlantDetailScreen — marker/callout interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens side panel overlay when a marker is pressed', async () => {
    const plantId = 4;

    const observations = [
      { observation_id: 101, plant_id: plantId, public: 1, latitude: -37.81, longitude: 144.96, observation_date: '2024-10-01T10:00:00Z' },
      { observation_id: 102, plant_id: plantId, public: 1, latitude: -37.82, longitude: 144.97, observation_date: '2024-10-02T10:00:00Z' },
    ];

    const firstResponse = {
      ok: true,
      json: async () => ({ plant: { plant_id: plantId, common_name: 'Interaction Plant' }, observations, base_location: { latitude: -37.81, longitude: 144.96 } }),
    };
    const secondResponse = { ok: true, json: async () => ({ observations }) };

    global.fetch = jest.fn().mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(secondResponse);

    const route = { params: { plant: { plant_id: plantId, common_name: 'Interaction Plant' }, plant_id: plantId } };

    let tree;
    await act(async () => {
      tree = TestRenderer.create(<PlantDetailScreen route={route} />);
    });
    // Allow effects to settle
    await act(async () => {});
    const root = tree.root;

    const markers = root.findAll((n) => n.type === 'Marker');
    expect(markers.length).toBe(observations.length);

    const initialPressables = root.findAll((n) => n.type === 'Pressable');

    // Trigger marker press
    await act(async () => {
      markers[0].props.onPress && markers[0].props.onPress();
    });

    const afterPressPressables = root.findAll((n) => n.type === 'Pressable');
    expect(afterPressPressables.length).toBeGreaterThan(initialPressables.length);
  });
});