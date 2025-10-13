# Alert Monitor Test Scripts

This directory contains 5 test scripts designed to trigger different types of alerts in the `alert_monitor.py` system. Each script simulates specific sensor conditions that will activate various alert mechanisms.

## Prerequisites

1. **Install Dependencies:**
   ```bash
   pip install paho-mqtt
   ```

2. **Ensure alert_monitor.py and mqtt_to_mysql.py are running:**
   ```bash
   python3 alert_monitor.py
   python3 mqtt_to_mysql.py
   ```

3. **Database Connection:** Make sure the MySQL database is accessible and the `alert_monitor.py` can connect to it.

## Test Scripts Overview

### 1. 🌡️ `test_abnormal_temperature.py`
**Purpose:** Triggers abnormal sensor fluctuation alert for temperature

**What it does:**
- Sends initial temperature reading (25.0°C)
- Sends abnormal temperature spike (40.5°C) - 15.5° jump
- Triggers `abnormal_sensor` alert (medium severity)

**Expected Alert:**
- Alert Type: `abnormal_sensor`
- Severity: `medium`
- Description: "Abnormal temperature fluctuation detected"

**Run:**
```bash
python3 test_abnormal_temperature.py
```

### 2. 🏃 `test_motion_alert.py`
**Purpose:** Triggers motion detection alert

**What it does:**
- Sends initial no motion reading (0)
- Sends motion detection (1)
- Contributes to composite alert logic

**Expected Alert:**
- Contributes to composite `poaching_alert` if combined with other sensors
- Individual motion detection logged

**Run:**
```bash
python3 test_motion_alert.py
```

### 3. 🔊 `test_sound_spike.py`
**Purpose:** Triggers sound spike alert

**What it does:**
- Sends initial sound level (100)
- Sends sound spike (150) - 50 unit increase (>20 threshold)
- Sends extreme spike (200)
- Triggers `sound_spike` alert

**Expected Alert:**
- Contributes to composite `poaching_alert`
- Sound spike detection in composite logic

**Run:**
```bash
python3 test_sound_spike.py
```

### 4. 🚨 `test_poaching_alert.py`
**Purpose:** Triggers composite poaching alert (2 sensors)

**What it does:**
- Sends baseline readings
- Triggers motion detection (1)
- Triggers sound spike (40 unit increase)
- Combines 2+ suspicious signals for poaching alert

**Expected Alert:**
- Alert Type: `poaching_alert`
- Severity: `medium` (2 suspicious signals)
- Description: "Possible poaching activity detected (Motion detected, Sound spike)"

**Run:**
```bash
python3 test_poaching_alert.py
```

### 5. 🚨 `test_critical_poaching.py`
**Purpose:** Triggers critical multi-sensor poaching alert (4+ sensors)

**What it does:**
- Sends baseline readings for all sensors
- Triggers motion detection
- Triggers sound spike (>20 delta)
- Triggers temperature rise (>3 delta)
- Triggers soil disturbance (>12 delta)
- Combines 4+ suspicious signals for critical alert

**Expected Alert:**
- Alert Type: `poaching_alert`
- Severity: `critical` (4+ suspicious signals)
- Description: "Possible poaching activity detected (Motion detected, Sound spike, Temperature rise, Soil change)"

**Run:**
```bash
python3 test_critical_poaching.py
```

### 6. 💧 `test_humidity_fluctuation.py`
**Purpose:** Triggers humidity fluctuation alert

**What it does:**
- Sends initial humidity (65%)
- Sends humidity drop (45%) - 20% change
- Sends humidity spike (80%) - 35% change
- Sends extreme fluctuation (30%) - 50% change
- Triggers humidity-based alerts

**Expected Alert:**
- Contributes to composite `poaching_alert`
- Humidity fluctuation detection in composite logic

**Run:**
```bash
python3 test_humidity_fluctuation.py
```

## Alert Thresholds Reference

Based on `alert_monitor.py` configuration:

| Sensor Type | Threshold | Alert Condition |
|-------------|-----------|----------------|
| Temperature | >3°C delta | Temperature rise |
| Humidity | >10% delta | Humidity fluctuation |
| Motion | value = 1 | Motion detected |
| Sound | >20 delta | Sound spike |
| Soil Moisture | >12% delta | Soil disturbance |
| Abnormal Sensor | delta > 8 AND delta > 5% of value | Abnormal sensor |

## Composite Alert Logic

- **2 suspicious signals** → `medium` severity poaching alert
- **3 suspicious signals** → `high` severity poaching alert  
- **4+ suspicious signals** → `critical` severity poaching alert

## Usage Tips

1. **Run tests individually** to see specific alert types
2. **Wait 2+ minutes between tests** due to debounce settings
3. **Monitor alert_monitor.log** for detailed logging
4. **Check database Alerts table** for inserted alerts
5. **Run alert_monitor.py with DEBUG logging** for more details:
   ```python
   logging.basicConfig(level=logging.DEBUG, ...)
   ```

## Troubleshooting

- **No alerts triggered:** Check if `alert_monitor.py` is running and connected to database
- **Connection errors:** Verify MQTT broker credentials and network connectivity
- **Missing alerts:** Check debounce timing (2-minute intervals between same alert types)
- **Database errors:** Verify MySQL connection and table structure

## MQTT Configuration

All test scripts use the same MQTT configuration as `microcontroller.ino`:
- **Broker:** `e3e32df3497349d99be8c3b6ce3a9a16.s1.eu.hivemq.cloud`
- **Port:** `8883` (TLS)
- **Topic:** `sensors`
- **Payload Format:** JSON with sensor IDs like `"1[temperature]": 25.0`