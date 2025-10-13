#!/usr/bin/env python3
"""
Test script to trigger critical multi-sensor poaching alert.
Sends motion + sound + temperature + soil moisture readings to trigger high/critical severity poaching_alert.
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
        
        # Send initial baseline readings for all sensors
        baseline_payload = {
            "1[temperature]": 22.0,
            "2[humidity]": 60.0,
            "3[motion]": 0,
            "4[soil_moisture]": 45,
            "5[sound]": 85
        }
        client.publish(MQTT_TOPIC, json.dumps(baseline_payload))
        print(f"📤 Published baseline readings: {baseline_payload}")
        
        # Wait for baseline to be processed
        time.sleep(3)
        
        # Step 1: Motion detected
        motion_payload = {"3[motion]": 1}
        client.publish(MQTT_TOPIC, json.dumps(motion_payload))
        print(f"🚨 Step 1 - Motion detected: {motion_payload}")
        
        time.sleep(1)
        
        # Step 2: Sound spike (>20 delta)
        sound_spike_payload = {"5[sound]": 130}  # 45 unit increase
        client.publish(MQTT_TOPIC, json.dumps(sound_spike_payload))
        print(f"🔊 Step 2 - Sound spike: {sound_spike_payload}")
        
        time.sleep(1)
        
        # Step 3: Temperature rise (>3 delta)
        temp_rise_payload = {"1[temperature]": 26.5}  # 4.5 degree increase
        client.publish(MQTT_TOPIC, json.dumps(temp_rise_payload))
        print(f"🌡️ Step 3 - Temperature rise: {temp_rise_payload}")
        
        time.sleep(1)
        
        # Step 4: Soil disturbance (>12 delta)
        soil_disturbance_payload = {"4[soil_moisture]": 60}  # 15 unit increase
        client.publish(MQTT_TOPIC, json.dumps(soil_disturbance_payload))
        print(f"🌱 Step 4 - Soil disturbance: {soil_disturbance_payload}")
        
        time.sleep(1)
        
        # Step 5: Maintain all suspicious signals for critical alert
        critical_payload = {
            "1[temperature]": 28.0,  # Further temperature increase
            "3[motion]": 1,          # Continued motion
            "4[soil_moisture]": 65,  # More soil disturbance
            "5[sound]": 150          # Higher sound level
        }
        client.publish(MQTT_TOPIC, json.dumps(critical_payload))
        print(f"🚨 Step 5 - Critical multi-sensor alert: {critical_payload}")
        
        time.sleep(2)
        client.disconnect()
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_disconnect(client, userdata, rc):
    print("🔌 Disconnected from MQTT Broker")

def main():
    print("🚨 Testing Critical Multi-Sensor Poaching Alert")
    print("This will trigger a high/critical severity 'poaching_alert'")
    print("Expected sequence:")
    print("  - Motion detection")
    print("  - Sound spike (>20 delta)")
    print("  - Temperature rise (>3 delta)")
    print("  - Soil disturbance (>12 delta)")
    print("  - 4+ suspicious signals = CRITICAL severity poaching alert")
    
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