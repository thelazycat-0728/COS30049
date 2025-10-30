// src/screens/MapScreen.js - Updated with navigation, App.js-style filters, and MapView
import React, { useState, useEffect, useRef } from 'react';
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
  AccessibilityInfo,
  Platform,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
// Removed: PROVIDER_GOOGLE
import MapView, { Marker, Heatmap } from 'react-native-maps';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const MapScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const mapRef = useRef(null);
  // Removed unused markerRefs (previously for programmatic callouts)
  // Filters (replicated from image-location-app/App.js)
  const ALL_STATUSES = ['least_concern', 'near_threatened', 'vulnerable'];
  const [filterVisible, setFilterVisible] = useState(false);
  // Plant family multi-select
  const [filterFamilies, setFilterFamilies] = useState([]);
  const [familyOptions, setFamilyOptions] = useState([]);
  const [familyDropdownVisible, setFamilyDropdownVisible] = useState(false);
  const [tempFilterFamilies, setTempFilterFamilies] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [datePreset, setDatePreset] = useState(null);
  const [filterError, setFilterError] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [showPlantCard, setShowPlantCard] = useState(false);
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });
  const [cardDims, setCardDims] = useState({ width: 280, height: 220 });
  const [cardPosition, setCardPosition] = useState({ left: 16, top: 16 });
  const [lastPinPoint, setLastPinPoint] = useState(null);
  const [locations, setLocations] = useState([]);
  const [resultsCount, setResultsCount] = useState(0);
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
    colors: ['rgba(79,195,247,0)', '#29b6f6', '#0288d1', '#ef6c00', '#d84315', '#b71c1c'],
    startPoints: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
    colorMapSize: 256,
  });
  const [densityPoints, setDensityPoints] = useState([]);
  const [densityMax, setDensityMax] = useState(1);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [hasAutoFitted, setHasAutoFitted] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(null); // { loc, mapped }

  const withTimeout = (promise, ms) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Location timeout')), ms);
      promise
        .then((v) => {
          clearTimeout(t);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(t);
          reject(e);
        });
    });

  useEffect(() => {
    (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== 'granted') {
            return;
          }
        }
        const last = await Location.getLastKnownPositionAsync();
        const accuracy = Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High;
        let loc = null;
        try {
          loc = await withTimeout(Location.getCurrentPositionAsync({ accuracy }), 6000);
        } catch (e) {}
        const final = loc || last;
        if (!final) return;
        const region = {
          latitude: final.coords.latitude,
          longitude: final.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        if (!hasUserInteracted) {
          if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
            mapRef.current.animateToRegion(region, 600);
          }
        }
        setMapRegion(region);
        setPinCoords({ latitude: region.latitude, longitude: region.longitude });
      } catch (err) {
        console.warn('Location error:', err?.message || err);
      }
    })();
  }, [hasUserInteracted]);

  // Heatmap helpers and fetching
  const formatDateISO = (dateObj) => {
    try {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch {
      return '';
    }
  };

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
      const selFamiliesForHeat = Array.isArray(filterFamilies) ? filterFamilies.filter(Boolean) : [];
      if (selFamiliesForHeat.length === 1) params.set('family', selFamiliesForHeat[0]);
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
      const params = new URLSearchParams();
      params.set('limit', '500');
      const selFamilies = Array.isArray(filterFamilies) ? filterFamilies.filter(Boolean) : [];
      if (selFamilies.length === 1) params.set('family', selFamilies[0]);
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
      const filteredCoords = selFamilies.length > 1 ? withCoords.filter((loc) => selFamilies.includes(loc?.plant?.family)) : withCoords;
      setLocations(filteredCoords);
      setResultsCount(filteredCoords.length);

      // Auto-fit once to include all markers, unless user has interacted
      if (withCoords.length > 0 && !hasUserInteracted && !hasAutoFitted) {
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
        if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
          mapRef.current.animateToRegion(nextRegion, 600);
        }
        setMapRegion(nextRegion);
        setHasAutoFitted(true);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
    }
  };

  // Initial markers fetch
  useEffect(() => {
    fetchLocations();
  }, []);

  // Refetch markers when filters change
  useEffect(() => {
    fetchLocations();
  }, [filterFamilies, filterStatuses, filterStartDate, filterEndDate]);

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

    if (!filtered.length || !Heatmap) return null;
    const points = filtered.map((p) => ({ latitude: p.latitude, longitude: p.longitude, weight: Math.max(1, p.observation_count) }));
    return (
      <Heatmap points={points} radius={radius} opacity={opacity} gradient={gradient} />
    );
  };

  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  const computeCardPosition = (pt, dims, layout) => {
    const pad = 12;
    const safeLeft = clamp((pt?.x ?? layout.width / 2) + pad, pad, Math.max(pad, layout.width - dims.width - pad));
    const safeTop = clamp((pt?.y ?? layout.height / 2) - dims.height - pad, pad, Math.max(pad, layout.height - dims.height - pad));
    return { left: safeLeft, top: safeTop };
  };

  const showCardAfterCenter = async (loc, mapped) => {
    let pt = null;
    try {
      if (mapRef.current && typeof mapRef.current.pointForCoordinate === 'function') {
        pt = await mapRef.current.pointForCoordinate({ latitude: loc.coordinates.lat, longitude: loc.coordinates.lon });
      }
    } catch (e) {
      pt = { x: mapLayout.width / 2, y: mapLayout.height / 2 };
    }
    setLastPinPoint(pt);
    const pos = computeCardPosition(pt, cardDims, mapLayout);
    setCardPosition(pos);
    setSelectedPlant(mapped);
    setShowPlantCard(true);
    setPendingSelection(null);
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
    // Hide any existing card while we move the map
    setShowPlantCard(false);
    setSelectedPlant(null);
    setHasUserInteracted(true);
    setPendingSelection({ loc, mapped });

    const nextRegion = {
      latitude: loc.coordinates.lat,
      longitude: loc.coordinates.lon,
      latitudeDelta: mapRegion?.latitudeDelta ?? 0.02,
      longitudeDelta: mapRegion?.longitudeDelta ?? 0.02,
    };
    if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
      mapRef.current.animateToRegion(nextRegion, 350);
    }
    setMapRegion(nextRegion);
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
    setFilterFamilies([]);
    setFilterStatuses([]);
    setFilterStartDate('');
    setFilterEndDate('');
    setDatePreset(null);
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

  // Quick date range presets
  const applyDatePreset = (preset) => {
    setFilterError(null);
    const today = new Date();
    let start = null;
    let end = null;
    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'last7': {
        end = today;
        start = new Date(today);
        start.setDate(today.getDate() - 6);
        break;
      }
      case 'last30': {
        end = today;
        start = new Date(today);
        start.setDate(today.getDate() - 29);
        break;
      }
      case 'last90': {
        end = today;
        start = new Date(today);
        start.setDate(today.getDate() - 89);
        break;
      }
      case 'thisMonth': {
        end = today;
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      }
      default:
        return;
    }
    setFilterStartDate(formatDateISO(start));
    setFilterEndDate(formatDateISO(end));
    setDatePreset(preset);
  };

  // Family dropdown helpers
  const openFamilyDropdown = () => {
    setTempFilterFamilies(filterFamilies);
    setFamilyDropdownVisible(true);
    AccessibilityInfo.announceForAccessibility?.('Select plant families.');
  };
  const closeFamilyDropdown = () => {
    setFamilyDropdownVisible(false);
  };
  const toggleTempFamily = (fam) => {
    setTempFilterFamilies((prev) => {
      if (prev.includes(fam)) return prev.filter((f) => f !== fam);
      return [...prev, fam];
    });
  };
  const confirmFamilySelection = () => {
    setFilterFamilies(tempFilterFamilies);
    setFamilyDropdownVisible(false);
  };
  const clearAllFamilies = () => {
    setTempFilterFamilies([]);
  };
  const removeFamily = (fam) => {
    setFilterFamilies((prev) => prev.filter((f) => f !== fam));
  };

  const removeStatus = (status) => {
    setFilterStatuses((prev) => prev.filter((s) => s !== status));
  };

  // Fetch all families once for dropdown options
  const fetchFamilyOptions = async () => {
    try {
      const res = await fetch(`${API_BASE}/map/locations/public`);
      if (!res.ok) throw new Error('Family options fetch failed');
      const data = await res.json();
      const list = Array.isArray(data?.locations) ? data.locations : [];
      const families = Array.from(new Set(list.map((loc) => (loc?.plant?.family || '').trim()).filter(Boolean))).sort();
      setFamilyOptions(families);
    } catch (err) {
      console.warn('Unable to load family options:', err?.message || err);
      // Fallback: derive from current locations if available
      setFamilyOptions((prev) => {
        const families = Array.from(new Set(locations.map((loc) => (loc?.plant?.family || '').trim()).filter(Boolean))).sort();
        return families.length ? families : prev;
      });
    }
  };

  useEffect(() => {
    fetchFamilyOptions();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search plants or locations"
            value={searchText}
            onChangeText={setSearchText}
          />
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        </View>
      </View>

      {/* Title Section */}
      <View style={styles.titleSection}>
        <Text style={styles.appTitle}>Plant Map</Text>
        <TouchableOpacity style={styles.filterButton} onPress={() => setFilterVisible(true)}>
          <Ionicons name="options-outline" size={18} color="#666" />
          <Text style={styles.filterText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Applied Filters Bar */}
      {(filterFamilies.length || filterStatuses.length || datePreset) && (
        <View style={styles.filtersBar} accessible accessibilityLabel="Applied filters">
          <Text style={styles.filtersLabel}>Applied Filters:</Text>
          <View style={styles.chip}><Text style={styles.chipText}>Results: {resultsCount}</Text></View>
          {datePreset ? (
            <TouchableOpacity
              style={styles.chip}
              onPress={() => { setDatePreset(null); setFilterStartDate(''); setFilterEndDate(''); }}
              accessibilityRole="button"
              accessibilityLabel="Remove date range filter"
            >
              <Text style={styles.chipText}>Date Range: {(
                {
                  today: 'Today',
                  last7: 'Last 7 days',
                  last30: 'Last 30 days',
                  last90: 'Last 90 days',
                  thisMonth: 'This month',
                }[datePreset]
              )} ✕</Text>
            </TouchableOpacity>
          ) : null}
          {filterFamilies.map((fam, i) => (
            <TouchableOpacity
              key={`fam-chip-${fam}-${i}`}
              style={styles.chip}
              onPress={() => removeFamily(fam)}
              accessibilityRole="button"
              accessibilityLabel={`Remove family ${fam}`}
            >
              <Text style={styles.chipText}>Family: {fam} ✕</Text>
            </TouchableOpacity>
          ))}
          {filterStatuses.map((s, i) => (
            <TouchableOpacity
              key={`chip-${s}-${i}`}
              style={styles.chip}
              onPress={() => removeStatus(s)}
              accessibilityRole="button"
              accessibilityLabel={`Remove status ${s}`}
            >
              <Text style={styles.chipText}>Status: {s} ✕</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.clearBtn} onPress={clearFilters} accessibilityRole="button" accessibilityLabel="Clear filters">
            <Text style={styles.clearBtnText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map View */}
      <View style={styles.mapContainer} onLayout={(e) => setMapLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={mapRegion}
          // Removed: provider={Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE}
          onRegionChangeComplete={(r) => { 
            setMapRegion(r);
            setHasUserInteracted(true);
            if (showHeatmap) { fetchHeatmapDensity(); }
            if (pendingSelection) {
              const targetLat = pendingSelection.loc.coordinates.lat;
              const targetLon = pendingSelection.loc.coordinates.lon;
              const closeEnough = Math.abs(r.latitude - targetLat) < 0.0005 && Math.abs(r.longitude - targetLon) < 0.0005;
              if (closeEnough) {
                // After the map centers, show the card anchored over the pin
                showCardAfterCenter(pendingSelection.loc, pendingSelection.mapped);
              }
            }
          }}
          onPanDrag={() => setHasUserInteracted(true)}
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
              onPress={() => handleLocationPress(loc)}
            />
          ))}

          {/* Close card when tapping empty map area */}
          
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
        {/* Dismiss card by tapping anywhere outside the card */}
        {showPlantCard && (
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={closePlantCard}
          />
        )}
        {showPlantCard && selectedPlant && (
          <View
            style={[
              styles.plantCardOverlay,
              { left: cardPosition.left, top: cardPosition.top, width: cardDims.width },
            ]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              // Update dims and re-clamp position to keep within viewport
              if (width !== cardDims.width || height !== cardDims.height) {
                const nextDims = { width, height };
                setCardDims(nextDims);
                const nextPos = computeCardPosition(lastPinPoint, nextDims, mapLayout);
                setCardPosition(nextPos);
              }
            }}
          >
            {/* Pointer visually anchored to the tapped pin's x-position */}
            <View
              style={[
                styles.cardPointer,
                {
                  left: clamp(
                    ((lastPinPoint?.x ?? (cardPosition.left + cardDims.width / 2)) - cardPosition.left) - 8,
                    10,
                    Math.max(10, cardDims.width - 26)
                  ),
                },
              ]}
            />
            <View style={styles.plantCard}>
              <TouchableOpacity style={styles.closeButton} onPress={closePlantCard}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
              {selectedPlant && (
                <>
                  <View style={styles.cardHeader}>
                    {selectedPlant.image ? (
                      <Image source={{ uri: selectedPlant.image }} style={styles.cardImage} />
                    ) : (
                      <View style={styles.cardImagePlaceholder}>
                        <Ionicons name="leaf" size={24} color="#2e7d32" />
                      </View>
                    )}
                    <View style={styles.cardText}>
                      <Text style={styles.plantCardName} numberOfLines={1}>{selectedPlant.name}</Text>
                      <Text style={styles.plantCardScientific} numberOfLines={2}>{selectedPlant.scientificName}</Text>
                    </View>
                  </View>
                  <View style={styles.plantCardInfo}>
                    <TouchableOpacity style={styles.viewDetailsButton} onPress={handleViewDetails}>
                      <Text style={styles.viewDetailsText}>View Details</Text>
                      <Text style={styles.arrowIcon}>→</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
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
            let perm = await Location.getForegroundPermissionsAsync();
            if (perm.status !== 'granted') {
              const req = await Location.requestForegroundPermissionsAsync();
              if (req.status !== 'granted') return;
            }
            const last = await Location.getLastKnownPositionAsync();
            const accuracy = Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High;
            let loc = null;
            if (last) {
              const regionA = {
                latitude: last.coords.latitude,
                longitude: last.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              };
              if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
                mapRef.current.animateToRegion(regionA, 600);
              }
              setMapRegion(regionA);
              setPinCoords({ latitude: regionA.latitude, longitude: regionA.longitude });
            }
            try {
              loc = await withTimeout(Location.getCurrentPositionAsync({ accuracy }), 6000);
            } catch (e) {}
            const final = loc || last;
            if (!final) return;
            const regionB = {
              latitude: final.coords.latitude,
              longitude: final.coords.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            };
            if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
              mapRef.current.animateToRegion(regionB, 600);
            }
            setMapRegion(regionB);
            setPinCoords({ latitude: regionB.latitude, longitude: regionB.longitude });
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
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {filterError && (
                <View style={styles.errorContainer}><Text style={styles.errorText}>{filterError}</Text></View>
              )}
              <View style={styles.dataContainer}>
                <Text style={styles.inputLabel}>Plant Family</Text>
                <TouchableOpacity
                  style={styles.textInput}
                  onPress={openFamilyDropdown}
                  accessibilityRole="button"
                  accessibilityLabel="Open plant family selector"
                >
                  <Text>
                    {filterFamilies.length
                      ? `${filterFamilies.length} selected`
                      : 'Select plant families'}
                  </Text>
                </TouchableOpacity>
                {filterFamilies.length ? (
                  <View style={styles.statusRow}>
                    {filterFamilies.map((fam, i) => (
                      <TouchableOpacity
                        key={`fam-sel-${fam}-${i}`}
                        style={styles.statusChip}
                        onPress={() => removeFamily(fam)}
                        accessibilityRole="button"
                        accessibilityLabel={`Deselect ${fam}`}
                      >
                        <Text style={styles.statusChipText}>{fam} ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Family Multi-Select Modal */}
              <Modal
                visible={familyDropdownVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={closeFamilyDropdown}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Select Plant Families</Text>
                      <TouchableOpacity onPress={closeFamilyDropdown}>
                        <Ionicons name="close" size={24} color="#666" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody}>
                      <View style={styles.dataContainer}>
                        {familyOptions.length === 0 ? (
                          <Text>No family options available.</Text>
                        ) : familyOptions.map((fam) => {
                          const selected = tempFilterFamilies.includes(fam);
                          return (
                            <TouchableOpacity
                              key={`fam-opt-${fam}`}
                              onPress={() => toggleTempFamily(fam)}
                              style={[styles.statusChip, selected ? styles.statusChipActive : null]}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: selected }}
                              accessibilityLabel={fam}
                            >
                              <Text style={[styles.statusChipText, selected ? styles.statusChipTextActive : null]}>
                                {fam}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>

                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.cancelButton} onPress={clearAllFamilies} accessibilityRole="button" accessibilityLabel="Clear all selected families">
                        <Text style={styles.cancelButtonText}>Clear Selection</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveButton} onPress={confirmFamilySelection} accessibilityRole="button" accessibilityLabel="Apply selected families">
                        <Text style={styles.saveButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              <View style={styles.dataContainer}>
                <Text style={styles.inputLabel}>Conservation Status</Text>
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
                <Text style={styles.inputLabel}>Quick Date Ranges</Text>
                <View style={styles.statusRow}>
                  <TouchableOpacity onPress={() => applyDatePreset('today')} style={[styles.statusChip, datePreset === 'today' ? styles.statusChipActive : null]} accessibilityRole="button" accessibilityLabel="Select today">
                    <Text style={[styles.statusChipText, datePreset === 'today' ? styles.statusChipTextActive : null]}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyDatePreset('last7')} style={[styles.statusChip, datePreset === 'last7' ? styles.statusChipActive : null]} accessibilityRole="button" accessibilityLabel="Select last 7 days">
                    <Text style={[styles.statusChipText, datePreset === 'last7' ? styles.statusChipTextActive : null]}>Last 7 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyDatePreset('last30')} style={[styles.statusChip, datePreset === 'last30' ? styles.statusChipActive : null]} accessibilityRole="button" accessibilityLabel="Select last 30 days">
                    <Text style={[styles.statusChipText, datePreset === 'last30' ? styles.statusChipTextActive : null]}>Last 30 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyDatePreset('last90')} style={[styles.statusChip, datePreset === 'last90' ? styles.statusChipActive : null]} accessibilityRole="button" accessibilityLabel="Select last 90 days">
                    <Text style={[styles.statusChipText, datePreset === 'last90' ? styles.statusChipTextActive : null]}>Last 90 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyDatePreset('thisMonth')} style={[styles.statusChip, datePreset === 'thisMonth' ? styles.statusChipActive : null]} accessibilityRole="button" accessibilityLabel="Select this month">
                    <Text style={[styles.statusChipText, datePreset === 'thisMonth' ? styles.statusChipTextActive : null]}>This month</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={clearFilters}>
                <Text style={styles.cancelButtonText}>Clear Filters</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={applyFilters}>
                <Text style={styles.saveButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Plant Card anchored overlay is rendered inside mapContainer above */}
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
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#f1f3f4',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: 12,
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
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
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
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    color: '#666',
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
  plantCardOverlay: {
    position: 'absolute',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  cardPointer: {
    position: 'absolute',
    bottom: -8,
    width: 16,
    height: 16,
    backgroundColor: '#ffffff',
    borderColor: '#ddd',
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  modalContainer: {
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
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
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f1f3f4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
  },
  statusChipActive: {
    backgroundColor: '#e8f5e8',
    borderColor: '#2e7d32',
  },
  statusChipText: {
    fontSize: 14,
    color: '#666',
  },
  statusChipTextActive: {
    color: '#2e7d32',
    fontWeight: '600',
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
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
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
  plantCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    minWidth: 220,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  closeIcon: {
    fontSize: 20,
    color: '#666',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f1f3f4',
  },
  cardImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
  },
  plantCardInfo: {
    paddingHorizontal: 2,
  },
  plantCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  plantCardScientific: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  viewDetailsButton: {
    backgroundColor: '#2e7d32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  viewDetailsText: {
    color: '#ffffff',
    fontSize: 15,
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
