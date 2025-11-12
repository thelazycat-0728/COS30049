/**
 * Tests: PlantDetailScreen loading and error states
 * - Initial loading shows spinner and loading text
 * - Failed fetch shows an error message box
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

process.env.EXPO_PUBLIC_API_BASE = 'http://localhost:3000';

// Minimal maps mock to avoid native dependencies
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

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
  useFocusEffect: (cb) => {
    const cleanup = cb();
    return typeof cleanup === 'function' ? cleanup : undefined;
  },
}));

import PlantDetailScreen from '../../frontend/src/screens/PlantDetailScreen';

describe('PlantDetailScreen — loading and error states', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('shows ActivityIndicator and loading text on initial render', async () => {
    const plantId = 2;
    // Keep fetch pending long enough to observe the initial state
    global.fetch = jest.fn(() => new Promise(() => {}));
    const route = { params: { plant: { plant_id: plantId, common_name: 'Loader Plant' }, plant_id: plantId } };

    let tree;
    await act(async () => {
      tree = TestRenderer.create(<PlantDetailScreen route={route} />);
    });
    const root = tree.root;

    const spinners = root.findAll((n) => n.type === 'ActivityIndicator');
    expect(spinners.length).toBeGreaterThan(0);

    const loadingText = root.findAll((n) => n.type === 'Text' && typeof n.props.children === 'string' && n.props.children.includes('Loading plant details'));
    expect(loadingText.length).toBeGreaterThan(0);
  });

  it('shows error message when plant fetch fails', async () => {
    const plantId = 3;
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));
    const route = { params: { plant: { plant_id: plantId, common_name: 'Error Plant' }, plant_id: plantId } };

    let tree;
    await act(async () => {
      tree = TestRenderer.create(<PlantDetailScreen route={route} />);
    });
    // Allow queued microtasks/effects to settle
    await act(async () => {});
    const root = tree.root;

    // Error box displays with some error text
    const errorTexts = root.findAll((n) => n.type === 'Text' && typeof n.props.children === 'string' && (
      n.props.children.toLowerCase().includes('error') || n.props.children.toLowerCase().includes('fail')
    ));
    expect(errorTexts.length).toBeGreaterThan(0);

    // Spinner should be gone after error state
    const spinners = root.findAll((n) => n.type === 'ActivityIndicator');
    expect(spinners.length).toBe(0);
  });
});