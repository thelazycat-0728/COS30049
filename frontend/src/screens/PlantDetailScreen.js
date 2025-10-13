// screens/PlantDetailScreen.js
import React from 'react';
import { View, StyleSheet, Text, Image, ScrollView } from 'react-native';

const PlantDetailScreen = ({ route }) => {
  const { plant } = route.params;

  return (
    <ScrollView style={styles.container}>
      <Image 
        source={{ uri: plant.image }} 
        style={styles.plantImage}
        defaultSource={{ uri: 'https://via.placeholder.com/300' }}
      />
      
      <View style={styles.content}>
        <Text style={styles.plantName}>{plant.name}</Text>
        <Text style={styles.scientificName}>{plant.scientificName}</Text>
        
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Discovery Details</Text>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Discovered by:</Text>
            <Text style={styles.detailValue}>{plant.discoveredBy}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>{plant.discoveryDate}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Location:</Text>
            <Text style={styles.detailValue}>
              {plant.latitude ? `Lat: ${plant.latitude}, Lng: ${plant.longitude}` : 'Location not specified'}
            </Text>
          </View>
        </View>
        
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>About {plant.name}</Text>
          <Text style={styles.description}>
            {plant.description || `The ${plant.name} (${plant.scientificName}) is a beautiful plant species discovered in its natural habitat.`}
          </Text>
        </View>
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
});

export default PlantDetailScreen;