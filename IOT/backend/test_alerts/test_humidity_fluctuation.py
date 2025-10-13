#!/usr/bin/env python3
"""
Test script to trigger humidity fluctuation alert.
Sends humidity readings with large delta changes to trigger humidity-based alerts.
"""

import paho.mqtt.client as mqtt
import json
import time
import ssl

# MQTT Configuration (from microcontroller.ino)
MQTT_BROKER = "e3e32df3497349d99be8c3b6ce3a9a16.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USER = "esp32"
MQTT_PASSWORD = "Qwerty123"
MQTT_TOPIC = "sensors"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT Broker")
        
        # Send initial normal humidity reading
        initial_payload = {"2[humidity]": 65.0}
        client.publish(MQTT_TOPIC, json.dumps(initial_payload))
        print(f"📤 Published initial humidity: {initial_payload}")
        
        # Wait a moment, then send humidity fluctuation
        time.sleep(2)
        
        # Large humidity drop (>10 delta change) to trigger humidity_drop alert
        drop_payload = {"2[humidity]": 45.0}  # 20% drop
        client.publish(MQTT_TOPIC, json.dumps(drop_payload))
        print(f"🚨 Published humidity drop: {drop_payload}")
        
        time.sleep(1)
        
        # Another fluctuation - humidity spike
        spike_payload = {"2[humidity]": 80.0}  # 35% increase from previous
        client.publish(MQTT_TOPIC, json.dumps(spike_payload))
        print(f"📈 Published humidity spike: {spike_payload}")
        
        time.sleep(1)
        
        # Extreme fluctuation
        extreme_payload = {"2[humidity]": 30.0}  # 50% drop
        client.publish(MQTT_TOPIC, json.dumps(extreme_payload))
        print(f"⚠️ Published extreme humidity fluctuation: {extreme_payload}")
        
        time.sleep(1)
        client.disconnect()
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_disconnect(client, userdata, rc):
    print("🔌 Disconnected from MQTT Broker")

def main():
    print("💧 Testing Humidity Fluctuation Alert")
    print("This will trigger 'humidity_drop' alerts in the monitoring system")
    print("Expected: >10% humidity changes will trigger alerts")
    
    client = mqtt.Client()
    client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.tls_set(ca_certs=None, certfile=None, keyfile=None, 
                   cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS,
                   ciphers=None)
    
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()