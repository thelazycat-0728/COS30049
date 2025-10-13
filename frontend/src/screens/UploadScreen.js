// screens/UploadScreen.js
import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, TextInput, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

const UploadScreen = () => {
  const navigation = useNavigation();
  const [image, setImage] = useState(null);
  const [plantName, setPlantName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      alert('Photo library permission is required to upload images');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      alert('Camera permission is required to take photos');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    if (!image || !plantName) {
      alert('Please provide at least an image and plant name');
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
      discoveredBy: 'Current User',
      discoveryDate: new Date().toISOString().split('T')[0]
    };

    alert('Plant observation uploaded successfully!');
    
    // Reset form
    setImage(null);
    setPlantName('');
    setScientificName('');
    setDescription('');
    setLocation('');
    
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
      </View>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Plant Name *"
          value={plantName}
          onChangeText={setPlantName}
        />
        
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