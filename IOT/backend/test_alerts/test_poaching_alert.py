#!/usr/bin/env python3
"""
Test script to trigger composite poaching alert.
Sends motion + sound readings to trigger poaching_alert (2+ suspicious signals).
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
        
        # Send initial baseline readings
        baseline_payload = {
            "3[motion]": 0,
            "5[sound]": 80
        }
        client.publish(MQTT_TOPIC, json.dumps(baseline_payload))
        print(f"📤 Published baseline readings: {baseline_payload}")
        
        # Wait a moment, then simulate poaching activity
        time.sleep(3)
        
        # Step 1: Motion detected
        motion_payload = {"3[motion]": 1}
        client.publish(MQTT_TOPIC, json.dumps(motion_payload))
        print(f"🚨 Published motion detection: {motion_payload}")
        
        time.sleep(1)
        
        # Step 2: Sound spike (>20 delta) - this should trigger composite poaching alert
        sound_spike_payload = {"5[sound]": 120}  # 40 unit increase from baseline
        client.publish(MQTT_TOPIC, json.dumps(sound_spike_payload))
        print(f"🔊 Published sound spike: {sound_spike_payload}")
        
        time.sleep(1)
        
        # Step 3: Maintain suspicious activity
        continued_activity = {
            "3[motion]": 1,
            "5[sound]": 140
        }
        client.publish(MQTT_TOPIC, json.dumps(continued_activity))
        print(f"⚠️ Published continued suspicious activity: {continued_activity}")
        
        time.sleep(2)
        client.disconnect()
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_disconnect(client, userdata, rc):
    print("🔌 Disconnected from MQTT Broker")

def main():
    print("🚨 Testing Composite Poaching Alert")
    print("This will trigger a 'poaching_alert' with motion + sound combination")
    print("Expected: 2+ suspicious signals = medium severity poaching alert")
    
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