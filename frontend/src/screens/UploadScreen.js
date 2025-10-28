import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import MapView, { Marker } from 'react-native-maps';
import { useNavigation } from "@react-navigation/native";
//import PlantClassifierService from "../services/PlantClassifierService";     (unused for now)

import NetInfo from "@react-native-community/netinfo";

const UploadScreen = () => {
  const navigation = useNavigation();
  const [image, setImage] = useState(null);
  const [plantName, setPlantName] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  // New states for secure backend processing and map
  const [uploading, setUploading] = useState(false);
  const [extractedCoords, setExtractedCoords] = useState(null); // { lat, lon }
  const [mapRegion, setMapRegion] = useState(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(null);
  const [backendImageUrl, setBackendImageUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageSourceType, setImageSourceType] = useState(null); // 'camera' or 'file'
  const [tempImageData, setTempImageData] = useState(null); // Store image data before upload
  const backendImageUrlRef = useRef(null);

  
  // Helper: extract decimal coords from EXIF data for immediate preview
  const extractCoordsFromExif = (exif) => {
    if (!exif) return null;
    const scope = exif.GPS ? exif.GPS : exif;
    const latVal = scope?.GPSLatitude ?? scope?.Latitude;
    const lonVal = scope?.GPSLongitude ?? scope?.Longitude;
    const latRef = scope?.GPSLatitudeRef ?? scope?.LatitudeRef;
    const lonRef = scope?.GPSLongitudeRef ?? scope?.LongitudeRef;
    const toDec = (val, ref) => {
      if (Array.isArray(val) && val.length >= 3) {
        const [d, m, s] = val;
        let dec = Number(d) + Number(m) / 60 + Number(s) / 3600;
        if (ref === 'S' || ref === 'W') dec = -dec;
        return dec;
      }
      if (typeof val === 'number') {
        let dec = val;
        if (ref === 'S' || ref === 'W') dec = -Math.abs(dec);
        if (ref === 'N' || ref === 'E') dec = Math.abs(dec);
        return dec;
      }
      return null;
    };
    const lat = toDec(latVal, latRef);
    const lon = toDec(lonVal, lonRef);
    return (typeof lat === 'number' && typeof lon === 'number') ? { lat, lon } : null;
  };
  // In production, prefer an https URL and load from config/env
  const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

  // useEffect(() => {
  //   // Pre-load the model when screen mounts
  //   PlantClassifierService.loadModel();
  // }, []);   (unused for now)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Cleanup: Delete image when component unmounts if not submitted
  useEffect(() => {
    return () => {
      if (backendImageUrl) {
        deleteImageFromBackend(backendImageUrl);
      }
    };
  }, []);

  // Delete image from backend
  const deleteImageFromBackend = async (imageUrl) => {
    try {
      await fetch(`${API_BASE}/identify/delete-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      console.log('Image deleted from backend:', imageUrl);
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  // Upload a picked file to backend to extract EXIF GPS and store image
  const uploadFileToBackend = async (asset) => {
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        name: asset.name || 'upload.jpg',
        type: asset.mimeType || 'image/jpeg',
      });

      const res = await fetch(`${API_BASE}/identify/extract-location`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          // Do NOT set Content-Type here; let fetch set multipart boundary
        },
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || `Upload failed (HTTP ${res.status})`;
        Alert.alert('Upload error', msg);
        return;
      }

      const coords = data?.coordinates || null;
      const uploadedUrl = data?.image_url || null;

      if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
        setExtractedCoords(coords);
        setGoogleMapsUrl(data?.googleMapsUrl || null);
        setMapRegion({
          latitude: coords.lat,
          longitude: coords.lon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } else {
        Alert.alert('No GPS data', 'No embedded GPS coordinates were found in this image.');
      }
    return uploadedUrl;  
    } catch (err) {
      console.error('uploadFileToBackend error:', err);
      Alert.alert('Network error', 'Failed to process the image. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };
  
  // Upload a camera-captured image by reading base64 and posting JSON
  const uploadBase64ToBackend = async (imageUri) => {
    try {
      setUploading(true);

      let base64;
      try {
        base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
      } catch (e) {
        const res = await fetch(imageUri);
        const blob = await res.blob();
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result;
            resolve(typeof dataUrl === 'string' ? dataUrl.split(',')[1] : '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      const filename = `camera-${Date.now()}.jpg`;

      const res = await fetch(`${API_BASE}/identify/extract-location-base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ image: base64, filename }),
      });
      
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || `Upload failed (HTTP ${res.status})`;
        Alert.alert('Upload error', msg);
        return null;
      }

      const coords = data?.coordinates || null;
      const uploadedUrl = data?.image_url || null;
      
      if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
        setExtractedCoords(coords);
        setGoogleMapsUrl(data?.googleMapsUrl || null);
        setMapRegion({
          latitude: coords.lat,
          longitude: coords.lon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } else {
        Alert.alert('No GPS data', 'No embedded GPS coordinates were found in this image.');
      }
      
      return uploadedUrl;
    } catch (err) {
      console.error('uploadBase64ToBackend error:', err);
      Alert.alert('Network error', 'Failed to process the image. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Select image from device file library with EXIF for immediate location preview
  const pickFile = async () => {
    try {
      // Clear previous image if exists
      if (backendImageUrl) {
        await deleteImageFromBackend(backendImageUrl);
        setBackendImageUrl(null);
      }
      
      resetForm();

      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) return;
      
      const asset = Array.isArray(result.assets) ? result.assets[0] : result;
      if (!asset?.uri) {
        Alert.alert('Selection error', 'No file selected.');
        return;
      }

      if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
        Alert.alert('Invalid file', 'Please select an image file.');
        return;
      }

      const previewUri = asset.uri || (asset.file && URL.createObjectURL(asset.file)) || null;
      setImage(previewUri);
      setImageSourceType('file');
      setTempImageData({
        uri: asset.uri || null,
        name: asset.name || 'upload.jpg',
        mimeType: asset.mimeType || asset.type || 'image/jpeg',
        file: asset.file || null,
      });
    } catch (err) {
      console.error('pickFile error:', err);
      Alert.alert('Permission or selection error', 'Unable to access files. Check permissions and try again.');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera permission is required to take photos"
      );
      return;
    }

    // Clear previous image if exists
    if (backendImageUrl) {
      await deleteImageFromBackend(backendImageUrl);
      setBackendImageUrl(null);
    }
    
    resetForm();

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      exif: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const uri = asset.uri;
      setImage(uri);
      setImageSourceType('camera');
      setTempImageData({
        uri: uri,
        exif: asset.exif,
        fileName: asset.fileName || `camera-${Date.now()}.jpg`,
        mimeType: asset.type || 'image/jpeg',
      });
      
      // Show preview of coordinates if available
      const coords = extractCoordsFromExif(asset.exif || null);
      if (coords) {
        setExtractedCoords(coords);
        setGoogleMapsUrl(`https://maps.google.com/?q=${coords.lat},${coords.lon}`);
        setMapRegion({
          latitude: coords.lat,
          longitude: coords.lon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    }
  };

  const submitObservationToBackend = async () => {
    try {
      if (!backendImageUrl) {
        Alert.alert('Missing image', 'No uploaded image URL found. Please classify an image first.');
        return;
      }
      
      setSaving(true);
      const lat = extractedCoords?.lat ?? null;
      const lon = extractedCoords?.lon ?? null;
      
      const res = await fetch(`${API_BASE}/identify/submit-observation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ image_url: backendImageUrl, lat, lon }),
      });
      
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || `Submit failed (HTTP ${res.status})`;
        Alert.alert('Submit error', msg);
        return;
      }
      
      Alert.alert('Success', 'Observation saved successfully');
      
      // Clear the backendImageUrl so it won't be deleted on unmount
      setBackendImageUrl(null);
      resetForm();
      
    } catch (err) {
      console.error('submitObservationToBackend error:', err);
      Alert.alert('Network error', 'Failed to submit observation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // const classifyPlantImage = async (imageUri) => {
  //   setIsClassifying(true);
  //   setPredictions([]);

  //   try {
  //     console.log("Classifying image:", imageUri);
  //     const results = await PlantClassifierService.classifyImage(imageUri);
  //     setPredictions(results);

  //     // Auto-fill form with top prediction
  //     if (results.length > 0) {
  //       const topPrediction = results[0];
  //       setPlantName(topPrediction.species);
  //       setConfidenceScore(topPrediction.confidence);

  //       // Optionally set scientific name if available
  //       // setScientificName(topPrediction.scientificName);
  //     }
  //   } catch (error) {
  //     Alert.alert(
  //       "Classification Error",
  //       "Failed to identify plant. Please try again."
  //     );
  //     console.error("Classification error:", error);
  //   } finally {
  //     setIsClassifying(false);
  //   }
  // };           (unused for now)

  //Classify Plant From Backend Server
  const classifyPlantViaBackend = async () => {
    if (!tempImageData) {
      Alert.alert('No image selected', 'Please select an image first.');
      return;
    }

    try {
      // Delete old image if exists
      if (backendImageUrl) {
        await deleteImageFromBackend(backendImageUrl);
      }

      let uploadedUrl = null;

      // Upload based on source type
      if (imageSourceType === 'file') {
        uploadedUrl = await uploadFileToBackend(tempImageData);
      } else if (imageSourceType === 'camera') {
        uploadedUrl = await uploadBase64ToBackend(tempImageData.uri);
      }

      if (!uploadedUrl) {
        Alert.alert('Upload failed', 'Failed to upload image to server.');
        return;
      }

      setBackendImageUrl(uploadedUrl);

      // Now classify the uploaded image
      setIsClassifying(true);
      setPredictions([]);

      const response = await fetch(`${API_BASE}/identify/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: uploadedUrl }),
      });

      const data = await response.json();
      
      if (data.success && data.predictions) {
        console.log("✅ Classification result:", data);
        setPredictions(data.predictions);
        
        if (data.predictions.length > 0) {
          const top = data.predictions[0];
          setPlantName(top.species || top.className);
          setConfidenceScore(top.confidence || top.probability);
        }
      } else {
        Alert.alert('Classification failed', data.error || 'Unknown error');
      }
    } catch (err) {
      console.error("Classification error:", err);
      Alert.alert('Error', 'Failed to classify plant.');
    } finally {
      setIsClassifying(false);
    }
  };

  // Cancel and delete uploaded image
  const cancelAndReset = async () => {
    if (backendImageUrl) {
      await deleteImageFromBackend(backendImageUrl);
    }
    resetForm();
  };


  const resetForm = () => {
    setImage(null);
    setPredictions([]);
    setConfidenceScore(0);
    setPlantName('');
    setScientificName('');
    setDescription('');
    setExtractedCoords(null);
    setMapRegion(null);
    setGoogleMapsUrl(null);
    setImageSourceType(null);
    setTempImageData(null);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Upload New Plant Discovery</Text>

      <View style={styles.statusBar}>
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              📡 Offline Mode - AI disabled, using mock predictions
            </Text>
          </View>
        )}
        // {PlantClassifierService.isOfflineCapable() && (
        //   <View style={styles.offlineCapableBanner}>
        //     <Text style={styles.offlineCapableText}>✅ Offline AI Ready</Text>
        //   </View>           (unused for now)
        // )}
        {uploading && (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.classifyingText}>Processing image for location...</Text>
          </View>
        )}
      </View>

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
          <TouchableOpacity style={styles.button} onPress={pickFile}>
            <Text style={styles.buttonText}>Upload from Files</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Classify Plant button */}
        {image && !isClassifying && !backendImageUrl && (
          <TouchableOpacity 
            style={[styles.button, styles.classifyButton]} 
            onPress={classifyPlantViaBackend}
            disabled={isOffline}
          >
            <Text style={styles.buttonText}>Classify Plant</Text>
          </TouchableOpacity>
        )}

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
            <Text style={styles.predictionsTitle}>
              AI Identification Results:
            </Text>
            {predictions.slice(0, 3).map((prediction, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.predictionItem,
                  index === 0 && styles.topPrediction,
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

        {/* Location Card */}
        {extractedCoords && (
          <View style={styles.locationCard}>
            <Text style={styles.locationTitle}>Extracted Location</Text>
            <Text style={styles.locationText}>Latitude: {extractedCoords.lat.toFixed(6)}</Text>
            <Text style={styles.locationText}>Longitude: {extractedCoords.lon.toFixed(6)}</Text>
            {googleMapsUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(googleMapsUrl)}>
                <Text style={styles.openMapsLink}>Open in Maps</Text>
              </TouchableOpacity>
            )}
            <View style={styles.mapContainer}>
              {mapRegion && (
                <MapView
                  style={styles.map}
                  region={mapRegion}
                  initialRegion={mapRegion}
                >
                  <Marker coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }} />
                </MapView>
              )}
            </View>
          </View>
        )}
        {/* Action Buttons */}
        {backendImageUrl && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={cancelAndReset}
              disabled={saving}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={submitObservationToBackend}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? 'Saving...' : 'Submit Observation'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Form */}
      {/* Simplified layout: form removed to focus on two primary actions */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  statusBar: {
    width: "100%",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  offlineBanner: {
    backgroundColor: "#FF9800",
    padding: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  offlineText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  offlineCapableBanner: {
    backgroundColor: "#4CAF50",
    padding: 8,
    borderRadius: 8,
  },
  offlineCapableText: {
    color: "white",
    textAlign: "center",
    fontSize: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
  },
  uploadSection: {
    alignItems: "center",
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
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ccc",
  },
  uploadText: {
    color: "#666",
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  classifyingContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  classifyingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  predictionsContainer: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  predictionsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  predictionItem: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  topPrediction: {
    borderColor: "#4CAF50",
    borderWidth: 2,
    backgroundColor: "#f0f8f0",
  },
  predictionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  predictionRank: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
    marginRight: 12,
    width: 30,
  },
  predictionInfo: {
    flex: 1,
  },
  predictionSpecies: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  predictionConfidence: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  autoFilledBadge: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "bold",
    marginTop: 5,
  },
  predictionNote: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    marginTop: 8,
    textAlign: "center",
  },
  form: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  confidenceLabel: {
    fontSize: 14,
    color: "#4CAF50",
    marginBottom: 10,
    fontWeight: "600",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: "#cccccc",
  },
  submitButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  uploadingContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  locationCard: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  locationText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  openMapsLink: {
    color: "#1e88e5",
    fontWeight: "600",
    marginBottom: 10,
  },
  mapContainer: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  map: {
    width: "100%",
    height: 220,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
  },
  submitButton: {
    backgroundColor: "#4CAF50",
    flex: 1,
    marginLeft: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f44336",
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  classifyButton: {
  width: "90%",
  alignItems: "center",
  marginTop: 10,
},
});

export default UploadScreen;
