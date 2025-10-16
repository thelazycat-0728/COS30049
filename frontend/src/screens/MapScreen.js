// src/screens/MapScreen.js - Updated with navigation, App.js-style filters, and MapView
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StatusBar,
  SafeAreaView,
  Modal,
  Image,
  ScrollView,
  Button,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
// Removed: PROVIDER_GOOGLE
import MapView, { Marker, Circle, Heatmap } from 'react-native-maps';
const API_BASE = 'http://192.168.0.114:3000';
import * as Location from 'expo-location';

const MapScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  // Filters (replicated from image-location-app/App.js)
  const ALL_STATUSES = ['least_concern', 'near_threatened', 'vulnerable'];
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterFamily, setFilterFamily] = useState('');
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterError, setFilterError] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [showPlantCard, setShowPlantCard] = useState(false);
  const [locations, setLocations] = useState([]);
  const [markersLoading, setMarkersLoading] = useState(false);
  const [markersError, setMarkersError] = useState(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: -37.8136,
    longitude: 144.9631,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [pinCoords, setPinCoords] = useState(null);
  // Heatmap state (matching image-location-app/App.js)
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatRadius, setHeatRadius] = useState(40);
  const [heatOpacity, setHeatOpacity] = useState(0.7);
  const [heatGradient, setHeatGradient] = useState({
    colors: ['#4fc3f7', '#29b6f6', '#0288d1', '#ef6c00', '#d84315', '#b71c1c'],
    startPoints: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
    colorMapSize: 256,
  });
  const [densityPoints, setDensityPoints] = useState([]);
  const [densityMax, setDensityMax] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setMapRegion(region);
        setPinCoords({ latitude: region.latitude, longitude: region.longitude });
      } catch (err) {
        console.warn('Location error:', err?.message || err);
      }
    })();
  }, []);

  // Heatmap helpers and fetching
  const getRegionBounds = (region) => {
    if (!region) return null;
    const halfLat = region.latitudeDelta / 2;
    const halfLon = region.longitudeDelta / 2;
    return {
      minLat: region.latitude - halfLat,
      maxLat: region.latitude + halfLat,
      minLon: region.longitude - halfLon,
      maxLon: region.longitude + halfLon,
    };
  };

  const fetchHeatmapDensity = async () => {
    try {
      if (!mapRegion) return;
      const params = new URLSearchParams();
      params.set('limit', '2000');
      if (filterFamily.trim()) params.set('family', filterFamily.trim());
      const allowedStatuses = ALL_STATUSES;
      const selectedStatuses = filterStatuses.filter((s) => allowedStatuses.includes(s));
      if (selectedStatuses.length) params.set('conservation_status', selectedStatuses.join(','));
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (filterStartDate && dateRegex.test(filterStartDate)) params.set('start_date', filterStartDate);
      if (filterEndDate && dateRegex.test(filterEndDate)) params.set('end_date', filterEndDate);

      const b = getRegionBounds(mapRegion);
      if (b) {
        params.set('min_lat', String(b.minLat));
        params.set('max_lat', String(b.maxLat));
        params.set('min_lon', String(b.minLon));
        params.set('max_lon', String(b.maxLon));
      }

      const url = `${API_BASE}/map/locations/density?${params.toString()}`;
      const response = await fetch(url, { method: 'GET' });
      const data = await response.json();
      const points = data?.points || [];
      const max = data?.max_count || (points.length ? Math.max(...points.map((p) => p.observation_count)) : 1);
      setDensityPoints(points);
      setDensityMax(Math.max(1, max));
    } catch (err) {
      console.error('Error fetching heatmap density:', err);
    }
  };

  // Fetch public locations (markers) from backend
  const fetchLocations = async () => {
    try {
      setMarkersLoading(true);
      setMarkersError(null);
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (filterFamily.trim()) params.set('family', filterFamily.trim());
      const selectedStatuses = filterStatuses.filter((s) => ALL_STATUSES.includes(s));
      if (selectedStatuses.length) params.set('conservation_status', selectedStatuses.join(','));
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (filterStartDate && dateRegex.test(filterStartDate)) params.set('start_date', filterStartDate);
      if (filterEndDate && dateRegex.test(filterEndDate)) params.set('end_date', filterEndDate);

      const url = `${API_BASE}/map/locations/public?${params.toString()}`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Markers fetch failed: ${response.status}`);
      }
      const data = await response.json();
      const list = Array.isArray(data?.locations) ? data.locations : [];
      // Keep only items with valid coordinates
      const withCoords = list.filter((loc) => loc?.coordinates && typeof loc.coordinates.lat === 'number' && typeof loc.coordinates.lon === 'number');
      setLocations(withCoords);

      // Auto-fit region to include all markers for better visibility
      if (withCoords.length > 0) {
        const lats = withCoords.map((loc) => loc.coordinates.lat);
        const lons = withCoords.map((loc) => loc.coordinates.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;
        const latSpan = Math.max(0.01, maxLat - minLat);
        const lonSpan = Math.max(0.01, maxLon - minLon);
        const paddingFactor = 1.4; // add some padding around extremes
        const nextRegion = {
          latitude: centerLat,
          longitude: centerLon,
          latitudeDelta: latSpan * paddingFactor,
          longitudeDelta: lonSpan * paddingFactor,
        };
        setMapRegion(nextRegion);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
      setMarkersError(err.message || 'Failed to fetch locations');
    } finally {
      setMarkersLoading(false);
    }
  };

  // Initial markers fetch
  useEffect(() => {
    fetchLocations();
  }, []);

  // Refetch markers when filters change
  useEffect(() => {
    fetchLocations();
  }, [filterFamily, filterStatuses, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (showHeatmap && mapRegion) {
      fetchHeatmapDensity();
    }
  }, [showHeatmap, mapRegion]); // Added mapRegion dependency for better map interaction

  const renderHeatmapLayer = ({ gradient, radius, opacity, region }) => {
    const filtered = densityPoints.filter((p) => {
      const b = getRegionBounds(region);
      if (!b) return true;
      return p.latitude >= b.minLat && p.latitude <= b.maxLat && p.longitude >= b.minLon && p.longitude <= b.maxLon;
    });

    const isWeb = typeof document !== 'undefined';
    if (!isWeb && Heatmap) {
      if (!filtered.length) return null;
      const points = filtered.map((p) => ({ latitude: p.latitude, longitude: p.longitude, weight: Math.max(1, p.observation_count) }));
      return (
        <Heatmap points={points} radius={radius} opacity={opacity} gradient={gradient} />
      );
    }
    // Web fallback: use per-point circles
    const min = 1; const max = Math.max(1, densityMax);
    const pickColor = (count) => {
      const idx = Math.min(heatGradient.colors.length - 1, Math.floor((count / max) * (heatGradient.colors.length - 1)));
      return heatGradient.colors[idx] || '#0288d1';
    };
    return filtered.map((p, i) => {
      const color = pickColor(p.observation_count);
      const circleRadius = Math.max(60, (radius * 12) * (p.observation_count / max));
      return (
        <Circle
          key={`hp-${i}-${p.latitude}-${p.longitude}`}
          center={{ latitude: p.latitude, longitude: p.longitude }}
          radius={circleRadius}
          strokeColor={color}
          fillColor={color + '55'}
          zIndex={1}
        />
      );
    });
  };

  const handleLocationPress = (loc) => {
    // Map backend location to card-friendly shape
    const mapped = {
      image: loc.image_url || null,
      name: loc.plant?.common_name || 'Unknown',
      scientificName: loc.plant?.scientific_name || '',
      plantId: loc.plant_id,
      observationId: loc.observation_id,
      coordinates: loc.coordinates,
    };
    setSelectedPlant(mapped);
    setShowPlantCard(true);
  };

  const closePlantCard = () => {
    setShowPlantCard(false);
    setSelectedPlant(null);
  };

  const handleViewDetails = () => {
    closePlantCard();
    // Navigate to a plant detail screen (you'll need to create this)
    // Assumes 'PlantDetail' is a valid route name in your navigator setup
    navigation.navigate('PlantDetailScreen', { plant: selectedPlant });
  };

  const toggleStatus = (status) => {
    setFilterStatuses((prev) => {
      if (prev.includes(status)) return prev.filter((s) => s !== status);
      return [...prev, status];
    });
  };

  const clearFilters = () => {
    setFilterFamily('');
    setFilterStatuses([]);
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterError(null);
  };

  const applyFilters = () => {
    setFilterError(null);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (filterStartDate && !dateRegex.test(filterStartDate)) {
      setFilterError('Start date must be in YYYY-MM-DD format');
      return;
    }
    if (filterEndDate && !dateRegex.test(filterEndDate)) {
      setFilterError('End date must be in YYYY-MM-DD format');
      return;
    }
    if (filterStartDate && filterEndDate && filterStartDate > filterEndDate) {
      setFilterError('Start date must be before end date');
      return;
    }
    setFilterVisible(false);
    // Filters are already triggering a fetchLocations via useEffect
    // The heatmap fetch is also triggered via mapRegion change and showHeatmap toggle
    // or by the useEffect watching showHeatmap and mapRegion
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search plants or locations"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* Title Section */}
      <View style={styles.titleSection}>
        <Text style={styles.appTitle}>Plant Map</Text>
        <TouchableOpacity style={styles.filterToggle} onPress={() => setFilterVisible(!filterVisible)}>
          <Text style={styles.filterIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Applied Filters Bar */}
      {(filterFamily || filterStatuses.length || filterStartDate || filterEndDate) && (
        <View style={styles.filtersBar}>
          <Text style={styles.filtersLabel}>Applied Filters:</Text>
          {filterFamily ? (
            <View style={styles.chip}><Text style={styles.chipText}>Family: {filterFamily}</Text></View>
          ) : null}
          {filterStatuses.map((s, i) => (
            <View key={`chip-${s}-${i}`} style={styles.chip}><Text style={styles.chipText}>Status: {s}</Text></View>
          ))}
          {filterStartDate ? (
            <View style={styles.chip}><Text style={styles.chipText}>From: {filterStartDate}</Text></View>
          ) : null}
          {filterEndDate ? (
            <View style={styles.chip}><Text style={styles.chipText}>To: {filterEndDate}</Text></View>
          ) : null}
          <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
            <Text style={styles.clearBtnText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={mapRegion}
          region={mapRegion}
          // Removed: provider={Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE}
          onRegionChangeComplete={(r) => { 
            setMapRegion(r);
            if (showHeatmap) { fetchHeatmapDensity(); }
          }}
          onLongPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setPinCoords({ latitude, longitude });
          }}
        >
          {/* Heatmap overlay */}
          {showHeatmap && densityPoints.length > 0 && (
            renderHeatmapLayer({ gradient: heatGradient, radius: heatRadius, opacity: heatOpacity, region: mapRegion })
          )}

          {/* Dynamic markers from backend (hidden while heatmap to reduce clutter) */}
          {!showHeatmap && locations.map((loc) => (
            <Marker
              key={`loc-${loc.observation_id}-${loc.plant_id}`}
              coordinate={{ latitude: loc.coordinates.lat, longitude: loc.coordinates.lon }}
              title={loc.plant?.common_name || 'Plant'}
              description={loc.plant?.scientific_name || ''}
              onPress={() => handleLocationPress(loc)}
            />
          ))}

          {/* User-dropped pin */}
          {pinCoords && (
            <Marker
              coordinate={pinCoords}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setPinCoords({ latitude, longitude });
              }}
            />
          )}
        </MapView>
        {showHeatmap && (!densityPoints || densityPoints.length === 0) && (
          <View style={styles.legendEmpty}>
            <Text style={styles.legendTitle}>No heatmap data in view</Text>
            <Text style={styles.legendLabel}>Try zooming out or changing filters.</Text>
          </View>
        )}
        {showHeatmap && (
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Observation Density</Text>
            <View style={styles.legendBar}>
              {heatGradient.colors.map((c, i) => (
                <View key={`lg-${i}`} style={[styles.legendSwatch, { backgroundColor: c }]} />
              ))}
            </View>
            <View style={styles.legendLabelsRow}>
              <Text style={styles.legendLabel}>Low</Text>
              <Text style={styles.legendLabel}>High</Text>
            </View>
            <Text style={styles.legendScale}>0 — {densityMax} obs</Text>
          </View>
        )}
      </View>

      {/* Location Button */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({});
            const region = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            };
            setMapRegion(region);
            setPinCoords({ latitude: region.latitude, longitude: region.longitude });
          } catch (err) {
            console.warn('Failed to recenter:', err?.message || err);
          }
        }}
      >
        <Text style={styles.locationIcon}>📍</Text>
      </TouchableOpacity>

      {/* Heatmap toggle */}
      <View style={{ paddingHorizontal: 20, marginTop: 6, marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => {
            setShowHeatmap((v) => {
              const next = !v;
              if (next && mapRegion) {
                fetchHeatmapDensity();
              }
              return next;
            });
          }}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: showHeatmap ? '#1565c0' : '#e3f2fd',
            borderColor: '#90caf9',
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 16,
          }}
        >
          <Text style={{ color: showHeatmap ? '#fff' : '#1565c0' }}>{showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Modal */}
      <Modal
        visible={filterVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.sectionTitle}>Filters</Text>
          {filterError && (
            <View style={styles.errorContainer}><Text style={styles.errorText}>{filterError}</Text></View>
          )}
          <View style={styles.dataContainer}>
            <Text style={styles.label}>Plant Family</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Myrtaceae"
              value={filterFamily}
              onChangeText={setFilterFamily}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.dataContainer}>
            <Text style={styles.label}>Conservation Status</Text>
            <View style={styles.statusRow}>
              {ALL_STATUSES.map((s) => (
                <TouchableOpacity
                  key={`opt-${s}`}
                  onPress={() => toggleStatus(s)}
                  style={[styles.statusChip, filterStatuses.includes(s) ? styles.statusChipActive : null]}
                >
                  <Text style={[styles.statusChipText, filterStatuses.includes(s) ? styles.statusChipTextActive : null]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.dataContainer}>
            <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={filterStartDate}
              onChangeText={setFilterStartDate}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.dataContainer}>
            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={filterEndDate}
              onChangeText={setFilterEndDate}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setFilterVisible(false)}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* Plant Card Modal */}
      <Modal
        visible={showPlantCard}
        animationType="slide"
        transparent={true}
        onRequestClose={closePlantCard}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.plantCard}>
            <TouchableOpacity style={styles.closeButton} onPress={closePlantCard}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            
            {selectedPlant && (
              <>
                {/* Use the Image component generally, the source is a URI */}
                <Image source={{ uri: selectedPlant.image }} style={styles.plantCardImage} />
                <View style={styles.plantCardInfo}>
                  <Text style={styles.plantCardName}>{selectedPlant.name}</Text>
                  <Text style={styles.plantCardScientific}>{selectedPlant.scientificName}</Text>
                  
                  <TouchableOpacity style={styles.viewDetailsButton} onPress={handleViewDetails}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <Text style={styles.arrowIcon}>→</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ... keep all your existing styles ...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  filterToggle: {
    padding: 8,
  },
  filterIcon: {
    fontSize: 20,
  },
  filtersBar: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filtersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  chip: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    color: '#333',
  },
  clearBtn: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearBtnText: {
    color: '#2e7d32',
    fontWeight: '600',
    fontSize: 13,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#e9ecef',
    margin: 20,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  legend: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    maxWidth: 180,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  legendBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  legendSwatch: {
    flex: 1,
  },
  legendLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendLabel: {
    fontSize: 10,
    color: '#555',
  },
  legendScale: {
    marginTop: 4,
    fontSize: 10,
    color: '#555',
  },
  legendEmpty: {
    position: 'absolute',
    left: 16,
    top: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    maxWidth: 220,
  },
  markersContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  marker: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  markerIcon: {
    fontSize: 20,
  },
  modalContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  errorContainer: {
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#b00020',
    fontSize: 14,
  },
  dataContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f1f3f4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  statusChipActive: {
    backgroundColor: '#c8e6c9',
  },
  statusChipText: {
    fontSize: 14,
    color: '#333',
  },
  statusChipTextActive: {
    color: '#1b5e20',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  applyBtn: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  applyBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelBtn: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelBtnText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
  },
  locationButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#ffffff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  locationIcon: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  plantCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  closeIcon: {
    fontSize: 20,
    color: '#666',
  },
  plantCardImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  plantCardInfo: {
    paddingHorizontal: 8,
  },
  plantCardName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  plantCardScientific: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  plantCardDistance: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  viewDetailsButton: {
    backgroundColor: '#2e7d32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  viewDetailsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  arrowIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MapScreen;
