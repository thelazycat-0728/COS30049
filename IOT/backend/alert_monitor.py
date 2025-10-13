import mysql.connector
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Any

# ========== LOGGING SETUP ==========
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('alert_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ========== DATABASE CONFIG ==========
DB_CONFIG = {
    'host': 'srv1758.hstgr.io',
    'user': 'u149795069_user',
    'password': 'Smartestplant123',
    'database': 'u149795069_smartplant',
    'autocommit': True,
    'connection_timeout': 10,
    'charset': 'utf8mb4'
}

# ========== MONITOR SETTINGS ==========
SCAN_INTERVAL = 5  # seconds
DEBOUNCE_MINUTES = 2
MAX_MEMORY_AGE_HOURS = 24  # Clean up readings older than 24 hours
MAX_RECONNECT_ATTEMPTS = 3
RECONNECT_DELAY = 5  # seconds

# Store last readings in memory for delta calculations
last_readings: Dict[int, Dict[str, Any]] = {}  # {sensor_id: {'value': x, 'time': t, 'type': type, 'obs_id': id}}
last_alert_time: Dict[tuple, datetime] = {}  # {(observation_id, alert_type): timestamp}
last_fetch_time: Optional[datetime] = None  # Track last successful data fetch
conn: Optional[mysql.connector.MySQLConnection] = None  # Global database connection


def connect_db() -> Optional[mysql.connector.MySQLConnection]:
    """Establish database connection with retry logic and error handling."""
    for attempt in range(MAX_RECONNECT_ATTEMPTS):
        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            if conn.is_connected():
                logger.info(f"Database connected successfully (attempt {attempt + 1})")
                return conn
        except mysql.connector.Error as e:
            logger.error(f"Database connection attempt {attempt + 1} failed: {e}")
            if attempt < MAX_RECONNECT_ATTEMPTS - 1:
                logger.info(f"Retrying in {RECONNECT_DELAY} seconds...")
                time.sleep(RECONNECT_DELAY)
        except Exception as e:
            logger.error(f"Unexpected error during database connection: {e}")
            break
    
    logger.critical("Failed to establish database connection after all attempts")
    return None


def ensure_connection() -> bool:
    """Ensure database connection is alive, reconnect if necessary."""
    global conn
    
    if conn is None or not conn.is_connected():
        logger.warning("Database connection lost, attempting to reconnect...")
        if conn:
            try:
                conn.close()
            except:
                pass
        conn = connect_db()
        return conn is not None
    return True


def fetch_recent_readings(conn: mysql.connector.MySQLConnection) -> list:
    """Fetch only new readings since last fetch time with proper validation."""
    global last_fetch_time
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # If first run, get readings from last 10 minutes
        if last_fetch_time is None:
            query = """
                SELECT r.sensor_id, r.reading_type, r.reading_value, r.reading_time,
                       s.observation_id
                FROM SensorReadings r
                JOIN IoTSensors s ON r.sensor_id = s.sensor_id
                WHERE r.reading_time > NOW() - INTERVAL 10 MINUTE
                ORDER BY r.reading_time ASC
            """
            cursor.execute(query)
        else:
            # Only fetch readings newer than last fetch time
            query = """
                SELECT r.sensor_id, r.reading_type, r.reading_value, r.reading_time,
                       s.observation_id
                FROM SensorReadings r
                JOIN IoTSensors s ON r.sensor_id = s.sensor_id
                WHERE r.reading_time > %s
                ORDER BY r.reading_time ASC
            """
            cursor.execute(query, (last_fetch_time,))
        
        rows = cursor.fetchall()
        cursor.close()
        
        # Update last fetch time to current time
        last_fetch_time = datetime.now()
        
        # Validate and filter readings
        validated_rows = []
        for row in rows:
            if validate_reading(row):
                validated_rows.append(row)
            else:
                logger.warning(f"Invalid reading skipped: {row}")
        
        logger.info(f"Fetched {len(validated_rows)} valid readings")
        return validated_rows
        
    except mysql.connector.Error as e:
        logger.error(f"Database error while fetching readings: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error while fetching readings: {e}")
        raise


def validate_reading(reading: dict) -> bool:
    """Validate sensor reading data."""
    try:
        # Check required fields
        required_fields = ['sensor_id', 'reading_type', 'reading_value', 'reading_time', 'observation_id']
        for field in required_fields:
            if field not in reading or reading[field] is None:
                return False
        
        # Validate sensor_id and observation_id are positive integers
        if not isinstance(reading['sensor_id'], int) or reading['sensor_id'] <= 0:
            return False
        if not isinstance(reading['observation_id'], int) or reading['observation_id'] <= 0:
            return False
        
        # Validate reading_type is a valid string
        valid_types = ['temperature', 'humidity', 'motion', 'soil_moisture', 'sound']
        if reading['reading_type'] not in valid_types:
            return False
        
        # Validate reading_value is numeric and within reasonable ranges
        try:
            value = float(reading['reading_value'])
            # Basic range validation
            if reading['reading_type'] == 'temperature' and not (-50 <= value <= 100):
                return False
            elif reading['reading_type'] == 'humidity' and not (0 <= value <= 100):
                return False
            elif reading['reading_type'] == 'motion' and value not in [0, 1]:
                return False
            elif reading['reading_type'] == 'soil_moisture' and not (0 <= value <= 100):
                return False
            elif reading['reading_type'] == 'sound' and not (0 <= value <= 200):
                return False
        except (ValueError, TypeError):
            return False
        
        # Validate reading_time is a datetime
        if not isinstance(reading['reading_time'], datetime):
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"Error validating reading: {e}")
        return False


