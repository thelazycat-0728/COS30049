// src/components/admin/UsersSection.js
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './SectionStyles';

const UsersSection = ({ API_URL, getAuthToken }) => {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [usersPage, setUsersPage] = useState(1);
  const USERS_PAGE_SIZE = 10;
  const [usersTotal, setUsersTotal] = useState(0);
  const [createUserModalVisible, setCreateUserModalVisible] = useState(false);
  const [createUserSaving, setCreateUserSaving] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ username: '', email: '', password: '', role: 'public' });
  const [usersFilterModalVisible, setUsersFilterModalVisible] = useState(false);
  const [usersFilterRole, setUsersFilterRole] = useState(null);
  const [usersSortKey, setUsersSortKey] = useState('name');
  const [usersSortOrder, setUsersSortOrder] = useState('asc');
  const [usersFilterTempRole, setUsersFilterTempRole] = useState(null);
  const [usersSortTempKey, setUsersSortTempKey] = useState('name');
  const [usersSortTempOrder, setUsersSortTempOrder] = useState('asc');

  const USER_ROLES = ['public', 'expert', 'admin'];

  const totalUsersPages = useMemo(() => Math.max(1, Math.ceil(usersTotal / USERS_PAGE_SIZE)), [usersTotal]);

  useEffect(() => {
    if (usersPage > totalUsersPages) {
      setUsersPage(totalUsersPages);
    }
  }, [usersPage, totalUsersPages]);

  useEffect(() => {
    fetchUsers();
  }, [usersPage, usersFilterRole, usersSortKey, usersSortOrder]);

  const resetUsers = () => {
    setUsers([]);
    setUsersError(null);
  };

  const fetchUsers = async () => {
    if (usersLoading) return;
    try {
      setUsersLoading(true);
      const token = await getAuthToken();
      const params = new URLSearchParams({
        page: String(usersPage),
        limit: String(USERS_PAGE_SIZE),
      });
      
      // Add filter and sort parameters if available
      if (usersFilterRole) {
        params.append('role', usersFilterRole);
      }
      if (usersSortKey) {
        params.append('sort', usersSortKey);
        params.append('order', usersSortOrder);
      }

      const res = await fetch(`${API_URL}/admin/users?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`);
      
      const list = Array.isArray(json.data) ? json.data : [];
      const mapped = list.map(u => ({
        user_id: u.user_id ?? u.id ?? u.userId,
        username: u.username,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
      }));
      
      setUsers(mapped);
      setUsersTotal(json.pagination?.total ?? json.total ?? list.length);
      setUsersError(null);
    } catch (err) {
      console.error('Users fetch error:', err);
      setUsersError(err.message || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleUpdateUserRole = async (user, newRole) => {
    try {
      if (!USER_ROLES.includes(newRole)) {
        Alert.alert('Invalid role', 'Role must be one of: public, expert, admin');
        return;
      }
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/admin/users/${user.user_id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.user_id, newRole }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `Failed to update role`);
      setUsers(prev => prev.map(u => u.user_id === user.user_id ? { ...u, role: newRole } : u));
      Alert.alert('Success', `Updated ${user.username}'s role to ${newRole}`);
    } catch (err) {
      console.error('Update user role error:', err);
      Alert.alert('Error', err.message || 'Failed to update user role');
    }
  };

  const openUsersFilterModal = () => {
    setUsersFilterTempRole(usersFilterRole);
    setUsersSortTempKey(usersSortKey);
    setUsersSortTempOrder(usersSortOrder);
    setUsersFilterModalVisible(true);
  };

  const applyUsersFilterSort = () => {
    setUsersFilterRole(usersFilterTempRole ?? null);
    setUsersSortKey(usersSortTempKey || 'name');
    setUsersSortOrder(usersSortTempOrder || 'asc');
    setUsersFilterModalVisible(false);
    setUsersPage(1); // Reset to first page when filters change
  };

  const clearUsersFilters = () => {
    setUsersFilterTempRole(null);
    setUsersSortTempKey('name');
    setUsersSortTempOrder('asc');
    setUsersFilterRole(null);
    setUsersSortKey('name');
    setUsersSortOrder('asc');
    setUsersPage(1);
  };

  // REMOVED: Client-side sorting that was overriding server-side pagination
  // const usersDisplay = useMemo(() => {
  //   let arr = [...users];
  //   const getVal = (u) => {
  //     if (usersSortKey === 'email') return (u.email || '').toLowerCase();
  //     return (u.username || u.name || u.email || '').toLowerCase();
  //   };
  //   arr.sort((a, b) => {
  //     const av = getVal(a);
  //     const bv = getVal(b);
  //     if (av < bv) return usersSortOrder === 'asc' ? -1 : 1;
  //     if (av > bv) return usersSortOrder === 'asc' ? 1 : -1;
  //     return 0;
  //   });
  //   return arr;
  // }, [users, usersSortKey, usersSortOrder]);

  const openCreateUser = () => {
    setCreateUserForm({ username: '', email: '', password: '', role: 'public' });
    setCreateUserModalVisible(true);
  };

  const handleSaveCreateUser = async () => {
    try {
      const name = createUserForm.username.trim();
      const email = createUserForm.email.trim();
      const pwd = createUserForm.password;
      if (!name || !email || !pwd) {
        Alert.alert('Missing fields', 'Please fill in username, email and password');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Alert.alert('Invalid email', 'Please enter a valid email address');
        return;
      }
      setCreateUserSaving(true);
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ username: name, email, password: pwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Register failed (${res.status})`);
      }
      const created = data?.user || data?.data;
      const newUserId = created?.id ?? created?.user_id ?? created?.userId;
      const desiredRole = createUserForm.role || 'public';
      const currentRole = created?.role ?? 'public';
      if (newUserId && desiredRole !== currentRole) {
        const res2 = await fetch(`${API_URL}/admin/users/${newUserId}/role`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ userId: newUserId, newRole: desiredRole }),
        });
        const data2 = await res2.json();
        if (!res2.ok || !data2?.success) {
          throw new Error(data2?.error || 'Failed to set role');
        }
      }
      setCreateUserModalVisible(false);
      setCreateUserForm({ username: '', email: '', password: '', role: 'public' });
      fetchUsers(); // Fixed: removed { reset: true } parameter
      Alert.alert('Success', 'User created successfully');
    } catch (err) {
      console.error('Create user error:', err);
      Alert.alert('Error', err.message || 'Failed to create user');
    } finally {
      setCreateUserSaving(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Users Management</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={openUsersFilterModal}
          >
            <Ionicons name="options-outline" size={16} color="#666" />
            <Text style={styles.filterText}>Filter & Sort</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={openCreateUser}
          >
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.addButtonText}>Create User</Text>
          </TouchableOpacity>
        </View>
      </View>

      {usersLoading ? (
        <View style={styles.placeholderBox}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 12, color: '#666' }}>Loading users...</Text>
        </View>
      ) : usersError ? (
        <View style={styles.placeholderBox}>
          <Ionicons name="alert-circle-outline" size={32} color="#F44336" />
          <Text style={{ marginTop: 8, color: '#F44336' }}>{usersError}</Text>
          <TouchableOpacity
            style={[styles.addButton, { marginTop: 12 }]}
            onPress={fetchUsers} // Fixed: removed { reset: true } parameter
          >
            <Ionicons name="refresh" size={16} color="white" />
            <Text style={styles.addButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.contentScroll}>
          {/* Fixed: Use users directly instead of usersDisplay */}
          {users.map(item => (
            <View key={item.user_id} style={styles.plantCard}>
              <View style={styles.plantHeader}>
                <Text style={styles.plantName}>
                  {item.username || item.name || item.email || `User #${item.user_id ?? item.id}`}
                </Text>
              </View>
              <View style={{ marginTop: 6 }}>
                <Text style={styles.plantDescription}>Email: {item.email || '-'}</Text>
                <Text style={styles.plantDescription}>Role: {item.role || 'public'}</Text>
              </View>

              <View style={[styles.filterRow, { marginTop: 8 }]}>
                {USER_ROLES.map((role) => {
                  const active = (item.role || 'public') === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => handleUpdateUserRole(item, role)}
                      disabled={usersLoading}
                    >
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={active ? '#2e7d32' : '#666'}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{role}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          
          {/* Fixed: Use users.length instead of usersDisplay.length */}
          {users.length === 0 && !usersLoading && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No users found</Text>
              <Text style={styles.emptyStateSubtext}>Create a new user or adjust filters</Text>
            </View>
          )}

          {/* Fixed: Use users.length instead of usersDisplay.length */}
          {users.length > 0 && (
            <View style={styles.paginationBar}>
              <TouchableOpacity
                style={[styles.pageButton, usersPage <= 1 && styles.disabledButton]}
                onPress={() => usersPage > 1 && setUsersPage(usersPage - 1)}
                disabled={usersPage <= 1}
              >
                <Ionicons name="chevron-back" size={18} color={usersPage <= 1 ? '#fff' : '#2e7d32'} />
                <Text style={[styles.pageButtonText, usersPage <= 1 && styles.pageButtonTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              <Text style={styles.pageIndicator}>Page {usersPage} of {totalUsersPages}</Text>
              <TouchableOpacity
                style={[styles.pageButton, usersPage >= totalUsersPages && styles.disabledButton]}
                onPress={() => usersPage < totalUsersPages && setUsersPage(usersPage + 1)}
                disabled={usersPage >= totalUsersPages}
              >
                <Text style={[styles.pageButtonText, usersPage >= totalUsersPages && styles.pageButtonTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={18} color={usersPage >= totalUsersPages ? '#fff' : '#2e7d32'} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Create User Modal */}
      <Modal
        visible={createUserModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create User</Text>
              <TouchableOpacity onPress={() => setCreateUserModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Username *</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="Enter username"
                value={createUserForm.username}
                onChangeText={(t) => setCreateUserForm(prev => ({ ...prev, username: t }))}
              />

              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="Enter email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={createUserForm.email}
                onChangeText={(t) => setCreateUserForm(prev => ({ ...prev, email: t }))}
              />

              <Text style={styles.inputLabel}>Password *</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="Enter password"
                secureTextEntry
                value={createUserForm.password}
                onChangeText={(t) => setCreateUserForm(prev => ({ ...prev, password: t }))}
              />

              <Text style={styles.inputLabel}>Role</Text>
              <View>
                {USER_ROLES.map((role) => (
                  <TouchableOpacity
                    key={`form-role-${role}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                    onPress={() => setCreateUserForm(prev => ({ ...prev, role }))}
                  >
                    <Ionicons
                      name={createUserForm.role === role ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={createUserForm.role === role ? '#2e7d32' : '#666'}
                    />
                    <Text style={{ marginLeft: 8, color: '#333', fontSize: 14 }}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setCreateUserModalVisible(false)}
                disabled={createUserSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, createUserSaving && styles.disabledButton]}
                onPress={handleSaveCreateUser}
                disabled={createUserSaving}
              >
                {createUserSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Create User</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Users Filter & Sort Modal */}
      <Modal
        visible={usersFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setUsersFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter & Sort Users</Text>
              <TouchableOpacity onPress={() => setUsersFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Filter by Role</Text>
              <View>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                  onPress={() => setUsersFilterTempRole(null)}
                >
                  <Ionicons
                    name={usersFilterTempRole == null ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={usersFilterTempRole == null ? '#2e7d32' : '#666'}
                  />
                  <Text style={{ marginLeft: 8, color: '#333', fontSize: 14 }}>All roles</Text>
                </TouchableOpacity>
                {USER_ROLES.map((role) => (
                  <TouchableOpacity
                    key={`filter-role-${role}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                    onPress={() => setUsersFilterTempRole(role)}
                  >
                    <Ionicons
                      name={usersFilterTempRole === role ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={usersFilterTempRole === role ? '#2e7d32' : '#666'}
                    />
                    <Text style={{ marginLeft: 8, color: '#333', fontSize: 14 }}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Sort by</Text>
              <View>
                {[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                ].map(opt => (
                  <TouchableOpacity
                    key={`sort-key-${opt.key}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                    onPress={() => setUsersSortTempKey(opt.key)}
                  >
                    <Ionicons
                      name={usersSortTempKey === opt.key ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={usersSortTempKey === opt.key ? '#2e7d32' : '#666'}
                    />
                    <Text style={{ marginLeft: 8, color: '#333', fontSize: 14 }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Sort order</Text>
              <View>
                {[
                  { key: 'asc', label: 'Ascending (A→Z)' },
                  { key: 'desc', label: 'Descending (Z→A)' },
                ].map(opt => (
                  <TouchableOpacity
                    key={`sort-order-${opt.key}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                    onPress={() => setUsersSortTempOrder(opt.key)}
                  >
                    <Ionicons
                      name={usersSortTempOrder === opt.key ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={usersSortTempOrder === opt.key ? '#2e7d32' : '#666'}
                    />
                    <Text style={{ marginLeft: 8, color: '#333', fontSize: 14 }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={clearUsersFilters}
              >
                <Text style={styles.cancelButtonText}>Clear Filters</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setUsersFilterModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={applyUsersFilterSort}
              >
                <Text style={styles.saveButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default UsersSection;