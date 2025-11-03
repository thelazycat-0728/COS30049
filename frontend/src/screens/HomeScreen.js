// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons'; // 添加这行

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
  SafeAreaView,
  FlatList,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

const HomeScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPlantData();
  }, []);

  const getPlantData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      
      const plantsResponse = await fetch(`${API_BASE}/admin/plants`);
      
      if (!plantsResponse.ok) {
        throw new Error(`HTTP error! status: ${plantsResponse.status}`);
      }
      
      const plantsData = await plantsResponse.json();
      setPlants(plantsData.plants);
      
    } catch (error) {
      console.error("Error fetching plant data:", error);
      setError(error.message);
      
      // Show error alert
      Alert.alert(
        'Error',
        'Failed to load plants. Please check your connection.',
        [
          { text: 'Retry', onPress: () => getPlantData() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleLayout = () => {
    setIsGridLayout(!isGridLayout);
  };

  const goToPlantPage = (plant) => {
    console.log('Navigating to PlantDetail with plant:', plant);
    navigation.navigate('PlantDetail', { plant });
  };

  const renderPlantCard = ({ item }) => (
    <TouchableOpacity 
      style={isGridLayout ? styles.plantCardGrid : styles.plantCardList}
      onPress={() => goToPlantPage(item)}
    >
      <Image source={{ uri: item.image_url }} style={isGridLayout ? styles.plantImageGrid : styles.plantImageList} />
      <View style={isGridLayout ? styles.plantInfoGrid : styles.plantInfoList}>
        <Text style={styles.plantName}>{item.common_name}</Text>
        <Text style={styles.plantScientific}>{item.scientific_name}</Text>
        <Text style={styles.plantDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading plants...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>Failed to Load Plants</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={getPlantData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search plants..."
            value={searchText}
            onChangeText={setSearchText}
          />
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        </View>
      </View>

      {/* Title Section */}
      <View style={styles.titleSection}>
        <Text style={styles.appTitle}>SmartPlant</Text>
        <TouchableOpacity style={styles.layoutToggle} onPress={toggleLayout}>
          <Ionicons 
            name={isGridLayout ? "list" : "grid"} 
            size={24} 
            color="#2e7d32" 
          />
        </TouchableOpacity>
      </View>

      {/* Plant Grid/List */}
      <FlatList
        data={plants}
        renderItem={renderPlantCard}
        keyExtractor={item => item.plant_id}
        numColumns={isGridLayout ? 2 : 1}
        contentContainerStyle={styles.plantsContainer}
        showsVerticalScrollIndicator={false}
        key={isGridLayout ? 'grid' : 'list'}
      />
    </SafeAreaView>
  );
};

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
  layoutToggle: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f44336',
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#2e7d32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  plantsContainer: {
    padding: 10,
    flexGrow: 1,  
  },

  plantCardGrid: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  plantCardList: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  plantImageGrid: {
    width: '100%',
    height: 150,
  },
  plantImageList: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  plantInfoGrid: {
    padding: 12,
  },
  plantInfoList: {
    flex: 1,
    paddingLeft: 12,
  },
  plantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  plantScientific: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  plantDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
});

export default HomeScreen;