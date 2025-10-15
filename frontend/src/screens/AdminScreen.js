// src/screens/AdminScreen.js
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AdminScreen = () => {
  const [activeSection, setActiveSection] = useState('plants');
  const [plantModalVisible, setPlantModalVisible] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);

  // Mock data based on your screenshots
  const [plants, setPlants] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [models, setModels] = useState([]);

  useEffect(() => {
    loadMockData();
  }, []);

  const loadMockData = () => {
    // Plants data from first screenshot
    setPlants([
      {
        id: '1',
        name: 'Sunflower',
        scientificName: 'Helianthus annuus',
        description: 'Annual flowering plant known for its large yellow flowers that track the sun.',
        family: 'Asteraceae',
        image: 'https://images.unsplash.com/photo-1597848212624-e5f4b302a6e2?w=400'
      }
    ]);

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
    
    // Models data
    setModels([
      {
        id: '1',
        name: 'model1',
        created: '2025-01-15',
        active: true,
        plot: 'https://via.placeholder.com/300x150?text=Model+Plot'
      },
      {
        id: '2',
        name: 'model2',
        created: '2025-01-10',
        active: false,
        plot: 'https://via.placeholder.com/300x150?text=Model+Plot'
      }
    ]);
  };

  const sections = [
    { id: 'plants', label: 'Plants', icon: 'leaf' },
    { id: 'observations', label: 'Observations', icon: 'eye' },
    { id: 'users', label: 'Users', icon: 'people' },
    { id: 'sensors', label: 'Sensor Readings', icon: 'hardware-chip' },
    { id: 'alerts', label: 'Alerts', icon: 'warning' },
    { id: 'models', label: 'Models', icon: 'layers'},
  ];

  const renderPlantsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Plants Management</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setPlantModalVisible(true)}
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
            <Text style={styles.plantDescription}>{plant.description}</Text>
            <Text style={styles.plantFamily}>Family: {plant.family}</Text>
            
            <TouchableOpacity 
              style={styles.viewDetailsButton}
              onPress={() => {
                setSelectedPlant(plant);
                // You can open a details modal here if needed
              }}
            >
              <Text style={styles.viewDetailsText}>View Details</Text>
            </TouchableOpacity>
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
        <Text style={styles.sectionTitle}>Observations</Text>
      </View>
      <View style={styles.emptyState}>
        <Ionicons name="eye-outline" size={48} color="#ccc" />
        <Text style={styles.emptyStateText}>Observations Section</Text>
        <Text style={styles.emptyStateSubtext}>User observations will appear here</Text>
      </View>
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

  // Render Models Section
  const renderModelsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Model Management</Text>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={15} color="white" />
          <Text style={styles.addButtonText}>Train New Model</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.contentScroll}>
        {models.map(model => (
          <View key={model.id} style={styles.plantCard}>
            <Text style={styles.plantName}>{model.name}</Text>
            <Text style={styles.scientificName}>Created: {model.created}</Text>

            <Text style={{ 
              color: model.active ? 'green' : 'gray',
              marginBottom: 10,
              fontWeight: '600'
            }}>
              {model.active ? 'ACTIVE' : 'Not Active'}
            </Text>
            <TouchableOpacity style={styles.viewDetailsButton}>
              <Text style={styles.viewDetailsText}>View Details</Text>
            </TouchableOpacity>
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
              <Text style={styles.modalTitle}>Add New Plant</Text>
              <TouchableOpacity onPress={() => setPlantModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Plant Name</Text>
              <TextInput style={styles.textInput} placeholder="Enter plant name" />
              
              <Text style={styles.inputLabel}>Scientific Name</Text>
              <TextInput style={styles.textInput} placeholder="Enter scientific name" />
              
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput 
                style={[styles.textInput, styles.textArea]} 
                placeholder="Enter description" 
                multiline 
                numberOfLines={3}
              />
              
              <Text style={styles.inputLabel}>Family</Text>
              <TextInput style={styles.textInput} placeholder="Enter family" />
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setPlantModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save Plant</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    maxHeight: 220,  //added by junwen  (make the navigation cards smaller vertically)
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
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
    marginLeft: 6,
  },
  contentScroll: {
    flex: 1,
  },
  plantCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    maxHeight: '80%',
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
});

export default AdminScreen;
