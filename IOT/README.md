# IoT Wildlife Monitoring System

This IoT system monitors wildlife areas using ESP32 microcontrollers with multiple sensors to detect potential poaching activities. The system consists of hardware sensors, MQTT communication, real-time data processing, and intelligent alert generation.

## 📁 Project Structure

```
IOT/
├── backend/
│   ├── mqtt_to_mysql.py          # MQTT-to-Database bridge
│   ├── alert_monitor.py           # Real-time alert processing engine
│   ├── alert_monitor.log          # System logs
│   └── test_alerts/               # Test scripts for alert validation
│       ├── README_TEST_SCRIPTS.md
│       ├── test_abnormal_temperature.py
│       ├── test_critical_poaching.py
│       ├── test_humidity_fluctuation.py
│       ├── test_motion_alert.py
│       ├── test_poaching_alert.py
│       └── test_sound_spike.py
└── microcontroller/
    └── microcontroller.ino        # ESP32 firmware
```

## 🔧 System Architecture

### Data Flow
1. **ESP32 Sensors** → **MQTT Broker** → **mqtt_to_mysql.py** → **MySQL Database**
2. **MySQL Database** → **alert_monitor.py** → **Alert Generation** → **Database Storage**

---

## 📱 Hardware Layer

### `microcontroller/microcontroller.ino`

**Purpose:** ESP32 firmware that reads multiple sensors and publishes data via MQTT

#### 🔌 **Hardware Configuration**
- **DHT11 Sensor (Pin 4):** Temperature and humidity monitoring
- **PIR Sensor (Pin 13):** Motion detection for wildlife/human activity
- **Soil Moisture Sensor (Pin 34):** Ground disturbance detection
- **Sound Sensor (Pin 35):** Audio level monitoring for unusual sounds
- **Onboard LED (Pin 2):** Connection status indicator

#### 🌐 **Connectivity**
- **Wi-Fi:** Connects to "James's iPhone" network
- **MQTT Broker:** HiveMQ Cloud with TLS encryption
  - Server: `e3e32df3497349d99be8c3b6ce3a9a16.s1.eu.hivemq.cloud`
  - Port: 8883 (Secure)
  - Topic: `sensors`

#### 📊 **Sensor Processing Logic**

**Threshold-Based Publishing:**
- **Temperature:** Publishes when change > 0.5°C
- **Humidity:** Publishes when change > 2.0%
- **Motion:** Publishes on any state change (0↔1)
- **Soil Moisture:** Publishes when change > 2%
- **Sound Level:** Publishes when change > 50 units

**JSON Payload Format:**
```json
{
  "1[temperature]": 25.5,
  "2[humidity]": 65.2,
  "3[motion]": 1,
  "4[soil_moisture]": 45,
  "5[sound]": 120
}
```

**Key Features:**
- **Efficient Bandwidth Usage:** Only sends changed values
- **Automatic Reconnection:** Handles Wi-Fi and MQTT disconnections
- **Data Validation:** Checks for NaN values before publishing
- **Real-time Processing:** 1-second sensor reading interval

---

## 🔄 Data Processing Layer

### `backend/mqtt_to_mysql.py`

**Purpose:** MQTT-to-Database bridge that receives sensor data and stores it in MySQL

#### 🔗 **Core Functionality**

**MQTT Client Configuration:**
- **Broker:** HiveMQ Cloud with TLS/SSL encryption
- **Authentication:** Username/password authentication
- **Topic Subscription:** `sensors`
- **Connection Security:** SSL certificate validation

**Data Processing Pipeline:**
1. **Message Reception:** Listens to MQTT `sensors` topic
2. **JSON Parsing:** Decodes payload from ESP32
3. **Key Pattern Matching:** Extracts sensor ID and type using regex `(\d+)\[(\w+)\]`
4. **Database Insertion:** Stores readings with timestamp

**Database Schema Integration:**
```sql
INSERT INTO SensorReadings (sensor_id, reading_type, reading_value, reading_time)
VALUES (sensor_id, reading_type, reading_value, NOW())
```

**Error Handling:**
- **Connection Failures:** Automatic MQTT reconnection
- **Database Errors:** Graceful error logging without system crash
- **Invalid Data:** Skips malformed JSON or invalid key formats
- **Network Issues:** Maintains connection state and retries

**Example Processing:**
```
Input:  {"1[temperature]": 25.5, "3[motion]": 1}
Output: 
  - Sensor 1, Type: temperature, Value: 25.5
  - Sensor 3, Type: motion, Value: 1
```

---

## 🚨 Alert Processing Engine

### `backend/alert_monitor.py`

**Purpose:** Real-time intelligent alert system that analyzes sensor patterns and generates wildlife protection alerts

#### 🧠 **Core Intelligence Features**

**1. Real-time Data Analysis**
- **Continuous Monitoring:** 5-second scan intervals
- **Delta Calculations:** Compares current vs. previous readings
- **Memory Management:** Maintains 24-hour rolling window
- **Database Connection Resilience:** Auto-reconnection with retry logic

**2. Multi-layered Alert System**

##### **Individual Sensor Alerts:**
- **Abnormal Sensor Fluctuations**
  - Triggers when sensor value changes dramatically
  - Severity based on delta magnitude
  - Prevents false positives with debounce logic

##### **Composite Poaching Detection:**
Intelligent multi-sensor correlation to detect potential poaching:

