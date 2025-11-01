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
  const [deleteUserModalVisible, setDeleteUserModalVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  const USER_ROLES = [
    { key: '', label: 'All Roles' },
    { key: 'public', label: 'Public' },
    { key: 'expert', label: 'Expert' },
    { key: 'admin', label: 'Admin' },
  ];

  const SORT_OPTIONS = [
    { key: 'username', label: 'Username' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'created_at', label: 'Date Created' },
  ];

  // Role color mapping for better visual distinction
  const ROLE_COLORS = {
    admin: '#d32f2f',    // Red
    expert: '#1976d2',   // Blue
    public: '#388e3c',   // Green
  };

  const ROLE_ICONS = {
    admin: 'shield',
    expert: 'school',
    public: 'person',
  };

  const totalUsersPages = useMemo(() => Math.max(1, Math.ceil(usersTotal / USERS_PAGE_SIZE)), [usersTotal]);

  useEffect(() => {
    if (usersPage > totalUsersPages) {
      setUsersPage(totalUsersPages);
    }
  }, [usersPage, totalUsersPages]);

  useEffect(() => {
    fetchUsers();
  }, [usersPage, searchQuery, roleFilter, sortBy, sortOrder]);

  const fetchUsers = async () => {
    if (usersLoading) return;
    try {
      setUsersLoading(true);
      const token = await getAuthToken();
      const params = new URLSearchParams({
        page: String(usersPage),
        limit: String(USERS_PAGE_SIZE),
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter && { role: roleFilter }),
        sortBy,
        sortOrder
      });

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
      if (!['public', 'expert', 'admin'].includes(newRole)) {
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

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setDeletingUser(true);
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/admin/users/${userToDelete.user_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `Failed to delete user`);
      
      // Remove user from local state
      setUsers(prev => prev.filter(u => u.user_id !== userToDelete.user_id));
      setUsersTotal(prev => prev - 1);
      setDeleteUserModalVisible(false);
      setUserToDelete(null);
      Alert.alert('Success', `User ${userToDelete.username} deleted successfully`);
    } catch (err) {
      console.error('Delete user error:', err);
      Alert.alert('Error', err.message || 'Failed to delete user');
    } finally {
      setDeletingUser(false);
    }
  };

  const confirmDeleteUser = (user) => {
    setUserToDelete(user);
    setDeleteUserModalVisible(true);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    setUsersPage(1);
  };

  const handleFilterChange = (value) => {
    setRoleFilter(value);
    setUsersPage(1);
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setUsersPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('');
    setSortBy('created_at');
    setSortOrder('DESC');
    setUsersPage(1);
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return 'swap-vertical';
    return sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down';
  };

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
      fetchUsers();
      Alert.alert('Success', 'User created successfully');
    } catch (err) {
      console.error('Create user error:', err);
      Alert.alert('Error', err.message || 'Failed to create user');
    } finally {
      setCreateUserSaving(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.section}>
      {/* Loading Indicator */}
      {usersLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      )}

      <ScrollView style={styles.contentScroll}>
        {/* Search and Filter Section */}
        <View style={styles.filterSection}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
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
            {/* Role Filter */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Role:</Text>
              <ScrollView horizontal style={styles.filterOptions}>
                {USER_ROLES.map(option => (
                  <TouchableOpacity
                    key={`role-${option.key}`}
                    style={[
                      styles.filterOption,
                      roleFilter === option.key && styles.filterOptionActive
                    ]}
                    onPress={() => handleFilterChange(option.key)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      roleFilter === option.key && styles.filterOptionTextActive
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
          {(searchQuery || roleFilter || sortBy !== 'created_at') && (
            <TouchableOpacity style={styles.clearFiltersButtonRed} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color="#fff" />
              <Text style={styles.clearFiltersTextRed}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Users List */}
        {usersError ? (
          <View style={styles.placeholderBox}>
            <Ionicons name="alert-circle-outline" size={32} color="#F44336" />
            <Text style={{ marginTop: 8, color: '#F44336' }}>{usersError}</Text>
            <TouchableOpacity
              style={[styles.viewDetailsButton, { marginTop: 12 }]}
              onPress={fetchUsers}
            >
              <Text style={styles.viewDetailsText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {users.map(item => (
              <View key={item.user_id} style={styles.userCard}>
                {/* Header with user info and actions */}
                <View style={styles.userCardHeader}>
                  <View style={styles.userInfo}>
                    <View style={styles.userAvatar}>
                      <Ionicons 
                        name={ROLE_ICONS[item.role] || 'person'} 
                        size={24} 
                        color="#fff" 
                      />
                    </View>
                    <View style={styles.userDetails}>
                      <Text style={styles.userName}>{item.username}</Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                    </View>
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => confirmDeleteUser(item)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ffffffff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* User metadata */}
                <View style={styles.userMeta}>
                  <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] }]}>
                    <Ionicons 
                      name={ROLE_ICONS[item.role] || 'person'} 
                      size={12} 
                      color="#fff" 
                    />
                    <Text style={styles.roleText}>{item.role}</Text>
                  </View>
                  <View style={styles.dateContainer}>
                    <Ionicons name="calendar-outline" size={12} color="#666" />
                    <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                  </View>
                </View>

                {/* Quick role actions */}
                <View style={styles.roleActions}>
                  <Text style={styles.roleActionsLabel}>Change Role:</Text>
                  <View style={styles.roleButtons}>
                    {['public', 'expert', 'admin'].map((role) => {
                      const active = (item.role || 'public') === role;
                      return (
                        <TouchableOpacity
                          key={role}
                          style={[
                            styles.roleButton,
                            active && styles.roleButtonActive,
                            { borderColor: ROLE_COLORS[role] }
                          ]}
                          onPress={() => handleUpdateUserRole(item, role)}
                          disabled={usersLoading || active}
                        >
                          <Ionicons
                            name={active ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={active ? ROLE_COLORS[role] : '#666'}
                          />
                          <Text style={[
                            styles.roleButtonText,
                            active && { color: ROLE_COLORS[role] }
                          ]}>
                            {role}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            ))}
            
            {users.length === 0 && !usersLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No users found</Text>
                <Text style={styles.emptyStateSubtext}>
                  {searchQuery || roleFilter
                    ? 'Try adjusting your search or filters' 
                    : 'Create a new user to get started'
                  }
                </Text>
              </View>
            )}

            {users.length > 0 && (
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  style={[styles.pageArrowButton, usersPage <= 1 && styles.disabledButton]}
                  onPress={() => usersPage > 1 && setUsersPage(usersPage - 1)}
                  disabled={usersPage <= 1}
                >
                  <Ionicons name="chevron-back" size={20} color={usersPage <= 1 ? '#ccc' : '#2e7d32'} />
                </TouchableOpacity>
                
                <Text style={styles.pageIndicator}>Page {usersPage} of {totalUsersPages}</Text>
                
                <TouchableOpacity
                  style={[styles.pageArrowButton, usersPage >= totalUsersPages && styles.disabledButton]}
                  onPress={() => usersPage < totalUsersPages && setUsersPage(usersPage + 1)}
                  disabled={usersPage >= totalUsersPages}
                >
                  <Ionicons name="chevron-forward" size={20} color={usersPage >= totalUsersPages ? '#ccc' : '#2e7d32'} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Floating Action Button for Create User */}
      <TouchableOpacity 
        style={styles.floatingActionButton}
        onPress={openCreateUser}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

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
                {['public', 'expert', 'admin'].map((role) => (
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

      {/* Delete User Confirmation Modal */}
      <Modal
        visible={deleteUserModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete User</Text>
              <TouchableOpacity onPress={() => setDeleteUserModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={32} color="#dc3545" />
                <Text style={styles.warningText}>
                  Are you sure you want to delete user "{userToDelete?.username}"?
                </Text>
                <Text style={styles.warningSubtext}>
                  This action cannot be undone. All data associated with this user will be permanently removed.
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setDeleteUserModalVisible(false)}
                disabled={deletingUser}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteButtonModal, deletingUser && styles.disabledButton]}
                onPress={handleDeleteUser}
                disabled={deletingUser}
              >
                {deletingUser ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="white" />
                    <Text style={styles.deleteButtonText}>Delete User</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default UsersSection;