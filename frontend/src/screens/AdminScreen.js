// src/screens/AdminScreen.js
import { Ionicons } from '@expo/vector-icons';
import { Alert, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';
const API_URL = 'http://192.168.0.114:3000'; //change to your pc IPv4 address or server


const AdminScreen = () => {
  const [activeSection, setActiveSection] = useState('plants');
  const [plantModalVisible, setPlantModalVisible] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trainingModalVisible, setTrainingModalVisible] = useState(false);
  const [plotModalVisible, setPlotModalVisible] = useState(false);
  const [selectedModelPlot, setSelectedModelPlot] = useState(null);
  const [plotLoading, setPlotLoading] = useState(false);

  // Mock data based on your screenshots
  const [plants, setPlants] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [models, setModels] = useState([]);

  // Training state (added)
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [trainingParams, setTrainingParams] = useState({
    epochs: '30',
    batchSize: '32',
    learningRate: '0.00001',
    modelName: ''
  });
  
  // Observation detail modal state
  const [obsDetailVisible, setObsDetailVisible] = useState(false);
  const [obsDetail, setObsDetail] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [pubSaving, setPubSaving] = useState(false);


  useEffect(() => {
    loadMockData();
    (async () => {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Login Required', 'Please sign in to access admin features.');
        return;
      }
      await fetchPlants();
      await loadModels(); //added
    })();
  }, []);



  // Poll training status when training is active
  useEffect(() => {
    let interval;
    if (trainingStatus?.isTraining) {
      interval = setInterval(() => {
        checkTrainingStatus();
      }, 8000); // Check every 8 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [trainingStatus?.isTraining]);

  const getAuthToken = async () => {
    return await AsyncStorage.getItem('authToken');
  };


  const loadMockData = () => {
    // Alerts data from second screenshot
    setAlerts([
      {
        id: '1',
        type: 'Temperature Alert',
        sensor: 'TEMP001',
        observation: 'Observation #1',
        message: 'Temperature reading outside normal range for this plant species',
        score: 0.73,
        timestamp: '1/15/2024 04:05 PM',
        severity: 'high'
      },
      {
        id: '2',
        type: 'Soil Moisture Alert',
        sensor: 'TEMP002',
        observation: 'Observation #2',
        message: 'Soil moisture levels critically low for plant health',
        score: 0.89,
        timestamp: '1/10/2024 01:20 PM',
        severity: 'critical'
      }
    ]);
  };

  // ===================================================================================================
  // Plants - fetch, add, edit, delete
  // ===================================================================================================
  const [savingPlant, setSavingPlant] = useState(false);
  const [plantForm, setPlantForm] = useState({
    common_name: '',
    scientific_name: '',
    species: '',
    family: '',
    description: '',
    conservation_status: '',
  });

  const fetchPlants = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/admin/plants`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
      const list = Array.isArray(data.plants) ? data.plants : [];
      // Map backend rows to UI structure
      setPlants(list.map(row => ({
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
      })));
    } catch (err) {
      console.error('Plants fetch error:', err);
      Alert.alert('Error', err.message || 'Failed to load plants');
    }
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
    });
    setPlantModalVisible(true);
  };

  const handleSavePlant = async () => {
    try {
      setSavingPlant(true);
      const token = await getAuthToken();
      const isEdit = !!selectedPlant?.plant_id;
      const url = isEdit ? `${API_URL}/admin/plants/${selectedPlant.plant_id}` : `${API_URL}/admin/plants`;
      const method = isEdit ? 'PUT' : 'POST';
      const payload = { ...plantForm };
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
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


  // ===================================================================================================
  // AI models
  // ===================================================================================================

  const loadModels = async () => {
    try {
      console.log('Loading models from backend...');
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/admin/models`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Models loaded successfully:', data);
        setModels(data.models || []);
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
          
          // If training just finished, reload models
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
      'Are you sure you want to stop the training process and delete the incomplete model?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop & Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              
              // 1. First stop the training process
              const stopResponse = await fetch(`${API_URL}/admin/train/stop`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (stopResponse.ok) {
                const data = await stopResponse.json();
                setTrainingStatus(data.status);
                
                // 2. Delete the incomplete model files (force delete)
                if (trainingStatus?.modelName) {
                  const deleteResponse = await fetch(
                    `${API_URL}/admin/models/${trainingStatus.modelName}?force=true`,
                    {
                      method: 'DELETE',
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    }
                  );

                  if (deleteResponse.ok) {
                    Alert.alert('Success', 'Training stopped and incomplete model deleted');
                    loadModels(); // Refresh the models list
                  } else {
                    Alert.alert('Success', 'Training stopped (but could not delete model files)');
                  }
                } else {
                  Alert.alert('Success', 'Training stopped');
                }
              } else {
                Alert.alert('Error', 'Failed to stop training');
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
        loadModels(); // Reload the models list
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
                loadModels(); // Reload the models list
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

  const sections = [
    { id: 'plants', label: 'Plants', icon: 'leaf' },
    { id: 'observations', label: 'Observations', icon: 'eye' },
    { id: 'users', label: 'Users', icon: 'people' },
    { id: 'sensors', label: 'Sensor Readings', icon: 'hardware-chip' },
    { id: 'alerts', label: 'Alerts', icon: 'warning' },
    { id: 'models', label: 'Models', icon: 'layers'},
  ];

  // ===================================================================================================
  // Observations - fetch, filter, pagination
  // ===================================================================================================
  const [observations, setObservations] = useState([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsError, setObsError] = useState(null);
  const [obsPage, setObsPage] = useState(1);
  const [obsLimit] = useState(20); // page size
  const [obsHasMore, setObsHasMore] = useState(true);
  const [statusFilter, setStatusFilter] = useState(''); // '', 'pending', 'verified', 'unsure', 'rejected'
  const [consFilters, setConsFilters] = useState([]); // conservation filters (multi-select)
  const [publicFilter, setPublicFilter] = useState(''); // '', 'public', 'private'
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempStatusFilter, setTempStatusFilter] = useState('');
  const [tempConsFilters, setTempConsFilters] = useState([]);
  const [tempPublicFilter, setTempPublicFilter] = useState('');
  const [plantCache, setPlantCache] = useState({}); // plant_id -> { common_name, scientific_name, conservation_status }

  const statusOptions = [
    { key: '', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'verified', label: 'Verified' },
    { key: 'unsure', label: 'Unsure' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const CONSERVATION_OPTIONS = [
    { key: '', label: 'All' },
    { key: 'least_concern', label: 'Least Concern' },
    { key: 'near_threatened', label: 'Near Threatened' },
    { key: 'vulnerable', label: 'Vulnerable' },
    { key: 'endangered', label: 'Endangered' },
    { key: 'critically_endangered', label: 'Critically Endangered' },
  ];

  const PUBLIC_OPTIONS = [
    { key: '', label: 'All' },
    { key: 'public', label: 'Public' },
    { key: 'private', label: 'Private' },
  ];

  const resetObservations = () => {
    setObservations([]);
    setObsPage(1);
    setObsHasMore(true);
    setObsError(null);
  };

  useEffect(() => {
    if (activeSection === 'observations') {
      resetObservations();
      fetchObservations({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'observations') {
      resetObservations();
      fetchObservations({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (activeSection === 'observations') {
      resetObservations();
      fetchObservations({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicFilter, consFilters.join(',')]);

  const fetchObservations = async ({ reset = false } = {}) => {
    if (obsLoading) return;
    try {
      setObsLoading(true);
      const pageToFetch = reset ? 1 : obsPage;
      const params = new URLSearchParams({
        page: String(pageToFetch),
        limit: String(obsLimit),
      });
      if (statusFilter) params.append('status', statusFilter);
      if (publicFilter) params.append('public', publicFilter === 'public' ? '1' : '0');
      if (consFilters && consFilters.length > 0) {
        const selected = consFilters.filter(s => !!s && s !== '');
        if (selected.length > 0) params.append('conservation_status', selected.join(','));
      }

      const res = await fetch(`${API_URL}/observations?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch observations');

      const list = Array.isArray(data.observations) ? data.observations : [];
      setObservations(prev => (reset ? list : [...prev, ...list]));
      await preloadPlantNames(list);

      const totalPages = data?.pagination?.totalPages;
      setObsHasMore(totalPages ? pageToFetch < totalPages : list.length === obsLimit);
      setObsPage(pageToFetch + 1);
      setObsError(null);
    } catch (e) {
      console.error('Observations fetch error:', e);
      setObsError(e.message || 'Failed to load observations');
    } finally {
      setObsLoading(false);
    }
  };

  const preloadPlantNames = async (items) => {
    try {
      const ids = Array.from(new Set((items || [])
        .map(it => it?.plant_id)
        .filter(id => id != null && !(id in plantCache))
      ));
      if (!ids.length) return;
      const results = await Promise.all(ids.map(async (id) => {
        try {
          const r = await fetch(`${API_URL}/map/plants/${id}`);
          if (!r.ok) throw new Error(`Plant ${id} fetch failed`);
          const plant = await r.json();
          return { id, plant };
        } catch (err) {
          console.warn('Plant preload error:', err);
          return { id, plant: null };
        }
      }));
      setPlantCache(prev => {
        const next = { ...prev };
        for (const { id, plant } of results) {
          if (plant) next[id] = {
            common_name: plant?.common_name || `Plant #${id}`,
            scientific_name: plant?.scientific_name || '',
            conservation_status: plant?.conservation_status || null,
          };
        }
        return next;
      });
    } catch (err) {
      console.warn('Preload plant names failed:', err);
    }
  };

  const refreshObservationDetail = async (id) => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/observations/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.success && data?.observation) {
        setObsDetail((prev) => ({ ...prev, ...data.observation }));
      }
    } catch (err) {
      console.warn('Failed to refresh observation detail:', err);
    }
  };

  useEffect(() => {
    // When modal opens, ensure we have up-to-date detail incl. public flag
    if (obsDetailVisible && obsDetail?.observation_id) {
      if (obsDetail.public == null) {
        refreshObservationDetail(obsDetail.observation_id);
      }
      // Ensure plant details include conservation status
      const pid = obsDetail.plant_id;
      if (pid != null && (!plantCache[pid] || plantCache[pid]?.conservation_status == null)) {
        preloadPlantNames([obsDetail]);
      }
    }
  }, [obsDetailVisible, obsDetail?.observation_id]);

  const getStatusColor = (status) => {
    const map = {
      pending: '#FFC107',
      verified: '#4CAF50',
      unsure: '#FF9800',
      rejected: '#F44336',
    };
    return map[status] || '#9E9E9E';
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

  const renderPlantsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Plants Management</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={openAddPlant}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.addButtonText}>Add Plant</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentScroll}>
        {plants.map(plant => (
          <View key={plant.id} style={styles.plantCard}>
            <View style={styles.plantHeader}>
              <Text style={styles.plantName}>{plant.name}</Text>
            </View>
            <Text style={styles.scientificName}>{plant.scientificName}</Text>
            {plant.conservation_status ? (
              <View style={[styles.consBadge, { backgroundColor: getConservationColor(plant.conservation_status) }]}>
                <Text style={styles.consText}>
                  {(plant.conservation_status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
              </View>
            ) : null}
            <Text style={styles.plantDescription}>{plant.description}</Text>
            <Text style={styles.plantFamily}>Family: {plant.family}</Text>
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
        
        {/* Empty state */}
        {plants.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No plants added yet</Text>
            <Text style={styles.emptyStateSubtext}>Add your first plant to get started</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderAlertsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>System Alerts</Text>
        <View style={styles.filterRow}>
          <View style={styles.filterButton}>
            <Text style={styles.filterText}>All Alerts</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </View>
          <View style={styles.filterButton}>
            <Text style={styles.filterText}>All Severity</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </View>
        </View>
      </View>

      <ScrollView style={styles.contentScroll}>
        {alerts.map(alert => (
          <View key={alert.id} style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertTitle}>{alert.type}</Text>
              <View style={[
                styles.severityBadge,
                { backgroundColor: getSeverityColor(alert.severity) }
              ]}>
                <Text style={styles.severityText}>
                  {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                </Text>
              </View>
            </View>
            
            <Text style={styles.alertSubtitle}>
              Sensor {alert.sensor} - {alert.observation}
            </Text>
            
            <Text style={styles.alertMessage}>{alert.message}</Text>
            
            <View style={styles.alertFooter}>
              <Text style={styles.alertScore}>Score: {alert.score}</Text>
              <Text style={styles.alertTimestamp}>{alert.timestamp}</Text>
            </View>
          </View>
        ))}
        
        {/* Empty state */}
        {alerts.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No active alerts</Text>
            <Text style={styles.emptyStateSubtext}>All systems are running normally</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderObservationsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Observations</Text>
          <TouchableOpacity style={styles.filterButton} onPress={() => {
            setTempStatusFilter(statusFilter);
            setTempConsFilters(consFilters);
            setTempPublicFilter(publicFilter);
            setFilterModalVisible(true);
          }}>
            <Text style={styles.filterText}>Filter</Text>
            <Ionicons name="options-outline" size={18} color="#666" />
          </TouchableOpacity>
        </View>
        


      </View>

      {obsError && (
        <View style={styles.plotError}>
          <Ionicons name="alert-circle" size={32} color="#F44336" />
          <Text style={styles.plotErrorText}>{String(obsError)}</Text>
          <TouchableOpacity style={[styles.viewDetailsButton]} onPress={() => fetchObservations({ reset: true })}>
            <Text style={styles.viewDetailsText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {obsLoading && observations.length === 0 ? (
        <View style={styles.plotLoading}>
          <ActivityIndicator size="small" color="#2e7d32" />
          <Text style={styles.plotLoadingText}>Loading observations...</Text>
        </View>
      ) : null}

      <FlatList
        data={observations}
        keyExtractor={(item) => String(item.observation_id)}
        contentContainerStyle={observations.length === 0 ? { flexGrow: 1 } : null}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Ionicons name="eye-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No observations found</Text>
            <Text style={styles.emptyStateSubtext}>Try adjusting filters or refresh</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const plantInfo = plantCache[item.plant_id] || null;
          const commonName = plantInfo?.common_name || `Plant #${item.plant_id}`;
          const scientificName = plantInfo?.scientific_name || '';
          const dateStr = (item.observation_date || '').toString().split('T')[0];
          const lat = item.latitude != null ? Number(item.latitude).toFixed(5) : '—';
          const lon = item.longitude != null ? Number(item.longitude).toFixed(5) : '—';
          const cons = (item.conservation_status || plantInfo?.conservation_status || '').toString();
          const consColor = getConservationColor(cons);
          const isPublic = item.public === 1 || item.public === true;
          return (
            <TouchableOpacity style={styles.plantCard} activeOpacity={0.85}
              onPress={() => {
                setObsDetail(item);
                setObsDetailVisible(true);
              }}
            >
              <View style={styles.obsHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.plantName}>{commonName}</Text>
                  {scientificName ? <Text style={styles.scientificName}>{scientificName}</Text> : null}
                  {cons ? (
                    <View style={[styles.consBadge, { backgroundColor: consColor }]}>
                      <Text style={styles.consText}>
                        {(cons || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}> 
                  <Text style={styles.statusText}>{(item.status || 'unknown').toUpperCase()}</Text>
                </View>
              </View>

              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.obsImage} />
              ) : null}

              <View style={styles.obsMetaRow}>
                <Ionicons name="person-circle-outline" size={16} color="#666" />
                <Text style={styles.obsMetaText}>Uploader: {item.username || `User #${item.user_id}`}</Text>
              </View>
              <View style={styles.obsMetaRow}>
                <Ionicons name="calendar-outline" size={16} color="#666" />
                <Text style={styles.obsMetaText}>Date: {dateStr || 'N/A'}</Text>
              </View>
              <View style={styles.obsMetaRow}>
                <Ionicons name={isPublic ? 'globe-outline' : 'lock-closed-outline'} size={16} color={isPublic ? '#2e7d32' : '#666'} />
                <Text style={[styles.obsMetaText, { color: isPublic ? '#2e7d32' : '#666' }]}>{isPublic ? 'Public' : 'Private'}</Text>
              </View>
              <View style={styles.obsMetaRow}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={styles.obsMetaText}>Lat: {lat}  |  Lon: {lon}</Text>
              </View>
              <View style={styles.obsMetaRow}>
                <Ionicons name="stats-chart-outline" size={16} color="#666" />
                <Text style={styles.obsMetaText}>Confidence: {item.confidence_score != null ? Number(item.confidence_score).toFixed(2) : '—'}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        onEndReachedThreshold={0.7}
        onEndReached={() => {
          if (!obsLoading && obsHasMore) fetchObservations();
        }}
        ListFooterComponent={(
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            {obsLoading && observations.length > 0 ? (
              <ActivityIndicator size="small" color="#2e7d32" />
            ) : (
              !obsHasMore && observations.length > 0 ? (
                <Text style={{ color: '#666' }}>End of list</Text>
              ) : null
            )}
          </View>
        )}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );

  const renderUsersSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Users Management</Text>
      </View>
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={48} color="#ccc" />
        <Text style={styles.emptyStateText}>Users Section</Text>
        <Text style={styles.emptyStateSubtext}>User management will appear here</Text>
      </View>
    </View>
  );

  const renderSensorsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sensor Readings</Text>
      </View>
      <View style={styles.emptyState}>
        <Ionicons name="hardware-chip-outline" size={48} color="#ccc" />
        <Text style={styles.emptyStateText}>Sensor Readings</Text>
        <Text style={styles.emptyStateSubtext}>Sensor data will appear here</Text>
      </View>
    </View>
  );

  //Render Models Section
  const renderModelsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Model Management</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setTrainingModalVisible(true)}   //pop up
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
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => deleteModel(model.name)}
              >
                <Ionicons name="trash" size={18} color="white" />
                <Text style={styles.addButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        
        {models.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="layers-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No models added yet</Text>
            <Text style={styles.emptyStateSubtext}>Train a model to get started</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#4CAF50',
      medium: '#FFC107',
      high: '#FF9800',
      critical: '#F44336'
    };
    return colors[severity] || '#666';
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'plants':
        return renderPlantsSection();
      case 'observations':
        return renderObservationsSection();
      case 'users':
        return renderUsersSection();
      case 'sensors':
        return renderSensorsSection();
      case 'alerts':
        return renderAlertsSection();
      case 'models':
        return renderModelsSection();
      default:
        return renderPlantsSection();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Admin Dashboard</Text>
      </View>

      {/* Navigation Menu - Simple list like in screenshot */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.navMenu}
      >
        {sections.map(section => (
          <TouchableOpacity
            key={section.id}
            style={[
              styles.navItem,
              activeSection === section.id && styles.navItemActive
            ]}
            onPress={() => setActiveSection(section.id)}
          >
            <Ionicons 
              name={section.icon} 
              size={20} 
              color={activeSection === section.id ? '#2e7d32' : '#666'} 
            />
            <Text style={[
              styles.navText,
              activeSection === section.id && styles.navTextActive
            ]}>
              {section.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {renderContent()}
      </View>

      {/* Filters Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Status Filter (single-select) */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>Status</Text>
                <TouchableOpacity onPress={() => setTempStatusFilter('')}>
                </TouchableOpacity>
              </View>
              <View>
                {statusOptions.map(opt => (
                  <TouchableOpacity
                    key={`modal-status-${opt.key || 'all'}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                    onPress={() => setTempStatusFilter(opt.key)}
                  >
                    <Ionicons
                      name={tempStatusFilter === opt.key ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={tempStatusFilter === opt.key ? '#2e7d32' : '#666'}
                    />
                    <Text style={[styles.statusOptionText]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Conservation Filter (multi-select) */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>Conservation Status</Text>
                <TouchableOpacity onPress={() => setTempConsFilters([])}>
                </TouchableOpacity>
              </View>
              <View>
                {CONSERVATION_OPTIONS.filter(o => o.key !== '').map(opt => {
                  const checked = tempConsFilters.includes(opt.key);
                  return (
                    <TouchableOpacity
                      key={`modal-cons-${opt.key}`}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => setTempConsFilters(prev => prev.includes(opt.key) ? prev.filter(k => k !== opt.key) : [...prev, opt.key])}
                    >
                      <Ionicons
                        name={checked ? 'checkbox' : 'checkbox-outline'}
                        size={20}
                        color={checked ? '#2e7d32' : '#666'}
                      />
                      <View style={[styles.consBadge, { backgroundColor: getConservationColor(opt.key), marginTop: 0, marginLeft: 6 }]}> 
                        <Text style={styles.consText}>{opt.label}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Public Filter (single-select) */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>Visibility</Text>
                <TouchableOpacity onPress={() => setTempPublicFilter('')}>
                </TouchableOpacity>
              </View>
              <View>
                {PUBLIC_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={`modal-public-${opt.key || 'all'}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                    onPress={() => setTempPublicFilter(opt.key)}
                  >
                    <Ionicons
                      name={tempPublicFilter === opt.key ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={tempPublicFilter === opt.key ? '#2e7d32' : '#666'}
                    />
                    <Text style={[styles.statusOptionText]}>{opt.label || 'All'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setTempStatusFilter('');
                  setTempConsFilters([]);
                  setTempPublicFilter('');
                }}
              >
                <Text style={styles.cancelButtonText}>Clear Selection</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  setFilterModalVisible(false);
                  setStatusFilter(tempStatusFilter);
                  setConsFilters(tempConsFilters);
                  setPublicFilter(tempPublicFilter);
                }}
              >
                <Text style={styles.saveButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Observation Details Modal */}
      <Modal
        visible={obsDetailVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setObsDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Observation Details</Text>
              <TouchableOpacity onPress={() => setObsDetailVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={[styles.modalBody, styles.detailModalBody]}>
              {obsDetail ? (
                <>
                  {/* Header with plant name and status */}
                  <View style={styles.obsHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.plantName}>
                        {(plantCache[obsDetail.plant_id]?.common_name) || `Plant #${obsDetail.plant_id}`}
                      </Text>
                      {plantCache[obsDetail.plant_id]?.scientific_name ? (
                        <Text style={styles.scientificName}>{plantCache[obsDetail.plant_id].scientific_name}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(obsDetail.status) }]}>
                      <Text style={styles.statusText}>{(obsDetail.status || 'unknown').toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Image */}
                  {obsDetail.image_url ? (
                    <Image source={{ uri: obsDetail.image_url }} style={styles.obsImage} />
                  ) : null}

                  {/* Meta */}
                  <View style={styles.detailSection}>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="person-circle-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>Uploader: {obsDetail.username || `User #${obsDetail.user_id}`}</Text>
                    </View>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="calendar-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>Date: {(obsDetail.observation_date || '').toString().split('T')[0] || 'N/A'}</Text>
                    </View>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>
                        Lat: {obsDetail.latitude != null ? String(obsDetail.latitude) : '—'}
                        {' \n'}
                        Lon: {obsDetail.longitude != null ? String(obsDetail.longitude) : '—'}
                      </Text>
                    </View>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="stats-chart-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>Confidence: {obsDetail.confidence_score != null ? Number(obsDetail.confidence_score).toFixed(2) : '—'}</Text>
                    </View>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="shield-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>
                        Conservation Status: {(() => {
                          const cs = plantCache[obsDetail.plant_id]?.conservation_status;
                          return cs ? cs.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'N/A';
                        })()}
                      </Text>
                    </View>
                    <View style={[styles.obsMetaRow, { justifyContent: 'space-between', marginTop: 8 }]}> 
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="globe-outline" size={16} color="#666" />
                        <Text style={styles.obsMetaText}>Published to Public Map</Text>
                      </View>
                      <Switch
                        value={!!(obsDetail?.public === 1 || obsDetail?.public === true)}
                        onValueChange={async (val) => {
                          if (!obsDetail?.observation_id) return;
                          try {
                            setPubSaving(true);
                            const token = await getAuthToken();
                            const res = await fetch(`${API_URL}/observations/${obsDetail.observation_id}/public`, {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                              },
                              body: JSON.stringify({ public: val }),
                            });
                            const data = await res.json();
                            if (!res.ok || !data?.success) {
                              throw new Error(data?.error || `Update failed (${res.status})`);
                            }
                            setObsDetail((prev) => ({ ...prev, public: val }));
                          } catch (err) {
                            console.error('Public toggle error:', err);
                            Alert.alert('Error', String(err.message || 'Failed to update public visibility'));
                          } finally {
                            setPubSaving(false);
                          }
                        }}
                        disabled={pubSaving}
                      />
                    </View>
                    <View style={styles.infoBox}>
                      <Ionicons name="information-circle-outline" size={16} color="#2E7D32" />
                      <Text style={styles.infoText}>
                        Sensitive species may have rounded coordinates when not published. Publishing will show full precision on the public map.
                      </Text>
                    </View>
                  </View>

                  {/* Map */}
                  <View style={styles.mapContainer}>
                    {obsDetail.latitude != null && obsDetail.longitude != null ? (
                      <MapView
                        style={styles.map}
                        initialRegion={{
                          latitude: Number(obsDetail.latitude),
                          longitude: Number(obsDetail.longitude),
                          latitudeDelta: 0.02,
                          longitudeDelta: 0.02,
                        }}
                      >
                        <Marker
                          coordinate={{
                            latitude: Number(obsDetail.latitude),
                            longitude: Number(obsDetail.longitude),
                          }}
                          title={(plantCache[obsDetail.plant_id]?.common_name) || `Plant #${obsDetail.plant_id}`}
                          description={`Lat: ${String(obsDetail.latitude)}  |  Lon: ${String(obsDetail.longitude)}`}
                        />
                      </MapView>
                    ) : (
                      <View style={styles.placeholderBox}>
                        <Text style={{ color: '#666' }}>No coordinates available for this observation</Text>
                      </View>
                    )}
                  </View>

                  {/* Status selection and save */}
                  <View style={[styles.detailSection, styles.statusSelectRow]}>
                    {['pending', 'verified', 'unsure', 'rejected'].map((st) => (
                      <TouchableOpacity
                        key={`status-select-${st}`}
                        style={[styles.statusOption, obsDetail.status === st && styles.statusOptionActive]}
                        onPress={() => setObsDetail({ ...obsDetail, status: st })}
                      >
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(st) }]} />
                        <Text style={styles.statusOptionText}>{st}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  
                </>
              ) : (
                <View style={styles.plotError}>
                  <Ionicons name="alert-circle" size={32} color="#F44336" />
                  <Text style={styles.plotErrorText}>No observation selected</Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.cancelButton]}
                      onPress={() => setObsDetailVisible(false)}
                      disabled={statusSaving}
                    >
                      <Text style={styles.cancelButtonText}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveButton, statusSaving && styles.disabledButton]}
                      onPress={async () => {
                        if (!obsDetail) return;
                        try {
                          setStatusSaving(true);
                          const token = await getAuthToken();
                          const res = await fetch(`${API_URL}/observations/${obsDetail.observation_id}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({ status: obsDetail.status }),
                          });
                          const data = await res.json();
                          if (!res.ok || !data?.success) {
                            throw new Error(data?.error || `Update failed (${res.status})`);
                          }
                          // Update list item in-place
                          setObservations((prev) => prev.map((o) => (
                            o.observation_id === obsDetail.observation_id ? { ...o, status: obsDetail.status } : o
                          )));
                          // Sync detail with updated server response if available
                          if (data?.observation) setObsDetail(data.observation);
                          Alert.alert('Success', 'Observation status updated');
                        } catch (err) {
                          console.error('Status update error:', err);
                          Alert.alert('Error', String(err.message || 'Failed to update status'));
                        } finally {
                          setStatusSaving(false);
                        }
                      }}
                      disabled={statusSaving}
                    >
                      {statusSaving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.saveButtonText}>Save Status</Text>
                      )}
                    </TouchableOpacity>
                  </View>
          </View>
        </View>
      </Modal>

      {/* Add Plant Modal */}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginTop: 25, //added by junwen  (because the header not showing)
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center',
  },
  navMenu: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    maxHeight: 80, 
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 0,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  navItemActive: {
    backgroundColor: '#e8f5e8',
  },
  navText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  navTextActive: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
  },
  section: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    frontSize: 12,
  },
  contentScroll: {
    flex: 1,
  },
  chip: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#e8f5e8',
    borderColor: '#2e7d32',
  },
  chipText: {
    fontSize: 13,
    color: '#666',
  },
  chipTextActive: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  plantCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  detailModalBody: {
    paddingBottom: 8,
  },
  obsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  consBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  consText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize',
  },
  obsImage: {
    width: '100%',
    height: 180,
    borderRadius: 6,
    marginBottom: 10,
    backgroundColor: '#f1f1f1',
  },
  obsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  obsMetaText: {
    fontSize: 13,
    color: '#555',
  },
  detailSection: {
    marginBottom: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#eaf5ea',
    borderWidth: 1,
    borderColor: '#d3e9d3',
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#2E7D32',
  },
  mapContainer: {
    height: 220,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  statusSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 6,
  },
  statusOptionActive: {
    backgroundColor: '#e8f5e8',
    borderColor: '#2e7d32',
  },
  statusOptionText: {
    fontSize: 13,
    color: '#333',
    textTransform: 'capitalize',
    marginLeft: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  plantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  plantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scientificName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  plantDescription: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 8,
  },
  plantFamily: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  viewDetailsButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  viewDetailsText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  alertCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  alertSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertScore: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  alertTimestamp: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },

  // Training Modal Styles
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 6,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#2E7D32',
    lineHeight: 16,
  },
  disabledButton: {
    backgroundColor: '#9E9E9E',
  },
  
  // Models Section Styles
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modelInfo: {
    flex: 1,
  },
  modelStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modelStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  modelActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },

  viewPlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },

  trainingBanner: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  trainingBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  trainingBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  trainingBannerText: {
    fontSize: 14,
    color: '#388E3C',
    marginBottom: 4,
  },
  stopTrainingButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  plotImage: {
    width: '100%',
    height: 350,
    borderRadius: 8,
  },
  plotLoading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
  },
  plotLoadingText: {
    marginTop: 12,
    color: '#666',
  },
  plotError: {
    padding: 40,
    alignItems: 'center',
  },
  plotErrorText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  placeholderBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdminScreen;
