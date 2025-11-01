// src/components/admin/ObservationsSection.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import styles from './SectionStyles';

const ObservationsSection = ({ API_URL, getAuthToken, plantCache, setPlantCache }) => {
  const [observations, setObservations] = useState([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsError, setObsError] = useState(null);
  const [obsPage, setObsPage] = useState(1);
  const OBS_PAGE_SIZE = 10;
  const [obsTotal, setObsTotal] = useState(0);
  
  // Filter and search states - UPDATED: removed conservation filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [publicFilter, setPublicFilter] = useState('');
  const [sortBy, setSortBy] = useState('po.created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  const [obsDetailVisible, setObsDetailVisible] = useState(false);
  const [obsDetail, setObsDetail] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [pubSaving, setPubSaving] = useState(false);

  const totalObsPages = useMemo(() => Math.max(1, Math.ceil(obsTotal / OBS_PAGE_SIZE)), [obsTotal]);

  const statusOptions = [
    { key: '', label: 'All Status' },
    { key: 'pending', label: 'Pending' },
    { key: 'verified', label: 'Verified' },
    { key: 'unsure', label: 'Unsure' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const PUBLIC_OPTIONS = [
    { key: '', label: 'All Visibility' },
    { key: 'public', label: 'Public' },
    { key: 'private', label: 'Private' },
  ];

  // UPDATED: Simplified sort options to only include required fields
  const SORT_OPTIONS = [
    { key: 'po.created_at', label: 'Date Added' },
    { key: 'po.observation_date', label: 'Obs Date' },
    { key: 'p.common_name', label: 'Plant Name' },
    { key: 'po.confidence_score', label: 'Confidence' },
  ];

  useEffect(() => {
    if (obsPage > totalObsPages) {
      setObsPage(totalObsPages);
    }
  }, [obsPage, totalObsPages]);

  useEffect(() => {
    fetchObservations();
  }, [obsPage, searchQuery, statusFilter, publicFilter, sortBy, sortOrder]); // UPDATED: removed conservationFilter

  const fetchObservations = async () => {
    if (obsLoading) return;
    try {
      setObsLoading(true);
      const params = new URLSearchParams({
        page: String(obsPage),
        size: String(OBS_PAGE_SIZE),
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter && { status: statusFilter }),
        ...(publicFilter && { public: publicFilter }),
        sortBy,
        sortOrder
      });

      const res = await fetch(`${API_URL}/observations?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch observations');

      const list = Array.isArray(data.observations) ? data.observations : [];
      setObservations(list);
      setObsTotal(data?.total || list.length);
      await preloadPlantNames(list);
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
    if (obsDetailVisible && obsDetail?.observation_id) {
      if (obsDetail.public == null) {
        refreshObservationDetail(obsDetail.observation_id);
      }
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

  const handleSearch = (text) => {
    setSearchQuery(text);
    setObsPage(1);
  };

  const handleFilterChange = (filterType, value) => {
    if (filterType === 'status') {
      setStatusFilter(value);
    } else if (filterType === 'public') {
      setPublicFilter(value);
    }
    setObsPage(1);
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setObsPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPublicFilter('');
    setSortBy('po.created_at');
    setSortOrder('DESC');
    setObsPage(1);
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return 'swap-vertical';
    return sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down';
  };

  return (
    <View style={styles.section}>
      {/* Loading Indicator */}
      {obsLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading observations...</Text>
        </View>
      )}

      <ScrollView style={styles.contentScroll}>
        {/* Search and Filter Section - UPDATED: Labels on same line as options */}
        <View style={styles.filterSection}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search observations..."
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Rows - UPDATED: Labels inline with options */}
          <View style={styles.filterRowsContainer}>
            {/* Status Filter Row */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Status:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.filterOptions}
                contentContainerStyle={styles.filterOptionsContent}
              >
                {statusOptions.map(option => (
                  <TouchableOpacity
                    key={`status-${option.key}`}
                    style={[
                      styles.filterOption,
                      statusFilter === option.key && styles.filterOptionActive
                    ]}
                    onPress={() => handleFilterChange('status', option.key)}
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

            {/* Visibility Filter Row */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Visibility:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.filterOptions}
                contentContainerStyle={styles.filterOptionsContent}
              >
                {PUBLIC_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={`public-${option.key}`}
                    style={[
                      styles.filterOption,
                      publicFilter === option.key && styles.filterOptionActive
                    ]}
                    onPress={() => handleFilterChange('public', option.key)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      publicFilter === option.key && styles.filterOptionTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

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
          {(searchQuery || statusFilter || publicFilter || sortBy !== 'po.created_at') && (
            <TouchableOpacity style={styles.clearFiltersButtonRed} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color="#fff" />
              <Text style={styles.clearFiltersTextRed}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Observations List */}
        {obsError ? (
          <View style={styles.placeholderBox}>
            <Ionicons name="alert-circle-outline" size={32} color="#F44336" />
            <Text style={{ marginTop: 8, color: '#F44336' }}>{String(obsError)}</Text>
            <TouchableOpacity
              style={[styles.viewDetailsButton, { marginTop: 12 }]}
              onPress={fetchObservations}
            >
              <Text style={styles.viewDetailsText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {observations.map(item => {
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
                <TouchableOpacity key={item.observation_id} style={styles.plantCard} activeOpacity={0.85}
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
            })}
            
            {observations.length === 0 && !obsLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="eye-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No observations found</Text>
                <Text style={styles.emptyStateSubtext}>
                  {searchQuery || statusFilter || publicFilter
                    ? 'Try adjusting your search or filters' 
                    : 'No observations available'
                  }
                </Text>
              </View>
            )}

            {observations.length > 0 && (
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  style={[styles.pageArrowButton, obsPage <= 1 && styles.disabledButton]}
                  onPress={() => obsPage > 1 && setObsPage(obsPage - 1)}
                  disabled={obsPage <= 1}
                >
                  <Ionicons name="chevron-back" size={20} color={obsPage <= 1 ? '#ccc' : '#2e7d32'} />
                </TouchableOpacity>
                
                <Text style={styles.pageIndicator}>Page {obsPage} of {totalObsPages}</Text>
                
                <TouchableOpacity
                  style={[styles.pageArrowButton, obsPage >= totalObsPages && styles.disabledButton]}
                  onPress={() => obsPage < totalObsPages && setObsPage(obsPage + 1)}
                  disabled={obsPage >= totalObsPages}
                >
                  <Ionicons name="chevron-forward" size={20} color={obsPage >= totalObsPages ? '#ccc' : '#2e7d32'} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

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
    </View>
  );
};

export default ObservationsSection;