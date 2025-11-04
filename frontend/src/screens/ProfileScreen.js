// screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  TextInput,
  Modal
} from 'react-native';
import TokenRefreshService from '../services/TokenRefreshService';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  
  // Edit profile states
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [saving, setSaving] = useState(false);

  const getAuthToken = async () => {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (e) {
      return null;
    }
  };

  const getRefreshToken = async () => {
    try {
      return await AsyncStorage.getItem('refreshToken');
    } catch (e) {
      return null;
    }
  }

  // Fetch user profile and observations
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Not logged in', 'Please log in to view profile');
        setLoading(false);
        return;
      }

      // Fetch user profile
      const resProfile = await fetch(`${API_BASE}/user/profile`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataProfile = await resProfile.json().catch(() => null);
      if (!resProfile.ok || !dataProfile?.user) {
        throw new Error(dataProfile?.error || `Failed to load profile (HTTP ${resProfile.status})`);
      }
      const u = dataProfile.user;
      setUser(u);
      setProfileForm({ username: u.username, email: u.email });

      // Fetch observations by this user
      const params = new URLSearchParams({
        page: '1',
        size: '50',
        search: u.username || '',
        sortBy: 'po.created_at',
        sortOrder: 'DESC',
      });
      const resObs = await fetch(`${API_BASE}/observations?${params.toString()}`, {
        method: 'GET',
      });
      const dataObs = await resObs.json().catch(() => null);
      if (!resObs.ok || !dataObs?.success) {
        throw new Error(dataObs?.error || `Failed to load observations (HTTP ${resObs.status})`);
      }
      const list = Array.isArray(dataObs.observations) ? dataObs.observations : [];
      setObservations(list);
    } catch (err) {
      console.error('ProfileScreen load error:', err);
      Alert.alert('Error', err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = await getRefreshToken();
      const authToken = await getAuthToken();
      TokenRefreshService.stopAutoRefresh();
      // Call backend logout route
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
a
      // Clear tokens locally
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('refreshToken');

      // Reset navigation to Login screen
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      // Ensure local logout even if API fails
      TokenRefreshService.stopAutoRefresh();
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('refreshToken');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      
      const token = await getAuthToken();
      
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileForm),
      });

      const data = await res.json();
      
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update profile');
      }

      setUser(data.user);
      setEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setSaving(true);
      const token = await getAuthToken();
      // Validate confirm new password
      if (!passwordForm.newPassword || !passwordForm.confirmNewPassword) {
        throw new Error('Please enter and confirm your new password');
      }
      if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
        throw new Error('New password and confirmation do not match');
      }
      
      const res = await fetch(`${API_BASE}/profile/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();
      
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to change password');
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      setEditingPassword(false);
      Alert.alert('Success', 'Password changed successfully');
    } catch (error) {
      console.error('Change password error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    const map = {
      pending: '#FFC107',
      verified: '#4CAF50',
      unsure: '#FF9800',
      rejected: '#F44336',
    };
    return map[status] || '#9E9E9E';
  };

  const filteredObservations = observations.filter(obs => {
    if (activeTab === 'all') return true;
    return obs.status === activeTab;
  });

  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'shield-checkmark';
      case 'expert': return 'school';
      default: return 'person';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-circle-outline" size={80} color="#ccc" />
        <Text style={styles.errorText}>No user profile found</Text>
        <Text style={styles.errorSubtext}>Please log in to view your profile</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.nameRoleContainer}>
              <Text style={styles.userName}>{user.username}</Text>
              <View style={styles.roleContainer}>
                <Ionicons name={getRoleIcon(user.role)} size={18} color="#2e7d32" />
                <Text style={styles.roleText}>{user.role}</Text>
              </View>
            </View>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.joinDate}>
              Joined {new Date(user.created_at).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
            
            {/* Edit Profile Button */}
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setEditingProfile(true)}
            >
              <Ionicons name="create-outline" size={16} color="#2e7d32" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics Section */}
        <View style={styles.statsSection}>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E8F5E8' }]}>
                <Ionicons name="camera" size={24} color="#2e7d32" />
              </View>
              <Text style={styles.statNumber}>{observations.length}</Text>
              <Text style={styles.statLabel}>Observations</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="leaf" size={24} color="#1976D2" />
              </View>
              <Text style={styles.statNumber}>
                {new Set(observations.map(o => o.plant_id)).size}
              </Text>
              <Text style={styles.statLabel}>Species</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="location" size={24} color="#FF9800" />
              </View>
              <Text style={styles.statNumber}>
                {new Set(observations.filter(o => o.latitude != null && o.longitude != null).map(o => `${o.latitude},${o.longitude}`)).size}
              </Text>
              <Text style={styles.statLabel}>Locations</Text>
            </View>
          </View>
        </View>

        {/* Change Password Button */}
        <View style={styles.settingsSection}>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setEditingPassword(true)}
          >
            <Ionicons name="key-outline" size={20} color="#666" />
            <Text style={styles.settingsButtonText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
          {/* Logout Button */}
          <View style={{ height: 8 }} />
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#666" />
            <Text style={styles.settingsButtonText}>Log Out</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Observations Section */}
        <View style={styles.observationsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Observations</Text>
            <Text style={styles.sectionCount}>({filteredObservations.length})</Text>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.tabContainer}
          >
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'all' && styles.activeTab]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'verified' && styles.activeTab]}
              onPress={() => setActiveTab('verified')}
            >
              <Ionicons name="checkmark-circle" size={16} color={activeTab === 'verified' ? '#fff' : '#4CAF50'} />
              <Text style={[styles.tabText, activeTab === 'verified' && styles.activeTabText]}>
                Verified
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
              onPress={() => setActiveTab('pending')}
            >
              <Ionicons name="time" size={16} color={activeTab === 'pending' ? '#fff' : '#FFC107'} />
              <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
                Pending
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {filteredObservations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="camera-outline" size={64} color="#e0e0e0" />
              <Text style={styles.emptyStateText}>No observations found</Text>
              <Text style={styles.emptyStateSubtext}>
                {activeTab === 'all' 
                  ? "You haven't made any observations yet" 
                  : `No ${activeTab} observations`
                }
              </Text>
            </View>
          ) : (
            filteredObservations.map(observation => {
              const img = observation.image_url 
                ? (observation.image_url.startsWith('http') 
                    ? observation.image_url 
                    : `${API_BASE}${observation.image_url}`)
                : 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=150&h=150&fit=crop';
              
              const dateStr = observation.observation_date 
                ? new Date(observation.observation_date).toLocaleDateString() 
                : '';

              return (
                <TouchableOpacity key={observation.observation_id} style={styles.observationCard}>
                  <Image source={{ uri: img }} style={styles.observationImage} />
                  
                  <View style={styles.observationContent}>
                    <View style={styles.observationHeader}>
                      <Text style={styles.plantName} numberOfLines={1}>
                        {observation.common_name || `Plant #${observation.plant_id}`}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(observation.status) }]}>
                        <Text style={styles.statusText}>{observation.status}</Text>
                      </View>
                    </View>
                    
                    {observation.scientific_name && (
                      <Text style={styles.scientificName} numberOfLines={1}>
                        {observation.scientific_name}
                      </Text>
                    )}
                    
                    <View style={styles.observationMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={14} color="#666" />
                        <Text style={styles.metaText}>{dateStr}</Text>
                      </View>
                      
                      {observation.confidence_score && (
                        <View style={styles.metaItem}>
                          <Ionicons name="stats-chart" size={14} color="#666" />
                          <Text style={styles.metaText}>
                            {Number(observation.confidence_score).toFixed(2)} confidence
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    {(observation.latitude && observation.longitude) && (
                      <View style={styles.locationTag}>
                        <Ionicons name="location" size={12} color="#2e7d32" />
                        <Text style={styles.locationText}>Has location</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editingProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingProfile(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditingProfile(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={profileForm.username}
                  onChangeText={(text) => setProfileForm(prev => ({ ...prev, username: text }))}
                  placeholder="Enter username"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={profileForm.email}
                  onChangeText={(text) => setProfileForm(prev => ({ ...prev, email: text }))}
                  placeholder="Enter email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, saving && styles.disabledButton]}
                  onPress={() => setEditingProfile(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.disabledButton]}
                  onPress={handleUpdateProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={editingPassword}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setEditingPassword(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordForm.currentPassword}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, currentPassword: text }))}
                  placeholder="Enter current password"
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordForm.newPassword}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, newPassword: text }))}
                  placeholder="Enter new password"
                  secureTextEntry
                />
                <Text style={styles.helperText}>
                  Password must be at least 6 characters long
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordForm.confirmNewPassword}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, confirmNewPassword: text }))}
                  placeholder="Re-enter new password"
                  secureTextEntry
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, saving && styles.disabledButton]}
                  onPress={() => setEditingPassword(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.disabledButton]}
                  onPress={handleChangePassword}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Change Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#2e7d32',
    padding: 20,
    paddingTop: 60,
  },
  userInfo: {
    flex: 1,
  },
  nameRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  joinDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsSection: {
    padding: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  settingsSection: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  settingsButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  observationsSection: {
    padding: 20,
    paddingTop: 16,
    backgroundColor: '#fff',
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionCount: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  tabContainer: {
    marginBottom: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  activeTab: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 4,
  },
  activeTabText: {
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  observationCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  observationImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  observationContent: {
    flex: 1,
    marginLeft: 12,
  },
  observationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  plantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  scientificName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  observationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  locationText: {
    fontSize: 10,
    color: '#2e7d32',
    fontWeight: '600',
    marginLeft: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 0,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ProfileScreen;