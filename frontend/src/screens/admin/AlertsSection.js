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
  const [alertsFilterModalVisible, setAlertsFilterModalVisible] = useState(false);
  const [alertsFilterSeverity, setAlertsFilterSeverity] = useState(null);
  const [alertsFilterType, setAlertsFilterType] = useState(null);
  const [alertsSortKey, setAlertsSortKey] = useState('timestamp');
  const [alertsSortOrder, setAlertsSortOrder] = useState('desc');
  const [alertsFilterTempSeverity, setAlertsFilterTempSeverity] = useState(null);
  const [alertsFilterTempType, setAlertsFilterTempType] = useState(null);
  const [alertsSortTempKey, setAlertsSortTempKey] = useState('timestamp');
  const [alertsSortTempOrder, setAlertsSortTempOrder] = useState('desc');
  const [alertDetailVisible, setAlertDetailVisible] = useState(false);
  const [alertDetail, setAlertDetail] = useState(null);
  const [alertResolving, setAlertResolving] = useState(false);

  const totalAlertsPages = useMemo(() => Math.max(1, Math.ceil(alertsTotal / ALERTS_PAGE_SIZE)), [alertsTotal]);

  const alertTypes = useMemo(() => {
    try {
      return Array.from(new Set((alerts || []).map(a => a.type))).filter(Boolean);
    } catch {
      return [];
    }
  }, [alerts]);

  useEffect(() => {
    if (alertsPage > totalAlertsPages) {
      setAlertsPage(totalAlertsPages);
    }
  }, [alertsPage, totalAlertsPages]);

  useEffect(() => {
    fetchAlerts();
  }, [alertsPage, alertsFilterSeverity, alertsFilterType, alertsSortKey, alertsSortOrder]);

  const fetchAlerts = async () => {
    if (alertsLoading) return;
    try {
      setAlertsLoading(true);
      setAlertsError(null);
      const token = await getAuthToken();
      const params = new URLSearchParams({
        page: String(alertsPage),
        size: String(ALERTS_PAGE_SIZE),
      });
      
      // Add filter and sort parameters
      if (alertsFilterSeverity) {
        params.append('severity', alertsFilterSeverity);
      }
      if (alertsFilterType) {
        params.append('type', alertsFilterType);
      }
      if (alertsSortKey) {
        params.append('sort', alertsSortKey);
        params.append('order', alertsSortOrder);
      }

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
        id: a.alertId || a.alert_id || String(a.id || ''),
        type: a.alertType || 'Alert',
        severity: String(a.severity || 'low').toLowerCase(),
        sensor: a.sensorName || (a.sensorId ? `Sensor ${a.sensorId}` : 'Unknown sensor'),
        observation: a.sensorLocation || '',
        message: a.description || a.message || '',
        score: typeof a.score === 'number' ? a.score : (a.score ? Number(a.score) : 0),
        timestamp: a.createdAt || a.created_at || '',
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

  const openAlertsFilterModal = () => {
    setAlertsFilterTempSeverity(alertsFilterSeverity);
    setAlertsFilterTempType(alertsFilterType);
    setAlertsSortTempKey(alertsSortKey);
    setAlertsSortTempOrder(alertsSortOrder);
    setAlertsFilterModalVisible(true);
  };

  const applyAlertsFilterSort = () => {
    setAlertsFilterSeverity(alertsFilterTempSeverity ?? null);
    setAlertsFilterType(alertsFilterTempType ?? null);
    setAlertsSortKey(alertsSortTempKey || 'timestamp');
    setAlertsSortOrder(alertsSortTempOrder || 'desc');
    setAlertsFilterModalVisible(false);
    setAlertsPage(1); // Reset to first page when filters change
  };

  const clearAlertsFilters = () => {
    setAlertsFilterTempSeverity(null);
    setAlertsFilterTempType(null);
    setAlertsSortTempKey('timestamp');
    setAlertsSortTempOrder('desc');
    setAlertsFilterSeverity(null);
    setAlertsFilterType(null);
    setAlertsSortKey('timestamp');
    setAlertsSortOrder('desc');
    setAlertsPage(1);
  };

  const alertsDisplay = useMemo(() => {
    let arr = [...(alerts || [])];

    // Sort
    const sevRank = { low: 0, medium: 1, high: 2, critical: 3 };
    arr.sort((a, b) => {
      let av, bv;
      switch (alertsSortKey) {
        case 'severity':
          av = sevRank[(a.severity || '').toLowerCase()] ?? -1;
          bv = sevRank[(b.severity || '').toLowerCase()] ?? -1;
          break;
        case 'score':
          av = Number(a.score ?? 0);
          bv = Number(b.score ?? 0);
          break;
        case 'timestamp':
        default:
          av = new Date(a.timestamp || 0).getTime();
          bv = new Date(b.timestamp || 0).getTime();
      }
      if (av < bv) return alertsSortOrder === 'asc' ? -1 : 1;
      if (av > bv) return alertsSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return arr;
  }, [alerts, alertsSortKey, alertsSortOrder]);

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#4CAF50',
      medium: '#FFC107',
      high: '#FF9800',
      critical: '#F44336'
    };
    return colors[severity] || '#666';
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>System Alerts</Text>
        <View style={styles.filterRow}>
          {alertsFilterSeverity && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Severity: {alertsFilterSeverity}</Text>
              <TouchableOpacity onPress={() => setAlertsFilterSeverity(null)}>
                <Ionicons name="close-circle" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          )}
          {alertsFilterType && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Type: {alertsFilterType}</Text>
              <TouchableOpacity onPress={() => setAlertsFilterType(null)}>
                <Ionicons name="close-circle" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.filterButton} onPress={openAlertsFilterModal}>
            <Ionicons name="options-outline" size={16} color="#666" />
            <Text style={styles.filterText}>Filter & Sort</Text>
          </TouchableOpacity>
        </View>
      </View>

      {alertsLoading ? (
        <View style={styles.placeholderBox}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 12, color: '#666' }}>Loading alerts...</Text>
        </View>
      ) : alertsError ? (
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
        <ScrollView style={styles.contentScroll}>
          {alertsDisplay.map(alert => (
            <TouchableOpacity key={alert.id} style={styles.alertCard} activeOpacity={0.85} onPress={() => { setAlertDetail(alert); setAlertDetailVisible(true); }}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertTitle}>{alert.type}</Text>
                <View style={[
                  styles.severityBadge,
                  { backgroundColor: getSeverityColor(alert.severity) }
                ]}>
                  <Text style={styles.severityText}>
                    {String(alert.severity || '').charAt(0).toUpperCase() + String(alert.severity || '').slice(1)}
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
            </TouchableOpacity>
          ))}
          
          {/* Empty state */}
          {alertsDisplay.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No active alerts</Text>
              <Text style={styles.emptyStateSubtext}>All systems are running normally</Text>
            </View>
          )}

          {alertsDisplay.length > 0 && (
            <View style={styles.paginationBar}>
              <TouchableOpacity
                style={[styles.pageButton, alertsPage <= 1 && styles.disabledButton]}
                onPress={() => alertsPage > 1 && setAlertsPage(alertsPage - 1)}
                disabled={alertsPage <= 1}
              >
                <Ionicons name="chevron-back" size={18} color={alertsPage <= 1 ? '#fff' : '#2e7d32'} />
                <Text style={[styles.pageButtonText, alertsPage <= 1 && styles.pageButtonTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              <Text style={styles.pageIndicator}>Page {alertsPage} of {totalAlertsPages}</Text>
              <TouchableOpacity
                style={[styles.pageButton, alertsPage >= totalAlertsPages && styles.disabledButton]}
                onPress={() => alertsPage < totalAlertsPages && setAlertsPage(alertsPage + 1)}
                disabled={alertsPage >= totalAlertsPages}
              >
                <Text style={[styles.pageButtonText, alertsPage >= totalAlertsPages && styles.pageButtonTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={18} color={alertsPage >= totalAlertsPages ? '#fff' : '#2e7d32'} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

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
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertTitle}>{alertDetail.type}</Text>
                    <View style={[
                      styles.severityBadge,
                      { backgroundColor: getSeverityColor(alertDetail.severity) }
                    ]}>
                      <Text style={styles.severityText}>
                        {alertDetail.severity ? alertDetail.severity.charAt(0).toUpperCase() + alertDetail.severity.slice(1) : 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  {/* Resolved status */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name={alertDetail.resolved === 1 ? 'checkmark-circle-outline' : 'close-circle-outline'} size={16} color={alertDetail.resolved === 1 ? '#2E7D32' : '#F44336'} />
                    <Text style={[styles.obsMetaText, { marginLeft: 6, color: alertDetail.resolved === 1 ? '#2E7D32' : '#F44336' }]}>
                      {alertDetail.resolved === 1 ? 'resolved' : 'unresolved'}
                    </Text>
                  </View>

                  {/* Toggle resolved/unresolved */}
                  <Text style={[styles.inputLabel, { marginTop: 4 }]}>Status</Text>
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
                      <Text style={styles.statusOptionText}>resolved</Text>
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
                      <Text style={styles.statusOptionText}>unresolved</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="construct-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>Type: {alertDetail.type || '—'}</Text>
                    </View>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="hardware-chip-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>Sensor: {alertDetail.sensor || '—'}</Text>
                    </View>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="alert-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>Message: {alertDetail.message || '—'}</Text>
                    </View>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="speedometer-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>Score: {alertDetail.score != null ? String(alertDetail.score) : '—'}</Text>
                    </View>
                    <View style={styles.obsMetaRow}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.obsMetaText}>Time: {alertDetail.timestamp || '—'}</Text>
                    </View>
                    {alertDetail.observation ? (
                      <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={16} color="#2E7D32" />
                        <Text style={styles.infoText}>
                          Observation: {alertDetail.observation}
                        </Text>
                      </View>
                    ) : null}
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

      {/* Alerts Filter & Sort Modal */}
      <Modal
        visible={alertsFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAlertsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alerts Filter & Sort</Text>
              <TouchableOpacity onPress={() => setAlertsFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll}>
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Filter by severity</Text>
                <View>
                  {[
                    { key: 'all', label: 'All severities', value: null },
                    { key: 'low', label: 'Low', value: 'low' },
                    { key: 'medium', label: 'Medium', value: 'medium' },
                    { key: 'high', label: 'High', value: 'high' },
                    { key: 'critical', label: 'Critical', value: 'critical' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={`alerts-severity-${opt.key}`}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => setAlertsFilterTempSeverity(opt.value)}
                    >
                      <Ionicons
                        name={alertsFilterTempSeverity === opt.value ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={alertsFilterTempSeverity === opt.value ? '#2e7d32' : '#666'}
                      />
                      <Text style={{ marginLeft: 8, color: '#333', fontSize: 14 }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Filter by type</Text>
                <View>
                  {[
                    { key: 'all', label: 'All types', value: null },
                    ...alertTypes.map(t => ({ key: `type-${t}`, label: t, value: t }))
                  ].map(opt => (
                    <TouchableOpacity
                      key={`alerts-type-${opt.key}`}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => setAlertsFilterTempType(opt.value)}
                    >
                      <Ionicons
                        name={alertsFilterTempType === opt.value ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={alertsFilterTempType === opt.value ? '#2e7d32' : '#666'}
                      />
                      <Text style={{ marginLeft: 8, color: '#333', fontSize: 14 }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Sort by</Text>
                <View>
                  {[
                    { key: 'timestamp', label: 'Timestamp (latest first)' },
                    { key: 'severity', label: 'Severity' },
                    { key: 'score', label: 'Score' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={`alerts-sort-key-${opt.key}`}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => setAlertsSortTempKey(opt.key)}
                    >
                      <Ionicons
                        name={alertsSortTempKey === opt.key ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={alertsSortTempKey === opt.key ? '#2e7d32' : '#666'}
                      />
                      <Text style={{ marginLeft: 8, color: '#333', fontSize: 14 }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Sort order</Text>
                <View>
                  {[
                    { key: 'asc', label: 'Ascending (low→high)' },
                    { key: 'desc', label: 'Descending (high→low)' },
                  ].map(opt => (
                    <TouchableOpacity
                      key={`alerts-sort-order-${opt.key}`}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => setAlertsSortTempOrder(opt.key)}
                    >
                      <Ionicons
                        name={alertsSortTempOrder === opt.key ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={alertsSortTempOrder === opt.key ? '#2e7d32' : '#666'}
                      />
                      <Text style={{ marginLeft: 8, color: '#333', fontSize: 14 }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={clearAlertsFilters}
              >
                <Text style={styles.cancelButtonText}>Clear Filters</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setAlertsFilterModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={applyAlertsFilterSort}
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

export default AlertsSection;