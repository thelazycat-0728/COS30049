// src/screens/AdminScreen.js
import { Ionicons } from '@expo/vector-icons';
import { Alert, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import section components
import PlantsSection from './admin/PlantsSection';
import ObservationsSection from './admin/ObservationsSection';
import UsersSection from './admin/UsersSection';
import SensorsSection from './admin/SensorsSection';
import AlertsSection from './admin/AlertsSection';
import ModelsSection from './admin/ModelsSection';
import ModelPerformance from './admin/ModelPerformance';

const API_URL = process.env.EXPO_PUBLIC_API_BASE;

const AdminScreen = () => {
  const [activeSection, setActiveSection] = useState('plants');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  // Shared state that might be needed across sections
  const [plantCache, setPlantCache] = useState({});

  const getAuthToken = async () => {
    return await AsyncStorage.getItem('authToken');
  };

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        
        const res = await fetch(`${API_URL}/user/profile`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (res.ok) {
          const data = await res.json();
          setUserRole(data?.user?.role || '');
          // Capture current logged-in user's id for verified_by updates
          setCurrentUserId(data?.user?.user_id ?? data?.user?.id ?? null);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };
    
    fetchUserRole();
  }, []);

  const allSections = [
    { id: 'plants', label: 'Plants', icon: 'leaf' },
    { id: 'observations', label: 'Observations', icon: 'eye' },
    { id: 'users', label: 'Users', icon: 'people' },
    { id: 'sensors', label: 'Sensor Readings', icon: 'hardware-chip' },
    { id: 'alerts', label: 'Alerts', icon: 'warning' },
    { id: 'models', label: 'Models', icon: 'layers'},
    { id: 'model-performance', label: 'Model Performance', icon: 'stats-chart' },
  ];

  // Filter sections based on user role
  const sections = userRole === 'expert' 
    ? allSections.filter(section => 
        ['plants', 'observations', 'sensors', 'alerts'].includes(section.id)
      )
    : allSections;

  const renderContent = () => {
    const sharedProps = {
      getAuthToken,
      API_URL,
      plantCache,
      setPlantCache,
      currentUserId,
    };

    switch (activeSection) {
      case 'plants':
        return <PlantsSection {...sharedProps} />;
      case 'observations':
        return <ObservationsSection {...sharedProps} />;
      case 'users':
        return <UsersSection {...sharedProps} />;
      case 'sensors':
        return <SensorsSection {...sharedProps} />;
      case 'alerts':
        return <AlertsSection {...sharedProps} />;
      case 'models':
        return <ModelsSection {...sharedProps} />;
      case 'model-performance':
        return <ModelPerformance {...sharedProps} />;
      default:
        return <PlantsSection {...sharedProps} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>
          {userRole === 'expert' ? 'Expert Dashboard' : 'Admin Dashboard'}
        </Text>
      </View>

      {/* Navigation Menu */}
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
    marginTop: 25,
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
});

export default AdminScreen;
