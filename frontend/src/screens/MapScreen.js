// src/screens/MapScreen.js - Updated with navigation
import React, { useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { plants } from '../data/mockData';

const MapScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [showPlantCard, setShowPlantCard] = useState(false);

  const handlePlantPress = (plant) => {
    setSelectedPlant(plant);
    setShowPlantCard(true);
  };

  const closePlantCard = () => {
    setShowPlantCard(false);
    setSelectedPlant(null);
  };

  const handleViewDetails = () => {
    closePlantCard();
    // Navigate to a plant detail screen (you'll need to create this)
    navigation.navigate('PlantDetail', { plant: selectedPlant });
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
        <TouchableOpacity style={styles.filterToggle} onPress={() => setShowFilters(!showFilters)}>
          <Text style={styles.filterIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Section */}
      {showFilters && (
        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filter Plants</Text>
            <TouchableOpacity>
              <Text style={styles.clearFilters}>Clear All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Plant Type</Text>
            <View style={styles.filterOptions}>
              {['Indoor Plants', 'Outdoor Plants', 'Succulents', 'Flowering Plants'].map((type) => (
                <TouchableOpacity key={type} style={styles.filterOption}>
                  <Text style={styles.filterOptionText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <Text style={styles.mapPlaceholder}>🌍 Interactive Map</Text>
        <Text style={styles.mapDescription}>Plant locations would be displayed here</Text>
        
        {/* Plant Markers */}
        <View style={styles.markersContainer}>
          {plants.map((plant, index) => (
            <TouchableOpacity 
              key={plant.id}
              style={[styles.marker, { 
                left: 30 + (index * 80), 
                top: 50 + (index % 2 * 60) 
              }]}
              onPress={() => handlePlantPress(plant)}
            >
              <Text style={styles.markerIcon}>🌿</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Location Button */}
      <TouchableOpacity style={styles.locationButton}>
        <Text style={styles.locationIcon}>📍</Text>
      </TouchableOpacity>

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
                <Image source={{ uri: selectedPlant.image }} style={styles.plantCardImage} />
                <View style={styles.plantCardInfo}>
                  <Text style={styles.plantCardName}>{selectedPlant.name}</Text>
                  <Text style={styles.plantCardScientific}>{selectedPlant.scientificName}</Text>
                  <Text style={styles.plantCardDistance}>2.3km away</Text>
                  
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
  filterSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  clearFilters: {
    color: '#2e7d32',
    fontWeight: '500',
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  filterOptionText: {
    fontSize: 14,
    color: '#333',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    borderRadius: 16,
    position: 'relative',
  },
  mapPlaceholder: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  mapDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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