#!/usr/bin/env python3
"""
Test script to trigger sound spike alert.
Sends sound sensor readings with large delta changes to trigger sound-based alerts.
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
        
        # Send initial normal sound level
        initial_payload = {"5[sound]": 100}
        client.publish(MQTT_TOPIC, json.dumps(initial_payload))
        print(f"📤 Published initial sound level: {initial_payload}")
        
        # Wait a moment, then send sound spike
        time.sleep(2)
        
        # Large sound spike (>20 delta change) to trigger sound_spike alert
        spike_payload = {"5[sound]": 150}  # 50 unit increase (>20 threshold)
        client.publish(MQTT_TOPIC, json.dumps(spike_payload))
        print(f"🚨 Published sound spike: {spike_payload}")
        
        # Send another spike to maintain alert condition
        time.sleep(1)
        extreme_spike_payload = {"5[sound]": 200}  # Even higher spike
        client.publish(MQTT_TOPIC, json.dumps(extreme_spike_payload))
        print(f"🔊 Published extreme sound spike: {extreme_spike_payload}")
        
        time.sleep(1)
        client.disconnect()
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_disconnect(client, userdata, rc):
    print("🔌 Disconnected from MQTT Broker")

def main():
    print("🔊 Testing Sound Spike Alert")
    print("This will trigger 'sound_spike' alerts in the monitoring system")
    
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