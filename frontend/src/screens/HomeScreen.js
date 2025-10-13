// screens/HomeScreen.js
import React, { useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const HomeScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [isGridLayout, setIsGridLayout] = useState(true);

  const plants = [
    {
      id: '1',
      name: 'Monstera',
      scientificName: 'Monstera deliciosa',
      description: 'Monstera is a type of tropical plant that is popular',
      image: 'https://images.unsplash.com/photo-1525498128493-380d1990a112?w=400',
      type: 'indoor'
    },
    {
      id: '2',
      name: 'Aloe Vera',
      scientificName: 'Aloe barbadensis',
      description: 'Aloe vera is a plant species with thick fleshy leaves',
      image: 'https://images.unsplash.com/photo-1596541223130-5d31a73d4c68?w=400',
      type: 'succulent'
    },
    {
      id: '3',
      name: 'Snake Plant',
      scientificName: 'Sansevieria trifasciata',
      description: 'Sansevieria is known for its air-purifying qualities',
      image: 'https://images.unsplash.com/photo-1585355865725-4a1eaaad5145?w=400',
      type: 'indoor'
    },
    {
      id: '4',
      name: 'Fiddle Leaf Fig',
      scientificName: 'Ficus lyrata',
      description: 'Popular indoor tree with large, violin-shaped leaves',
      image: 'https://images.unsplash.com/photo-1593489060062-2c6c0e4080b1?w=400',
      type: 'indoor'
    },
    {
      id: '5',
      name: 'Pothos',
      scientificName: 'Epipremnum aureum',
      description: 'Easy-care trailing vine perfect for beginners',
      image: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=400',
      type: 'indoor'
    },
    {
      id: '6',
      name: 'Rubber Plant',
      scientificName: 'Ficus elastica',
      description: 'Glossy-leaved plant that grows into a beautiful tree',
      image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400',
      type: 'indoor'
    },
  ];

  const toggleLayout = () => {
    setIsGridLayout(!isGridLayout);
  };

  const goToPlantPage = (plant) => {
    navigation.navigate('PlantDetail', { plant });
  };

  const renderPlantCard = ({ item }) => (
    <TouchableOpacity 
      style={isGridLayout ? styles.plantCardGrid : styles.plantCardList}
      onPress={() => goToPlantPage(item)}
    >
      <Image source={{ uri: item.image }} style={isGridLayout ? styles.plantImageGrid : styles.plantImageList} />
      <View style={isGridLayout ? styles.plantInfoGrid : styles.plantInfoList}>
        <Text style={styles.plantName}>{item.name}</Text>
        <Text style={styles.plantScientific}>{item.scientificName}</Text>
        <Text style={styles.plantDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
        keyExtractor={item => item.id}
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
  plantsContainer: {
    padding: 10,
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