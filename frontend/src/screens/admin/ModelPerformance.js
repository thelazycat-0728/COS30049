import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, TextInput, Alert } from 'react-native';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import styles from './SectionStyles';

const GRAPH_HEIGHT = 280;
const GRAPH_WIDTH = Dimensions.get('window').width - 40;
const Y_MIN = 40;
const Y_MAX = 100;

function getY(value) {
  return ((Y_MAX - value) / (Y_MAX - Y_MIN)) * (GRAPH_HEIGHT - 90) + 40; 
}

function getX(index, total) {
  // Handle single data point - center it
  if (total === 1) {
    return GRAPH_WIDTH / 2;
  }
  return (index / (total - 1)) * (GRAPH_WIDTH - 80) + 50; 
}

const ModelPerformance = ({ API_URL, getAuthToken }) => {
  const [autoTraining, setAutoTraining] = useState(false);
  const [threshold, setThreshold] = useState('0.00');
  const [countThreshold, setCountThreshold] = useState('0');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [trainingHistory, setTrainingHistory] = useState({
    trainAcc: [],
    valAcc: [],
    trainingCounts: []
  });
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    fetchRetrainStats();
    fetchTrainingHistory();
  }, []);

  const fetchRetrainStats = async () => {
    try {
      setInitialLoading(true);
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/admin/retrain-stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const { auto_retrain, threshold_accuracy, threshold_count } = data.data;
        
        setAutoTraining(auto_retrain === 1);
        setThreshold(threshold_accuracy ? threshold_accuracy.toString() : '0.00');
        setCountThreshold(threshold_count ? threshold_count.toString() : '0');
      }
    } catch (error) {
      console.error('Failed to fetch retrain stats:', error);
      Alert.alert('Error', 'Failed to load retrain statistics');
    } finally {
      setInitialLoading(false);
      setLoading(false);
    }
  };

  const fetchTrainingHistory = async () => {
    try {
      setHistoryLoading(true);
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/admin/training-history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      
      if (result.success && result.data && result.data.length > 0) {
        const trainAcc = result.data.map(item => parseFloat(item.training_accuracy)*100);
        const valAcc = result.data.map(item => parseFloat(item.validation_accuracy)*100);
        const trainingCounts = result.data.map((item, idx) => item.model_version || `T${idx + 1}`);
     
        setTrainingHistory({
          trainAcc,
          valAcc,
          trainingCounts
        });
      } else {
        // Keep default empty state if no data
        setTrainingHistory({
          trainAcc: [],
          valAcc: [],
          trainingCounts: []
        });
      }
    } catch (error) {
      console.error('Failed to fetch training history:', error);
      Alert.alert('Error', 'Failed to load training history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const updateRetrainStats = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      const updateData = {
        auto_retrain: autoTraining,
        threshold_accuracy: parseFloat(threshold) || 0,
        threshold_count: parseInt(countThreshold) || 0
      };

      const response = await fetch(`${API_URL}/admin/retrain-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('Retrain settings updated successfully');
      } else {
        throw new Error(data.message || 'Update failed');
      }
    } catch (error) {
      console.error('Failed to update retrain stats:', error);
      Alert.alert('Error', error.message || 'Failed to update retrain settings');
    } finally {
      setLoading(false);
    }
  };

  // Update stats when autoTraining, threshold, or countThreshold change
  useEffect(() => {
    if (!initialLoading) {
      const timeoutId = setTimeout(() => {
        updateRetrainStats();
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [autoTraining, threshold, countThreshold]);

  // Helper to allow only 2 decimal places
  const handleThresholdChange = (val) => {
    let cleaned = val.replace(/[^0-9.]/g, '');
    if (cleaned.includes('.')) {
      const [intPart, decPart] = cleaned.split('.');
      cleaned = intPart + '.' + (decPart || '').slice(0, 2);
    }
    setThreshold(cleaned);
  };

  // Helper to allow only integers
  const handleCountThresholdChange = (val) => {
    setCountThreshold(val.replace(/[^0-9]/g, ''));
  };

  const handleAutoTrainingToggle = () => {
    setAutoTraining(!autoTraining);
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading retrain settings...</Text>
      </View>
    );
  }

  const hasTrainingData = trainingHistory.trainAcc.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.section}>
      <View>
        {/* Section 1: AutoTraining Toggle and Thresholds */}
        <View style={[styles.MPsection, styles.sectionBorder]}>
          <View style={styles.row}>
            <Text style={styles.sectionTitle}>AutoTraining</Text>
            {loading && <Text style={styles.loadingText}>Updating...</Text>}
            <View style={styles.toggleAndInputs}>
              <TouchableOpacity
                style={[
                  styles.toggleSwitch,
                  autoTraining ? styles.toggleOn : styles.toggleOff
                ]}
                activeOpacity={0.8}
                onPress={handleAutoTrainingToggle}
                disabled={loading}
              >
                <View style={[
                  styles.toggleCircle,
                  autoTraining ? styles.circleRight : styles.circleLeft
                ]} />
              </TouchableOpacity>
              
              {/* Threshold Box */}
              <View style={styles.inputBox}>
                <Text style={styles.MPinputLabel}>Threshold</Text>
                <TextInput
                  style={styles.input}
                  value={threshold}
                  onChangeText={handleThresholdChange}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  placeholder="0.00"
                  placeholderTextColor="#aaa"
                  editable={!loading}
                />
              </View>
              
              {/* Count Threshold Box */}
              <View style={styles.inputBox}>
                <Text style={styles.MPinputLabel}>Count Threshold</Text>
                <TextInput
                  style={styles.input}
                  value={countThreshold}
                  onChangeText={handleCountThresholdChange}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholder="0"
                  placeholderTextColor="#aaa"
                  editable={!loading}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Section 2: Training History Graph */}
        <View style={[styles.MPsection, styles.sectionBorder]}>
          <Text style={styles.sectionTitle}>Training History</Text>
          <View style={styles.graphPlaceholder}>
            {historyLoading ? (
              <View style={{ height: GRAPH_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={styles.loadingText}>Loading training history...</Text>
              </View>
            ) : !hasTrainingData ? (
              <View style={{ height: GRAPH_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#888', fontSize: 14 }}>No training history available</Text>
              </View>
            ) : (
              <>
                <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
                  {/* Y Axis Title */}
                  <SvgText
                    x={20}
                    y={GRAPH_HEIGHT / 2}
                    fontSize="12"
                    fill="#333"
                    textAnchor="middle"
                    fontWeight="bold"
                    transform={`rotate(-90, 20, ${GRAPH_HEIGHT / 2})`}
                  >
                    Accuracy (%)
                  </SvgText>
                  
                  {/* Y Axis Labels and grid lines */}
                  {[100, 90, 80, 70, 60, 50, 40].map((y, i) => (
                    <React.Fragment key={y}>
                      <SvgText
                        x={35}
                        y={getY(y) + 5}
                        fontSize="12"
                        fill="#888"
                        textAnchor="end"
                        fontWeight="500"
                      >
                        {y}
                      </SvgText>
                      <Line
                        x1={48}
                        y1={getY(y)}
                        x2={GRAPH_WIDTH - 16}
                        y2={getY(y)}
                        stroke="#e0e0e0"
                        strokeDasharray="4"
                      />
                    </React.Fragment>
                  ))}
                  
                  {/* X Axis Labels */}
                  {trainingHistory.trainingCounts.map((label, i) => {
                    const displayLabel = label.length > 15 ? label.substring(0, 12) + '...' : label;
                    return (
                      <SvgText
                        key={label}
                        x={getX(i, trainingHistory.trainingCounts.length)}
                        y={GRAPH_HEIGHT - 35}
                        fontSize="10"
                        fill="#888"
                        textAnchor="end"
                        fontWeight="500"
                        transform={`rotate(-45, ${getX(i, trainingHistory.trainingCounts.length)}, ${GRAPH_HEIGHT - 35})`}
                      >
                        {displayLabel}
                      </SvgText>
                    );
                  })}

                  {/* Training Accuracy Line & Dots */}
                  {trainingHistory.trainAcc.map((acc, i) => {
                    if (i < trainingHistory.trainAcc.length - 1) {
                      return (
                        <Line
                          key={'train-line-' + i}
                          x1={getX(i, trainingHistory.trainAcc.length)}
                          y1={getY(trainingHistory.trainAcc[i])}
                          x2={getX(i + 1, trainingHistory.trainAcc.length)}
                          y2={getY(trainingHistory.trainAcc[i + 1])}
                          stroke="#2e7d32"
                          strokeWidth="3"
                        />
                      );
                    }
                    return null;
                  })}

                  {trainingHistory.trainAcc.map((acc, i) => (
                    <Circle
                      key={'train-dot-' + i}
                      cx={getX(i, trainingHistory.trainAcc.length)}
                      cy={getY(acc)}
                      r="7"
                      fill="#2e7d32"
                      stroke="#fff"
                      strokeWidth="2"
                    />
                  ))}

                  {/* Validation Accuracy Line & Dots */}
                  {trainingHistory.valAcc.map((acc, i) => {
                    if (i < trainingHistory.valAcc.length - 1) {
                      return (
                        <Line
                          key={'val-line-' + i}
                          x1={getX(i, trainingHistory.valAcc.length)}
                          y1={getY(trainingHistory.valAcc[i])}
                          x2={getX(i + 1, trainingHistory.valAcc.length)}
                          y2={getY(trainingHistory.valAcc[i + 1])}
                          stroke="#d32f2f"
                          strokeWidth="3"
                        />
                      );
                    }
                    return null;
                  })}

                  {trainingHistory.valAcc.map((acc, i) => (
                    <Circle
                      key={'val-dot-' + i}
                      cx={getX(i, trainingHistory.valAcc.length)}
                      cy={getY(acc)}
                      r="7"
                      fill="#d32f2f"
                      stroke="#fff"
                      strokeWidth="2"
                    />
                  ))}
                </Svg>
                
                {/* Legend */}
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#2e7d32' }]} />
                  <Text style={styles.legendText}>Training Accuracy</Text>
                  <View style={[styles.legendDot, { backgroundColor: '#d32f2f', marginLeft: 16 }]} />
                  <Text style={styles.legendText}>Validation Accuracy</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default ModelPerformance;