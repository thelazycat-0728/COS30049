/**
 * Tests: PlantDetailScreen Load More pagination
 * - Initial shows 5 items, correct remaining count
 * - After pressing Load More once, shows 10 items, remaining updates
 * - After pressing again, shows all items and button hides
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

process.env.EXPO_PUBLIC_API_BASE = 'http://localhost:3000';

// Mock expo-linear-gradient ESM to avoid transform issues in Jest
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children, ...props }) => React.createElement('LinearGradient', props, children),
  };
});

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
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), getState: () => ({ routes: [], index: 0 }) }),
  useFocusEffect: (cb) => {
    const cleanup = cb();
    return typeof cleanup === 'function' ? cleanup : undefined;
  },
}));

import PlantDetailScreen from '../../frontend/src/screens/PlantDetailScreen';

describe('PlantDetailScreen — Load More pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('paginates observations by 5 and updates remaining count', async () => {
    const plantId = 5;
    const total = 12;
    const observations = Array.from({ length: total }, (_, i) => ({
      observation_id: i + 1,
      plant_id: plantId,
      public: 1,
      latitude: -37.8 - i * 0.001,
      longitude: 144.96 + i * 0.001,
      observation_date: `2024-10-${String(10 + i).padStart(2, '0')}T10:00:00Z`,
      username: `user${i + 1}`,
    }));

    const firstResponse = { ok: true, json: async () => ({ plant: { plant_id: plantId, common_name: 'Paged Plant' }, observations }) };
    const secondResponse = { ok: true, json: async () => ({ observations }) };
    global.fetch = jest.fn().mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(secondResponse);

    const route = { params: { plant: { plant_id: plantId, common_name: 'Paged Plant' }, plant_id: plantId } };
    let tree;
    await act(async () => {
      tree = TestRenderer.create(<PlantDetailScreen route={route} />);
    });
    // Allow effects to settle
    await act(async () => {});
    const root = tree.root;

    // Count list items via chevron-forward icons present in each item
    const itemIcons = () => root.findAll((n) => n.type === 'Ionicons' && n.props.name === 'chevron-forward');

    expect(itemIcons().length).toBe(5);

    // Verify Load More button exists via its icon, then check text
    const loadMoreButton = root.findAll(
      (n) => n.type === 'TouchableOpacity' && n.findAll?.((c) => c.type === 'Ionicons' && c.props.name === 'add-circle-outline').length > 0
    )[0];
    expect(loadMoreButton).toBeTruthy();
    const isLoadMoreText = (n) => {
      const ch = n.props?.children;
      if (typeof ch === 'string') return ch.includes('Load More (');
      if (Array.isArray(ch)) return ch.join('').includes('Load More (');
      return false;
    };
    const loadMoreTextNode = root.findAll((n) => isLoadMoreText(n))[0];
    expect(loadMoreTextNode).toBeTruthy();
    const textContent = Array.isArray(loadMoreTextNode.props.children)
      ? loadMoreTextNode.props.children.join('')
      : loadMoreTextNode.props.children;
    expect(textContent).toContain('7');

    // Press Load More once
    await act(async () => {
      loadMoreButton.props.onPress();
    });

    expect(itemIcons().length).toBe(10);
    const loadMoreTextAfter = root.findAll((n) => isLoadMoreText(n))[0];
    const textContentAfter = Array.isArray(loadMoreTextAfter.props.children)
      ? loadMoreTextAfter.props.children.join('')
      : loadMoreTextAfter.props.children;
    expect(textContentAfter).toContain('2');

    // Press Load More second time to exhaust
    await act(async () => {
      loadMoreButton.props.onPress();
    });

    expect(itemIcons().length).toBe(total);
    // Button should hide when no remaining
    const loadMoreTextGone = root.findAll((n) => isLoadMoreText(n));
    expect(loadMoreTextGone.length).toBe(0);
  });
});