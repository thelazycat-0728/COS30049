// src/components/admin/ModelsSection.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './SectionStyles';

const ModelsSection = ({ API_URL, getAuthToken, currentUserId }) => {
  const [models, setModels] = useState([]);
  const [modelsPage, setModelsPage] = useState(1);
  const MODELS_PAGE_SIZE = 10;
  const [modelsTotal, setModelsTotal] = useState(0);
  const [trainingModalVisible, setTrainingModalVisible] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [trainingParams, setTrainingParams] = useState({
    epochs: '30',
    batchSize: '32',
    learningRate: '0.00001',
    modelName: ''
  });
  const [plotModalVisible, setPlotModalVisible] = useState(false);
  const [selectedModelPlot, setSelectedModelPlot] = useState(null);
  const [plotLoading, setPlotLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter and search states - matching PlantsSection structure
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  const STATUS_OPTIONS = [
    { key: 'all', label: 'All Status' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
  ];

  const SORT_OPTIONS = [
    { key: 'name', label: 'Name' },
    { key: 'created_at', label: 'Date Created' },
    { key: 'size', label: 'Size' },
  ];

  const totalModelsPages = useMemo(() => Math.max(1, Math.ceil(modelsTotal / MODELS_PAGE_SIZE)), [modelsTotal]);

  useEffect(() => {
    if (modelsPage > totalModelsPages) {
      setModelsPage(totalModelsPages);
    }
  }, [modelsPage, totalModelsPages]);

  useEffect(() => {
    checkTrainingStatus(); // Check once immediately
  }, []);

  useEffect(() => {
    loadModels();
  }, [modelsPage, searchQuery, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    let interval;
    if (trainingStatus?.isTraining) {
      interval = setInterval(() => {
        checkTrainingStatus();
      }, 3000);   //(3 seconds)
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [trainingStatus?.isTraining]);

  const loadModels = async () => {
    try {
      setLoading(true);
      console.log('Loading models from backend...');
      const token = await getAuthToken();
      
      // Build query parameters matching backend expectations
      const params = new URLSearchParams({
        page: String(modelsPage),
        limit: String(MODELS_PAGE_SIZE),
      });

      // Add search parameter
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      // Add filter parameter (convert empty string to 'all')
      const filterValue = statusFilter === 'all' ? '' : statusFilter;
      if (filterValue) {
        params.append('filter', filterValue);
      }

      // Add sort parameters - backend now expects sortBy and sortOrder
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      if (sortOrder) {
        params.append('sortOrder', sortOrder);
      }

      console.log('Request params:', params.toString());
      
      const response = await fetch(`${API_URL}/admin/models?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Models data received:', data.models?.length);
        console.log('Sort parameters used:', { sortBy, sortOrder });
        console.log('Filter parameter used:', statusFilter);
        setModels(data.models || []);
        setModelsTotal(data.pagination?.total || data.total || (data.models || []).length);
      } else {
        console.error('Failed to load models:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error loading models:', error);
      Alert.alert('Error', error.message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };


  const checkTrainingStatus = async () => {
    try {
      const token = await getAuthToken();
        const response = await fetch(`${API_URL}/admin/train/status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setTrainingStatus(data.status);
          
          
          if (!data.status.isTraining && trainingStatus?.isTraining) {
            loadModels();
          }
        }
      } catch (error) {
        console.error('Error checking training status:', error);
      }
    };

  const startTraining = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch(`${API_URL}/admin/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          epochs: parseInt(trainingParams.epochs),
          batchSize: parseInt(trainingParams.batchSize),
          learningRate: parseFloat(trainingParams.learningRate),
          modelName: trainingParams.modelName || undefined,
          userID: Number(currentUserId)
        })
      });

      const data = await response.json();
        
      if (response.ok) {
        setTrainingStatus(data.status);
        setTrainingModalVisible(false);
        Alert.alert('Success', 'Model training started successfully!');
      } else {
        Alert.alert('Error', data.message || 'Failed to start training');
      }
    } catch (error) {
      console.error('Error starting training:', error);
      Alert.alert('Error', 'Failed to start training');
    } finally {
      setLoading(false);
    }
  };

  const stopTraining = async () => {
    Alert.alert(
      'Stop Training',
      'Are you sure you want to stop the training process?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const response = await fetch(`${API_URL}/admin/train/stop`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              const data = await response.json();
              if (response.ok) {
                Alert.alert('Success', data.message);
                loadModels();
              } else {
                Alert.alert('Error', data.message || 'Failed to stop training');
              }
            } catch (error) {
              console.error('Error stopping training:', error);
              Alert.alert('Error', 'Failed to stop training');
            }
          }
        }
      ]
    );
  };

  const activateModel = async (modelName) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/admin/models/${modelName}/activate`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        Alert.alert('Success', 'Model activated successfully');
        loadModels();
      } else {
        const data = await response.json();
        Alert.alert('Error', data.message || 'Failed to activate model');
      }
    } catch (error) {
      console.error('Error activating model:', error);
      Alert.alert('Error', 'Failed to activate model');
    }
  };

  const deleteModel = async (modelName) => {
    Alert.alert(
      'Delete Model',
      `Are you sure you want to delete ${modelName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const response = await fetch(`${API_URL}/admin/models/${modelName}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (response.ok) {
                Alert.alert('Success', 'Model deleted successfully');
                loadModels();
              } else {
                const data = await response.json();
                Alert.alert('Error', data.message || 'Failed to delete model');
              }
            } catch (error) {
              console.error('Error deleting model:', error);
              Alert.alert('Error', 'Failed to delete model');
            }
          }
        }
      ]
    );
  };

  const viewModelPlot = async (modelName) => {
    const token = await getAuthToken();
    const plotUrl = await fetch(`${API_URL}/admin/models/${modelName}/plot`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
    });

    setSelectedModelPlot(plotUrl);
    setPlotModalVisible(true);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    setModelsPage(1);
  };

  const handleFilterChange = (value) => {
    setStatusFilter(value);
    setModelsPage(1);
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
    setModelsPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('created_at');
    setSortOrder('DESC');
    setModelsPage(1);
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return 'swap-vertical';
    return sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down';
  };

  const openTrainModel = () => {
    setTrainingParams({
      epochs: '30',
      batchSize: '32',
      learningRate: '0.00001',
      modelName: ''
    });
    setTrainingModalVisible(true);
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadModels();
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
          <Text style={styles.loadingText}>Loading models...</Text>
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
        {/* Search and Filter Section - Matching PlantsSection structure */}
        <View style={styles.filterSection}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search models..."
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
            {/* Status Filter */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status:</Text>
              <ScrollView horizontal style={styles.filterOptions}>
                {STATUS_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={`status-${option.key}`}
                    style={[
                      styles.filterOption,
                      statusFilter === option.key && styles.filterOptionActive
                    ]}
                    onPress={() => handleFilterChange(option.key)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      statusFilter === option.key && styles.filterOptionTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Sort Row */}
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

          {/* Clear Filters */}
          {(searchQuery || statusFilter !== 'all' || sortBy !== 'created_at' || sortOrder !== 'DESC') && (
            <TouchableOpacity style={styles.clearFiltersButtonRed} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color="#fff" />
              <Text style={styles.clearFiltersTextRed}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Model Training Banner */}
        {trainingStatus?.isTraining && (
          <View style={styles.trainingBanner}>
            <View style={styles.trainingBannerHeader}>
              <ActivityIndicator size="small" color="#2e7d32" />
              <Text style={styles.trainingBannerTitle}>Training in Progress</Text>
            </View>

            <Text style={styles.trainingStageText}>
              {trainingStatus.stage === 'stage1' ? 'Stage 1: Training Head' : 'Stage 2: Fine-Tuning'}
            </Text>

            <Text style={styles.trainingBannerText}>
              Epoch {trainingStatus.epoch}/{trainingStatus.totalEpochs} - 
              Progress: {trainingStatus.progress.toFixed(1)}%
            </Text>
            {trainingStatus.loss && (
              <Text style={styles.trainingBannerText}>
                Loss: {trainingStatus.loss.toFixed(4)} - 
                Accuracy: {trainingStatus.accuracy?.toFixed(2)}%
              </Text>
            )}
            <TouchableOpacity 
              style={styles.stopTrainingButton}
              onPress={stopTraining}
            >
              <Text style={styles.addButtonText}>Stop Training</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Models List */}
        {models.map(model => (
          <View key={model.id} style={styles.plantCard}>
            <View style={styles.modelHeader}>
              <View style={styles.modelInfo}>
                <Text style={styles.plantName}>{model.name}</Text>
                <Text style={styles.scientificName}>
                  Created: {new Date(model.created).toLocaleDateString()}
                </Text>
                <Text style={styles.scientificName}>
                  Size: {(model.size / 1024 / 1024).toFixed(2)} MB
                </Text>
                {model.trainedBy && (
                  <Text style={styles.scientificName}>
                    Trained by: {model.trainedBy}
                  </Text>
                )}
              </View>
              <View style={[
                styles.modelStatusBadge,
                { backgroundColor: model.active ? '#4CAF50' : '#9E9E9E' }
              ]}>
                <Text style={styles.modelStatusText}>
                  {model.active ? 'ACTIVE' : 'INACTIVE'}
                </Text>
              </View>
            </View>
            
            <View style={styles.modelActions}>
              {!model.active && (
                <TouchableOpacity 
                  style={styles.activateButton}
                  onPress={() => activateModel(model.name)}
                >
                  <Ionicons name="checkmark-circle" size={18} color="white" />
                  <Text style={styles.addButtonText}>Activate</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.viewPlotButton}
                onPress={() => viewModelPlot(model.name)}
              >
                <Ionicons name="stats-chart" size={18} color="white" />
                <Text style={styles.addButtonText}>View Plot</Text>
              </TouchableOpacity>
              {!model.active && model.name !== 'default_model' &&(
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => deleteModel(model.name)}
                >
                  <Ionicons name="trash" size={18} color="white" />
                  <Text style={styles.addButtonText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        
        {models.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="layers-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No models found</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters' 
                : 'Train a model to get started'
              }
            </Text>
          </View>
        )}

        {models.length > 0 && (
          <View style={styles.paginationBar}>
            <TouchableOpacity
              style={[styles.pageArrowButton, modelsPage <= 1 && styles.disabledButton]}
              onPress={() => modelsPage > 1 && setModelsPage(modelsPage - 1)}
              disabled={modelsPage <= 1}
            >
              <Ionicons name="chevron-back" size={20} color={modelsPage <= 1 ? '#ccc' : '#2e7d32'} />
            </TouchableOpacity>
            
            <Text style={styles.pageIndicator}>Page {modelsPage} of {totalModelsPages}</Text>
            
            <TouchableOpacity
              style={[styles.pageArrowButton, modelsPage >= totalModelsPages && styles.disabledButton]}
              onPress={() => modelsPage < totalModelsPages && setModelsPage(modelsPage + 1)}
              disabled={modelsPage >= totalModelsPages}
            >
              <Ionicons name="chevron-forward" size={20} color={modelsPage >= totalModelsPages ? '#ccc' : '#2e7d32'} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button for Train Model */}
      <TouchableOpacity 
        style={styles.floatingActionButton}
        onPress={openTrainModel}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* Train Model Modal */}
      <Modal
        visible={trainingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTrainingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Train New Model</Text>
              <TouchableOpacity onPress={() => setTrainingModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Model Name *</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="Enter model name (e.g., model1)"
                value={trainingParams.modelName}
                onChangeText={(text) => setTrainingParams({...trainingParams, modelName: text})}
              />
              
              <Text style={styles.inputLabel}>Epochs *</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="Number of epochs (e.g., 30)"
                keyboardType="numeric"
                value={trainingParams.epochs}
                onChangeText={(text) => setTrainingParams({...trainingParams, epochs: text})}
              />
              
              <Text style={styles.inputLabel}>Batch Size *</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="Batch size (e.g., 32)"
                keyboardType="numeric"
                value={trainingParams.batchSize}
                onChangeText={(text) => setTrainingParams({...trainingParams, batchSize: text})}
              />
              
              <Text style={styles.inputLabel}>Learning Rate *</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="Learning rate (e.g., 0.00001)"
                keyboardType="decimal-pad"
                value={trainingParams.learningRate}
                onChangeText={(text) => setTrainingParams({...trainingParams, learningRate: text})}
              />
              
              {/* Training Info */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#2e7d32" />
                <Text style={styles.infoText}>
                  The model will be trained using MobileNetV2 with two-stage training.
                  Stage 1: Train classifier head | Stage 2: Fine-tune entire network
                </Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setTrainingModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, loading && styles.disabledButton]}
                onPress={startTraining}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Start Training</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Plot Modal */}
      <Modal
        visible={plotModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPlotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Training Performance</Text>
              <TouchableOpacity onPress={() => setPlotModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              {selectedModelPlot ? (
                <Image 
                  source={{ uri: selectedModelPlot }}
                  style={styles.plotImage}
                  resizeMode="contain"
                  onLoadStart={() => setPlotLoading(true)}
                  onLoadEnd={() => setPlotLoading(false)}
                />
              ) : (
                <View style={styles.plotError}>
                  <Ionicons name="image-outline" size={48} color="#ccc" />
                  <Text style={styles.plotErrorText}>Plot not available</Text>
                </View>
              )}
              {plotLoading && (
                <View style={styles.plotLoading}>
                  <ActivityIndicator size="large" color="#2e7d32" />
                  <Text style={styles.plotLoadingText}>Loading plot...</Text>
                </View>
              )}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setPlotModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ModelsSection;
