/**
 * Frontend: Admin ObservationsSection
 * Scenarios:
 * 1) Save “verified” status includes verifiedBy
 * 2) Save non-verified status does not include verifiedBy
 * 3) Plant/location updates persist alongside verification
 * 4) Unauthorized save shows error UI and state unchanged
 */

const React = require('react');
const renderer = require('react-test-renderer');

// Mock react-native primitives and Alert (monorepo may not resolve real RN here)
jest.mock('react-native', () => {
  const React = require('react');
  const mk = (name) => (props) => React.createElement(name, props, props.children);
  return {
    View: mk('View'),
    Text: mk('Text'),
    TouchableOpacity: mk('TouchableOpacity'),
    Image: mk('Image'),
    Modal: mk('Modal'),
    ActivityIndicator: mk('ActivityIndicator'),
    Switch: mk('Switch'),
    TextInput: mk('TextInput'),
    ScrollView: mk('ScrollView'),
    RefreshControl: mk('RefreshControl'),
    Alert: { alert: jest.fn() },
    StyleSheet: { create: (s) => s },
  };
}, { virtual: true });

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  const mk = (name) => (props) => React.createElement(name, props, props.children);
  return {
    __esModule: true,
    default: mk('MapView'),
    Marker: mk('Marker'),
  };
}, { virtual: true });

// Mock expo vector icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Ionicons = (props) => React.createElement('Ionicons', props, props.children);
  return { __esModule: true, Ionicons };
}, { virtual: true });

// Component under test
const ObservationsSection = require('../../frontend/src/screens/admin/ObservationsSection.js').default;

// Helpers
const { act } = renderer;
const flush = () => new Promise(resolve => setImmediate(resolve));

