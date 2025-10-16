// screens/PlantDetailScreen.js
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Image, ScrollView, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const API_BASE = 'http://192.168.0.114:3000'; // align with Map/Admin screens

const PlantDetailScreen = ({ route }) => {
  const { plant } = route.params || {};
  const plantId = plant?.plantId;
  const observationId = plant?.observationId;

  const [plantDetails, setPlantDetails] = useState(null);
  const [observation, setObservation] = useState(null);
  const [obsLocations, setObsLocations] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch plant details
        let pd = null;
        if (plantId) {
          const res = await fetch(`${API_BASE}/map/plants/${plantId}`);
          if (res.ok) {
            pd = await res.json();
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

        // Fetch all observations for this plant to render multiple pins
        let allObs = [];
        if (plantId) {
          const paramsAll = new URLSearchParams({ plantId: String(plantId), limit: '1000' });
          const resAll = await fetch(`${API_BASE}/observations?${paramsAll.toString()}`);
          if (resAll.ok) {
            const dataAll = await resAll.json();
            const list = Array.isArray(dataAll?.observations) ? dataAll.observations : [];
            // Keep only observations with valid numeric coordinates
            allObs = list.filter((o) => o?.latitude != null && o?.longitude != null)
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

          // Compute map region centered on available points
          const baseLat = obs?.latitude != null ? Number(obs.latitude) : (plant?.coordinates?.lat != null ? Number(plant.coordinates.lat) : null);
          const baseLon = obs?.longitude != null ? Number(obs.longitude) : (plant?.coordinates?.lon != null ? Number(plant.coordinates.lon) : null);
          const points = allObs.length ? allObs : (baseLat != null && baseLon != null ? [{ latitude: baseLat, longitude: baseLon }] : []);
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

  const imageUrl = observation?.image_url || plant?.image || null;
  const commonName = plantDetails?.common_name || plant?.name || 'Unknown';
  const scientificName = plantDetails?.scientific_name || plant?.scientificName || '';
  const species = plantDetails?.species || '';
  const family = plantDetails?.family || '';
  const description = plantDetails?.description || '';
  const conservationStatus = plantDetails?.conservation_status || '';
  const rawObservationDate = observation?.observation_date || '';
  const observationDate = rawObservationDate.split('T')[0] || '';
  const latitude = observation?.latitude != null
    ? Number(observation.latitude)
    : (plant?.coordinates?.lat != null ? Number(plant.coordinates.lat) : null);
  const longitude = observation?.longitude != null
    ? Number(observation.longitude)
    : (plant?.coordinates?.lon != null ? Number(plant.coordinates.lon) : null);

  return (
    <ScrollView style={styles.container}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.plantImage} />
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
            <Text style={styles.plantName}>{commonName}</Text>
            <Text style={styles.scientificName}>{scientificName}</Text>

            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Plant Details</Text>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Observation Date</Text>
                <Text style={styles.detailValue}>{observationDate || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Scientific Name</Text>
                <Text style={styles.detailValue}>{scientificName || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Species</Text>
                <Text style={styles.detailValue}>{species || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Common Name</Text>
                <Text style={styles.detailValue}>{commonName || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Family</Text>
                <Text style={styles.detailValue}>{family || 'N/A'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Conservation Status</Text>
                <Text style={styles.detailValue}>{conservationStatus || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>
                {description || `No description available for ${commonName}.`}
              </Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Location</Text>
              {((mapRegion && Number.isFinite(mapRegion.latitude) && Number.isFinite(mapRegion.longitude)) || (latitude != null && longitude != null)) ? (
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    initialRegion={mapRegion || {
                      latitude: latitude,
                      longitude: longitude,
                      latitudeDelta: 0.04,
                      longitudeDelta: 0.04,
                    }}
                  >
                    {(obsLocations.length ? obsLocations : (latitude != null && longitude != null ? [{ latitude, longitude, id: 'single' }] : []))
                      .map((p) => (
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
                  <Text style={{ color: '#666' }}>No known coordinates for this plant</Text>
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
