#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>

// ==== DHT11 Setup ====
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ==== PIR Setup ====
#define PIRPIN 13

// ==== Soil Moisture Setup (AO -> GPIO34 recommended) ====
#define SOILPIN 34

// ==== Sound Sensor Setup (AO -> GPIO35) ====
#define SOUNDPIN 35

// ==== Wi-Fi Credentials ====
const char* ssid = "James’s iPhone";
const char* password = "bbbbbbbb";

// ==== HiveMQ Cloud ====
const char* mqtt_server = "e3e32df3497349d99be8c3b6ce3a9a16.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "esp32";
const char* mqtt_password = "Qwerty123";

// ==== MQTT Topic (JSON) ====
const char* topic = "sensors";

// WiFi + MQTT clients
WiFiClientSecure espClient;
PubSubClient client(espClient);

// Onboard LED (GPIO2)
const int ledPin = 2;

// ==== Thresholds ====
float tempThreshold = 0.5;
float humThreshold = 2.0;
int soilThreshold = 2;
int soundThreshold = 50;

// ==== Previous values ====
float prevTemp = NAN;
float prevHum = NAN;
int prevMotion = -1;
int prevSoil = -1;
int prevSound = -1;

void setup_wifi() {
  pinMode(ledPin, OUTPUT);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(ledPin, HIGH);
    delay(500);
    digitalWrite(ledPin, LOW);
    delay(500);
  }

  digitalWrite(ledPin, HIGH);
}

void reconnect() {
  while (!client.connected()) {
    if (!client.connect("ESP32Client", mqtt_user, mqtt_password)) {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(PIRPIN, INPUT);
  setup_wifi();

  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Read sensors
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  int motion = digitalRead(PIRPIN);

  int soilRaw = analogRead(SOILPIN);
  int soilPercent = map(soilRaw, 4095, 0, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);

  int soundLevel = analogRead(SOUNDPIN);

  if (isnan(h) || isnan(t)) {
    delay(2000);
    return;
  }

  // Build JSON only with changed values
  String payload = "{";
  bool first = true;

  if (isnan(prevTemp) || abs(t - prevTemp) > tempThreshold) {
    if (!first) payload += ", ";
    payload += "\"1[temperature]\": " + String(t, 2);
    prevTemp = t;
    first = false;
  }

  if (isnan(prevHum) || abs(h - prevHum) > humThreshold) {
    if (!first) payload += ", ";
    payload += "\"2[humidity]\": " + String(h, 2);
    prevHum = h;
    first = false;
  }

  if (prevMotion == -1 || motion != prevMotion) {
    if (!first) payload += ", ";
    payload += "\"3[motion]\": " + String(motion);
    prevMotion = motion;
    first = false;
  }

  if (prevSoil == -1 || abs(soilPercent - prevSoil) > soilThreshold) {
    if (!first) payload += ", ";
    payload += "\"4[soil_moisture]\": " + String(soilPercent);
    prevSoil = soilPercent;
    first = false;
  }

  if (prevSound == -1 || abs(soundLevel - prevSound) > soundThreshold) {
    if (!first) payload += ", ";
    payload += "\"5[sound]\": " + String(soundLevel);
    prevSound = soundLevel;
    first = false;
  }

  payload += "}";

  // Only publish if something changed
  if (payload != "{}") {
    Serial.print("Publishing JSON: ");
    Serial.println(payload);
    client.publish(topic, payload.c_str());
  }

  delay(1000);
}
