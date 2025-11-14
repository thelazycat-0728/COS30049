// src/components/admin/SensorsSection.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Switch,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './SectionStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Line, Circle, Path, Text as SvgText, LinearGradient, Stop, Defs } from 'react-native-svg';

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
  const [autoRefreshSensors, setAutoRefreshSensors] = useState(false);

  // New states for grid layout and detail modal
  const [sensorDetailModalVisible, setSensorDetailModalVisible] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Chart range states - separate for grid (always 24h) and detail (user selectable)
  const [chartRange, setChartRange] = useState('24h'); // '24h' | 'week' | 'month' | 'all'
  const [rangeMenuVisible, setRangeMenuVisible] = useState(false);

  // Modal search state
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  const totalSensorsPages = useMemo(() => Math.max(1, Math.ceil(sensorsTotal / SENSORS_PAGE_SIZE)), [sensorsTotal]);

  const retrieveAccessToken = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      return token;
    } catch (err) {
      console.error('Error retrieving access token:', err);
      return null;
    }
  };

  const STATUS_OPTIONS = [
    { key: '', label: 'All Status' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
    { key: 'maintenance', label: 'Maintenance' },
  ];

  const SORT_OPTIONS = [
    { key: 'created_at', label: 'Date Added' },
    { key: 'observation_id', label: 'Observation ID' },
    { key: 'observation_name', label: 'Observation Name' },
  ];

  useEffect(() => {
    if (sensorsPage > totalSensorsPages) {
      setSensorsPage(totalSensorsPages);
    }
  }, [sensorsPage, totalSensorsPages]);

  useEffect(() => {
    fetchSensors();
  }, [sensorsPage, searchQuery, statusFilter, sortBy, sortOrder]);

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
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter && { status: statusFilter }),
        sortBy,
        sortOrder
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
          const accessToken = await retrieveAccessToken();
          const r = await fetch(`${API_URL}/map/plants/${id}`, {method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }});
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

  // Separate function for fetching grid data (always 24h)
  const fetchSensorReadingsForGrid = async (sensorsForObs) => {
    try {
      setSensorSeriesLoading(true);
      const token = await getAuthToken();
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // Always 24h for grid
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

  // Function to compute start time for different ranges
  const computeStartForRange = (range) => {
    const end = new Date();
    if (range === '24h') return new Date(end.getTime() - 24 * 60 * 60 * 1000);
    if (range === 'week') return new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (range === 'month') return new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (range === 'all') return new Date(0);
    return new Date(end.getTime() - 24 * 60 * 60 * 1000);
  };

  // Function to fetch data for detail chart with selected range
  const fetchSensorReadingsForDetail = async (sensorId, range = '24h') => {
    try {
      const token = await getAuthToken();
      const end = new Date();
      const start = computeStartForRange(range);
      const params = new URLSearchParams({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        limit: String(1000),
      });
      
      const res = await fetch(`${API_URL}/iot/sensors/${sensorId}/data/range?${params.toString()}`, {
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
      
      return list;
    } catch (e) {
      console.error(`Error fetching detail data for sensor ${sensorId}:`, e);
      return [];
    }
  };

  const rangeLabel = useMemo(() => {
    switch (chartRange) {
      case '24h': return 'Last 24h';
      case 'week': return 'Last Week';
      case 'month': return 'Last Month';
      case 'all': return 'All Time';
      default: return 'Last 24h';
    }
  }, [chartRange]);

  // Filter sensors for modal based on search query
  const getFilteredModalSensors = useMemo(() => {
    if (!modalSearchQuery.trim()) {
      return selectedObservationSensors;
    }
    
    const query = modalSearchQuery.toLowerCase().trim();
    return selectedObservationSensors.filter(sensor => 
      sensor.name?.toLowerCase().includes(query) ||
      sensor.sensorId?.toString().toLowerCase().includes(query) ||
      sensor.location?.toLowerCase().includes(query) ||
      sensor.status?.toLowerCase().includes(query)
    );
  }, [selectedObservationSensors, modalSearchQuery]);

  // Clear modal search
  const clearModalSearch = () => {
    setModalSearchQuery('');
  };

  const renderSensorChart = (series, range = '24h') => {
    const containerPad = 16;
    const h = 180; // Increased height for better visual appeal
    const w = chartWidth > 0 ? Math.max(200, chartWidth - containerPad * 2) : 320;
    const pad = 24; // Increased padding for better spacing
    
    // Modern color scheme
    const chartColors = {
      primary: '#4CAF50', // Modern green
      secondary: '#3B82F6', // Modern blue
      background: '#F8FAFC',
      grid: '#E2E8F0',
      text: '#64748B',
      textDark: '#1E293B',
      accent: '#8B5CF6' // Purple accent
    };

    // Always render the chart container with time range selector, even when no data
    return (
      <View style={styles.modernChartContainer} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
        {/* Modern Header with Gradient */}
        <View style={styles.chartHeader}>
          {/* Modern Segmented Control for Time Range */}
          <View style={styles.segmentedControl}>
            {[
              { key: '24h', label: '24H', icon: 'time' },
              { key: 'week', label: '1W', icon: 'calendar' },
              { key: 'month', label: '1M', icon: 'calendar' },
              { key: 'all', label: 'All', icon: 'infinite' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.segmentButton,
                  chartRange === opt.key && styles.segmentButtonActive
                ]}
                onPress={() => {
                  setChartRange(opt.key);
                  if (selectedSensor) {
                    fetchSensorReadingsForDetail(selectedSensor.sensorId, opt.key)
                      .then(data => {
                        setSensorSeriesBySensor(prev => ({
                          ...prev,
                          [selectedSensor.sensorId]: data
                        }));
                      });
                  }
                }}
              >
                <Ionicons 
                  name={opt.icon} 
                  size={14} 
                  color={chartRange === opt.key ? '#fff' : chartColors.text} 
                />
                <Text style={[
                  styles.segmentText,
                  chartRange === opt.key && styles.segmentTextActive
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {!series || series.length === 0 ? (
          <View style={styles.emptyChartState}>
            <Ionicons name="analytics-outline" size={48} color={chartColors.grid} />
            <Text style={styles.emptyChartTitle}>No Data Available</Text>
            <Text style={styles.emptyChartText}>
              No readings found for {rangeLabel.toLowerCase()}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.chartWrapper}>
              <Svg width={w} height={h} style={styles.chartSvg}>
                {/* Gradient Background */}
                <Path
                  d={`M ${pad} ${pad} L ${pad} ${h - pad} L ${w - pad} ${h - pad} L ${w - pad} ${pad} Z`}
                  fill={chartColors.background}
                />
                
                {/* Grid Lines */}
                {[0.25, 0.5, 0.75].map((position) => {
                  const y = pad + (h - pad * 2) * (1 - position);
                  return (
                    <Line
                      key={`grid-${position}`}
                      x1={pad}
                      y1={y}
                      x2={w - pad}
                      y2={y}
                      stroke={chartColors.grid}
                      strokeWidth={1}
                      strokeDasharray="4,4"
                    />
                  );
                })}
                
                {/* Main Axes */}
                <Line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={chartColors.grid} strokeWidth={2} />
                <Line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke={chartColors.grid} strokeWidth={2} />
                
                {/* Y-axis labels */}
                {(() => {
                  const values = series.map((p) => p.readingValue);
                  const minV = Math.min(...values);
                  const maxV = Math.max(...values);
                  const rangeV = Math.max(1e-6, maxV - minV);
                  const yTickValues = [minV, minV + rangeV / 2, maxV];
                  const yTickPositions = yTickValues.map((v) => pad + (h - pad * 2) * (1 - (v - minV) / rangeV));
                  
                  return yTickPositions.map((yPos, idx) => (
                    <SvgText
                      key={`y-label-${idx}`}
                      x={pad - 8}
                      y={yPos + 4}
                      fontSize={11}
                      fill={chartColors.text}
                      textAnchor="end"
                      fontWeight="500"
                    >
                      {Number.isFinite(yTickValues[idx]) ? yTickValues[idx].toFixed(1) : ''}
                    </SvgText>
                  ));
                })()}
                
                {/* X-axis labels */}
                {(() => {
                  const times = series.map((p) => new Date(p.readingTime).getTime());
                  const minT = Math.min(...times);
                  const maxT = Math.max(...times);
                  const rangeT = Math.max(1, maxT - minT);
                  const xTickTimes = [minT, minT + rangeT / 2, maxT];
                  const xTickPositions = xTickTimes.map((t) => pad + ((t - minT) / rangeT) * (w - pad * 2));
                  const formatTime = (t) => {
                    const d = new Date(t);
                    if (range === '24h') {
                      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else if (range === 'week' || range === 'month') {
                      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    } else {
                      return d.toLocaleDateString([], { month: 'short', year: 'numeric' });
                    }
                  };
                  
                  return xTickPositions.map((xPos, idx) => (
                    <SvgText
                      key={`x-label-${idx}`}
                      x={xPos}
                      y={h - pad + 16}
                      fontSize={11}
                      fill={chartColors.text}
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {formatTime(xTickTimes[idx])}
                    </SvgText>
                  ));
                })()}
                
                {/* Chart line and points with gradient effect */}
                {(() => {
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
                  
                  // Build smooth path
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
                  
                  // Area under the curve for gradient effect
                  const areaPath = smoothPath + ` L ${coords[coords.length - 1].x} ${h - pad} L ${coords[0].x} ${h - pad} Z`;
                  
                  return (
                    <>
                      {/* Area gradient */}
                      <Path 
                        d={areaPath} 
                        fill="url(#areaGradient)" 
                        fillOpacity={0.3}
                      />
                      {/* Define gradient */}
                      <Defs>
                        <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.8} />
                          <Stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.1} />
                        </LinearGradient>
                      </Defs>
                      
                      {/* Main line */}
                      <Path 
                        d={smoothPath} 
                        fill="none" 
                        stroke={chartColors.primary} 
                        strokeWidth={3} 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      
                      {/* Data points - only show recent points for clarity */}
                      {coords.filter((_, idx) => idx % Math.ceil(coords.length / 8) === 0 || idx === coords.length - 1).map((c, idx) => (
                        <Circle 
                          key={idx} 
                          cx={c.x} 
                          cy={c.y} 
                          r={3} 
                          fill="#fff" 
                          stroke={chartColors.primary}
                          strokeWidth={2}
                        />
                      ))}
                      
                      {/* Current value indicator */}
                      {coords.length > 0 && (
                        <Circle 
                          cx={coords[coords.length - 1].x} 
                          cy={coords[coords.length - 1].y} 
                          r={5} 
                          fill={chartColors.primary}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      )}
                    </>
                  );
                })()}
              </Svg>
            </View>
            
            {/* Modern Stats Panel */}
            <View style={styles.statsPanel}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Current</Text>
                <Text style={styles.statValue}>
                  {series.length > 0 ? series[series.length - 1].readingValue.toFixed(2) : 'N/A'}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Min</Text>
                <Text style={styles.statValue}>
                  {Math.min(...series.map(p => p.readingValue)).toFixed(2)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Max</Text>
                <Text style={styles.statValue}>
                  {Math.max(...series.map(p => p.readingValue)).toFixed(2)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Avg</Text>
                <Text style={styles.statValue}>
                  {(series.reduce((sum, p) => sum + p.readingValue, 0) / series.length).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Latest Readings in Modern Card */}
            {(() => {
              const latest = series.slice(-3).reverse();
              const formatTime = (t) => {
                const d = new Date(t);
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              };
              
              return (
                <View style={styles.latestReadings}>
                  <Text style={styles.latestReadingsTitle}>Latest Readings</Text>
                  {latest.map((r, i) => (
                    <View key={`latest-${i}`} style={styles.readingItem}>
                      <View style={styles.readingTimeContainer}>
                        <Ionicons name="time-outline" size={12} color={chartColors.text} />
                        <Text style={styles.readingTime}>{formatTime(new Date(r.readingTime).getTime())}</Text>
                      </View>
                      <Text style={styles.readingValue}>
                        {Number.isFinite(r.readingValue) ? r.readingValue.toFixed(2) : r.readingValue}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </>
        )}
      </View>
    );
  };

  // New function to render mini chart for grid items (ALWAYS 24h)
  const renderMiniChart = (series, size = 80) => {
    const pad = 8;
    const w = size;
    const h = size;
    
    if (!series || series.length === 0) {
      return (
        <View style={[styles.miniChartContainer, { width: w, height: h }]}>
          <Text style={styles.miniChartNoData}>No data</Text>
        </View>
      );
    }

    // For grid mini charts, we always show last 24h
    const twentyFourHoursAgo = new Date().getTime() - 24 * 60 * 60 * 1000;
    const filteredSeries = series.filter(p => new Date(p.readingTime).getTime() >= twentyFourHoursAgo);

    if (filteredSeries.length === 0) {
      return (
        <View style={[styles.miniChartContainer, { width: w, height: h }]}>
          <Text style={styles.miniChartNoData}>No data (24h)</Text>
        </View>
      );
    }

    const values = filteredSeries.map((p) => p.readingValue);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const rangeV = Math.max(1e-6, maxV - minV);
    const times = filteredSeries.map((p) => new Date(p.readingTime).getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const rangeT = Math.max(1, maxT - minT);

    const coords = filteredSeries.map((p) => {
      const t = new Date(p.readingTime).getTime();
      const x = pad + ((t - minT) / rangeT) * (w - pad * 2);
      const y = pad + (h - pad * 2) * (1 - (p.readingValue - minV) / rangeV);
      return { x, y };
    });

    // Simple path without axes for mini chart
    const buildMiniPath = (pts) => {
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

    const miniPath = buildMiniPath(coords);
    const latestValue = filteredSeries[filteredSeries.length - 1]?.readingValue;

    return (
      <View style={[styles.miniChartContainer, { width: w, height: h }]}>
        <Svg width={w} height={h}>
          <Path d={miniPath} fill="none" stroke="#2e7d32" strokeWidth={1.5} />
          {coords.length > 0 && (
            <Circle 
              cx={coords[coords.length - 1].x} 
              cy={coords[coords.length - 1].y} 
              r={2} 
              fill="#2e7d32" 
            />
          )}
        </Svg>
        {latestValue !== undefined && (
          <Text style={styles.miniChartValue}>
            {Number.isFinite(latestValue) ? latestValue.toFixed(1) : 'N/A'}
          </Text>
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
    setModalSearchQuery(''); // Clear search when opening modal
    // Grid always uses 24h data
    await fetchSensorReadingsForGrid(sensorsForObs);
  };

  const openSensorDetailModal = async (sensor) => {
    setSelectedSensor(sensor);
    setSensorDetailModalVisible(true);
    // Reset to 24h when opening detail modal
    setChartRange('24h');
    // Fetch initial data for detail chart (24h)
    const detailData = await fetchSensorReadingsForDetail(sensor.sensorId, '24h');
    setSensorSeriesBySensor(prev => ({
      ...prev,
      [sensor.sensorId]: detailData
    }));
  };

  // Auto-refresh sensor readings every 1 second when enabled and modal is open
  useEffect(() => {
    let interval;
    const shouldRun = sensorsObsModalVisible && autoRefreshSensors && selectedObservationSensors && selectedObservationSensors.length > 0;
    if (shouldRun) {
      // Immediate refresh - grid always uses 24h
      fetchSensorReadingsForGrid(selectedObservationSensors);
      interval = setInterval(() => {
        fetchSensorReadingsForGrid(selectedObservationSensors);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sensorsObsModalVisible, autoRefreshSensors, selectedObservationSensors]);

  const getStatusColor = (status) => {
    const map = {
      pending: '#FFC107',
      verified: '#4CAF50',
      unsure: '#FF9800',
      rejected: '#F44336',
    };
    return map[status] || '#9E9E9E';
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    setSensorsPage(1);
  };

  const handleFilterChange = (value) => {
    setStatusFilter(value);
    setSensorsPage(1);
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setSensorsPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setSortBy('created_at');
    setSortOrder('DESC');
    setSensorsPage(1);
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return 'swap-vertical';
    return sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down';
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchSensors();
    } finally {
      setRefreshing(false);
    }
  };

  // Render individual sensor grid item
  const renderSensorGridItem = ({ item: sensor }) => (
    <TouchableOpacity
      style={styles.sensorGridItem}
      onPress={() => openSensorDetailModal(sensor)}
    >
      <View style={styles.sensorGridHeader}>
        <Text style={styles.sensorGridName} numberOfLines={1}>
          {sensor.name}
        </Text>
        <View style={[
          styles.sensorGridStatus, 
          { backgroundColor: getSensorStatusColor(sensor.status) }
        ]} />
      </View>
      
      {(!sensorSeriesBySensor[sensor.sensorId] && sensorSeriesLoading) ? (
        <View style={styles.miniChartLoading}>
          <ActivityIndicator size="small" color="#2e7d32" />
        </View>
      ) : (
        renderMiniChart(sensorSeriesBySensor[sensor.sensorId])
      )}
      
      <View style={styles.sensorGridFooter}>
        <Text style={styles.sensorGridId} numberOfLines={1}>
          ID: {sensor.sensorId}
        </Text>
        <Text style={styles.sensorGridType} numberOfLines={1}>
          Last 24h • {sensorSeriesBySensor[sensor.sensorId]?.[0]?.readingType || 'Sensor'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.section}>
      {/* Loading Indicator */}
      {sensorsLoading && !refreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading sensors...</Text>
        </View>
      )}

      <ScrollView
        style={styles.contentScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2e7d32']}
            tintColor={'#2e7d32'}
          />
        }
      >
        {/* Search and Filter Section */}
        <View style={styles.filterSection}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search sensors..."
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
            {/* Status Filter */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status:</Text>
              <ScrollView horizontal style={styles.filterOptions}>
                {STATUS_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={`status-${option.key}`}
                    style={[
                      styles.filterOption,
                      statusFilter === option.key && styles.filterOptionActive
                    ]}
                    onPress={() => handleFilterChange(option.key)}
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
          {(searchQuery || statusFilter || sortBy !== 'created_at') && (
            <TouchableOpacity style={styles.clearFiltersButtonRed} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color="#fff" />
              <Text style={styles.clearFiltersTextRed}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sensors List */}
        {sensorsError ? (
          <View style={styles.placeholderBox}>
            <Ionicons name="alert-circle-outline" size={32} color="#F44336" />
            <Text style={{ marginTop: 8, color: '#F44336' }}>{String(sensorsError)}</Text>
            <TouchableOpacity
              style={[styles.viewDetailsButton, { marginTop: 12 }]}
              onPress={fetchSensors}
            >
              <Text style={styles.viewDetailsText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
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

            {sensorsObsList.length === 0 && !sensorsLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="hardware-chip-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No observations have sensors yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  {searchQuery || statusFilter
                    ? 'Try adjusting your search or filters' 
                    : 'Link an IoT sensor to an observation to see it here'
                  }
                </Text>
              </View>
            )}

            {sensorsObsList.length > 0 && (
              <View style={styles.paginationBar}>
                <TouchableOpacity
                  style={[styles.pageArrowButton, sensorsPage <= 1 && styles.disabledButton]}
                  onPress={() => sensorsPage > 1 && setSensorsPage(sensorsPage - 1)}
                  disabled={sensorsPage <= 1}
                >
                  <Ionicons name="chevron-back" size={20} color={sensorsPage <= 1 ? '#ccc' : '#2e7d32'} />
                </TouchableOpacity>
                
                <Text style={styles.pageIndicator}>Page {sensorsPage} of {totalSensorsPages}</Text>
                
                <TouchableOpacity
                  style={[styles.pageArrowButton, sensorsPage >= totalSensorsPages && styles.disabledButton]}
                  onPress={() => sensorsPage < totalSensorsPages && setSensorsPage(sensorsPage + 1)}
                  disabled={sensorsPage >= totalSensorsPages}
                >
                  <Ionicons name="chevron-forward" size={20} color={sensorsPage >= totalSensorsPages ? '#ccc' : '#2e7d32'} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Observation Sensors Modal (Grid Layout) */}
      <Modal
        visible={sensorsObsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSensorsObsModalVisible(false);
          setModalSearchQuery(''); // Clear search when modal closes
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sensors for Observation</Text>
              <TouchableOpacity onPress={() => {
                setSensorsObsModalVisible(false);
                setModalSearchQuery('');
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Auto Refresh Toggle */}
            <View style={styles.autoRefreshRow}>
              <View style={styles.autoRefreshLabel}>
                <Ionicons name="refresh" size={18} color="#2e7d32" />
                <Text style={styles.autoRefreshText}>Auto Refresh (1s)</Text>
              </View>
              <Switch value={autoRefreshSensors} onValueChange={setAutoRefreshSensors} />
            </View>

            {/* Modal Search Bar */}
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.modalSearchIcon} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search sensors"
                value={modalSearchQuery}
                onChangeText={setModalSearchQuery}
                clearButtonMode="while-editing"
              />
              {modalSearchQuery ? (
                <TouchableOpacity onPress={clearModalSearch} style={styles.modalSearchClear}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView style={styles.modalBodyScroll} contentContainerStyle={styles.modalBody}>
              {selectedSensorsObservation ? (
                <>
                  <View style={styles.observationHeader}>
                    <Text style={styles.inputLabel}>
                      {plantCache[selectedSensorsObservation.plant_id]?.common_name || `Plant #${selectedSensorsObservation.plant_id}`}
                    </Text>
                    <Text style={styles.scientificName}>
                      {plantCache[selectedSensorsObservation.plant_id]?.scientific_name || ''}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedSensorsObservation.status) }]}> 
                      <Text style={styles.statusText}>{(selectedSensorsObservation.status || 'unknown').toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={18} color="#2E7D32" />
                    <Text style={styles.infoText}>
                      Tap on any sensor to view detailed readings and information. Grid shows last 24 hours.
                      {modalSearchQuery && ` Showing ${getFilteredModalSensors.length} of ${selectedObservationSensors.length} sensors`}
                    </Text>
                  </View>

                  {/* Search Results Info */}
                  {modalSearchQuery && (
                    <View style={styles.searchResultsInfo}>
                      <Text style={styles.searchResultsText}>
                        Found {getFilteredModalSensors.length} sensor{getFilteredModalSensors.length !== 1 ? 's' : ''} matching "{modalSearchQuery}"
                      </Text>
                      <TouchableOpacity onPress={clearModalSearch} style={styles.clearSearchButton}>
                        <Ionicons name="close" size={16} color="#666" />
                        <Text style={styles.clearSearchText}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Sensors Grid using FlatList */}
                  {getFilteredModalSensors.length > 0 ? (
                    <FlatList
                      data={getFilteredModalSensors}
                      keyExtractor={(item) => item.sensorId}
                      numColumns={2}
                      renderItem={renderSensorGridItem}
                      contentContainerStyle={styles.sensorsGridContainer}
                      columnWrapperStyle={styles.columnWrapper}
                      scrollEnabled={false}
                      showsVerticalScrollIndicator={false}
                    />
                  ) : (
                    <View style={styles.emptyState}>
                      {modalSearchQuery ? (
                        <>
                          <Ionicons name="search-outline" size={48} color="#ccc" />
                          <Text style={styles.emptyStateText}>No sensors found</Text>
                          <Text style={styles.emptyStateSubtext}>
                            No sensors match "{modalSearchQuery}". Try adjusting your search terms.
                          </Text>
                          <TouchableOpacity 
                            style={[styles.viewDetailsButton, { marginTop: 12 }]}
                            onPress={clearModalSearch}
                          >
                            <Text style={styles.viewDetailsText}>Clear Search</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <Ionicons name="hardware-chip-outline" size={48} color="#ccc" />
                          <Text style={styles.emptyStateText}>No sensors linked</Text>
                          <Text style={styles.emptyStateSubtext}>This observation does not have any sensors</Text>
                        </>
                      )}
                    </View>
                  )}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sensor Detail Modal */}
      <Modal
        visible={sensorDetailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSensorDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.detailModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sensor Details</Text>
              <TouchableOpacity onPress={() => setSensorDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} contentContainerStyle={styles.modalBody}>
              {selectedSensor ? (
                <View style={styles.sensorDetailCard}>
                  <View style={styles.plantHeader}>
                    <Text style={styles.plantName}>{selectedSensor.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getSensorStatusColor(selectedSensor.status) }]}>
                      <Text style={styles.statusText}>{(selectedSensor.status || 'unknown').toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.scientificName}>Location: {selectedSensor.location || 'N/A'}</Text>
                  
                  {selectedSensor.lastChecked && (
                    <Text style={styles.obsMetaText}>
                      Last Checked: {new Date(selectedSensor.lastChecked).toLocaleString()}
                    </Text>
                  )}
                  
                  <Text style={styles.obsMetaText}>Sensor ID: {selectedSensor.sensorId}</Text>
                  <Text style={styles.obsMetaText}>
                    Created: {new Date(selectedSensor.createdAt).toLocaleDateString()}
                  </Text>

                  <View style={styles.chartSection}>
                    {(!sensorSeriesBySensor[selectedSensor.sensorId] && sensorSeriesLoading) ? (
                      <View style={styles.placeholderBox}>
                        <ActivityIndicator size="small" color="#2e7d32" />
                        <Text style={{ marginTop: 8, color: '#666' }}>Loading readings...</Text>
                      </View>
                    ) : (
                      renderSensorChart(sensorSeriesBySensor[selectedSensor.sensorId], chartRange)
                    )}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SensorsSection;