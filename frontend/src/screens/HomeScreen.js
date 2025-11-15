// screens/HomeScreen.js
import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
  SafeAreaView,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

const HomeScreen = () => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [isGridLayout, setIsGridLayout] = useState(true);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlants, setTotalPlants] = useState(0);
  const PLANTS_PAGE_SIZE = 10;

  // Calculate total pages
  const totalPlantPages = useMemo(() => 
    Math.max(1, Math.ceil(totalPlants / PLANTS_PAGE_SIZE)), 
    [totalPlants]
  );

  // Reset to page 1 when current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPlantPages) {
      setCurrentPage(totalPlantPages);
    }
  }, [currentPage, totalPlantPages]);

  useEffect(() => {
    getPlantData();
  }, [currentPage, searchText]);

  useEffect(() => {
    // Animate content in when plants load
    if (plants.length > 0 && !loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [plants, loading]);

  // Resolve image URL: accept absolute URLs and backend-relative paths like "/uploads/xyz.jpg"
  const resolveImageUrl = (url) => {
    if (url) {
      return url.startsWith('http') ? url : `${API_BASE}${url}`;
    }
  };

  const getPlantData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({ 
        page: String(currentPage), 
        size: String(PLANTS_PAGE_SIZE),
        ...(searchText && { search: searchText })
      });
      
      const accessToken = await AsyncStorage.getItem('authToken');

      const plantsResponse = await fetch(`${API_BASE}/plants?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!plantsResponse.ok) {
        throw new Error(`HTTP error! status: ${plantsResponse.status}`);
      }
      
      const plantsData = await plantsResponse.json();
      const plantList = Array.isArray(plantsData.plants) ? plantsData.plants : [];
      
      setPlants(plantList);
      setTotalPlants(Number(plantsData.total || 0));
      setTotalPages(Math.max(1, Math.ceil(Number(plantsData.total || 0) / PLANTS_PAGE_SIZE)));
      
    } catch (error) {
      console.error("Error fetching plant data:", error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await getPlantData();
    } catch (err) {
      console.error("Refresh error:", err);
    }
  };

  const handleSearch = (text) => {
    setSearchText(text);
    setCurrentPage(1);
  };

  const toggleLayout = () => {
    setIsGridLayout(!isGridLayout);
  };

  const goToPlantPage = (plant) => {
    console.log('Navigating to PlantDetail with plant:', plant);
    navigation.navigate('PlantDetail', { plant, origin: 'Home' });
  };

  const renderPlantCard = ({ item, index }) => (
    <Animated.View
      style={[
        isGridLayout ? styles.plantCardGrid : styles.plantCardList,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, 20 * (index % 4)],
              })
            }
          ]
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.cardTouchable}
        onPress={() => goToPlantPage(item)}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: resolveImageUrl(item.image_url || item.image) }}
            style={isGridLayout ? styles.plantImageGrid : styles.plantImageList}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.1)']}
            style={styles.imageGradient}
          />
        </View>
        
        <View style={isGridLayout ? styles.plantInfoGrid : styles.plantInfoList}>
          <View style={styles.textContainer}>
            <Text style={styles.plantName} numberOfLines={1}>
              {item.common_name}
            </Text>
            <Text style={styles.plantScientific} numberOfLines={1}>
              {item.scientific_name}
            </Text>
            {item.family ? (
              <View style={styles.familyContainer}>
                <MaterialIcons name="eco" size={12} color="#4CAF50" />
                <Text style={styles.plantFamily} numberOfLines={1}>
                  {item.family}
                </Text>
              </View>
            ) : null}
          </View>
          
          {item.description ? (
            <View style={styles.descriptionContainer}>
              <Text style={styles.plantDescription} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
          ) : null}
          
          <View style={styles.cardFooter}>
            <View style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View Details</Text>
              <Ionicons name="chevron-forward" size={14} color="#4CAF50" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading && !refreshing && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a3c27" />
        <LinearGradient
          colors={['#1a3c27', '#2d5a3d']}
          style={styles.loadingContainer}
        >
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Discovering Plants...</Text>
            <Text style={styles.loadingSubtext}>Loading your green companions</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (error && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a3c27" />
        <LinearGradient
          colors={['#1a3c27', '#2d5a3d']}
          style={styles.errorContainer}
        >
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle-outline" size={80} color="#ffffff" />
            <Text style={styles.errorText}>Connection Issue</Text>
            <Text style={styles.errorSubtext}>Unable to load plants. Please check your connection.</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={getPlantData}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#1a3c27" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a3c27" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#2e7d32', '#2e7d32']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.welcomeSection}>
            <Text style={styles.greeting}>SmartPlant</Text>
            <Text style={styles.subGreeting}>Discover amazing plants</Text>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search plants..."
              placeholderTextColor="#999"
              value={searchText}
              onChangeText={handleSearch}
            />
            {searchText ? (
              <TouchableOpacity 
                style={styles.searchClear} 
                onPress={() => setSearchText('')}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {/* Content Area */}
      <View style={styles.content}>
        {/* Title and Controls */}
        <View style={styles.controlsSection}>
          <View>
            <Text style={styles.sectionTitle}>Plant Collection</Text>
            <Text style={styles.sectionSubtitle}>{totalPlants} plants to explore</Text>
          </View>
          
          <View style={styles.controls}>
            <TouchableOpacity 
              style={[styles.layoutButton, isGridLayout && styles.layoutButtonActive]}
              onPress={toggleLayout}
            >
              <Ionicons 
                name="grid" 
                size={18} 
                color={isGridLayout ? '#fff' : '#4CAF50'} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.layoutButton, !isGridLayout && styles.layoutButtonActive]}
              onPress={toggleLayout}
            >
              <Ionicons 
                name="list" 
                size={18} 
                color={!isGridLayout ? '#fff' : '#4CAF50'} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Plant Grid/List */}
        <Animated.View 
          style={[
            styles.plantsWrapper,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <FlatList
            data={plants}
            renderItem={renderPlantCard}
            keyExtractor={item => item.plant_id}
            numColumns={isGridLayout ? 2 : 1}
            contentContainerStyle={styles.plantsContainer}
            showsVerticalScrollIndicator={false}
            key={isGridLayout ? 'grid' : 'list'}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#4CAF50']}
                tintColor={'#4CAF50'}
              />
            }
            ListEmptyComponent={
              !loading && (
                <View style={styles.emptyState}>
                  <Ionicons name="leaf-outline" size={64} color="#e0e0e0" />
                  <Text style={styles.emptyStateText}>
                    {searchText ? 'No matching plants' : 'No plants available'}
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    {searchText
                      ? 'Try a different search term' 
                      : 'Check back later for new additions'
                    }
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              plants.length > 0 && (
                <View style={styles.paginationBar}>
                  <TouchableOpacity
                    style={[styles.pageButton, currentPage <= 1 && styles.disabledButton]}
                    onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <Ionicons name="chevron-back" size={20} color={currentPage <= 1 ? '#ccc' : '#4CAF50'} />
                    <Text style={[styles.pageButtonText, currentPage <= 1 && styles.disabledText]}>
                      Previous
                    </Text>
                  </TouchableOpacity>
                  
                  <View style={styles.pageIndicator}>
                    <Text style={styles.pageIndicatorText}>
                      Page {currentPage} of {totalPlantPages}
                    </Text>
                    <Text style={styles.pageIndicatorSubtext}>
                      {totalPlants} total
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.pageButton, currentPage >= totalPlantPages && styles.disabledButton]}
                    onPress={() => currentPage < totalPlantPages && setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPlantPages}
                  >
                    <Text style={[styles.pageButtonText, currentPage >= totalPlantPages && styles.disabledText]}>
                      Next
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={currentPage >= totalPlantPages ? '#ccc' : '#4CAF50'} />
                  </TouchableOpacity>
                </View>
              )
            }
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faf7',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  welcomeSection: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    marginTop: 20,
  },
  subGreeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  searchContainer: {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchInput: {
    paddingHorizontal: 45,
    paddingVertical: 15,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  searchIcon: {
    position: 'absolute',
    left: 15,
    top: 15,
    zIndex: 1,
  },
  searchClear: {
    position: 'absolute',
    right: 15,
    top: 15,
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  controlsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a3c27',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    backgroundColor: '#f0f7f0',
    borderRadius: 12,
    padding: 4,
  },
  layoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  layoutButtonActive: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  plantsWrapper: {
    flex: 1,
  },
  plantsContainer: {
    paddingHorizontal: 15,
    paddingBottom: 20,
    flexGrow: 1,
  },
  // Plant Cards
  plantCardGrid: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    margin: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
    overflow: 'hidden',
  },
  plantCardList: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginVertical: 6,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
    overflow: 'hidden',
  },
  cardTouchable: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  plantImageGrid: {
    width: '100%',
    height: 160,
  },
  plantImageList: {
    width: 120,
    height: 120,
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  plantInfoGrid: {
    padding: 16,
    flex: 1,
  },
  plantInfoList: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  textContainer: {
    marginBottom: 8,
  },
  plantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a3c27',
    marginBottom: 4,
  },
  plantScientific: {
    fontSize: 13,
    color: '#4CAF50',
    fontStyle: 'italic',
    fontWeight: '500',
    marginBottom: 6,
  },
  familyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plantFamily: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
  descriptionContainer: {
    marginBottom: 12,
  },
  plantDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
    marginRight: 4,
  },
  // Loading and Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  retryButtonText: {
    color: '#1a3c27',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Pagination
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    marginTop: 10,
    borderRadius: 20,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8faf7',
  },
  pageButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginHorizontal: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#ccc',
  },
  pageIndicator: {
    alignItems: 'center',
  },
  pageIndicatorText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  pageIndicatorSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default HomeScreen;
