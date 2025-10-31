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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './SectionStyles';

const ModelsSection = ({ API_URL, getAuthToken }) => {
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

  const totalModelsPages = useMemo(() => Math.max(1, Math.ceil(modelsTotal / MODELS_PAGE_SIZE)), [modelsTotal]);

  useEffect(() => {
    if (modelsPage > totalModelsPages) {
      setModelsPage(totalModelsPages);
    }
  }, [modelsPage, totalModelsPages]);

  useEffect(() => {
    loadModels();
  }, [modelsPage]);

  useEffect(() => {
    let interval;
    if (trainingStatus?.isTraining) {
      interval = setInterval(() => {
        checkTrainingStatus();
      }, 8000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [trainingStatus?.isTraining]);

  const loadModels = async () => {
    try {
      console.log('Loading models from backend...');
      const token = await getAuthToken();
      const params = new URLSearchParams({
        page: String(modelsPage),
        limit: String(MODELS_PAGE_SIZE),
      });
      
      const response = await fetch(`${API_URL}/admin/models?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
        setModelsTotal(data.pagination?.total || data.total || (data.models || []).length);
      } else {
        console.error('Failed to load models:', response.status);
      }
    } catch (error) {
      console.error('Error loading models:', error);
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
          modelName: trainingParams.modelName || undefined
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

  const viewModelPlot = (modelName) => {
    const plotUrl = `${API_URL}/admin/models/${modelName}/plot`;
    setSelectedModelPlot(plotUrl);
    setPlotModalVisible(true);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Model Management</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setTrainingModalVisible(true)}
        >
          <Ionicons name="add" size={15} color="white" />
          <Text style={styles.addButtonText}>Train New Model</Text>
        </TouchableOpacity>
      </View>

      {/* Model Training */}
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

      {/* Models */}
      <ScrollView style={styles.contentScroll}>
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
            <Text style={styles.emptyStateText}>No models added yet</Text>
            <Text style={styles.emptyStateSubtext}>Train a model to get started</Text>
          </View>
        )}

        {models.length > 0 && (
          <View style={styles.paginationBar}>
            <TouchableOpacity
              style={[styles.pageButton, modelsPage <= 1 && styles.disabledButton]}
              onPress={() => modelsPage > 1 && setModelsPage(modelsPage - 1)}
              disabled={modelsPage <= 1}
            >
              <Ionicons name="chevron-back" size={18} color={modelsPage <= 1 ? '#fff' : '#2e7d32'} />
              <Text style={[styles.pageButtonText, modelsPage <= 1 && styles.pageButtonTextDisabled]}>Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>Page {modelsPage} of {totalModelsPages}</Text>
            <TouchableOpacity
              style={[styles.pageButton, modelsPage >= totalModelsPages && styles.disabledButton]}
              onPress={() => modelsPage < totalModelsPages && setModelsPage(modelsPage + 1)}
              disabled={modelsPage >= totalModelsPages}
            >
              <Text style={[styles.pageButtonText, modelsPage >= totalModelsPages && styles.pageButtonTextDisabled]}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color={modelsPage >= totalModelsPages ? '#fff' : '#2e7d32'} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Train Model Modal Pop Up */}
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