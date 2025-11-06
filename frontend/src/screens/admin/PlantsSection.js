// admin/PlantsSection.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from './SectionStyles';

const PlantsSection = ({ API_URL, getAuthToken, plantCache, setPlantCache }) => {
  const [plants, setPlants] = useState([]);
  const [plantsPage, setPlantsPage] = useState(1);
  const PLANTS_PAGE_SIZE = 10;
  const [plantsTotal, setPlantsTotal] = useState(0);
  const [plantModalVisible, setPlantModalVisible] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [savingPlant, setSavingPlant] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [conservationFilter, setConservationFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  const [plantForm, setPlantForm] = useState({
    common_name: '',
    scientific_name: '',
    species: '',
    family: '',
    description: '',
    conservation_status: '',
    image_url: null,
    imageAsset: null,
  });

  const totalPlantPages = useMemo(() => Math.max(1, Math.ceil(plantsTotal / PLANTS_PAGE_SIZE)), [plantsTotal]);

  useEffect(() => {
    if (plantsPage > totalPlantPages) {
      setPlantsPage(totalPlantPages);
    }
  }, [plantsPage, totalPlantPages]);

  useEffect(() => {
    fetchPlants();
  }, [plantsPage, searchQuery, conservationFilter, sortBy, sortOrder]);

  const fetchPlants = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const params = new URLSearchParams({ 
        page: String(plantsPage), 
        size: String(PLANTS_PAGE_SIZE),
        ...(searchQuery && { search: searchQuery }),
        ...(conservationFilter && { conservation_status: conservationFilter }),
        sortBy,
        sortOrder
      });
      
      const res = await fetch(`${API_URL}/plants?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
      const list = Array.isArray(data.plants) ? data.plants : [];
      setPlantsTotal(Number(data.total || 0));
      
      const mapped = list.map(row => ({
        id: row.plant_id,
        name: row.common_name || `Plant #${row.plant_id}`,
        scientificName: row.scientific_name || '',
        description: row.description || '',
        family: row.family || '',
        species: row.species || '',
        conservation_status: row.conservation_status || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
        plant_id: row.plant_id,
        image_url: row.image_url || row.image || null,
      }));
      setPlants(mapped);
    } catch (err) {
      console.error('Plants fetch error:', err);
      Alert.alert('Error', err.message || 'Failed to load plants');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    setPlantsPage(1); // Reset to first page when searching
  };

  const handleFilterChange = (value) => {
    setConservationFilter(value);
    setPlantsPage(1); // Reset to first page when filtering
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      // New field, default to ascending
      setSortBy(field);
      setSortOrder('ASC');
    }
    setPlantsPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setConservationFilter('');
    setSortBy('created_at');
    setSortOrder('DESC');
    setPlantsPage(1);
  };

  const openAddPlant = () => {
    setSelectedPlant(null);
    setPlantForm({
      common_name: '',
      scientific_name: '',
      species: '',
      family: '',
      description: '',
      conservation_status: '',
      image_url: null,
      imageAsset: null,
    });
    setPlantModalVisible(true);
  };

  const openEditPlant = (plant) => {
    setSelectedPlant(plant);
    setPlantForm({
      common_name: plant.name || '',
      scientific_name: plant.scientificName || '',
      species: plant.species || '',
      family: plant.family || '',
      description: plant.description || '',
      conservation_status: plant.conservation_status || '',
      image_url: plant.image_url || null,
      imageAsset: null,
    });
    setPlantModalVisible(true);
  };

  const pickPlantImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant photo library access to select an image');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPlantForm(prev => ({ ...prev, imageAsset: asset }));
      }
    } catch (err) {
      console.error('Image pick error:', err);
      Alert.alert('Error', err.message || 'Failed to pick image');
    }
  };

  const removePlantImage = () => {
    setPlantForm(prev => ({ ...prev, imageAsset: null }));
  };

  const handleSavePlant = async () => {
    try {
      setSavingPlant(true);
      const token = await getAuthToken();
      const isEdit = !!selectedPlant?.plant_id;
      const url = isEdit ? `${API_URL}/admin/plants/${selectedPlant.plant_id}` : `${API_URL}/admin/plants`;
      const method = isEdit ? 'PUT' : 'POST';

      const formData = new FormData();
      formData.append('common_name', plantForm.common_name || '');
      formData.append('scientific_name', plantForm.scientific_name || '');
      formData.append('species', plantForm.species || '');
      formData.append('family', plantForm.family || '');
      formData.append('description', plantForm.description || '');
      formData.append('conservation_status', plantForm.conservation_status || '');

      if (plantForm.imageAsset?.uri) {
        const uri = plantForm.imageAsset.uri;
        const name = uri.split('/').pop() || `plant-${Date.now()}.jpg`;
        const type = 'image/jpeg';
        formData.append('image', { uri, name, type });
      }

      const res = await fetch(url, {
        method,
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed to ${isEdit ? 'update' : 'create'} plant`);
      }
      setPlantModalVisible(false);
      setSelectedPlant(null);
      await fetchPlants();
      Alert.alert('Success', `Plant ${isEdit ? 'updated' : 'created'} successfully`);
    } catch (err) {
      console.error('Save plant error:', err);
      Alert.alert('Error', err.message || 'Failed to save plant');
    } finally {
      setSavingPlant(false);
    }
  };

  const handleDeletePlant = async (plant) => {
    Alert.alert(
      'Delete Plant',
      `Are you sure you want to delete ${plant.name || 'this plant'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const res = await fetch(`${API_URL}/admin/plants/${plant.plant_id}`, {
                method: 'DELETE',
                headers: {
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
              });
              const data = await res.json();
              if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to delete plant');
              }
              await fetchPlants();
              Alert.alert('Deleted', 'Plant deleted successfully');
            } catch (err) {
              console.error('Delete plant error:', err);
              Alert.alert('Error', err.message || 'Failed to delete plant');
            }
          },
        },
      ]
    );
  };

  const getConservationColor = (status) => {
    const map = {
      least_concern: '#4CAF50',
      near_threatened: '#8BC34A',
      vulnerable: '#FFC107',
      endangered: '#FF9800',
      critically_endangered: '#F44336',
      data_deficient: '#9E9E9E',
    };
    return map[status] || '#607D8B';
  };

  const CONSERVATION_OPTIONS = [
    { key: '', label: 'All Status' },
    { key: 'least_concern', label: 'Least Concern' },
    { key: 'near_threatened', label: 'Near Threatened' },
    { key: 'vulnerable', label: 'Vulnerable' },
    { key: 'endangered', label: 'Endangered' },
    { key: 'critically_endangered', label: 'Critically Endangered' },
  ];

  const SORT_OPTIONS = [
    { key: 'common_name', label: 'Name' },
    { key: 'scientific_name', label: 'Scientific Name' },
    { key: 'family', label: 'Family' },
    { key: 'conservation_status', label: 'Conservation' },
    { key: 'created_at', label: 'Date Added' },
  ];

  const getSortIcon = (field) => {
    if (sortBy !== field) return 'swap-vertical';
    return sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down';
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchPlants();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.section}>
      {/* Loading Indicator */}
      {loading && !refreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading plants...</Text>
        </View>
      )}

      <ScrollView
        style={styles.contentScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2e7d32']}
            tintColor={'#2e7d32'}
          />
        }
      >
        {/* Search and Filter Section - Now inside ScrollView */}
        <View style={styles.filterSection}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search plants..."
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {/* Conservation Status Filter */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status:</Text>
              <ScrollView horizontal style={styles.filterOptions}>
                {CONSERVATION_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={`cons-${option.key}`}
                    style={[
                      styles.filterOption,
                      conservationFilter === option.key && styles.filterOptionActive
                    ]}
                    onPress={() => handleFilterChange(option.key)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      conservationFilter === option.key && styles.filterOptionTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Sort Row - Now horizontally scrollable */}
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.sortOptions}
            >
              {SORT_OPTIONS.map(option => (
                <TouchableOpacity
                  key={`sort-${option.key}`}
                  style={[
                    styles.sortOption,
                    sortBy === option.key && styles.sortOptionActive
                  ]}
                  onPress={() => handleSortChange(option.key)}
                >
                  <Ionicons 
                    name={getSortIcon(option.key)} 
                    size={16} 
                    color={sortBy === option.key ? '#2e7d32' : '#666'} 
                  />
                  <Text style={[
                    styles.sortOptionText,
                    sortBy === option.key && styles.sortOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Clear Filters - Updated to red button style */}
          {(searchQuery || conservationFilter || sortBy !== 'created_at') && (
            <TouchableOpacity style={styles.clearFiltersButtonRed} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color="#fff" />
              <Text style={styles.clearFiltersTextRed}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Plants List */}
        {plants.map(plant => (
          <View key={plant.id} style={styles.plantCard}>
            <View style={styles.plantHeader}>
              <Text style={styles.plantName}>{plant.name}</Text>
              {plant.conservation_status ? (
                <View style={[styles.consBadge, { backgroundColor: getConservationColor(plant.conservation_status) }]}>
                  <Text style={styles.consText}>
                    {(plant.conservation_status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.scientificName}>{plant.scientificName}</Text>
            {plant.family ? (
              <Text style={styles.plantFamily}>Family: {plant.family}</Text>
            ) : null}
            {plant.image_url ? (
              <Image source={{ uri: plant.image_url }} style={styles.obsImage} />
            ) : null}
            <Text style={styles.plantDescription}>{plant.description}</Text>
            <View style={styles.modelActions}>
              <TouchableOpacity 
                style={styles.viewDetailsButton}
                onPress={() => openEditPlant(plant)}
              >
                <Text style={styles.viewDetailsText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => handleDeletePlant(plant)}
              >
                <Ionicons name="trash" size={18} color="white" />
                <Text style={styles.addButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        
        {plants.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No plants found</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery || conservationFilter
                ? 'Try adjusting your search or filters' 
                : 'Add your first plant to get started'
              }
            </Text>
          </View>
        )}

        {plants.length > 0 && (
          <View style={styles.paginationBar}>
            <TouchableOpacity
              style={[styles.pageArrowButton, plantsPage <= 1 && styles.disabledButton]}
              onPress={() => plantsPage > 1 && setPlantsPage(plantsPage - 1)}
              disabled={plantsPage <= 1}
            >
              <Ionicons name="chevron-back" size={20} color={plantsPage <= 1 ? '#ccc' : '#2e7d32'} />
            </TouchableOpacity>
            
            <Text style={styles.pageIndicator}>Page {plantsPage} of {totalPlantPages}</Text>
            
            <TouchableOpacity
              style={[styles.pageArrowButton, plantsPage >= totalPlantPages && styles.disabledButton]}
              onPress={() => plantsPage < totalPlantPages && setPlantsPage(plantsPage + 1)}
              disabled={plantsPage >= totalPlantPages}
            >
              <Ionicons name="chevron-forward" size={20} color={plantsPage >= totalPlantPages ? '#ccc' : '#2e7d32'} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button for Add Plant */}
      <TouchableOpacity 
        style={styles.floatingActionButton}
        onPress={openAddPlant}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* Add/Edit Plant Modal */}
      <Modal
        visible={plantModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPlantModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPlant ? 'Edit Plant' : 'Add New Plant'}</Text>
              <TouchableOpacity onPress={() => setPlantModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Plant Name</Text>
              <TextInput 
                style={styles.textInput} 
                placeholder="Enter plant name" 
                value={plantForm.common_name}
                onChangeText={(t) => setPlantForm(prev => ({ ...prev, common_name: t }))}
              />
              
              <Text style={styles.inputLabel}>Scientific Name</Text>
              <TextInput 
                style={styles.textInput} 
                placeholder="Enter scientific name" 
                value={plantForm.scientific_name}
                onChangeText={(t) => setPlantForm(prev => ({ ...prev, scientific_name: t }))}
              />

              <Text style={styles.inputLabel}>Species</Text>
              <TextInput 
                style={styles.textInput} 
                placeholder="Enter species" 
                value={plantForm.species}
                onChangeText={(t) => setPlantForm(prev => ({ ...prev, species: t }))}
              />
              
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput 
                style={[styles.textInput, styles.textArea]} 
                placeholder="Enter description" 
                multiline 
                numberOfLines={3}
                value={plantForm.description}
                onChangeText={(t) => setPlantForm(prev => ({ ...prev, description: t }))}
              />
              
              <Text style={styles.inputLabel}>Family</Text>
              <TextInput 
                style={styles.textInput} 
                placeholder="Enter family" 
                value={plantForm.family}
                onChangeText={(t) => setPlantForm(prev => ({ ...prev, family: t }))}
              />

              <Text style={styles.inputLabel}>Conservation Status</Text>
              <View>
                {CONSERVATION_OPTIONS.filter(o => o.key !== '').map(opt => (
                  <TouchableOpacity
                    key={`form-cons-${opt.key}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                    onPress={() => setPlantForm(prev => ({ ...prev, conservation_status: opt.key }))}
                  >
                    <Ionicons
                      name={plantForm.conservation_status === opt.key ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={plantForm.conservation_status === opt.key ? '#2e7d32' : '#666'}
                    />
                    <View style={[styles.consBadge, { backgroundColor: getConservationColor(opt.key), marginTop: 0, marginLeft: 6 }]}> 
                      <Text style={styles.consText}>{opt.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Plant Image</Text>
              {(plantForm.imageAsset?.uri || plantForm.image_url) ? (
                <Image
                  source={{ uri: plantForm.imageAsset?.uri || plantForm.image_url }}
                  style={styles.obsImage}
                />
              ) : (
                <View style={styles.placeholderBox}>
                  <Ionicons name="image-outline" size={40} color="#9E9E9E" />
                  <Text style={{ color: '#9E9E9E', marginTop: 8 }}>No image selected</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={styles.addButton} onPress={pickPlantImage}>
                  <Ionicons name="image" size={18} color="#fff" />
                  <Text style={[styles.addButtonText, { marginLeft: 6 }]}>{selectedPlant ? 'Replace Image' : 'Choose Image'}</Text>
                </TouchableOpacity>
                {plantForm.imageAsset?.uri ? (
                  <TouchableOpacity style={styles.cancelButton} onPress={removePlantImage}>
                    <Ionicons name="trash-outline" size={18} color="#666" />
                    <Text style={[styles.cancelButtonText, { marginLeft: 6 }]}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {selectedPlant ? (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#2E7D32" />
                  <Text style={styles.infoText}>If you don't choose a new image, the existing image will be kept.</Text>
                </View>
              ) : null}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setPlantModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, savingPlant && styles.disabledButton]}
                onPress={handleSavePlant}
                disabled={savingPlant}
              >
                <Text style={styles.saveButtonText}>{selectedPlant ? 'Update Plant' : 'Save Plant'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PlantsSection;