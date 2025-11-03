// screens/PlantDetailScreen.js
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Image, ScrollView, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE; // align with Map/Admin screens

const PlantDetailScreen = ({ route }) => {
  const { plant } = route.params || {};
  const plantId = plant?.plant_id;
  const observationId = plant?.observationId;

  const [plantDetails, setPlantDetails] = useState(null);
  const [observation, setObservation] = useState(null);
  const [obsLocations, setObsLocations] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ New: state for derived/display variables (initialized after fetch)
  const [display, setDisplay] = useState({
    imageUrl: null,
    commonName: 'Unknown',
    scientificName: '',
    species: '',
    family: '',
    description: '',
    conservationStatus: '',
    observationDate: '',
    latitude: null,
    longitude: null,
  });

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

            console.log(pd);
          } else {
            throw new Error(`Plant fetch failed: ${res.status}`);
          }
        }

        // Fetch observation details (for image/coordinates)
        let obs = null;
        if (observationId) {
          const resObs = await fetch(`${API_BASE}/observations/${observationId}`);
          if (resObs.ok) {
            const data = await resObs.json();
            obs = data?.observation || null;
          } else {
            console.warn('Observation fetch failed:', resObs.status);
          }
        }

        // Fetch observations for this specific plant to render multiple PUBLIC pins
        let allObs = [];
        if (plantId != null) {
          const paramsAll = new URLSearchParams({ plantId: String(plantId), limit: '1000', public: '1' });
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
              }));
          } else {
            console.warn('All observations fetch failed:', resAll.status);
          }
        }

        if (mounted) {
          setPlantDetails(pd);
          setObservation(obs);
          setObsLocations(allObs);

          // Compute map region centered on available public points only
          const points = allObs;
          if (points.length) {
            const lats = points.map(p => p.latitude);
            const lons = points.map(p => p.longitude);
            const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
            const minLon = Math.min(...lons); const maxLon = Math.max(...lons);
            const centerLat = (minLat + maxLat) / 2;
            const centerLon = (minLon + maxLon) / 2;
            const latDelta = Math.max(0.01, (maxLat - minLat) * 1.4);
            const lonDelta = Math.max(0.01, (maxLon - minLon) * 1.4);
            setMapRegion({ latitude: centerLat, longitude: centerLon, latitudeDelta: latDelta, longitudeDelta: lonDelta });
          } else {
            setMapRegion(null);
          }

          // ✅ Derive display variables AFTER fetch and set to state
          const imageUrl = obs?.image_url || plant?.image_url || null;
          const commonName = pd?.plant?.common_name || plant?.common_name || 'Unknown';
          const scientificName = pd?.plant?.scientific_name || plant?.scientific_name || '';
          const species = pd?.plant?.species || '';
          const family = pd?.plant?.family || '';
          const description = pd?.plant?.description || '';
          const conservationStatus = pd?.plant?.conservation_status || '';
          const rawObservationDate = obs?.observation_date || '';
          const observationDate = rawObservationDate ? String(rawObservationDate).split('T')[0] : '';
          const latitude = obs?.latitude != null
            ? Number(obs.latitude)
            : (plant?.coordinates?.lat != null ? Number(plant.coordinates.lat) : null);
          const longitude = obs?.longitude != null
            ? Number(obs.longitude)
            : (plant?.coordinates?.lon != null ? Number(plant.coordinates.lon) : null);

          setDisplay({
            imageUrl,
            commonName,
            scientificName,
            species,
            family,
            description,
            conservationStatus,
            observationDate,
            latitude,
            longitude,
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
  }, [plantId, observationId]);

  return (
    <ScrollView style={styles.container}>
      {display.imageUrl ? (
        <Image source={{ uri: display.imageUrl }} style={styles.plantImage} />
      ) : (
        <View style={[styles.plantImage, styles.placeholder]}>
          <Text style={{ color: '#888' }}>No image available</Text>
        </View>
      )}

      <View style={styles.content}>
        {loading ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator size="large" color="#2e7d32" />
            <Text style={{ textAlign: 'center', marginTop: 8, color: '#666' }}>Loading plant details...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.plantName}>{display.commonName}</Text>
            <Text style={styles.scientificName}>{display.scientificName}</Text>

            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Plant Details</Text>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Observation Date</Text>
                <Text style={styles.detailValue}>{display.observationDate || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Scientific Name</Text>
                <Text style={styles.detailValue}>{display.scientificName || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Species</Text>
                <Text style={styles.detailValue}>{display.species || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Common Name</Text>
                <Text style={styles.detailValue}>{display.commonName || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Family</Text>
                <Text style={styles.detailValue}>{display.family || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Conservation Status</Text>
                <Text style={styles.detailValue}>{display.conservationStatus || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>
                {display.description || `No description available for ${display.commonName}.`}
              </Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Location</Text>
              {(mapRegion && Number.isFinite(mapRegion.latitude) && Number.isFinite(mapRegion.longitude)) ? (
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    initialRegion={mapRegion}
                  >
                    {obsLocations.map((p) => (
                        <Marker
                          key={`obs-${p.id ?? `${p.latitude}-${p.longitude}`}`}
                          coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                          title={commonName}
                          description={`Lat: ${String(p.latitude)}  |  Lon: ${String(p.longitude)}`}
                        />
                      ))}
                  </MapView>

                  {obsLocations.length > 1 && (
                    <Text style={styles.coordsText}>{obsLocations.length} observation locations</Text>
                  )}
                </View>
              ) : (
                <View style={styles.placeholderBox}>
                  <Text style={{ color: '#666' }}>No public coordinates for this plant</Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  plantImage: {
    width: '100%',
    height: 300,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f3f4',
  },
  content: {
    padding: 20,
  },
  plantName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 5,
  },
  scientificName: {
    fontSize: 18,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  detailsSection: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  infoSection: {
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  mapContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  map: {
    width: '100%',
    height: 220,
  },
  coordsText: {
    paddingVertical: 8,
    textAlign: 'center',
    color: '#555',
    fontSize: 13,
  },
  placeholderBox: {
    backgroundColor: '#f1f3f4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: '#fdecea',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#b00020',
    textAlign: 'center',
  },
});

export default PlantDetailScreen;
