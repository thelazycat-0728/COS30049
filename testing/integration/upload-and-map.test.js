/**
 * Frontend: UploadScreen, PlantDetailScreen, MapScreen tests
 * - UploadScreen submission scenarios
 * - PlantDetailScreen markers and region computation
 * - MapScreen long-press draggable pin
 */

const React = require('react');
const TestRenderer = require('react-test-renderer');

// Note: Node test environment does not need animation frame polyfills for current suites

// Helpers for UploadScreen flows removed with those tests

// Ensure API base for fetch calls
process.env.EXPO_PUBLIC_API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://api.test';

// Configure testing environment for act support
// Remove test renderer warning suppression; not needed for remaining suites

// Stub react-native primitives used by screens without importing actual RN
jest.mock('react-native', () => {
  const React = require('react');
  const mk = (name) => {
    const Component = (props) => {
      return React.createElement(name, { ...props, testID: props?.testID || name }, props.children);
    };
    Component.displayName = name;
    return Component;
  };
  
  return {
    View: mk('View'),
    Text: mk('Text'),
    SafeAreaView: mk('SafeAreaView'),
    StatusBar: mk('StatusBar'),
    ScrollView: mk('ScrollView'),
    RefreshControl: mk('RefreshControl'),
    TouchableOpacity: mk('TouchableOpacity'),
    ActivityIndicator: mk('ActivityIndicator'),
    TextInput: mk('TextInput'),
    Image: mk('Image'),
    Modal: mk('Modal'),
    Pressable: mk('Pressable'),
    Animated: {
      View: mk('Animated.View'),
      Value: function(initial) { 
        this.__value = initial; 
        this.setValue = jest.fn(); 
        this.interpolate = jest.fn(() => '0deg'); 
      },
      timing: jest.fn(() => ({ start: jest.fn() })),
    },
    StyleSheet: { create: (s) => s },
    Dimensions: { get: () => ({ width: 360, height: 640 }) },
    AccessibilityInfo: { announceForAccessibility: jest.fn() },
    Platform: { OS: 'ios', select: (opts) => (opts && (opts.ios ?? opts.default ?? opts.android)) },
    Linking: { openURL: jest.fn() },
    BackHandler: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
    Alert: { alert: jest.fn() },
    // Add testID support
    findNodeHandle: jest.fn(),
    // Add UIManager for refs
    UIManager: {
      measure: jest.fn(),
    },
  };
});

// Mock NetInfo to avoid native dependency
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((handler) => {
    // Immediately emit a connected state so isOffline stays false
    if (typeof handler === 'function') {
      try { handler({ isConnected: true }); } catch (e) {}
    }
    // Return unsubscribe fn
    return jest.fn();
  }),
}));

// Mock AsyncStorage for token reads
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
  clear: jest.fn(async () => {}),
}));

// Mock Expo Location for MapScreen
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: -37.8136, longitude: 144.9631 } })),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Icon = (props) => React.createElement('Icon', props, props.children);
  return { 
    Ionicons: Icon, 
    MaterialIcons: Icon, 
    FontAwesome5: Icon,
    Feather: Icon,
    MaterialCommunityIcons: Icon,
  };
});

// Mock react-native-maps to simple components we can inspect
jest.mock('react-native-maps', () => {
  const React = require('react');
  const MapView = ({ children, ...props }) => React.createElement('MapView', props, children);
  const Marker = ({ children, ...props }) => React.createElement('Marker', props, children);
  const Heatmap = ({ children, ...props }) => React.createElement('Heatmap', props, children);
  const Callout = ({ children, ...props }) => React.createElement('Callout', props, children);
  return { __esModule: true, default: MapView, Marker, Heatmap, Callout };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const LinearGradient = ({ children, ...props }) => React.createElement('LinearGradient', props, children);
  return { LinearGradient };
});

// Mock react-navigation to avoid native nav calls
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    getState: () => ({ routes: [{ name: 'Home' }, { name: 'PlantDetail' }], index: 1 }),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useFocusEffect: (cb) => { 
    // Call the effect immediately in tests
    const cleanup = cb();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  },
  useRoute: () => ({
    params: {},
  }),
  useIsFocused: () => true,
}));

