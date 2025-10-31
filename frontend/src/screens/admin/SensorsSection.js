// src/components/admin/SensorsSection.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Path, Text as SvgText } from 'react-native-svg';
import styles from './SectionStyles';

const SensorsSection = ({ API_URL, getAuthToken, plantCache, setPlantCache }) => {
  const [sensors, setSensors] = useState([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);
  const [sensorsError, setSensorsError] = useState(null);
  const [sensorsPage, setSensorsPage] = useState(1);
  const SENSORS_PAGE_SIZE = 10;
  const [sensorsTotal, setSensorsTotal] = useState(0);
  const [sensorsByObservation, setSensorsByObservation] = useState({});
  const [sensorsObsList, setSensorsObsList] = useState([]);
  const [sensorsObsModalVisible, setSensorsObsModalVisible] = useState(false);
  const [selectedSensorsObservation, setSelectedSensorsObservation] = useState(null);
  const [selectedObservationSensors, setSelectedObservationSensors] = useState([]);
  const [sensorSeriesBySensor, setSensorSeriesBySensor] = useState({});
  const [sensorSeriesLoading, setSensorSeriesLoading] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  const totalSensorsPages = useMemo(() => Math.max(1, Math.ceil(sensorsTotal / SENSORS_PAGE_SIZE)), [sensorsTotal]);

  useEffect(() => {
    if (sensorsPage > totalSensorsPages) {
      setSensorsPage(totalSensorsPages);
    }
  }, [sensorsPage, totalSensorsPages]);

  useEffect(() => {
    fetchSensors();
  }, [sensorsPage]);

  const getSensorStatusColor = (status) => {
    const colors = {
      active: '#4CAF50',
      inactive: '#9E9E9E',
      maintenance: '#FF9800',
      error: '#F44336',
    };
    return colors[(status || '').toLowerCase()] || '#607D8B';
  };

  const fetchSensors = async () => {
    if (sensorsLoading) return;
    try {
      setSensorsLoading(true);
      const token = await getAuthToken();
      const params = new URLSearchParams({
        page: String(sensorsPage),
        size: String(SENSORS_PAGE_SIZE),
      });
      
      const res = await fetch(`${API_URL}/iot/sensors?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`);
      const list = Array.isArray(json.sensors) ? json.sensors : [];
      const mapped = list.map(s => ({
        sensorId: s.sensorId ?? s.sensor_id ?? s.id,
        name: s.name ?? s.sensor_name,
        location: s.location ?? s.location_description,
        status: s.status ?? 'active',
        lastChecked: s.lastChecked ?? s.last_checked,
        createdAt: s.createdAt ?? s.created_at,
        updatedAt: s.updatedAt ?? s.updated_at,
        observationId: s.observationId ?? s.observation_id,
      }));
      setSensors(mapped);
      setSensorsTotal(json.pagination?.total ?? json.total ?? list.length);

      // Group sensors by observation
      const grouped = {};
      for (const s of mapped) {
        const oid = s.observationId;
        if (oid != null && oid !== undefined) {
          if (!grouped[oid]) grouped[oid] = [];
          grouped[oid].push(s);
        }
      }
      setSensorsByObservation(grouped);

      const obsIds = Object.keys(grouped).map(id => Number(id)).filter(Boolean);
      if (obsIds.length > 0) {
        const obsDetails = await Promise.all(obsIds.map(async (id) => {
          try {
            const res = await fetch(`${API_URL}/observations/${id}`, {
              headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (res.ok && data?.observation) return data.observation;
            return { observation_id: id };
          } catch (e) {
            return { observation_id: id };
          }
        }));
        try { await preloadPlantNames(obsDetails); } catch {}
        setSensorsObsList(obsDetails);
      } else {
        setSensorsObsList([]);
      }

      setSensorsError(null);
    } catch (err) {
      console.error('Sensors fetch error:', err);
      setSensorsError(err.message || 'Failed to load sensors');
    } finally {
      setSensorsLoading(false);
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

  const fetchSensorReadingsForSensors = async (sensorsForObs) => {
    try {
      setSensorSeriesLoading(true);
      const token = await getAuthToken();
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        limit: String(1000),
      });
      await Promise.all(
        sensorsForObs.map(async (s) => {
          try {
            const res = await fetch(`${API_URL}/iot/sensors/${s.sensorId}/data/range?${params.toString()}`, {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });
            const json = await res.json();
            let list = Array.isArray(json?.data) ? json.data : [];
            list = list
              .map((r) => ({
                readingTime: r.readingTime,
                readingValue: typeof r.readingValue === 'number' ? r.readingValue : Number(r.readingValue),
                readingType: r.readingType,
              }))
              .filter((r) => !isNaN(new Date(r.readingTime).getTime()) && !isNaN(r.readingValue));
            list.sort((a, b) => new Date(a.readingTime) - new Date(b.readingTime));
            setSensorSeriesBySensor((prev) => ({ ...prev, [s.sensorId]: list }));
          } catch (e) {
            setSensorSeriesBySensor((prev) => ({ ...prev, [s.sensorId]: [] }));
          }
        })
      );
    } catch (err) {
      console.error('Fetch sensor readings error:', err);
    } finally {
      setSensorSeriesLoading(false);
    }
  };

  const renderSensorChart = (series) => {
    const containerPad = 12;
    const h = 120;
    const w = chartWidth > 0 ? Math.max(150, chartWidth - containerPad * 2) : 300;
    const pad = 20;
    if (!series || series.length === 0) {
      return <Text style={styles.obsMetaText}>No readings</Text>;
    }
    const values = series.map((p) => p.readingValue);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const rangeV = Math.max(1e-6, maxV - minV);
    const times = series.map((p) => new Date(p.readingTime).getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const rangeT = Math.max(1, maxT - minT);
    const coords = series.map((p) => {
      const t = new Date(p.readingTime).getTime();
      const x = pad + ((t - minT) / rangeT) * (w - pad * 2);
      const y = pad + (h - pad * 2) * (1 - (p.readingValue - minV) / rangeV);
      return { x, y };
    });
    const points = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const typeLabel = series[0]?.readingType ? String(series[0].readingType) : '';
    // Build a smooth cubic Bezier path across points
    const buildSmoothPath = (pts) => {
      if (!pts || pts.length === 0) return '';
      if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
      const d = [`M ${pts[0].x} ${pts[0].y}`];
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const dx = (p1.x - p0.x) / 3;
        const c1x = p0.x + dx;
        const c1y = p0.y;
        const c2x = p1.x - dx;
        const c2y = p1.y;
        d.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p1.x} ${p1.y}`);
      }
      return d.join(' ');
    };
    const smoothPath = buildSmoothPath(coords);
    // Axis tick formatting and positions
    const formatHHmm = (t) => {
      const d = new Date(t);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    };
    const yTickValues = [minV, minV + rangeV / 2, maxV];
    const yTickPositions = yTickValues.map((v) => pad + (h - pad * 2) * (1 - (v - minV) / rangeV));
    const xTickTimes = [minT, minT + rangeT / 2, maxT];
    const xTickPositions = xTickTimes.map((t) => pad + ((t - minT) / rangeT) * (w - pad * 2));
    const latest = series.slice(-5).reverse();
    return (
      <View style={styles.chartContainer} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
        <Text style={styles.chartTitle}>Last 24h{typeLabel ? ` • ${typeLabel}` : ''}</Text>
        <Svg width={w} height={h} style={styles.chartSvg}>
          <Line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#ddd" strokeWidth={1} />
          <Line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#ddd" strokeWidth={1} />
          {yTickPositions.map((yPos, idx) => (
            <SvgText
              key={`y-label-${idx}`}
              x={pad - 6}
              y={yPos}
              fontSize={10}
              fill="#888"
              textAnchor="end"
            >
              {Number.isFinite(yTickValues[idx]) ? yTickValues[idx].toFixed(2) : ''}
            </SvgText>
          ))}
          {xTickPositions.map((xPos, idx) => (
            <SvgText
              key={`x-label-${idx}`}
              x={xPos}
              y={h - pad + 12}
              fontSize={10}
              fill="#888"
              textAnchor="middle"
            >
              {formatHHmm(xTickTimes[idx])}
            </SvgText>
          ))}
          <Path d={smoothPath} fill="none" stroke="#2e7d32" strokeWidth={2} />
          {coords.map((c, idx) => (
            <Circle key={idx} cx={c.x} cy={c.y} r={2} fill="#2e7d32" />
          ))}
        </Svg>
        <Text style={styles.obsMetaText}>Min {minV} • Max {maxV}</Text>
        {latest && latest.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.obsMetaText}>Latest readings:</Text>
            {latest.map((r, i) => (
              <View key={`latest-${i}`} style={styles.obsMetaRow}>
                <Text style={styles.obsMetaText}>{formatHHmm(new Date(r.readingTime).getTime())}</Text>
                <Text style={styles.obsMetaText}> • {Number.isFinite(r.readingValue) ? r.readingValue.toFixed(2) : r.readingValue}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const openObservationSensorsModal = async (obs) => {
    const oid = obs?.observation_id ?? obs?.id;
    setSelectedSensorsObservation(obs);
    const sensorsForObs = sensorsByObservation[oid] || [];
    setSelectedObservationSensors(sensorsForObs);
    setSensorsObsModalVisible(true);
    await fetchSensorReadingsForSensors(sensorsForObs);
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

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Observations with Sensors</Text>
      </View>

      {sensorsLoading ? (
        <View style={styles.placeholderBox}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 12, color: '#666' }}>Loading observations...</Text>
        </View>
      ) : sensorsError ? (
        <View style={styles.placeholderBox}>
          <Ionicons name="warning-outline" size={32} color="#F44336" />
          <Text style={{ marginTop: 8, color: '#F44336' }}>{String(sensorsError)}</Text>
          <TouchableOpacity
            style={[styles.viewDetailsButton, { marginTop: 12 }]}
            onPress={fetchSensors}
          >
            <Text style={styles.viewDetailsText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.contentScroll}>
          {sensorsObsList.map(obs => {
            const oid = obs.observation_id;
            const sensorsForObs = sensorsByObservation[oid] || [];
            const pname = plantCache[obs.plant_id]?.common_name || `Plant #${obs.plant_id}`;
            return (
              <View key={oid} style={styles.plantCard}>
                <View style={styles.plantHeader}>
                  <Text style={styles.plantName}>{pname}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(obs.status) }]}> 
                    <Text style={styles.statusText}>{(obs.status || 'unknown').toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.scientificName}>{plantCache[obs.plant_id]?.scientific_name || ''}</Text>
                <Text style={styles.obsMetaText}>Observation ID: {oid}</Text>
                <Text style={styles.obsMetaText}>Sensors attached: {sensorsForObs.length}</Text>
                <View style={styles.modelActions}>
                  <TouchableOpacity 
                    style={styles.viewDetailsButton}
                    onPress={() => openObservationSensorsModal(obs)}
                  >
                    <Text style={styles.viewDetailsText}>View Sensors</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {sensorsObsList.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="hardware-chip-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No observations have sensors yet</Text>
              <Text style={styles.emptyStateSubtext}>Link an IoT sensor to an observation to see it here</Text>
            </View>
          )}

          {sensorsObsList.length > 0 && (
            <View style={styles.paginationBar}>
              <TouchableOpacity
                style={[styles.pageButton, sensorsPage <= 1 && styles.disabledButton]}
                onPress={() => sensorsPage > 1 && setSensorsPage(sensorsPage - 1)}
                disabled={sensorsPage <= 1}
              >
                <Ionicons name="chevron-back" size={18} color={sensorsPage <= 1 ? '#fff' : '#2e7d32'} />
                <Text style={[styles.pageButtonText, sensorsPage <= 1 && styles.pageButtonTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              <Text style={styles.pageIndicator}>Page {sensorsPage} of {totalSensorsPages}</Text>
              <TouchableOpacity
                style={[styles.pageButton, sensorsPage >= totalSensorsPages && styles.disabledButton]}
                onPress={() => sensorsPage < totalSensorsPages && setSensorsPage(sensorsPage + 1)}
                disabled={sensorsPage >= totalSensorsPages}
              >
                <Text style={[styles.pageButtonText, sensorsPage >= totalSensorsPages && styles.pageButtonTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={18} color={sensorsPage >= totalSensorsPages ? '#fff' : '#2e7d32'} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Observation Sensors Modal */}
      <Modal
        visible={sensorsObsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSensorsObsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sensors for Observation</Text>
              <TouchableOpacity onPress={() => setSensorsObsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBodyScroll} contentContainerStyle={styles.modalBody} nestedScrollEnabled showsVerticalScrollIndicator={true}>
              {selectedSensorsObservation ? (
                <>
                  <Text style={styles.inputLabel}>
                    {(plantCache[selectedSensorsObservation.plant_id]?.common_name) || `Plant #${selectedSensorsObservation.plant_id}`}
                  </Text>
                  <Text style={styles.scientificName}>
                    {plantCache[selectedSensorsObservation.plant_id]?.scientific_name || ''}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedSensorsObservation.status) }]}> 
                    <Text style={styles.statusText}>{(selectedSensorsObservation.status || 'unknown').toUpperCase()}</Text>
                  </View>

                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={18} color="#2E7D32" />
                    <Text style={styles.infoText}>
                      Below are all IoT sensors linked to this observation.
                    </Text>
                  </View>

                  {selectedObservationSensors.map(sensor => (
                    <View key={sensor.sensorId} style={styles.plantCard}>
                      <View style={styles.plantHeader}>
                        <Text style={styles.plantName}>{sensor.name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: getSensorStatusColor(sensor.status) }]}>
                          <Text style={styles.statusText}>{(sensor.status || 'unknown').toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={styles.scientificName}>Location: {sensor.location || 'N/A'}</Text>
                      {sensor.lastChecked && (
                        <Text style={styles.scientificName}>Last Checked: {new Date(sensor.lastChecked).toLocaleString()}</Text>
                      )}
                      <Text style={styles.obsMetaText}>Sensor ID: {sensor.sensorId}</Text>
                      {sensorSeriesLoading ? (
                        <View style={styles.placeholderBox}>
                          <ActivityIndicator size="small" color="#2e7d32" />
                          <Text style={{ marginTop: 8, color: '#666' }}>Loading readings...</Text>
                        </View>
                      ) : (
                        renderSensorChart(sensorSeriesBySensor[sensor.sensorId])
                      )}
                    </View>
                  ))}

                  {selectedObservationSensors.length === 0 && (
                    <View style={styles.emptyState}>
                      <Ionicons name="hardware-chip-outline" size={48} color="#ccc" />
                      <Text style={styles.emptyStateText}>No sensors linked</Text>
                      <Text style={styles.emptyStateSubtext}>This observation does not have any sensors</Text>
                    </View>
                  )}
                </>
              ) : null}
            </ScrollView>

          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SensorsSection;