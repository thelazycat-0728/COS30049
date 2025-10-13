#!/usr/bin/env python3
"""
Test script to trigger abnormal temperature fluctuation alert.
Sends temperature readings with large delta changes to trigger abnormal_sensor alert.
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
        
        # Send initial normal temperature reading
        initial_payload = {"1[temperature]": 25.0}
        client.publish(MQTT_TOPIC, json.dumps(initial_payload))
        print(f"📤 Published initial reading: {initial_payload}")
        
        # Wait a moment, then send abnormal temperature spike
        time.sleep(2)
        
        # Large temperature jump (>8 degree change) to trigger abnormal_sensor alert
        abnormal_payload = {"1[temperature]": 40.5}  # 15.5 degree jump
        client.publish(MQTT_TOPIC, json.dumps(abnormal_payload))
        print(f"🚨 Published abnormal temperature spike: {abnormal_payload}")
        
        time.sleep(1)
        client.disconnect()
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_disconnect(client, userdata, rc):
    print("🔌 Disconnected from MQTT Broker")

def main():
    print("🌡️ Testing Abnormal Temperature Fluctuation Alert")
    print("This will trigger an 'abnormal_sensor' alert for temperature")
    
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