describe('Frontend: Admin ObservationsSection', () => {
  const API_URL = 'http://localhost/api';
  const getAuthToken = jest.fn(async () => 'mock-token');
  const setPlantCache = jest.fn();
  const currentUserId = 42;

  let fetchMock;
  let alertSpy;

  beforeEach(() => {
    jest.resetAllMocks();
    alertSpy = require('react-native').Alert.alert;
    alertSpy.mockReset();

    // Install fetch mock on global
    fetchMock = jest.fn(async (url, options = {}) => {
      // Observations list load
      if (String(url).startsWith(`${API_URL}/observations?`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            total: 1,
            observations: [
              {
                observation_id: 123,
                status: 'pending',
                user_id: 999,
                username: 'uploader',
                plant_id: 5,
                image_url: '/uploads/obs.jpg',
                observation_date: '2024-08-18',
                latitude: -37.8136,
                longitude: 144.9631,
                public: 0,
              },
            ],
          }),
        };
      }

      // Plant preload (allow, but minimal response)
      if (String(url).startsWith(`${API_URL}/map/plants/`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ common_name: 'Test Plant', scientific_name: 'Plantus testus' }),
        };
      }

      // PUT update handler — default success; can be overridden per test
      if (String(url).startsWith(`${API_URL}/observations/123`) && (options?.method === 'PUT')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, observation: { observation_id: 123, ...JSON.parse(options.body) } }),
        };
      }

      // Fallback
      return { ok: false, status: 404, json: async () => ({ success: false, error: 'not found' }) };
    });
    global.fetch = fetchMock;
  });

  const renderSection = async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(
        React.createElement(ObservationsSection, {
          API_URL,
          getAuthToken,
          plantCache: {},
          setPlantCache,
          currentUserId,
        })
      );
      await flush();
    });
    return tree;
  };

  const openObservationDetail = async (tree) => {
    const root = tree.root;
    // Observation cards: TouchableOpacity with activeOpacity=0.85 and onPress
    const cards = root.findAll(node => node.props && node.props.activeOpacity === 0.85 && typeof node.props.onPress === 'function');
    expect(cards.length).toBeGreaterThan(0);
    await act(async () => {
      cards[0].props.onPress();
      await flush();
    });
  };

  const pressStatusOption = async (tree, statusText) => {
    const root = tree.root;
    const optionTextNodes = root.findAll(node => node.type === 'Text' && node.props.children === statusText);
    expect(optionTextNodes.length).toBeGreaterThan(0);
    let btn = optionTextNodes[0];
    while (btn && !(btn.props && typeof btn.props.onPress === 'function')) {
      btn = btn.parent;
    }
    expect(btn).toBeTruthy();
    await act(async () => {
      btn.props.onPress();
      await flush();
    });
  };

  const pressSave = async (tree) => {
    const root = tree.root;
    const saveTextNode = root.findAll(node => node.type === 'Text' && node.props.children === 'Save Changes')[0];
    let saveBtn = saveTextNode;
    while (saveBtn && !(saveBtn.props && typeof saveBtn.props.onPress === 'function')) {
      saveBtn = saveBtn.parent;
    }
    expect(saveBtn).toBeTruthy();
    await act(async () => {
      await saveBtn.props.onPress();
      await flush();
    });
  };

  it('Save “verified” includes verifiedBy', async () => {
    const tree = await renderSection();
    await openObservationDetail(tree);
    await pressStatusOption(tree, 'verified');
    await pressSave(tree);

    // Assert fetch called with PUT body including verifiedBy: 42
    const putCall = fetchMock.mock.calls.find(([url, opts]) => String(url).includes('/observations/123') && opts?.method === 'PUT');
    expect(putCall).toBeDefined();
    const [, opts] = putCall;
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({ status: 'verified', verifiedBy: 42 });

    // UI feedback: success alert shown
    expect(alertSpy).toHaveBeenCalled();
    const [titleArg] = alertSpy.mock.calls[0];
    expect(String(titleArg)).toContain('Success');
  });

  it('Save non-verified omits verifiedBy', async () => {
    const tree = await renderSection();
    await openObservationDetail(tree);
    await pressStatusOption(tree, 'rejected');
    await pressSave(tree);

    const putCall = fetchMock.mock.calls.find(([url, opts]) => String(url).includes('/observations/123') && opts?.method === 'PUT');
    expect(putCall).toBeDefined();
    const [, opts] = putCall;
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({ status: 'rejected' });
    expect(body).not.toHaveProperty('verifiedBy');
  });

  it('Plant/location fields persist with verification', async () => {
    const tree = await renderSection();
    await openObservationDetail(tree);
    await pressStatusOption(tree, 'verified');
    await pressSave(tree);

    const putCall = fetchMock.mock.calls.find(([url, opts]) => String(url).includes('/observations/123') && opts?.method === 'PUT');
    expect(putCall).toBeDefined();
    const [, opts] = putCall;
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      status: 'verified',
      verifiedBy: 42,
      plantId: 5,
      latitude: -37.8136,
      longitude: 144.9631,
    });

    // Post-success, list item shows updated status (VERIFIED)
    const root = tree.root;
    const statusBadgeTexts = root.findAll(node => node.type === 'Text' && node.props.children === 'VERIFIED');
    expect(statusBadgeTexts.length).toBeGreaterThan(0);
  });

  it('Unauthorized save shows error UI and keeps state', async () => {
    // Override PUT to return 403
    fetchMock.mockImplementation(async (url, options = {}) => {
      if (String(url).startsWith(`${API_URL}/observations?`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, total: 1, observations: [{
            observation_id: 123,
            status: 'pending',
            user_id: 999,
            username: 'uploader',
            plant_id: 5,
            image_url: '/uploads/obs.jpg',
            observation_date: '2024-08-18',
            latitude: -37.8136,
            longitude: 144.9631,
            public: 0,
          }] })
        };
      }
      if (String(url).startsWith(`${API_URL}/map/plants/`)) {
        return { ok: true, status: 200, json: async () => ({ common_name: 'Test Plant' }) };
      }
      if (String(url).startsWith(`${API_URL}/observations/123`) && (options?.method === 'PUT')) {
        return { ok: false, status: 403, json: async () => ({ success: false, error: 'Forbidden' }) };
      }
      return { ok: false, status: 404, json: async () => ({ success: false }) };
    });

    const tree = await renderSection();
    await openObservationDetail(tree);
    await pressStatusOption(tree, 'verified');
    await pressSave(tree);

    // Error alert rendered
    expect(alertSpy).toHaveBeenCalled();
    const [titleArg] = alertSpy.mock.calls[0];
    expect(String(titleArg)).toContain('Error');

    // State unchanged: list badge still shows PENDING
    const root = tree.root;
    const pendingTexts = root.findAll(node => node.type === 'Text' && node.props.children === 'PENDING');
    expect(pendingTexts.length).toBeGreaterThan(0);
  });
});