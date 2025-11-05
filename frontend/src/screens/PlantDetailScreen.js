// screens/PlantDetailScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity, Pressable, Animated, Dimensions, BackHandler } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const PlantDetailScreen = ({ route }) => {
  const navigation = useNavigation();
  const { plant } = route.params || {};
  const plantId = plant?.plant_id;

  const [plantDetails, setPlantDetails] = useState(null);
  const [obsLocations, setObsLocations] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedObsId, setSelectedObsId] = useState(null);
  const mapRef = useRef(null);

  // Side panel state
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [selectedObservation, setSelectedObservation] = useState(null);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const prevRouteNameRef = useRef(null);

  const handleGoBack = useCallback(() => {
    // Prefer normal stack back when available
    if (navigation && navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
      return true;
    }
    // Try origin param if provided by the source screen
    const origin = route?.params?.origin;
    if (origin) {
      navigation.navigate(origin);
      return true;
    }
    // Try previous route name from nav state
    const state = navigation?.getState?.();
    const prev = state?.routes?.[Math.max(0, (state?.index ?? 0) - 1)]?.name;
    if (prev) {
      navigation.navigate(prev);
      return true;
    }
    // Final fallback: go to Home tab
    navigation.navigate('Home');
    return true;
  }, [navigation, route?.params]);

  useFocusEffect(
    useCallback(() => {
      // Cache previous route name for potential fallback
      try {
        const state = navigation?.getState?.();
        prevRouteNameRef.current = state?.routes?.[Math.max(0, (state?.index ?? 0) - 1)]?.name || null;
      } catch (e) {
        prevRouteNameRef.current = null;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', handleGoBack);
      return () => sub.remove();
    }, [handleGoBack])
  );

  useEffect(() => {
    // Ensure header back uses the same logic across iOS/Android/web
    if (navigation?.setOptions) {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity onPress={handleGoBack} style={{ paddingHorizontal: 10 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, handleGoBack]);

  // Display state
  const [display, setDisplay] = useState({
    imageUrl: null,
    commonName: 'Unknown',
    scientificName: '',
    species: '',
    family: '',
    description: '',
  });

  // NEW: Load more state
  const [displayCount, setDisplayCount] = useState(5);
  const [displayedObservations, setDisplayedObservations] = useState([]);

  // NEW: Load more function
  const loadMoreObservations = () => {
    const newCount = displayCount + 5;
    setDisplayCount(newCount);
    setDisplayedObservations(obsLocations.slice(0, newCount));
  };

  // NEW: Update displayed observations when obsLocations or displayCount changes
  useEffect(() => {
    if (obsLocations.length > 0) {
      setDisplayedObservations(obsLocations.slice(0, displayCount));
    }
  }, [obsLocations, displayCount]);

  const openSidePanel = (observation) => {
    setSelectedObservation(observation);
    setSelectedObsId(observation.id);
    setShowSidePanel(true);
    
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const nextRegion = {
      latitude: observation.latitude,
      longitude: observation.longitude,
      latitudeDelta: mapRegion?.latitudeDelta ?? 0.02,
      longitudeDelta: mapRegion?.longitudeDelta ?? 0.02,
    };
    
    if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
      mapRef.current.animateToRegion(nextRegion, 350);
    }
  };

  const closeSidePanel = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowSidePanel(false);
      setSelectedObservation(null);
      setSelectedObsId(null);
    });
  };

  const handleObservationPress = (observation) => {
    openSidePanel(observation);
  };

  const timeAgo = (iso) => {
    if (!iso) return 'Unknown date';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Unknown date';
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    const month = Math.floor(day / 30);
    const year = Math.floor(day / 365);
    if (year > 0) return `${year} year${year > 1 ? 's' : ''} ago`;
    if (month > 0) return `${month} month${month > 1 ? 's' : ''} ago`;
    if (day > 0) return `${day} day${day > 1 ? 's' : ''} ago`;
    if (hr > 0) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
    if (min > 0) return `${min} minute${min > 1 ? 's' : ''} ago`;
    return `${sec} second${sec !== 1 ? 's' : ''} ago`;
  };

  const formatDate = (iso) => {
    if (!iso) return 'Unknown';
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fetch data
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch plant details
        let pd = null;
        if (plantId) {
          const res = await fetch(`${API_BASE}/admin/plants/${plantId}`);
          if (res.ok) {
            pd = await res.json();
          } else {
            throw new Error(`Plant fetch failed: ${res.status}`);
          }
        } else {
          throw new Error('No plant_id provided');
        }

        // Fetch observations
        let allObs = [];
        try {
          const paramsAll = new URLSearchParams({ 
            plantId: String(plantId), 
            limit: '1000', 
            public: '1' 
          });
          const resAll = await fetch(`${API_BASE}/observations?${paramsAll.toString()}`);
          if (resAll.ok) {
            const dataAll = await resAll.json();
            const rawList = Array.isArray(dataAll?.observations) ? dataAll.observations : [];
            const filteredByPlant = rawList.filter((o) => Number(o?.plant_id) === Number(plantId));
            const filteredPublic = filteredByPlant.filter((o) => o?.public === 1 || o?.public === true);
            allObs = filteredPublic
              .filter((o) => o?.latitude != null && o?.longitude != null)
              .map((o) => ({
                id: o.observation_id,
                latitude: Number(o.latitude),
                longitude: Number(o.longitude),
                image_url: o.image_url,
                observation_date: o.observation_date,
                user_id: o.user_id,
                username: o.username || null,
              }));
            allObs.sort((a, b) => {
              const ta = new Date(a.observation_date).getTime();
              const tb = new Date(b.observation_date).getTime();
              if (isNaN(ta) && isNaN(tb)) return 0;
              if (isNaN(ta)) return 1;
              if (isNaN(tb)) return -1;
              return tb - ta;
            });
          }
        } catch (e) {
          console.warn('Observations fetch error:', e?.message || e);
        }

        if (mounted) {
          setPlantDetails(pd);
          setObsLocations(allObs);

          // Compute map region
          if (allObs.length) {
            const lats = allObs.map(p => p.latitude);
            const lons = allObs.map(p => p.longitude);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            const centerLat = (minLat + maxLat) / 2;
            const centerLon = (minLon + maxLon) / 2;
            const latDelta = Math.max(0.01, (maxLat - minLat) * 1.4);
            const lonDelta = Math.max(0.01, (maxLon - minLon) * 1.4);
            setMapRegion({ 
              latitude: centerLat, 
              longitude: centerLon, 
              latitudeDelta: latDelta, 
              longitudeDelta: lonDelta 
            });
          }

          // Set display variables
          const imageUrl = pd?.plant?.image_url || plant?.image_url || null;
          const commonName = pd?.plant?.common_name || plant?.common_name || 'Unknown';
          const scientificName = pd?.plant?.scientific_name || plant?.scientific_name || '';
          const species = pd?.plant?.species || '';
          const family = pd?.plant?.family || '';
          const description = pd?.plant?.description || '';

          setDisplay({
            imageUrl,
            commonName,
            scientificName,
            species,
            family,
            description,
          });
        }
      } catch (e) {
        console.error('Error fetching plant details:', e);
        if (mounted) setError(e.message || 'Failed to load plant');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [plantId]);

  // Stats cards data
  const statsData = [
    {
      icon: 'eye',
      label: 'Observations',
      value: obsLocations.length,
      color: '#4CAF50'
    },
    {
      icon: 'map-marker-alt',
      label: 'Locations',
      value: new Set(obsLocations.map(obs => `${obs.latitude.toFixed(2)},${obs.longitude.toFixed(2)}`)).size,
      color: '#2196F3'
    },
    {
      icon: 'users',
      label: 'Contributors',
      value: new Set(obsLocations.map(obs => obs.user_id)).size,
      color: '#FF9800'
    }
  ];

  // NEW: Check if there are more observations to load
  const hasMoreObservations = displayedObservations.length < obsLocations.length;
  const remainingObservations = obsLocations.length - displayedObservations.length;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {/* Header with Plant Image and Gradient Overlay */}
        <View style={styles.headerContainer}>
          {display.imageUrl ? (
            <Image source={{ uri: display.imageUrl }} style={styles.plantImage} />
          ) : (
            <View style={[styles.plantImage, styles.placeholder]}>
              <FontAwesome5 name="leaf" size={50} color="#90EE90" />
              <Text style={styles.placeholderText}>No image available</Text>
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.gradientOverlay}
          />
          <View style={styles.headerContent}>
            <Text style={styles.plantName}>{display.commonName}</Text>
            <Text style={styles.scientificName}>{display.scientificName}</Text>
            {display.family && (
              <View style={styles.familyBadge}>
                <Text style={styles.familyText}>{display.family} Family</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading plant details...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={24} color="#f44336" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <>
              {/* Stats Cards */}
              <View style={styles.statsContainer}>
                {statsData.map((stat, index) => (
                  <View key={stat.label} style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                      <FontAwesome5 name={stat.icon} size={16} color={stat.color} />
                    </View>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* Description Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="description" size={20} color="#4CAF50" />
                  <Text style={styles.cardTitle}>Description</Text>
                </View>
                <Text style={styles.description}>
                  {display.description || `No description available for ${display.commonName}.`}
                </Text>
              </View>

              {/* Plant Details Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="eco" size={20} color="#4CAF50" />
                  <Text style={styles.cardTitle}>Plant Details</Text>
                </View>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <FontAwesome5 name="signature" size={14} color="#666" />
                    <Text style={styles.detailLabel}>Scientific Name</Text>
                    <Text style={styles.detailValue} numberOfLines={2}>{display.scientificName || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <FontAwesome5 name="seedling" size={14} color="#666" />
                    <Text style={styles.detailLabel}>Species</Text>
                    <Text style={styles.detailValue} numberOfLines={2}>{display.species || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <FontAwesome5 name="tag" size={14} color="#666" />
                    <Text style={styles.detailLabel}>Common Name</Text>
                    <Text style={styles.detailValue} numberOfLines={2}>{display.commonName || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <FontAwesome5 name="tree" size={14} color="#666" />
                    <Text style={styles.detailLabel}>Family</Text>
                    <Text style={styles.detailValue} numberOfLines={2}>{display.family || 'N/A'}</Text>
                  </View>
                </View>
              </View>

              {/* Observations Section */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="map" size={20} color="#4CAF50" />
                  <Text style={styles.cardTitle}>Observations Map</Text>
                  <View style={styles.observationCount}>
                    <Text style={styles.observationCountText}>{obsLocations.length}</Text>
                  </View>
                </View>
                
                {mapRegion && Number.isFinite(mapRegion.latitude) && Number.isFinite(mapRegion.longitude) ? (
                  <View style={styles.mapContainer}>
                    <MapView
                      ref={mapRef}
                      style={styles.map}
                      initialRegion={mapRegion}
                      onRegionChangeComplete={(r) => setMapRegion(r)}
                      onPanDrag={() => {
                        if (showSidePanel) {
                          closeSidePanel();
                        }
                      }}
                    >
                      {obsLocations.map((observation) => (
                        <Marker
                          key={`obs-${observation.id}`}
                          coordinate={{ 
                            latitude: observation.latitude, 
                            longitude: observation.longitude 
                          }}
                          pinColor={selectedObsId === observation.id ? '#4CAF50' : '#FF6B6B'}
                          onPress={() => handleObservationPress(observation)}
                          tracksViewChanges={false}
                        >
                          <Callout tooltip={true} style={styles.customCallout}>
                            <View style={styles.calloutContainer}>
                              <Text style={styles.calloutTitle} numberOfLines={1}>
                                {display.commonName}
                              </Text>
                              <Text style={styles.calloutSubtitle}>
                                {timeAgo(observation.observation_date)}
                              </Text>
                            </View>
                          </Callout>
                        </Marker>
                      ))}
                    </MapView>

                    {/* Map Controls */}
                    <View style={styles.mapControls}>
                      <Text style={styles.mapHint}>Tap on markers to view details</Text>
                    </View>

                    {/* Side Panel */}
                    {showSidePanel && (
                      <>
                        <Pressable style={styles.mapBackdrop} onPress={closeSidePanel} />
                        <Animated.View 
                          style={[
                            styles.mapSidePanel,
                            {
                              transform: [{ translateX: slideAnim }]
                            }
                          ]}
                        >
                          <View style={styles.panelHeader}>
                            <View style={styles.panelTitleContainer}>
                              <MaterialIcons name="photo-camera" size={18} color="#4CAF50" />
                              <Text style={styles.panelTitle}>Observation Details</Text>
                            </View>
                            <TouchableOpacity 
                              style={styles.closeButton}
                              onPress={closeSidePanel}
                            >
                              <Ionicons name="close" size={22} color="#666" />
                            </TouchableOpacity>
                          </View>

                          <ScrollView 
                            style={styles.panelContent} 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.panelContentContainer}
                            nestedScrollEnabled={true}
                            scrollEnabled={true}
                            overScrollMode="always"
                          >
                            {selectedObservation && (
                              <>
                                <View style={styles.imageContainer}>
                                  {selectedObservation.image_url ? (
                                    <Image 
                                      source={{ uri: selectedObservation.image_url }} 
                                      style={styles.observationImage} 
                                    />
                                  ) : (
                                    <View style={[styles.observationImage, styles.observationImagePlaceholder]}>
                                      <Ionicons name="camera" size={32} color="#ccc" />
                                      <Text style={styles.noImageText}>No Image Available</Text>
                                    </View>
                                  )}
                                </View>

                                <View style={styles.infoCard}>
                                  <Text style={styles.infoCardTitle}>Plant Information</Text>
                                  <View style={styles.infoGrid}>
                                    <View style={styles.infoItem}>
                                      <Text style={styles.infoLabel}>Common Name</Text>
                                      <Text style={styles.infoValue}>{display.commonName}</Text>
                                    </View>
                                    <View style={styles.infoItem}>
                                      <Text style={styles.infoLabel}>Scientific Name</Text>
                                      <Text style={styles.infoValue}>{display.scientificName}</Text>
                                    </View>
                                  </View>
                                </View>

                                <View style={styles.infoCard}>
                                  <Text style={styles.infoCardTitle}>Observation Details</Text>
                                  <View style={styles.infoGrid}>
                                    <View style={styles.infoItem}>
                                      <Text style={styles.infoLabel}>Observed</Text>
                                      <Text style={styles.infoValue}>{timeAgo(selectedObservation.observation_date)}</Text>
                                    </View>
                                    <View style={styles.infoItem}>
                                      <Text style={styles.infoLabel}>Published by</Text>
                                      <Text style={styles.infoValue}>{selectedObservation.username || 'Anonymous'}</Text>
                                    </View>
                                  </View>
                                </View>

                                <View style={styles.infoCard}>
                                  <Text style={styles.infoCardTitle}>Location</Text>
                                  <View style={styles.locationInfo}>
                                    <MaterialIcons name="location-on" size={16} color="#666" />
                                    <Text style={styles.coordinates}>
                                      {selectedObservation.latitude.toFixed(6)}, {selectedObservation.longitude.toFixed(6)}
                                    </Text>
                                  </View>
                                </View>
                              </>
                            )}
                          </ScrollView>
                        </Animated.View>
                      </>
                    )}
                  </View>
                ) : (
                  <View style={styles.placeholderBox}>
                    <MaterialIcons name="location-off" size={40} color="#ccc" />
                    <Text style={styles.placeholderTitle}>No Observations</Text>
                    <Text style={styles.placeholderSubtitle}>No public observations with coordinates available</Text>
                  </View>
                )}

                {/* Observations List */}
                {obsLocations.length > 0 && (
                  <View style={styles.listContainer}>
                    <View style={styles.listHeader}>
                      <Text style={styles.listTitle}>
                        {displayedObservations.length === obsLocations.length ? 'All Observations' : 'Recent Observations'}
                      </Text>
                      <Text style={styles.listCount}>({obsLocations.length})</Text>
                    </View>
                    <ScrollView 
                      style={styles.observationsScrollView}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {displayedObservations.map((observation) => (
                        <TouchableOpacity
                          key={`list-${observation.id}`}
                          style={[
                            styles.listItem,
                            selectedObsId === observation.id && styles.listItemSelected,
                          ]}
                          onPress={() => handleObservationPress(observation)}
                        >
                          <View style={styles.listItemContent}>
                            {observation.image_url ? (
                              <Image 
                                source={{ uri: observation.image_url }} 
                                style={styles.listThumb} 
                              />
                            ) : (
                              <View style={[styles.listThumb, styles.listThumbPlaceholder]}>
                                <Ionicons name="camera" size={20} color="#999" />
                              </View>
                            )}
                            <View style={styles.listTextBox}>
                              <Text style={styles.listItemTitle}>
                                {timeAgo(observation.observation_date)}
                              </Text>
                              <Text style={styles.listItemSubtitle}>
                                by {observation.username || 'Anonymous'}
                              </Text>
                            </View>
                            <View style={styles.listMeta}>
                              <MaterialIcons name="location-on" size={12} color="#999" />
                              <Text style={styles.listCoordinates}>
                                {observation.latitude.toFixed(2)}, {observation.longitude.toFixed(2)}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#999" />
                          </View>
                        </TouchableOpacity>
                      ))}
                      
                      {/* Load More Button */}
                      {hasMoreObservations && (
                        <TouchableOpacity 
                          style={styles.loadMoreButton}
                          onPress={loadMoreObservations}
                          activeOpacity={0.7}
                        >
                          <View style={styles.loadMoreContent}>
                            <Ionicons name="add-circle-outline" size={20} color="#4CAF50" />
                            <Text style={styles.loadMoreText}>
                              Load More ({remainingObservations} remaining)
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  // Header Styles
  headerContainer: {
    position: 'relative',
    height: 350,
  },
  plantImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  headerContent: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  plantName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  scientificName: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontStyle: 'italic',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  familyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  familyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // Content Styles
  content: {
    padding: 20,
    marginTop: -20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 16,
  },
  // Stats Cards
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // Card Styles
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  // Description
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
  },
  // Details Grid
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  // Map Styles
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: 300,
  },
  mapControls: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    alignItems: 'center',
  },
  mapHint: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  // Callout Styles
  customCallout: {
    backgroundColor: 'transparent',
  },
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  // Side Panel Styles
  mapBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  mapSidePanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '90%',
    maxWidth: 350,
    backgroundColor: 'white',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  panelTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  panelContent: {
    flex: 1,
  },
  panelContentContainer: {
    paddingBottom: 20,
  },
  // Observation Image
  imageContainer: {
    marginBottom: 16,
  },
  observationImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  observationImagePlaceholder: {
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  noImageText: {
    marginTop: 8,
    color: '#999',
    fontSize: 14,
  },
  // Info Cards in Side Panel
  infoCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordinates: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
    fontFamily: 'monospace',
  },
  // List Styles
  listContainer: {
    marginTop: 16,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  listCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  observationCount: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  observationCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  observationsScrollView: {
    maxHeight: 400,
  },
  listItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  listItemSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8e9',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  listThumbPlaceholder: {
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTextBox: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  listCoordinates: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  // NEW: Load More Button Styles
  loadMoreButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
  },
  loadMoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Placeholder Styles
  placeholderBox: {
    backgroundColor: '#f8f9fa',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  placeholderTitle: {
    fontSize: 18,
    color: '#999',
    marginTop: 12,
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default PlantDetailScreen;