def insert_alert(conn: mysql.connector.MySQLConnection, sensor_id: int, observation_id: int, 
                alert_type: str, description: str, severity: str, score: float) -> bool:
    """Insert alert into database with proper error handling."""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Alerts (sensor_id, observation_id, alert_type, description, severity, score)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (sensor_id, observation_id, alert_type, description, severity, score))
        conn.commit()
        cursor.close()
        logger.info(f"Alert inserted: {alert_type} for sensor {sensor_id} (severity: {severity})")
        return True
    except mysql.connector.Error as e:
        logger.error(f"Database error while inserting alert: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error while inserting alert: {e}")
        return False


def cleanup_old_data():
    """Clean up old readings and alert times from memory to prevent memory leaks."""
    global last_readings, last_alert_time
    
    try:
        current_time = datetime.now()
        cutoff_time = current_time - timedelta(hours=MAX_MEMORY_AGE_HOURS)
        
        # Clean up old readings
        sensors_to_remove = []
        for sensor_id, reading_data in last_readings.items():
            if reading_data.get('time', current_time) < cutoff_time:
                sensors_to_remove.append(sensor_id)
        
        for sensor_id in sensors_to_remove:
            del last_readings[sensor_id]
        
        # Clean up old alert times
        alerts_to_remove = []
        for key, alert_time in last_alert_time.items():
            if alert_time < cutoff_time:
                alerts_to_remove.append(key)
        
        for key in alerts_to_remove:
            del last_alert_time[key]
        
        if sensors_to_remove or alerts_to_remove:
            logger.info(f"Memory cleanup: removed {len(sensors_to_remove)} old readings and {len(alerts_to_remove)} old alert times")
            
    except Exception as e:
        logger.error(f"Error during memory cleanup: {e}")


