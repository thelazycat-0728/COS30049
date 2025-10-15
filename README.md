# 🌿 SmartPlant - Intelligent Plant Conservation & Monitoring System

<div align="center">

![SmartPlant Logo](https://img.shields.io/badge/SmartPlant-Conservation-green?style=for-the-badge)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/)
[![MQTT](https://img.shields.io/badge/MQTT-660066?style=for-the-badge&logo=mqtt&logoColor=white)](https://mqtt.org/)

**An integrated ecosystem combining AI-powered plant identification, IoT environmental monitoring, and real-time conservation alerts.**

[Features](#-features) • [Architecture](#-architecture) • [Installation](#-installation) • [Usage](#-usage) • [API Documentation](#-api-documentation)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [IoT Setup](#iot-setup)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [IoT Monitoring](#-iot-monitoring)
- [AI Model](#-ai-model)

---

## 🌟 Overview

**SmartPlant** is a comprehensive plant conservation platform that combines:

1. **🤖 AI-Powered Plant Identification** - TensorFlow Lite model for offline/online plant species recognition
2. **📡 IoT Environmental Monitoring** - Real-time sensor data from field devices via MQTT
3. **🗺️ Geographic Mapping** - Location-based plant observations and conservation zones
4. **👥 Multi-Role Management** - Admin, Expert, and User roles with different permissions
5. **📧 Alert System** - Real-time notifications for environmental anomalies and poaching detection

---

## ✨ Features

### 🔬 Plant Identification
- **Offline AI Classification** - TensorFlow Lite model (30+ Malaysian plant species)
- **Online Fallback** - Backend API with advanced ML model
- **Image Processing** - JPEG decoding with proper RGB normalization
- **Confidence Scoring** - Top-5 predictions with confidence percentages
- **Species Database** - Detailed information about 30 Malaysian flora species

### 📱 Mobile Application
- **Cross-Platform** - React Native (iOS & Android)
- **Camera Integration** - Take photos or upload from gallery
- **Offline Capability** - Works without internet connection
- **User Authentication** - JWT-based secure login with MFA support
- **Profile Management** - User profiles with observation history
- **Interactive Maps** - Geolocation-based plant observations

### 🌐 Backend API
- **RESTful API** - Node.js/Express server
- **MySQL Database** - Structured data storage
- **JWT Authentication** - Secure token-based auth with refresh tokens
- **Role-Based Access Control** - Admin, Expert, User permissions
- **Rate Limiting** - API protection and abuse prevention
- **Email Service** - Nodemailer integration for notifications
- **File Upload** - Multer middleware for image handling

### 🛰️ IoT Monitoring
- **MQTT Protocol** - Real-time sensor data streaming
- **Environmental Sensors**:
  - 🌡️ Temperature monitoring
  - 💧 Humidity tracking
  - 🔊 Sound level detection
  - 👁️ Motion sensors (poaching detection)
- **Automated Alerts** - Python-based alert monitoring system
- **MySQL Integration** - Sensor data storage and analytics

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SMARTPLANT ECOSYSTEM                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   MOBILE APP     │◄──────►│   BACKEND API    │◄──────►│   IoT DEVICES    │
│  (React Native)  │  HTTP  │   (Node.js)      │  MQTT  │  (Sensors)       │
└──────────────────┘        └──────────────────┘        └──────────────────┘
         │                           │                            │
         │                           │                            │
         ▼                           ▼                            ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   TFLite Model   │        │  MySQL Database  │        │   MQTT Broker    │
│  (Offline AI)    │        │  (Observations)  │        │   (Data Stream)  │
└──────────────────┘        └──────────────────┘        └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  Alert Monitor   │
                            │    (Python)      │
                            └──────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend (Mobile)
- **Framework**: React Native + Expo
- **Navigation**: React Navigation
- **State Management**: React Hooks
- **AI/ML**: TensorFlow Lite (`react-native-fast-tflite`)
- **Image Processing**: 
  - `expo-image-manipulator` - Image resizing/manipulation
  - `jpeg-js` - JPEG decoding to RGB pixels
  - `expo-image-picker` - Camera/gallery access
- **Networking**: Axios
- **Maps**: React Native Maps

### Backend (API)
- **Runtime**: Node.js v20+
- **Framework**: Express.js
- **Database**: MySQL 8.0
- **Authentication**: 
  - `jsonwebtoken` - JWT tokens
  - `bcryptjs` - Password hashing
- **Email**: Nodemailer
- **File Upload**: Multer
- **Security**: 
  - `express-rate-limit` - Rate limiting
  - `helmet` - HTTP headers security
  - `cors` - CORS handling
- **Validation**: Express Validator

### IoT System
- **Protocol**: MQTT (Mosquitto)
- **Language**: Python 3.8+
- **Microcontroller**: Arduino/ESP32
- **Libraries**:
  - `paho-mqtt` - MQTT client
  - `mysql-connector-python` - Database integration
  - `python-dotenv` - Environment variables

### AI/ML
- **Framework**: TensorFlow/Keras
- **Model Format**: TensorFlow Lite (.tflite)
- **Input**: 224x224x3 RGB images
- **Output**: 30 plant species classifications
- **Preprocessing**: JPEG decoding + normalization [0, 1]

---

## 📁 Project Structure

```
COS30049/
├── frontend/                    # React Native Mobile App
│   ├── src/
│   │   ├── screens/            # UI Screens
│   │   │   ├── HomeScreen.js
│   │   │   ├── UploadScreen.js
│   │   │   ├── MapScreen.js
│   │   │   ├── ProfileScreen.js
│   │   │   └── AdminScreen.js
│   │   ├── services/           # Business Logic
│   │   │   └── PlantClassifierService.js  # AI Classification
│   │   ├── navigation/         # Navigation
│   │   └── data/               # Mock Data
│   ├── assets/
│   │   ├── model/              # AI Model Files
│   │   │   ├── plant_classifier.tflite    # TFLite Model
│   │   │   └── labels.json                # Species Labels
│   │   └── images/
│   ├── android/                # Android Native Code
│   │   └── app/src/main/assets/  # TFLite Model Copy
│   ├── ios/                    # iOS Native Code
│   └── package.json
│
├── backend/                     # Node.js API Server
│   ├── src/
│   │   ├── config/             # Configuration
│   │   │   ├── database.js     # MySQL Connection
│   │   │   └── config.js       # App Config
│   │   ├── models/             # Database Models
│   │   │   ├── User.js
│   │   │   ├── Observation.js
│   │   │   └── RefreshToken.js
│   │   ├── controller/         # Route Controllers
│   │   │   ├── authController.js
│   │   │   ├── identifyController.js
│   │   │   ├── observationController.js
│   │   │   └── userController.js
│   │   ├── routes/             # API Routes
│   │   │   ├── auth.routes.js
│   │   │   ├── identify.routes.js
│   │   │   ├── map.routes.js
│   │   │   ├── iot.routes.js
│   │   │   └── user.routes.js
│   │   ├── middleware/         # Middleware
│   │   │   ├── auth.js         # JWT Authentication
│   │   │   ├── validation.js   # Input Validation
│   │   │   └── upload.js       # File Upload
│   │   └── services/           # Business Services
│   │       ├── plantClassification.js  # AI Service
│   │       ├── emailService.js         # Email Notifications
│   │       └── ai-services/
│   │           └── convertionScript.py # Model Conversion
│   ├── sql/
│   │   └── init.sql            # Database Schema
│   ├── uploads/                # User Uploaded Images
│   └── package.json
│
└── IOT/                         # IoT System
    ├── microcontroller/
    │   └── microcontroller.ino  # Arduino/ESP32 Code
    ├── backend/
    │   ├── mqtt_to_mysql.py     # MQTT → MySQL Bridge
    │   ├── alert_monitor.py     # Alert Detection
    │   └── test_alerts/         # Test Scripts
    │       ├── test_motion_alert.py
    │       ├── test_abnormal_temperature.py
    │       ├── test_humidity_fluctuation.py
    │       ├── test_sound_spike.py
    │       └── test_poaching_alert.py
    └── README.md
```

---

## 🚀 Installation

### Prerequisites

Ensure you have the following installed:

- **Node.js** v20.x or higher
- **npm** v10.x or higher
- **MySQL** v8.0 or higher
- **Python** v3.8 or higher
- **Java JDK** 11+ (for Android builds)
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Expo CLI**: `npm install -g expo-cli`
- **Mosquitto MQTT Broker** (for IoT)

---

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   # Create .env file
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   # Server
   PORT=3000
   NODE_ENV=development

   # Database
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=smartplant_db

   # JWT
   JWT_SECRET=your_super_secret_jwt_key_change_this
   JWT_REFRESH_SECRET=your_refresh_token_secret
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # Email (Nodemailer)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password

   # Upload
   MAX_FILE_SIZE=10485760
   UPLOAD_PATH=./uploads
   ```

4. **Setup MySQL database**
   ```bash
   # Login to MySQL
   mysql -u root -p

   # Create database
   CREATE DATABASE smartplant_db;

   # Import schema
   USE smartplant_db;
   SOURCE sql/init.sql;
   ```

5. **Start the server**
   ```bash
   npm start
   # Server runs on http://localhost:3000
   ```

6. **Test the API**
   ```bash
   curl http://localhost:3000/api/health
   ```

---

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install AI/ML dependencies**
   ```bash
   npm install react-native-fast-tflite
   npm install jpeg-js
   npm install base64-arraybuffer
   ```

4. **Configure API endpoint**

   Edit `src/services/PlantClassifierService.js`:
   ```javascript
   const API_BASE_URL = 'http://YOUR_IP_ADDRESS:3000/api';
   // Replace YOUR_IP_ADDRESS with your backend server IP
   ```

5. **Copy TFLite model to Android assets**

   The model should already be in:
   - `assets/model/plant_classifier.tflite`
   - `assets/model/labels.json`

   For Android, ensure it's also in:
   - `android/app/src/main/assets/plant_classifier.tflite`

6. **Start the development server**
   ```bash
   npx expo start
   ```

7. **Run on device/emulator**

   **For Android:**
   ```bash
   npx expo run:android
   ```

   **For iOS (macOS only):**
   ```bash
   npx expo run:ios
   ```

   **Using Expo Go App:**
   - Install "Expo Go" app on your phone
   - Scan the QR code from terminal
   - App will load on your device

---

### IoT Setup

1. **Install Python dependencies**
   ```bash
   cd IOT/backend
   pip install -r requirements.txt
   ```

   Create `requirements.txt`:
   ```txt
   paho-mqtt==1.6.1
   mysql-connector-python==8.0.33
   python-dotenv==1.0.0
   ```

2. **Setup environment variables**
   ```bash
   # Create .env file
   cd IOT/backend
   nano .env
   ```

   Add configuration:
   ```env
   # MQTT Configuration
   MQTT_BROKER=localhost
   MQTT_PORT=1883
   MQTT_USERNAME=
   MQTT_PASSWORD=

   # MySQL Configuration
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=smartplant_db

   # Alert Thresholds
   TEMP_MIN=15
   TEMP_MAX=35
   HUMIDITY_MIN=30
   HUMIDITY_MAX=80
   SOUND_THRESHOLD=80
   MOTION_THRESHOLD=5
   ```

3. **Install Mosquitto MQTT Broker**

   **Ubuntu/Debian:**
   ```bash
   sudo apt-get install mosquitto mosquitto-clients
   sudo systemctl start mosquitto
   sudo systemctl enable mosquitto
   ```

   **macOS:**
   ```bash
   brew install mosquitto
   brew services start mosquitto
   ```

   **Windows:**
   Download from: https://mosquitto.org/download/

4. **Upload microcontroller code**

   - Open `microcontroller/microcontroller.ino` in Arduino IDE
   - Configure WiFi and MQTT settings:
     ```cpp
     const char* ssid = "YOUR_WIFI_SSID";
     const char* password = "YOUR_WIFI_PASSWORD";
     const char* mqtt_server = "YOUR_MQTT_BROKER_IP";
     ```
   - Upload to your ESP32/Arduino board

5. **Start IoT services**

   **Terminal 1 - MQTT to MySQL Bridge:**
   ```bash
   cd IOT/backend
   python mqtt_to_mysql.py
   ```

   **Terminal 2 - Alert Monitor:**
   ```bash
   python alert_monitor.py
   ```

6. **Test alerts**
   ```bash
   cd test_alerts
   python test_motion_alert.py
   python test_abnormal_temperature.py
   ```

---

## 💻 Usage

### User Workflow

1. **Register/Login**
   - Open the SmartPlant app
   - Create account or login with existing credentials
   - Complete MFA setup (if enabled)

2. **Identify Plants**
   - Tap "Upload" or camera icon
   - Take photo or select from gallery
   - AI model processes image (offline/online)
   - View top 5 predictions with confidence scores

3. **View Plant Details**
   - Tap on identified plant
   - See species information, habitat, conservation status
   - View similar observations on map

4. **Explore Map**
   - Browse plant observations by location
   - Filter by species or date
   - View nearby conservation zones

5. **Manage Profile**
   - View observation history
   - Update profile information
   - Check statistics and achievements

### Admin Workflow

1. **Login as Admin**
   - Use admin credentials
   - Access admin dashboard

2. **Monitor IoT Devices**
   - View real-time sensor data
   - Check environmental alerts
   - Review poaching detection events

3. **Manage Users**
   - View user list
   - Approve/reject expert applications
   - Suspend accounts if needed

4. **Review Observations**
   - Verify user-submitted identifications
   - Flag incorrect classifications
   - Curate plant database

---

## 📡 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "user"
}

Response: 201 Created
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": 1,
    "username": "john_doe",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```

### Plant Identification Endpoints

#### Identify Plant
```http
POST /api/identify
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
  - image: (binary file)
  - latitude: 3.1390
  - longitude: 101.6869

Response: 200 OK
{
  "success": true,
  "data": {
    "predictions": [
      {
        "species": "Rafflesia arnoldii",
        "confidence": 92.5,
        "source": "online"
      },
      {
        "species": "Nepenthes rajah",
        "confidence": 4.2,
        "source": "online"
      }
    ],
    "location": {
      "latitude": 3.1390,
      "longitude": 101.6869
    }
  }
}
```

### Observation Endpoints

#### Get All Observations
```http
GET /api/observations?page=1&limit=20
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": {
    "observations": [
      {
        "id": 1,
        "species": "Rafflesia arnoldii",
        "confidence": 92.5,
        "latitude": 3.1390,
        "longitude": 101.6869,
        "imageUrl": "http://localhost:3000/uploads/image1.jpg",
        "userId": 1,
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 100
    }
  }
}
```

### IoT Endpoints

#### Get Sensor Data
```http
GET /api/iot/sensors?deviceId=ESP32_001&startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": 1,
      "deviceId": "ESP32_001",
      "temperature": 28.5,
      "humidity": 65.3,
      "soundLevel": 45.2,
      "motionDetected": false,
      "timestamp": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

#### Get Alerts
```http
GET /api/iot/alerts?status=active&page=1&limit=20
Authorization: Bearer <token>

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "poaching_alert",
      "severity": "critical",
      "message": "Motion detected in protected zone",
      "deviceId": "ESP32_001",
      "latitude": 3.1390,
      "longitude": 101.6869,
      "status": "active",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## 🛰️ IoT Monitoring

### MQTT Topics

```
smartplant/sensors/ESP32_001/temperature
smartplant/sensors/ESP32_001/humidity
smartplant/sensors/ESP32_001/sound
smartplant/sensors/ESP32_001/motion
smartplant/alerts/poaching
smartplant/alerts/environmental
```

### Alert Types

| Alert Type | Trigger Condition | Severity |
|-----------|------------------|----------|
| **Abnormal Temperature** | < 15°C or > 35°C | Warning |
| **Humidity Fluctuation** | < 30% or > 80% | Warning |
| **Sound Spike** | > 80 dB | Medium |
| **Motion Alert** | Motion detected | Medium |
| **Poaching Alert** | Motion + Sound spike | Critical |

### Test Alerts

```bash
# Navigate to test directory
cd IOT/backend/test_alerts

# Test motion detection
python test_motion_alert.py

# Test temperature anomaly
python test_abnormal_temperature.py

# Test humidity fluctuation
python test_humidity_fluctuation.py

# Test sound spike
python test_sound_spike.py

# Test poaching alert (combined)
python test_poaching_alert.py
```

---

## 🤖 AI Model

### Model Specifications

- **Architecture**: MobileNetV2 (transfer learning)
- **Input Shape**: `[1, 224, 224, 3]` (RGB images)
- **Output Shape**: `[1, 30]` (30 plant species probabilities)
- **Data Type**: `float32`
- **Model Size**: ~3.5 MB
- **Inference Time**: ~100ms (offline on mobile)

### Supported Species (30 Malaysian Flora)

1. Rafflesia arnoldii
2. Nepenthes rajah
3. Hibiscus rosa-sinensis
4. Bougainvillea spectabilis
5. Dendrobium nobile
6. Polyalthia longifolia
7. Rhizophora apiculata
8. Eusideroxylon zwageri
9. *... (22 more species)*

### Model Training

```python
# Convert Keras model to TFLite
cd backend/src/services/ai-services
python convertionScript.py
```

### Preprocessing Pipeline

```javascript
// Image → Tensor conversion
1. Resize image to 224x224
2. Decode JPEG to RGB pixels (jpeg-js)
3. Normalize pixel values [0, 1]
4. Convert to Float32Array
5. Pass to TFLite model
```


---



## 🙏 Acknowledgments

- **TensorFlow Team** - For the amazing ML framework
- **React Native Community** - For mobile development tools
- **Expo Team** - For simplifying React Native development
- **Mosquitto Project** - For the MQTT broker


---

## 📞 Support

For issues, questions, or suggestions:

- **GitHub Issues**: [Create an issue](https://github.com/yourusername/smartplant/issues)
- **Email**: support@smartplant.com
- **Documentation**: [Wiki](https://github.com/yourusername/smartplant/wiki)


---

<div align="center">

**Built with ❤️ by the COS30049 Pandai Team**

![Made with React Native](https://img.shields.io/badge/Made%20with-React%20Native-61DAFB?style=for-the-badge&logo=react)
![Powered by TensorFlow](https://img.shields.io/badge/Powered%20by-TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow)
![MQTT Integration](https://img.shields.io/badge/MQTT-Integration-660066?style=for-the-badge&logo=mqtt)

[⬆ Back to Top](#-smartplant---intelligent-plant-conservation--monitoring-system)

</div>