**Suspicious Activity Indicators:**
- **Motion Detection:** Human/vehicle presence
- **Sound Spikes:** Gunshots, vehicle engines, human voices
- **Temperature Changes:** Vehicle heat signatures
- **Humidity Fluctuations:** Environmental disturbances
- **Soil Disturbance:** Digging, heavy footsteps

**Alert Severity Calculation:**
```
2 suspicious signals = Medium severity
3 suspicious signals = High severity  
4+ suspicious signals = Critical severity
```

#### 🔍 **Advanced Processing Logic**

**Data Validation Pipeline:**
1. **Type Checking:** Ensures numeric values
2. **Range Validation:** Checks realistic sensor ranges
3. **Timestamp Verification:** Validates data freshness
4. **Duplicate Detection:** Prevents redundant processing

**Alert Debouncing:**
- **2-minute cooldown** between identical alerts
- Prevents alert spam from sensor noise
- Maintains alert effectiveness

**Memory Optimization:**
- **Automatic Cleanup:** Removes readings older than 24 hours
- **Efficient Storage:** In-memory caching for recent data
- **Connection Pooling:** Optimized database connections

#### 📊 **Alert Scoring System**

**Individual Alerts:**
- Score based on delta magnitude and sensor type
- Normalized scoring (0-100 scale)
- Contextual severity assignment

**Composite Alerts:**
- Weighted scoring based on signal combination
- Time-correlation analysis
- Environmental context consideration

---

## 🧪 Testing Framework

### `backend/test_alerts/`

**Purpose:** Comprehensive test suite for validating alert system functionality

#### 📋 **Test Scripts Overview**

**1. `test_abnormal_temperature.py`**
- **Scenario:** Sudden temperature spike (15.5°C jump)
- **Expected:** `abnormal_sensor` alert, medium severity
- **Use Case:** Vehicle heat signature detection

**2. `test_motion_alert.py`**
- **Scenario:** Motion sensor activation
- **Expected:** Motion detection logging
- **Use Case:** Human/animal movement detection

**3. `test_sound_spike.py`**
- **Scenario:** Significant sound level increases
- **Expected:** Sound spike detection
- **Use Case:** Gunshot or vehicle noise detection

**4. `test_poaching_alert.py`**
- **Scenario:** Combined motion + sound spike
- **Expected:** `poaching_alert`, medium severity
- **Use Case:** Basic suspicious activity detection

**5. `test_critical_poaching.py`**
- **Scenario:** Multi-sensor activation (motion + sound + temperature + soil)
- **Expected:** `poaching_alert`, critical severity
- **Use Case:** High-confidence poaching activity

**6. `test_humidity_fluctuation.py`**
- **Scenario:** Extreme humidity changes
- **Expected:** Environmental disturbance alerts
- **Use Case:** Large-scale environmental changes

#### 🔧 **Test Framework Features**
- **MQTT Integration:** Uses same broker as production system
- **Realistic Payloads:** Matches ESP32 JSON format exactly
- **Progressive Testing:** From simple to complex scenarios
- **Automated Validation:** Self-contained test execution
- **Comprehensive Documentation:** Detailed usage instructions

---

## 🚀 System Deployment

### Prerequisites
```bash
# Install Python dependencies
pip install mysql-connector-python paho-mqtt

# Install Arduino libraries (for ESP32)
# - WiFi
# - PubSubClient  
# - WiFiClientSecure
# - DHT sensor library
```

### Running the System

**1. Start Data Collection:**
```bash
cd backend/
python3 mqtt_to_mysql.py
```

**2. Start Alert Monitoring:**
```bash
python3 alert_monitor.py
```

**3. Deploy ESP32 Firmware:**
- Upload `microcontroller.ino` to ESP32
- Configure Wi-Fi credentials
- Verify sensor connections

**4. Test System:**
```bash
cd test_alerts/
python3 test_abnormal_temperature.py
```

### Configuration

**Database Settings (Both Python files):**
- Host: `srv1758.hstgr.io`
- Database: `u149795069_smartplant`
- Tables: `SensorReadings`, `Alerts`

**MQTT Settings:**
- Broker: HiveMQ Cloud
- Security: TLS/SSL encryption
- Topic: `sensors`

---

## 📊 Monitoring & Logs

### Log Files
- **`alert_monitor.log`:** Real-time system logs
  - Database connections
  - Alert generations
  - Error tracking
  - Performance metrics

### Database Tables
- **`SensorReadings`:** Raw sensor data storage
- **`Alerts`:** Generated alert records with severity and descriptions

---

## 🔒 Security Features

- **Encrypted Communication:** TLS/SSL for all MQTT traffic
- **Authentication:** Username/password for MQTT broker
- **Database Security:** Parameterized queries prevent SQL injection
- **Connection Validation:** Certificate verification for secure connections
- **Error Isolation:** Graceful handling prevents system crashes

---

## 🎯 Use Cases

1. **Wildlife Protection:** Detect poaching activities in protected areas
2. **Environmental Monitoring:** Track ecosystem changes
3. **Security Surveillance:** Monitor remote locations
4. **Research Applications:** Collect environmental data for studies
5. **Early Warning Systems:** Alert authorities to suspicious activities

This system provides a comprehensive, intelligent, and scalable solution for wildlife monitoring and protection using modern IoT technologies.