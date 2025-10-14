import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, TextInput, Image, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import PlantClassifierService from '../services/PlantClassifierService';

const UploadScreen = () => {
  const navigation = useNavigation();
  const [image, setImage] = useState(null);
  const [plantName, setPlantName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [confidenceScore, setConfidenceScore] = useState(0);

  useEffect(() => {
    // Pre-load the model when screen mounts
    PlantClassifierService.loadModel();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is required to upload images');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      // Auto-classify when image is selected
      classifyPlantImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to take photos');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      // Auto-classify when photo is taken
      classifyPlantImage(result.assets[0].uri);
    }
  };

  const classifyPlantImage = async (imageUri) => {
    setIsClassifying(true);
    setPredictions([]);
    
    try {
      const results = await PlantClassifierService.classifyImage(imageUri);
      setPredictions(results);
      
      // Auto-fill form with top prediction
      if (results.length > 0) {
        const topPrediction = results[0];
        setPlantName(topPrediction.species);
        setConfidenceScore(topPrediction.confidence);
        
        // Optionally set scientific name if available
        // setScientificName(topPrediction.scientificName);
      }
    } catch (error) {
      Alert.alert('Classification Error', 'Failed to identify plant. Please try again.');
      console.error('Classification error:', error);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmit = () => {
    if (!image || !plantName) {
      Alert.alert('Missing Information', 'Please provide at least an image and plant name');
      return;
    }

    // Here you would call your API to upload data
    const plantData = {
      id: Date.now().toString(),
      name: plantName,
      scientificName,
      description,
      location,
      image,
      confidenceScore,
      discoveredBy: 'Current User',
      discoveryDate: new Date().toISOString().split('T')[0],
      predictions: predictions
    };

    console.log('Uploading plant data:', plantData);
    Alert.alert('Success', 'Plant observation uploaded successfully!');
    
    // Reset form
    setImage(null);
    setPlantName('');
    setScientificName('');
    setDescription('');
    setLocation('');
    setPredictions([]);
    setConfidenceScore(0);
    
    // Navigate to map
    navigation.navigate('Map');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Upload New Plant Discovery</Text>
      
      {/* Image Upload Section */}
      <View style={styles.uploadSection}>
        {image ? (
          <Image source={{ uri: image }} style={styles.imagePreview} />
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Text style={styles.uploadText}>Select Plant Image</Text>
          </View>
        )}
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Classification Loading */}
        {isClassifying && (
          <View style={styles.classifyingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.classifyingText}>Identifying plant...</Text>
          </View>
        )}

        {/* AI Predictions */}
        {predictions.length > 0 && !isClassifying && (
          <View style={styles.predictionsContainer}>
            <Text style={styles.predictionsTitle}>🤖 AI Identification Results:</Text>
            {predictions.slice(0, 3).map((prediction, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.predictionItem,
                  index === 0 && styles.topPrediction
                ]}
                onPress={() => {
                  setPlantName(prediction.species);
                  setConfidenceScore(prediction.confidence);
                }}
              >
                <View style={styles.predictionContent}>
                  <Text style={styles.predictionRank}>#{index + 1}</Text>
                  <View style={styles.predictionInfo}>
                    <Text style={styles.predictionSpecies}>
                      {prediction.species}
                    </Text>
                    <Text style={styles.predictionConfidence}>
                      {prediction.confidence}% confidence
                    </Text>
                  </View>
                </View>
                {index === 0 && (
                  <Text style={styles.autoFilledBadge}>Auto-filled</Text>
                )}
              </TouchableOpacity>
            ))}
            <Text style={styles.predictionNote}>
              Tap a result to use it in the form
            </Text>
          </View>
        )}
      </View>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Plant Name *"
          value={plantName}
          onChangeText={setPlantName}
        />

        {confidenceScore > 0 && (
          <Text style={styles.confidenceLabel}>
            AI Confidence: {confidenceScore}%
          </Text>
        )}
        
        <TextInput
          style={styles.input}
          placeholder="Scientific Name"
          value={scientificName}
          onChangeText={setScientificName}
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Discovery Location"
          value={location}
          onChangeText={setLocation}
        />
        
        <TouchableOpacity 
          style={[styles.submitButton, (!image || !plantName) && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={!image || !plantName}
        >
          <Text style={styles.submitButtonText}>Upload Observation</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  uploadSection: {
    alignItems: 'center',
    padding: 20,
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
  },
  uploadPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
  },
  uploadText: {
    color: '#666',
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  classifyingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  classifyingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  predictionsContainer: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  predictionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  predictionItem: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  topPrediction: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#f0f8f0',
  },
  predictionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  predictionRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 12,
    width: 30,
  },
  predictionInfo: {
    flex: 1,
  },
  predictionSpecies: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  predictionConfidence: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  autoFilledBadge: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 5,
  },
  predictionNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 10,
    fontWeight: '600',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default UploadScreen;