def compute_composite_alert(conn, observation_id: int) -> bool:
    """
    Check recent sensor deltas in the same observation group and determine if
    poaching_alert should be triggered with proper error handling.
    """
    try:
        # Collect relevant sensors
        group = [v for v in last_readings.values() if v['obs_id'] == observation_id]
        if not group:
            logger.debug(f"No readings found for observation {observation_id}")
            return False

        suspicious_signals = []
        description_parts = []

        for s in group:
            try:
                rtype, delta = s['type'], s.get('delta', 0)
                value = s.get('value', 0)
                sensor_id = s.get('sid')
                
                if not sensor_id:
                    logger.warning(f"Missing sensor_id in reading: {s}")
                    continue

                # Abnormal individual sensor (for sensor health monitoring)
                if delta > 5 * abs(value) * 0.01 and delta > 8:
                    if insert_alert(conn, sensor_id, observation_id, "abnormal_sensor",
                                   f"Abnormal {rtype} fluctuation detected (Δ={delta:.2f})",
                                   "medium", min(0.5 + delta / 100, 1.0)):
                        logger.info(f"Abnormal sensor alert triggered for sensor {sensor_id}")

                # Evaluate anomaly per sensor for composite logic
                if rtype == "motion" and value == 1:
                    suspicious_signals.append("motion")
                    description_parts.append("Motion detected")

                elif rtype == "sound" and delta > 20:
                    suspicious_signals.append("sound_spike")
                    description_parts.append(f"Sound spike (Δ{delta:.1f}dB)")

                elif rtype == "temperature" and delta > 3:
                    suspicious_signals.append("temp_rise")
                    description_parts.append(f"Temperature rise (Δ{delta:.1f}°C)")

                elif rtype == "humidity" and delta > 10:
                    suspicious_signals.append("humidity_drop")
                    description_parts.append(f"Humidity fluctuation (Δ{delta:.1f}%)")

                elif rtype == "soil_moisture" and delta > 12:
                    suspicious_signals.append("soil_disturbance")
                    description_parts.append(f"Soil change (Δ{delta:.1f}%)")
                    
            except Exception as e:
                logger.error(f"Error processing sensor reading {s}: {e}")
                continue

        # === Composite Poaching Detection ===
        # Confidence and severity based on how many sensors confirm
        count = len(suspicious_signals)
        if count >= 2:
            try:
                # Compute confidence score and severity
                score = min(0.5 + 0.1 * count, 1.0)
                severity = "medium" if count == 2 else "high" if count == 3 else "critical"
                desc = ", ".join(description_parts)

                key = (observation_id, "poaching_alert")
                time_now = datetime.now()
                last_time = last_alert_time.get(key)

                if not last_time or (time_now - last_time).total_seconds() > DEBOUNCE_MINUTES * 60:
                    # Use the first sensor as representative
                    representative_sensor = group[0]['sid']
                    if insert_alert(conn, representative_sensor, observation_id, "poaching_alert",
                                   f"Possible poaching activity detected ({desc})",
                                   severity, score):
                        last_alert_time[key] = time_now
                        logger.info(f"Composite poaching alert triggered for observation {observation_id} - {desc}")
                        return True
                        
            except Exception as e:
                logger.error(f"Error creating composite alert for observation {observation_id}: {e}")
                return False
        
        return False
        
    except Exception as e:
        logger.error(f"Error in compute_composite_alert for observation {observation_id}: {e}")
        return False


def check_and_store(reading: Dict[str, Any]) -> bool:
    """Check reading for alerts and store in memory with proper error handling."""
    try:
        if not validate_reading(reading):
            return False
            
        sid = reading['sensor_id']
        obs_id = reading['observation_id']
        rtype = reading['reading_type']
        val = float(reading['reading_value'])
        time_now = datetime.now()

        prev = last_readings.get(sid)
        delta = abs(val - prev['value']) if prev else 0

        last_readings[sid] = {
            'sid': sid,
            'obs_id': obs_id,
            'type': rtype,
            'value': val,
            'time': time_now,
            'delta': delta
        }
        return True
        
    except Exception as e:
        logger.error(f"Error in check_and_store for reading {reading}: {e}")
        return False


def main():
    global conn
    logger.info("🔍 Starting composite multi-sensor monitoring...")
    conn = connect_db()
    
    if not conn:
        logger.error("Failed to establish initial database connection. Exiting.")
        exit(1)
        
    cleanup_counter = 0
    CLEANUP_INTERVAL = 3600 // SCAN_INTERVAL  # Cleanup every hour

    try:
        while True:
            # Ensure database connection is active
            if not ensure_connection():
                logger.error("Database connection lost and could not be re-established. Retrying in 30 seconds...")
                time.sleep(30)
                continue
            
            try:
                readings = fetch_recent_readings(conn)
                
                if readings:
                    logger.debug(f"Processing {len(readings)} new readings")
                    
                    for r in readings:
                        check_and_store(r)

                    # Check by observation group
                    obs_ids = set(v['obs_id'] for v in last_readings.values())
                    for oid in obs_ids:
                        if oid:  # Ensure obs_id is not None
                            compute_composite_alert(conn, oid)
                else:
                    logger.debug("No new readings to process")
                
                # Periodic memory cleanup
                cleanup_counter += 1
                if cleanup_counter >= CLEANUP_INTERVAL:
                    cleanup_old_data()
                    cleanup_counter = 0
                    
            except Exception as e:
                logger.error(f"Error in main monitoring loop: {e}")
                time.sleep(5)  # Brief pause before retrying

            time.sleep(SCAN_INTERVAL)

    except KeyboardInterrupt:
        logger.info("\n🛑 Stopping monitor gracefully.")
    except Exception as e:
        logger.error(f"Unexpected error in main loop: {e}")
    finally:
        if conn and conn.is_connected():
            conn.close()
            logger.info("Database connection closed.")


if __name__ == "__main__":
    main()
