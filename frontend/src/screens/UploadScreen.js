import React, { useState, useEffect } from "react";
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
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import MapView, { Marker } from "react-native-maps";
import { useNavigation } from "@react-navigation/native";
import PlantClassifierService from "../services/PlantClassifierService";

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
  const [pendingUpload, setPendingUpload] = useState(null);

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
  const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://192.168.0.114:3000';

  useEffect(() => {
    // Pre-load the model when screen mounts
    PlantClassifierService.loadModel();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Upload a picked file to backend to extract EXIF GPS and store image
  const uploadFileToBackend = async (asset) => {
    try {
      setUploading(true);
      setExtractedCoords(null);
      setGoogleMapsUrl(null);

      const formData = new FormData();
      // Handle web platform by using File/Blob when available
      if (asset?.file) {
        // expo-document-picker on web can provide a File instance
        formData.append('image', asset.file, asset.name || 'upload.jpg');
      } else if (Platform.OS === 'web' && asset?.uri) {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        const file = new File([blob], asset.name || 'upload.jpg', { type: blob.type || asset.mimeType || 'image/jpeg' });
        formData.append('image', file);
      } else {
        formData.append('image', {
          uri: asset.uri,
          name: asset.name || 'upload.jpg',
          type: asset.mimeType || 'image/jpeg',
        });
      }

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
    } catch (err) {
      console.error('uploadFileToBackend error:', err);
      Alert.alert('Network error', 'Failed to process the image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Upload a camera-captured image by reading base64 and posting JSON
  const uploadBase64ToBackend = async (imageUri) => {
    try {
      setUploading(true);
      setExtractedCoords(null);
      setGoogleMapsUrl(null);

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
        return;
      }

      const coords = data?.coordinates || null;
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
    } catch (err) {
      console.error('uploadBase64ToBackend error:', err);
      Alert.alert('Network error', 'Failed to process the image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Select image from device file library with EXIF for immediate location preview
  const pickFile = async () => {
    try {
      setExtractedCoords(null);
      setMapRegion(null);
      setGoogleMapsUrl(null);

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

      // Validate that the selected file is an image
      if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
        Alert.alert('Invalid file', 'Please select an image file.');
        return;
      }

      // For web, prefer preview using File object too
      const previewUri = asset.uri || (asset.file && URL.createObjectURL(asset.file)) || null;
      setImage(previewUri);
      // Run on-device classification for continuity of existing capabilities
      classifyPlantImage(previewUri);

      // Immediately upload to backend to extract GPS and render map
      await uploadFileToBackend({
        uri: asset.uri || null,
        name: asset.name || 'upload.jpg',
        mimeType: asset.mimeType || asset.type || 'image/jpeg',
        file: asset.file || null,
      });
      // Clear any pending state for file uploads (we auto-upload now)
      setPendingUpload(null);
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

    setExtractedCoords(null);
    setMapRegion(null);
    setGoogleMapsUrl(null);

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      exif: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const uri = asset.uri;
      setImage(uri);
      // Continue showing predictions as before
      classifyPlantImage(uri);
      // Mark as pending (no backend call yet)
      setPendingUpload({
        sourceType: 'camera',
        uri,
        filename: asset.fileName || `camera-${Date.now()}.jpg`,
        mimeType: asset.type || 'image/jpeg',
      });

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

  const confirmUpload = async () => {
    if (!pendingUpload) return;
    try {
      if (pendingUpload.sourceType === 'file') {
        await uploadFileToBackend(
          pendingUpload.asset || {
            uri: pendingUpload.uri,
            name: pendingUpload.filename,
            type: pendingUpload.mimeType,
          }
        );
      } else {
        await uploadBase64ToBackend(pendingUpload.uri);
      }
      setPendingUpload(null);
    } catch (err) {
      console.warn('confirmUpload error:', err);
    }
  };

  const cancelUpload = () => {
    setPendingUpload(null);
    setImage(null);
    setPredictions([]);
    setConfidenceScore(0);
    setPlantName('');
    setScientificName('');
    setDescription('');
    setExtractedCoords(null);
    setMapRegion(null);
    setGoogleMapsUrl(null);
  };

  const classifyPlantImage = async (imageUri) => {
    setIsClassifying(true);
    setPredictions([]);

    try {
      console.log("Classifying image:", imageUri);
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
      Alert.alert(
        "Classification Error",
        "Failed to identify plant. Please try again."
      );
      console.error("Classification error:", error);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmit = () => {
    if (!image || !plantName) {
      Alert.alert(
        "Missing Information",
        "Please provide at least an image and plant name"
      );
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
      discoveredBy: "Current User",
      discoveryDate: new Date().toISOString().split("T")[0],
      predictions: predictions,
    };

    console.log("Uploading plant data:", plantData);
    Alert.alert("Success", "Plant observation uploaded successfully!");

    // Reset form
    setImage(null);
    setPlantName("");
    setScientificName("");
    setDescription("");
    setLocation("");
    setPredictions([]);
    setConfidenceScore(0);

    // Navigate to map
    navigation.navigate("Map");
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Upload New Plant Discovery</Text>

      <View style={styles.statusBar}>
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              📡 Offline Mode - Using on-device AI
            </Text>
          </View>
        )}
        {PlantClassifierService.isOfflineCapable() && (
          <View style={styles.offlineCapableBanner}>
            <Text style={styles.offlineCapableText}>✅ Offline AI Ready</Text>
          </View>
        )}
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
        {image && pendingUpload && (
           <View style={styles.pendingCard}>
             <Text style={styles.pendingTitle}>Pending Upload (not saved yet)</Text>
             <Text style={styles.pendingText}>Confirm to save or cancel to discard.</Text>
             <View style={styles.pendingButtons}>
               <TouchableOpacity
                 style={[styles.button, styles.submitButtonSmall]}
                 onPress={confirmUpload}
                 disabled={uploading}
               >
                 <Text style={styles.buttonText}>{uploading ? 'Submitting...' : 'Submit'}</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 style={[styles.button, styles.cancelButtonSmall]}
                 onPress={cancelUpload}
                 disabled={uploading}
               >
                 <Text style={styles.buttonText}>Cancel</Text>
               </TouchableOpacity>
             </View>
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
  pendingCard: {
    width: "100%",
    backgroundColor: "#fff3e0",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffe0b2",
    marginTop: 10,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#e65100",
    marginBottom: 6,
  },
  pendingText: {
    fontSize: 14,
    color: "#6d4c41",
    marginBottom: 10,
  },
  pendingButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  submitButtonSmall: {
    backgroundColor: "#1976d2",
  },
  cancelButtonSmall: {
    backgroundColor: "#d32f2f",
  },
});

export default UploadScreen;
