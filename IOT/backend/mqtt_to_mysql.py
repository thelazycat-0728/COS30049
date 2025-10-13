import json
import re
import mysql.connector
import paho.mqtt.client as mqtt
import ssl
from datetime import datetime

# ====== MySQL Configuration ======
db_config = {
    "host": "srv1758.hstgr.io",
    "user": "u149795069_user",
    "password": "Smartestplant123",
    "database": "u149795069_smartplant"
}

# ====== MQTT Configuration ======
MQTT_BROKER = "e3e32df3497349d99be8c3b6ce3a9a16.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_TOPIC = "sensors"
MQTT_USER = "client"
MQTT_PASSWORD = "Qwerty123"

# ====== MySQL Connection ======
def get_db_connection():
    return mysql.connector.connect(**db_config)

# ====== Insert Reading into Database ======
def insert_sensor_reading(sensor_id, reading_type, reading_value):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    sql = """
        INSERT INTO SensorReadings (sensor_id, reading_type, reading_value, reading_time)
        VALUES (%s, %s, %s, %s)
    """
    values = (sensor_id, reading_type, reading_value, datetime.now())
    
    try:
        cursor.execute(sql, values)
        conn.commit()
        print(f"✅ Inserted: Sensor {sensor_id}, Type {reading_type}, Value {reading_value}")
    except mysql.connector.Error as err:
        print(f"❌ Database Error: {err}")
    finally:
        cursor.close()
        conn.close()

# ====== MQTT Handlers ======
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT Broker")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        print(f"📥 Received MQTT Message: {payload}")
        data = json.loads(payload)

        # Loop through key-value pairs in the JSON
        for key, value in data.items():
            # Match pattern like: 1[temperature]
            match = re.match(r"(\d+)\[(\w+)\]", key)
            if match:
                sensor_id = int(match.group(1))
                reading_type = match.group(2)
                reading_value = float(value)
                
                insert_sensor_reading(sensor_id, reading_type, reading_value)
            else:
                print(f"⚠️ Skipping invalid key format: {key}")

    except Exception as e:
        print(f"❌ Error processing message: {e}")

# ====== Main ======
if __name__ == "__main__":
    client = mqtt.Client()
    client.username_pw_set(MQTT_USER, MQTT_PASSWORD)  # <---- credentials added here
    
    # Enable TLS for secure connection to HiveMQ Cloud
    client.tls_set(ca_certs=None, certfile=None, keyfile=None, cert_reqs=ssl.CERT_REQUIRED,
                   tls_version=ssl.PROTOCOL_TLS, ciphers=None)
    
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()
