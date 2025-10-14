-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS Alerts;
DROP TABLE IF EXISTS AuditLogs;
DROP TABLE IF EXISTS SensorReadings;
DROP TABLE IF EXISTS PlantObservations;
DROP TABLE IF EXISTS IoTSensors;
DROP TABLE IF EXISTS Plants;
DROP TABLE IF EXISTS Users;

-- Create Users table
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('public', 'expert', 'admin') NOT NULL DEFAULT 'public',
    language_preference VARCHAR(20) DEFAULT 'en',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Plants table
CREATE TABLE Plants (
    plant_id INT AUTO_INCREMENT PRIMARY KEY,
    scientific_name VARCHAR(255) NOT NULL,
    species VARCHAR(255),
    common_name VARCHAR(255),
    family VARCHAR(255),
    description TEXT,
    conservation_status ENUM('least_concern', 'near_threatened', 'vulnerable', 'endangered', 'critically_endangered') DEFAULT 'least_concern',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create PlantObservations table
CREATE TABLE PlantObservations (
    observation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plant_id INT NOT NULL,
    public BOOLEAN,
    image_url VARCHAR(500),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    observation_date DATETIME NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    status ENUM('pending', 'verified', 'unsure', 'rejected') NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (plant_id) REFERENCES Plants(plant_id) ON DELETE CASCADE
);

-- Create IoTSensors table
CREATE TABLE IoTSensors (
    sensor_id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_name VARCHAR(100) NOT NULL,
    location_description VARCHAR(255),
    observation_id INT,
    status ENUM('active', 'inactive', 'maintenance') NOT NULL DEFAULT 'active',
    last_checked DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (observation_id) REFERENCES PlantObservations(observation_id) ON DELETE SET NULL
);

CREATE TABLE SensorReadings (
    reading_id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id INT NOT NULL,
    reading_type ENUM('temperature', 'humidity', 'soil_moisture', 'sound', 'motion') NOT NULL,
    reading_value DECIMAL(10,2) NOT NULL,
    reading_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sensor_id) REFERENCES IoTSensors(sensor_id) ON DELETE CASCADE
);

-- Create AuditLogs table
CREATE TABLE AuditLogs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_table VARCHAR(80) NOT NULL,
    target_id INT NOT NULL,
    action_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Create Alerts table
CREATE TABLE Alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id INT,
    observation_id INT,
    alert_type ENUM('abnormal_sensor', 'poaching_alert') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
    score DECIMAL(4,2),
    description TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sensor_id) REFERENCES IoTSensors(sensor_id) ON DELETE SET NULL,
    FOREIGN KEY (observation_id) REFERENCES PlantObservations(observation_id) ON DELETE SET NULL
);

CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at DATETIME NULL,
  replaced_by_token VARCHAR(500) NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_token (token),
  INDEX idx_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
)

CREATE TABLE mfa_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at DATETIME NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_code (code),
  INDEX idx_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) 

-- Create indexes for better performance
CREATE INDEX idx_sensor_readings_sensor_id ON SensorReadings(sensor_id);
CREATE INDEX idx_sensor_readings_time ON SensorReadings(reading_time);
CREATE INDEX idx_plant_observations_user_id ON PlantObservations(user_id);
CREATE INDEX idx_plant_observations_plant_id ON PlantObservations(plant_id);
CREATE INDEX idx_plant_observations_date ON PlantObservations(observation_date);
CREATE INDEX idx_alerts_sensor_id ON Alerts(sensor_id);
CREATE INDEX idx_alerts_observation_id ON Alerts(observation_id);
CREATE INDEX idx_audit_logs_user_id ON AuditLogs(user_id);
CREATE INDEX idx_audit_logs_time ON AuditLogs(action_time);

-- Sample data
-- Insert into Users
INSERT INTO Users (username, email, password_hash, role, language_preference)
VALUES ('john_doe', 'john@example.com', 'hashedpassword123', 'public', 'en');

-- Insert into Plants
INSERT INTO Plants (scientific_name, common_name, family, description, conservation_status)
VALUES (
    'Rafflesia arnoldii',
    'Corpse Flower',
    'Rafflesiaceae',
    'A rare parasitic flowering plant known for its large size and foul odor.',
    'endangered'
);

-- Insert into PlantObservations (requires valid user_id and plant_id)
INSERT INTO PlantObservations (user_id, plant_id, image_url, latitude, longitude, observation_date, confidence_score, status)
VALUES (
    1, -- user_id (john_doe)
    1, -- plant_id (Rafflesia arnoldii)
    'https://example.com/images/rafflesia1.jpg',
    1.5534000, -- example latitude
    110.3593000, -- example longitude
    '2025-10-03 10:00:00',
    0.95,
    'verified'
);

-- Insert into IoTSensors (linked to observation_id)
INSERT INTO IoTSensors (sensor_id, sensor_name, location_description, observation_id, status, last_checked)
VALUES (
    1,
    'DHT11 Temperature Sensor',
    'Near the Rafflesia observation site',
    1, 
    'active',
    '2025-10-03 10:05:00'
),
(
    2,
    'DHT11 Humidity Sensor',
    'Near the Rafflesia observation site',
    1, 
    'active',
    '2025-10-03 10:05:00'
),
(
    3,
    'PIR Motion Sensor',
    'Near the Rafflesia observation site',
    1, 
    'active',
    '2025-10-03 10:05:00'
),
(
    4,
    'Soil Moisture Sensor',
    'Near the Rafflesia observation site',
    1, 
    'active',
    '2025-10-03 10:05:00'
),
(
    5,
    'Sound Sensor',
    'Near the Rafflesia observation site',
    1, 
    'active',
    '2025-10-03 10:05:00'
);