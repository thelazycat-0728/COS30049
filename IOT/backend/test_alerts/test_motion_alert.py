#!/usr/bin/env python3
"""
Test script to trigger motion detection alert.
Sends motion sensor readings to trigger motion-based alerts.
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
        
        # Send initial no motion reading
        initial_payload = {"3[motion]": 0}
        client.publish(MQTT_TOPIC, json.dumps(initial_payload))
        print(f"📤 Published initial reading: {initial_payload}")
        
        # Wait a moment, then send motion detection
        time.sleep(2)
        
        # Motion detected (value = 1) to trigger motion alert
        motion_payload = {"3[motion]": 1}
        client.publish(MQTT_TOPIC, json.dumps(motion_payload))
        print(f"🚨 Published motion detection: {motion_payload}")
        
        # Send additional readings to maintain motion state
        time.sleep(1)
        client.publish(MQTT_TOPIC, json.dumps(motion_payload))
        print(f"📤 Published continued motion: {motion_payload}")
        
        time.sleep(1)
        client.disconnect()
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_disconnect(client, userdata, rc):
    print("🔌 Disconnected from MQTT Broker")

def main():
    print("🏃 Testing Motion Detection Alert")
    print("This will trigger motion-based alerts in the monitoring system")
    
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