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
    latitude DECIMAL(15,14),
    longitude DECIMAL(15,12),
    observation_date DATETIME NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    status ENUM('pending', 'verified', 'unsure', 'rejected') NOT NULL DEFAULT 'pending',
    verified_by INT NULL,
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

CREATE TABLE token_blacklist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_expires (expires_at)
);

CREATE TABLE training_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  triggered_by INT NOT NULL,
  status ENUM('pending', 'in_progress', 'completed', 'failed') DEFAULT 'pending',
  num_images INT DEFAULT 0,
  num_species INT DEFAULT 0,
  training_accuracy DECIMAL(5, 4) NULL,
  validation_accuracy DECIMAL(5, 4) NULL,
  model_version VARCHAR(50) NULL,
  error_message TEXT NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (triggered_by) REFERENCES Users(user_id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_created (created_at)
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
CREATE INDEX idx_plant_observations_verified_by ON PlantObservations(verified_by);

-- Sample data
-- Insert into Users
INSERT INTO Users (username, email, password_hash, role, language_preference)
VALUES ('john_doe', 'john@example.com', 'hashedpassword123', 'public', 'en');

-- Insert into Plants
INSERT INTO Plants (scientific_name, common_name, family, description, conservation_status)
VALUES (
        'Acalypha Hispida',
        'Chenille Plant',
        'Euphorbiaceae',
        'A tropical shrub known for its long, red, fuzzy flower spikes resembling a cat’s tail.',
        'least_concern'
    ),
    (
        'Bambusa Vulgaris',
        'Common Bamboo',
        'Poaceae',
        'A fast-growing bamboo species used for construction, crafts, and erosion control.',
        'least_concern'
    ),
    (
        'Hymenocallis Littoralis',
        'Beach Spider Lily',
        'Amaryllidaceae',
        'An ornamental plant with white, spider-like flowers found in coastal regions.',
        'least_concern'
    ),
    (
        'Piper Nigrum',
        'Black Pepper',
        'Piperaceae',
        'A flowering vine cultivated for its peppercorns, used worldwide as a spice.',
        'least_concern'
    ),
    (
        'Phalaenopsis Bellina',
        'Bellina Orchid',
        'Orchidaceae',
        'A fragrant orchid species with vibrant purple and white flowers native to Borneo.',
        'endangered'
    ),
    (
        'Bougainvillea',
        'Paper Flower',
        'Nyctaginaceae',
        'A thorny ornamental vine known for its colorful, papery bracts surrounding small white flowers.',
        'least_concern'
    ),
    (
        'Bulbophyllum Beccarii',
        'Beccari’s Bulbophyllum',
        'Orchidaceae',
        'A large epiphytic orchid known for its unique, foul-smelling flowers that attract flies.',
        'endangered'
    ),
    (
        'Couroupita Guianensis',
        'Cannonball Tree',
        'Lecythidaceae',
        'A tropical tree producing large, spherical fruits and fragrant flowers sacred in India.',
        'least_concern'
    ),
    (
        'Coelogyne Nitida',
        'Brilliant Coelogyne',
        'Orchidaceae',
        'An epiphytic orchid with elegant white flowers and yellow-tipped lips.',
        'endangered'
    ),
    (
        'Cordyline Fruticosa',
        'Ti Plant',
        'Asparagaceae',
        'A tropical plant with colorful foliage, used ornamentally and in traditional rituals.',
        'least_concern'
    ),
    (
        'Dendrobium Nobile',
        'Noble Dendrobium',
        'Orchidaceae',
        'An ornamental orchid with fragrant purple-white flowers, widely cultivated in Asia.',
        'least_concern'
    ),
    (
        'Dipteris Conjugata',
        'Umbrella Fern',
        'Dipteridaceae',
        'A rare fern with fan-shaped fronds resembling butterfly wings, found in tropical forests.',
        'near_threatened'
    ),
    (
        'Eusideroxylon Zwageri',
        'Bornean Ironwood',
        'Lauraceae',
        'A slow-growing hardwood tree highly valued for its durable timber.',
        'endangered'
    ),
    (
        'Pteridium Aquilinum',
        'Bracken Fern',
        'Dennstaedtiaceae',
        'A large, cosmopolitan fern species common in temperate and tropical regions.',
        'least_concern'
    ),
    (
        'Zingiber Officinale',
        'Ginger',
        'Zingiberaceae',
        'A herbaceous plant cultivated for its aromatic rhizomes used in food and medicine.',
        'least_concern'
    ),
    (
        'Heliconia Rostrata',
        'Lobster Claw',
        'Heliconiaceae',
        'A tropical plant with hanging red and yellow bracts resembling lobster claws.',
        'least_concern'
    ),
    (
        'Hibiscus Rosa-Sinensis',
        'China Rose',
        'Malvaceae',
        'An evergreen shrub with large, colorful flowers, often used as an ornamental plant.',
        'least_concern'
    ),
    (
        'Polyalthia Longifolia',
        'False Ashoka',
        'Annonaceae',
        'A tall, slender tree with cascading foliage often used in landscaping.',
        'least_concern'
    ),
    (
        'Ixora',
        'Jungle Flame',
        'Rubiaceae',
        'A flowering shrub known for its dense clusters of small, brightly colored flowers.',
        'least_concern'
    ),
    (
        'Licuala Orbicularis',
        'Circular Fan Palm',
        'Arecaceae',
        'A palm species with large, perfectly round leaves native to Southeast Asia.',
        'vulnerable'
    ),
    (
        'Rhizophora Apiculata',
        'Mangrove',
        'Rhizophoraceae',
        'A salt-tolerant tree forming dense mangrove forests that protect coastal ecosystems.',
        'least_concern'
    ),
    (
        'Nepenthes Lowii',
        'Low’s Pitcher Plant',
        'Nepenthaceae',
        'A carnivorous pitcher plant with unique adaptations for nutrient capture.',
        'endangered'
    ),
    (
        'Nepenthes Rajah',
        'Rajah Pitcher Plant',
        'Nepenthaceae',
        'The largest pitcher plant species, capable of trapping small vertebrates.',
        'endangered'
    ),
    (
        'Asplenium Nidus',
        'Bird’s Nest Fern',
        'Aspleniaceae',
        'An epiphytic fern with rosette-shaped fronds resembling a bird’s nest.',
        'least_concern'
    ),
    (
        'Nypa Fruticans',
        'Nipa Palm',
        'Arecaceae',
        'A mangrove palm found in tidal zones, known for its use in thatching and vinegar production.',
        'least_concern'
    ),
    (
        'Elaeis Guineensis',
        'African Oil Palm',
        'Arecaceae',
        'A tropical palm cultivated for its oil-rich fruit used in food and cosmetics.',
        'least_concern'
    ),
    (
        'Paphiopedilum Sanderianum',
        'Sander’s Paphiopedilum',
        'Orchidaceae',
        'A rare slipper orchid with extremely long, ribbon-like petals.',
        'endangered'
    ),
    (
        'Phalaenopsis Gigantea',
        'Giant Moth Orchid',
        'Orchidaceae',
        'The largest Phalaenopsis species with broad, mottled leaves and fragrant flowers.',
        'vulnerable'
    ),
    (
        'Rafflesia Tuan-Mudae',
        'Corpse Flower',
        'Rafflesiaceae',
        'A parasitic plant producing one of the largest flowers in the world with a foul odor.',
        'endangered'
    ),
    (
        'Cycas Revoluta',
        'Sago Palm',
        'Cycadaceae',
        'A slow-growing cycad with feathery leaves, often used as an ornamental plant.',
        'least_concern'
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
    'verified',
    1
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
