// src/components/admin/AlertsSection.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './SectionStyles';

const AlertsSection = ({ API_URL, getAuthToken }) => {
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState(null);
  const [alertsPage, setAlertsPage] = useState(1);
  const ALERTS_PAGE_SIZE = 10;
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [alertDetailVisible, setAlertDetailVisible] = useState(false);
  const [alertDetail, setAlertDetail] = useState(null);
  const [alertResolving, setAlertResolving] = useState(false);
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('DESC');

  const SEVERITY_OPTIONS = [
    { key: '', label: 'All Severities' },
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Medium' },
    { key: 'high', label: 'High' },
    { key: 'critical', label: 'Critical' },
  ];

  const ALERT_TYPE_OPTIONS = [
    { key: '', label: 'All Types' },
    { key: 'abnormal_sensor', label: 'Abnormal Sensor' },
    { key: 'poaching_alert', label: 'Poaching Alert' },
    // Removed 'system_alert' from filter options
  ];

  const RESOLVED_OPTIONS = [
    { key: '', label: 'All Status' },
    { key: 'false', label: 'Active' },
    { key: 'true', label: 'Resolved' },
  ];

  const SORT_OPTIONS = [
    { key: 'timestamp', label: 'Date' },
    { key: 'severity', label: 'Severity' },
    { key: 'type', label: 'Type' },
    { key: 'score', label: 'Score' },
  ];

  const totalAlertsPages = useMemo(() => Math.max(1, Math.ceil(alertsTotal / ALERTS_PAGE_SIZE)), [alertsTotal]);

  // Function to format alert type for display
  const formatAlertType = (type) => {
    switch (type) {
      case 'abnormal_sensor':
        return 'Abnormal Sensor';
      case 'poaching_alert':
        return 'Poaching Alert';
      case 'system_alert':
        return 'System Alert';
      default:
        return type || 'Alert';
    }
  };

  // Function to get icon for alert type
  const getAlertTypeIcon = (type) => {
    switch (type) {
      case 'abnormal_sensor':
        return 'warning-outline';
      case 'poaching_alert':
        return 'shield-checkmark-outline';
      case 'system_alert':
        return 'settings-outline';
      default:
        return 'alert-circle-outline';
    }
  };

  // Function to get severity icon
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'low':
        return 'checkmark-circle-outline';
      case 'medium':
        return 'alert-circle-outline';
      case 'high':
        return 'warning-outline';
      case 'critical':
        return 'skull-outline';
      default:
        return 'help-circle-outline';
    }
  };

  useEffect(() => {
    if (alertsPage > totalAlertsPages) {
      setAlertsPage(totalAlertsPages);
    }
  }, [alertsPage, totalAlertsPages]);

  useEffect(() => {
    fetchAlerts();
  }, [alertsPage, searchQuery, severityFilter, typeFilter, resolvedFilter, sortBy, sortOrder]);

  const fetchAlerts = async () => {
    if (alertsLoading) return;
    try {
      setAlertsLoading(true);
      setAlertsError(null);
      const token = await getAuthToken();
      const params = new URLSearchParams({
        page: String(alertsPage),
        size: String(ALERTS_PAGE_SIZE),
        ...(searchQuery && { search: searchQuery }),
        ...(severityFilter && { severity: severityFilter }),
        ...(typeFilter && { type: typeFilter }),
        ...(resolvedFilter && { resolved: resolvedFilter }),
        sort: sortBy,
        order: sortOrder.toLowerCase()
      });

      const res = await fetch(`${API_URL}/iot/alerts?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
      const list = Array.isArray(data.alerts) ? data.alerts : [];
      const mapped = list.map(a => ({
        id: a.alert_id || a.alertId || String(a.id || ''),
        type: a.alert_type || a.alertType || 'system_alert',
        severity: String(a.severity || 'low').toLowerCase(),
        sensorId: a.sensor_id || a.sensorId,
        sensor: a.sensorName || (a.sensor_id ? `Sensor ${a.sensor_id}` : 'Unknown sensor'),
        observation: a.sensorLocation || '',
        message: a.description || a.message || '',
        score: typeof a.score === 'number' ? a.score : (a.score ? Number(a.score) : 0),
        timestamp: a.created_at || a.createdAt || '',
        resolved: typeof a.resolved === 'boolean' ? (a.resolved ? 1 : 0) : (a.resolved != null ? Number(a.resolved) : 0),
      }));
      setAlerts(mapped);
      setAlertsTotal(data.pagination?.total || data.total || list.length);
    } catch (err) {
      console.error('Alerts fetch error:', err);
      setAlertsError(err.message || 'Failed to load alerts');
    } finally {
      setAlertsLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#4CAF50',
      medium: '#FFC107',
      high: '#FF9800',
      critical: '#F44336'
    };
    return colors[severity] || '#666';
  };

  const getSeverityBgColor = (severity) => {
    const colors = {
      low: '#E8F5E8',
      medium: '#FFF8E1',
      high: '#FFF3E0',
      critical: '#FFEBEE'
    };
    return colors[severity] || '#f8f9fa';
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    setAlertsPage(1);
  };

  const handleFilterChange = (filterType, value) => {
    if (filterType === 'severity') {
      setSeverityFilter(value);
    } else if (filterType === 'type') {
      setTypeFilter(value);
    } else if (filterType === 'resolved') {
      setResolvedFilter(value);
    }
    setAlertsPage(1);
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setAlertsPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSeverityFilter('');
    setTypeFilter('');
    setResolvedFilter('');
    setSortBy('timestamp');
    setSortOrder('DESC');
    setAlertsPage(1);
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return 'swap-vertical';
    return sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down';
  };

  // Format relative time
  const getRelativeTime = (timestamp) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - alertTime) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <View style={styles.section}>
      {/* Loading Indicator */}
      {alertsLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading alerts...</Text>
        </View>
      )}

      <ScrollView style={styles.contentScroll}>
        {/* Search and Filter Section */}
        <View style={styles.filterSection}>
          {/* Search Row */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search alerts..."
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Rows Container */}
          <View style={styles.filterRowsContainer}>
            {/* Severity Filter Row */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Severity:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.filterOptions}
                contentContainerStyle={styles.filterOptionsContent}
              >
                {SEVERITY_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={`severity-${option.key}`}
                    style={[
                      styles.filterOption,
                      severityFilter === option.key && styles.filterOptionActive
                    ]}
                    onPress={() => handleFilterChange('severity', option.key)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      severityFilter === option.key && styles.filterOptionTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Type Filter Row */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Type:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.filterOptions}
                contentContainerStyle={styles.filterOptionsContent}
              >
                {ALERT_TYPE_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={`type-${option.key}`}
                    style={[
                      styles.filterOption,
                      typeFilter === option.key && styles.filterOptionActive
                    ]}
                    onPress={() => handleFilterChange('type', option.key)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      typeFilter === option.key && styles.filterOptionTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Resolved Status Filter Row */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.filterOptions}
                contentContainerStyle={styles.filterOptionsContent}
              >
                {RESOLVED_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={`resolved-${option.key}`}
                    style={[
                      styles.filterOption,
                      resolvedFilter === option.key && styles.filterOptionActive
                    ]}
                    onPress={() => handleFilterChange('resolved', option.key)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      resolvedFilter === option.key && styles.filterOptionTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Sort Row */}
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort by:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.sortOptions}
                contentContainerStyle={styles.filterOptionsContent}
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
          </View>

          {/* Clear Filters */}
          {(searchQuery || severityFilter || typeFilter || resolvedFilter || sortBy !== 'timestamp') && (
            <TouchableOpacity style={styles.clearFiltersButtonRed} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color="#fff" />
              <Text style={styles.clearFiltersTextRed}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Alerts List */}
        {alertsError ? (
          <View style={styles.placeholderBox}>
            <Ionicons name="alert-circle-outline" size={32} color="#F44336" />
            <Text style={{ marginTop: 8, color: '#F44336' }}>{String(alertsError)}</Text>
            <TouchableOpacity
              style={[styles.viewDetailsButton, { marginTop: 12 }]}
              onPress={fetchAlerts}
            >
              <Text style={styles.viewDetailsText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {alerts.map(alert => (
              <TouchableOpacity 
                key={alert.id} 
                style={[
                  styles.alertCard,
                  { 
                    borderLeftWidth: 4,
                    borderLeftColor: getSeverityColor(alert.severity),
                    backgroundColor: getSeverityBgColor(alert.severity)
                  }
                ]} 
                activeOpacity={0.85} 
                onPress={() => { setAlertDetail(alert); setAlertDetailVisible(true); }}
              >
                {/* Header with type and severity */}
                <View style={styles.alertHeader}>
                  <View style={styles.alertTitleRow}>
                    <Ionicons 
                      name={getAlertTypeIcon(alert.type)} 
                      size={20} 
                      color="#2e7d32" 
                      style={styles.alertTypeIcon}
                    />
                    <View style={styles.alertTitleContainer}>
                      <Text style={styles.alertTitle}>{formatAlertType(alert.type)}</Text>
                      <View style={styles.alertMetaRow}>
                        <Ionicons name="hardware-chip-outline" size={12} color="#666" />
                        <Text style={styles.alertMetaText}>Sensor {alert.sensor}</Text>
                        {alert.observation && (
                          <>
                            <Text style={styles.alertMetaSeparator}>•</Text>
                            <Text style={styles.alertMetaText}>{alert.observation}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.alertHeaderRight}>
                    <View style={[
                      styles.severityBadge,
                      { backgroundColor: getSeverityColor(alert.severity) }
                    ]}>
                      <Ionicons 
                        name={getSeverityIcon(alert.severity)} 
                        size={12} 
                        color="white" 
                        style={styles.severityIcon}
                      />
                      <Text style={styles.severityText}>
                        {String(alert.severity || '').charAt(0).toUpperCase() + String(alert.severity || '').slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Alert Message */}
                <View style={styles.alertMessageContainer}>
                  <Ionicons name="alert-circle-outline" size={16} color="#666" style={styles.messageIcon} />
                  <Text style={styles.alertMessage} numberOfLines={3}>
                    {alert.message}
                  </Text>
                </View>

                {/* Footer with score, time, and status */}
                <View style={styles.alertFooter}>
                  <View style={styles.alertScoreContainer}>
                    <Ionicons name="speedometer-outline" size={14} color="#666" />
                    <Text style={styles.alertScore}>Score: {alert.score}</Text>
                  </View>
                  
                  <View style={styles.alertTimeContainer}>
                    <Ionicons name="time-outline" size={12} color="#666" />
                    <Text style={styles.alertTimestamp}>{getRelativeTime(alert.timestamp)}</Text>
                  </View>

                  {alert.resolved === 1 ? (
                    <View style={styles.resolvedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#2E7D32" />
                      <Text style={styles.resolvedText}>Resolved</Text>
                    </View>
                  ) : (
                    <View style={styles.unresolvedBadge}>
                      <Ionicons name="close-circle" size={14} color="#F44336" />
                      <Text style={styles.unresolvedText}>Active</Text>
                    </View>
                  )}
                </View>

                {/* Hover effect indicator */}
                <View style={styles.viewDetailsIndicator}>
                  <Text style={styles.viewDetailsIndicatorText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={14} color="#2e7d32" />
                </View>
              </TouchableOpacity>
            ))}
            
            {alerts.length === 0 && !alertsLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No alerts found</Text>
                <Text style={styles.emptyStateSubtext}>
                  {searchQuery || severityFilter || typeFilter || resolvedFilter
                    ? 'Try adjusting your search or filters' 
                    : 'All systems are running normally'
                  }
                </Text>
              </View>
            )}

            {alerts.length > 0 && (
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  style={[styles.pageArrowButton, alertsPage <= 1 && styles.disabledButton]}
                  onPress={() => alertsPage > 1 && setAlertsPage(alertsPage - 1)}
                  disabled={alertsPage <= 1}
                >
                  <Ionicons name="chevron-back" size={20} color={alertsPage <= 1 ? '#ccc' : '#2e7d32'} />
                </TouchableOpacity>
                
                <Text style={styles.pageIndicator}>Page {alertsPage} of {totalAlertsPages}</Text>
                
                <TouchableOpacity
                  style={[styles.pageArrowButton, alertsPage >= totalAlertsPages && styles.disabledButton]}
                  onPress={() => alertsPage < totalAlertsPages && setAlertsPage(alertsPage + 1)}
                  disabled={alertsPage >= totalAlertsPages}
                >
                  <Ionicons name="chevron-forward" size={20} color={alertsPage >= totalAlertsPages ? '#ccc' : '#2e7d32'} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Alert Details Modal */}
      <Modal
        visible={alertDetailVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAlertDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alert Details</Text>
              <TouchableOpacity onPress={() => setAlertDetailVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={[styles.modalBody, styles.detailModalBody]}>
              {alertDetail ? (
                <>
                  <View style={[
                    styles.alertHeader,
                    { padding: 16, backgroundColor: getSeverityBgColor(alertDetail.severity), borderRadius: 8 }
                  ]}>
                    <View style={styles.alertTitleRow}>
                      <Ionicons 
                        name={getAlertTypeIcon(alertDetail.type)} 
                        size={24} 
                        color="#2e7d32" 
                        style={styles.alertTypeIcon}
                      />
                      <Text style={styles.alertTitle}>{formatAlertType(alertDetail.type)}</Text>
                    </View>
                    <View style={[
                      styles.severityBadge,
                      { backgroundColor: getSeverityColor(alertDetail.severity) }
                    ]}>
                      <Ionicons 
                        name={getSeverityIcon(alertDetail.severity)} 
                        size={14} 
                        color="white" 
                        style={styles.severityIcon}
                      />
                      <Text style={styles.severityText}>
                        {alertDetail.severity ? alertDetail.severity.charAt(0).toUpperCase() + alertDetail.severity.slice(1) : 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  {/* Resolved status */}
                  <View style={styles.detailStatusSection}>
                    <Text style={styles.inputLabel}>Alert Status</Text>
                    <View style={styles.statusSelectRow}>
                      <TouchableOpacity
                        style={[styles.statusOption, alertDetail.resolved === 1 && styles.statusOptionActive]}
                        disabled={alertResolving}
                        onPress={async () => {
                          if (alertDetail.resolved === 1) return;
                          try {
                            setAlertResolving(true);
                            const token = await getAuthToken();
                            const res = await fetch(`${API_URL}/iot/alerts/${alertDetail.id}/resolve`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                              },
                            });
                            const data = await res.json();
                            if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
                            setAlertDetail(prev => ({ ...prev, resolved: 1 }));
                            setAlerts(prev => prev.map(a => a.id === alertDetail.id ? { ...a, resolved: 1 } : a));
                          } catch (err) {
                            Alert.alert('Error', err.message || 'Failed to resolve alert');
                          } finally {
                            setAlertResolving(false);
                          }
                        }}
                      >
                        <View style={[styles.statusDot, { backgroundColor: '#2E7D32' }]} />
                        <Text style={styles.statusOptionText}>Resolved</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.statusOption, alertDetail.resolved === 0 && styles.statusOptionActive]}
                        disabled={alertResolving}
                        onPress={async () => {
                          if (alertDetail.resolved === 0) return;
                          try {
                            setAlertResolving(true);
                            const token = await getAuthToken();
                            const res = await fetch(`${API_URL}/iot/alerts/${alertDetail.id}/unresolve`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                              },
                            });
                            const data = await res.json();
                            if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
                            setAlertDetail(prev => ({ ...prev, resolved: 0 }));
                            setAlerts(prev => prev.map(a => a.id === alertDetail.id ? { ...a, resolved: 0 } : a));
                          } catch (err) {
                            Alert.alert('Error', err.message || 'Failed to unresolve alert');
                          } finally {
                            setAlertResolving(false);
                          }
                        }}
                      >
                        <View style={[styles.statusDot, { backgroundColor: '#F44336' }]} />
                        <Text style={styles.statusOptionText}>Unresolved</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailItem}>
                      <Ionicons name="construct-outline" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Type:</Text>
                      <Text style={styles.detailValue}>{formatAlertType(alertDetail.type) || '—'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="hardware-chip-outline" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Sensor:</Text>
                      <Text style={styles.detailValue}>{alertDetail.sensor || '—'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="speedometer-outline" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Score:</Text>
                      <Text style={styles.detailValue}>{alertDetail.score != null ? String(alertDetail.score) : '—'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Time:</Text>
                      <Text style={styles.detailValue}>
                        {alertDetail.timestamp ? new Date(alertDetail.timestamp).toLocaleString() : '—'}
                      </Text>
                    </View>
                    
                    <View style={styles.messageSection}>
                      <Ionicons name="alert-circle-outline" size={16} color="#666" />
                      <Text style={styles.detailLabel}>Message:</Text>
                      <Text style={styles.detailMessage}>{alertDetail.message || '—'}</Text>
                    </View>
                    
                    {alertDetail.observation && (
                      <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={16} color="#2E7D32" />
                        <Text style={styles.infoText}>
                          Observation: {alertDetail.observation}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.plotError}>
                  <Ionicons name="alert-circle" size={32} color="#F44336" />
                  <Text style={styles.plotErrorText}>No alert selected</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setAlertDetailVisible(false)}
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

export default AlertsSection;