// Mock stack navigator
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ component }) => component,
  }),
}));

// Mock bottom tabs navigator  
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: ({ component }) => component,
  }),
}));

// Global fetch mock
beforeEach(() => {
  global.fetch = jest.fn();
  const { Alert } = require('react-native');
  Alert.alert.mockReset();
  jest.clearAllMocks();
});

// UploadScreen tests removed per request

describe('PlantDetailScreen - markers and region', () => {
  it('renders markers matching observation coordinates and computes region', async () => {
    const observations = [
      { observation_id: 1, plant_id: 5, latitude: -37.80, longitude: 144.95, image_url: null, public: 1 },
      { observation_id: 2, plant_id: 5, latitude: -37.82, longitude: 144.97, image_url: null, public: 1 },
      { observation_id: 3, plant_id: 5, latitude: -37.81, longitude: 144.96, image_url: null, public: 1 },
    ];

    // Mock plant details and observations fetches
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, plant: { plant_id: 5, common_name: 'Rose' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, observations }) });

const PlantDetailScreen = require('../../frontend/src/screens/PlantDetailScreen.js').default;

    const route = { params: { plant: { plant_id: 5, common_name: 'Rose' } } };
    let renderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(PlantDetailScreen, { route }));
    });

    // Flush effects for fetching observations
    await TestRenderer.act(async () => { 
      await new Promise((r) => setTimeout(r, 100));
    });

    const { Marker } = require('react-native-maps');
    const markers = renderer.root.findAllByType(Marker);
    expect(markers.length).toBe(observations.length);
    markers.forEach((m, idx) => {
      expect(m.props.coordinate.latitude).toBeCloseTo(observations[idx].latitude);
      expect(m.props.coordinate.longitude).toBeCloseTo(observations[idx].longitude);
    });

    // Verify map region computed from min/max of observations
    const lats = observations.map((o) => o.latitude);
    const lons = observations.map((o) => o.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    const latDelta = Math.max(0.01, (maxLat - minLat) * 1.4);
    const lonDelta = Math.max(0.01, (maxLon - minLon) * 1.4);

    // Find the MapView (mocked as 'MapView') by expecting initialRegion prop present
    const mapCandidate = renderer.root.findAll((el) => el.type === 'MapView' && el.props && el.props.initialRegion)[0];
    expect(mapCandidate).toBeDefined();
    expect(mapCandidate.props.initialRegion.latitude).toBeCloseTo(centerLat);
    expect(mapCandidate.props.initialRegion.longitude).toBeCloseTo(centerLon);
    expect(mapCandidate.props.initialRegion.latitudeDelta).toBeCloseTo(latDelta);
    expect(mapCandidate.props.initialRegion.longitudeDelta).toBeCloseTo(lonDelta);
  });
});

describe('MapScreen - long-press sets draggable pin', () => {
  it('sets pinCoords on long-press and renders draggable marker', async () => {
    // Provide default fetch for initial locations
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, locations: [] }) });

const MapScreen = require('../../frontend/src/screens/MapScreen.js').default;
    let renderer;
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(React.createElement(MapScreen));
    });

    // Allow initial effects to run
    await TestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Find the MapView (mocked View) which should have onLongPress handler
    const mapView = renderer.root.findAll((el) => el.props && typeof el.props.onLongPress === 'function')[0];
    expect(mapView).toBeDefined();

    const coord = { latitude: -37.85, longitude: 144.99 };
    await TestRenderer.act(async () => {
      mapView.props.onLongPress({ nativeEvent: { coordinate: coord } });
    });

    // Allow state update to propagate
    await TestRenderer.act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const { Marker } = require('react-native-maps');
    const markers = renderer.root.findAllByType(Marker);
    const pinMarker = markers.find((m) => m.props.draggable === true);
    expect(pinMarker).toBeDefined();
    expect(pinMarker.props.coordinate.latitude).toBeCloseTo(coord.latitude);
    expect(pinMarker.props.coordinate.longitude).toBeCloseTo(coord.longitude);
  });
});