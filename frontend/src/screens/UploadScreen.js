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
  Animated,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
//import PlantClassifierService from "../services/PlantClassifierService";     (unused for now)

import NetInfo from "@react-native-community/netinfo";

const UploadScreen = () => {
  const navigation = useNavigation();
  const [image, setImage] = useState(null);
  const [plantName, setPlantName] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [description, setDescription] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractedCoords, setExtractedCoords] = useState(null); // { lat, lon }
  const [mapRegion, setMapRegion] = useState(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(null);
  const [backendImageUrl, setBackendImageUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageSourceType, setImageSourceType] = useState(null); // 'camera' or 'file'
  const [tempImageData, setTempImageData] = useState(null); // Store image data before upload
  const [needsLocation, setNeedsLocation] = useState(false);
  const [manualPin, setManualPin] = useState(null); // { lat, lon }
  const manualPinRef = useRef(null); // live manual pin to avoid stale state reads
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationSource, setLocationSource] = useState(null); // 'auto' | 'manual' | null
  const [changeLocPressing, setChangeLocPressing] = useState(false);
  const mapOpacity = useRef(new Animated.Value(1)).current;
  const actionsOpacity = useRef(new Animated.Value(1)).current;
  const [currentStep, setCurrentStep] = useState('ai'); // 'ai' | 'location'
  const scrollRef = useRef(null);
  const [locationSectionY, setLocationSectionY] = useState(0);
  const [isUnsure, setIsUnsure] = useState(false);
  
  const handleNext = () => {
    // Only allow next when AI results are ready
    const ready = plantName && predictions.length > 0 && !isClassifying;
    if (!ready) return;
    setCurrentStep('location');
    // Smooth scroll to location section
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ y: locationSectionY, animated: true });
      }
    });
  };

  const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

  // Simple fetch wrapper with one retry for transient network failures
  const safeFetch = async (url, options = {}, { retries = 1, delayMs = 300 } = {}) => {
    try {
      return await fetch(url, options);
    } catch (err) {
      const message = String(err?.message || '');
      if (retries > 0 && message.includes('Network request failed')) {
        await new Promise((r) => setTimeout(r, delayMs));
        return safeFetch(url, options, { retries: retries - 1, delayMs });
      }
      throw err;
    }
  };

  // Preflight server reachability check
  const ensureServerReachable = async () => {
    if (!API_BASE) {
      Alert.alert('Configuration error', 'API base URL is not set. Please configure EXPO_PUBLIC_API_BASE.');
      return false;
    }
    try {
      const res = await safeFetch(`${API_BASE}/identify/health`, { method: 'GET' }, { retries: 1, delayMs: 300 });
      if (!res.ok) {
        Alert.alert('Network error', `Server health check failed (HTTP ${res.status}).`);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Server reachability check failed:', err);
      Alert.alert('Network error', 'Server is not reachable. Please check your connection and try again.');
      return false;
    }
  };

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
      if (!API_BASE) { return; }
      await safeFetch(`${API_BASE}/identify/delete-image`, {
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
      if (!API_BASE) {
        Alert.alert('Configuration error', 'API base URL is not set. Please configure EXPO_PUBLIC_API_BASE.');
        return null;
      }
      const reachable = await ensureServerReachable();
      if (!reachable) return null;
      
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        name: asset.name || 'upload.jpg',
        type: asset.mimeType || 'image/jpeg',
      });

      const res = await safeFetch(`${API_BASE}/identify/extract-location`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
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
        setLocationSource('auto');
        setGoogleMapsUrl(data?.googleMapsUrl || null);
        setMapRegion({
          latitude: coords.lat,
          longitude: coords.lon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } else {
        setNeedsLocation(true);
        setMapRegion((prev) => prev || ({
          latitude: 1.5325882484148807,
          longitude: 110.35727946120764,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }));
        setManualPin({ lat: 1.5325882484148807, lon: 110.35727946120764 });
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
  const uploadBase64ToBackend = async (imageData) => {
    try {
      setUploading(true);
      if (!API_BASE) {
        Alert.alert('Configuration error', 'API base URL is not set. Please configure EXPO_PUBLIC_API_BASE.');
        return null;
      }
      const reachable = await ensureServerReachable();
      if (!reachable) return null;

      const base64 = imageData?.base64 || null;

      if (!base64) {
        Alert.alert('Upload error', 'Unable to read image data. Please retake the photo.');
        return null;
      }

      const filename = imageData?.fileName || `camera-${Date.now()}.jpg`;

      const res = await safeFetch(`${API_BASE}/identify/extract-location-base64`, {
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
        setLocationSource('auto');
        setGoogleMapsUrl(data?.googleMapsUrl || null);
        setMapRegion({
          latitude: coords.lat,
          longitude: coords.lon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } else {
        setNeedsLocation(true);
        setMapRegion((prev) => prev || ({
          latitude: 1.5325882484148807,
          longitude: 110.35727946120764,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }));
        setManualPin({ lat: 1.5325882484148807, lon: 110.35727946120764 });
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
      // Ensure at the AI step and scrolled to top for a fresh start
      setCurrentStep('ai');
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ y: 0, animated: true });
        }
      });

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
    // Require device location services enabled to take photo for auto-detection purpose
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          'Enable Location Services',
          'Location must be enabled to take a photo and auto-detect location.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings?.() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access to continue. You can enable it in settings.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings?.() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
    } catch (e) {
      console.warn('Location services check failed:', e);
    }

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
    // Return to AI step and scroll to top on new capture
    setCurrentStep('ai');
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ y: 0, animated: true });
      }
    });

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      exif: true,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const uri = asset.uri;
      setImage(uri);
      setImageSourceType('camera');
      setTempImageData({
        uri: uri,
        exif: asset.exif,
        base64: asset.base64,
        fileName: asset.fileName || `camera-${Date.now()}.jpg`,
        mimeType: asset.type || 'image/jpeg',
      });
      
      // Capture current device location to auto-set coordinates
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = position?.coords || {};
        if (typeof latitude === 'number' && typeof longitude === 'number') {
          const coords = { lat: latitude, lon: longitude };
          setExtractedCoords(coords);
          setLocationSource('auto');
          setGoogleMapsUrl(`https://maps.google.com/?q=${coords.lat},${coords.lon}`);
          setMapRegion({
            latitude: coords.lat,
            longitude: coords.lon,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          });
        } else {
          Alert.alert('Location error', 'Unable to read current location. Please try again.');
          return;
        }
      } catch (err) {
        console.error('getCurrentPositionAsync error:', err);
        Alert.alert('Location error', 'Unable to access current location. Please try again.');
        return;
      }
    }
  };

  const submitObservationToBackend = async () => {
    try {
      if (!backendImageUrl) {
        Alert.alert('Missing image', 'No uploaded image URL found. Please classify an image first.');
        return;
      }

      // Require login for submission (backend needs user_id via token)
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Login Required', 'Please sign in to submit observations.');
        return;
      }

      if (!plantName) {
        Alert.alert('Missing plant name', 'Please classify an image to identify the plant.');
        return;
      }
      
      setSaving(true);
      const lat = extractedCoords?.lat ?? null;
      const lon = extractedCoords?.lon ?? null;

      const searchUrl = `${API_BASE}/identify/search-plant?plantName=${encodeURIComponent(plantName)}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (!searchData.success || !searchData.found) {
        Alert.alert('Plant not found', `No record found for "${plantName}".`);
        setSaving(false);
        return;
      }
      const plant_id = searchData.plant.plant_id;
      console.log('Found plant_id:', plant_id);

      
      const res = await fetch(`${API_BASE}/identify/submit-observation`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Accept: 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          image_url: backendImageUrl, 
          lat, 
          lon, 
          plant_id,
          confidence_score: confidenceScore,
          is_unsure: isUnsure
        }),
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

  // Check if submit button should be enabled
  const isSubmitEnabled = () => {
    return (
      backendImageUrl && // Image uploaded and classified
      plantName && // AI identification completed
      predictions.length > 0 && // AI predictions available
      extractedCoords && // Location confirmed
      !saving && 
      !isClassifying && 
      !uploading 
    );
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

      const reachable = await ensureServerReachable();
      if (!reachable) return;

      let uploadedUrl = null;

      // Upload based on source type
      if (imageSourceType === 'file') {
        uploadedUrl = await uploadFileToBackend(tempImageData);
      } else if (imageSourceType === 'camera') {
        uploadedUrl = await uploadBase64ToBackend(tempImageData);
      }

      if (!uploadedUrl) {
        Alert.alert('Upload failed', 'Failed to upload image to server.');
        return;
      }

      setBackendImageUrl(uploadedUrl);

      // Now classify the uploaded image
      setIsClassifying(true);
      setPredictions([]);

      if (!API_BASE) {
        Alert.alert('Configuration error', 'API base URL is not set. Please configure EXPO_PUBLIC_API_BASE.');
        return;
      }
      const response = await safeFetch(`${API_BASE}/identify/classify`, {
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

  // Cancel and delete uploaded image with smooth fade-out and full state reset
  const cancelAndReset = async () => {
    try {
      // Quick fade-out for map and action buttons if visible
      Animated.parallel([
        Animated.timing(mapOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(actionsOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(async () => {
        if (backendImageUrl) {
          await deleteImageFromBackend(backendImageUrl);
        }
        resetForm();
        // Restore opacity for next time these sections appear
        mapOpacity.setValue(1);
        actionsOpacity.setValue(1);
      });
    } catch (err) {
      console.error('cancelAndReset error:', err);
      // Fallback: ensure form resets even if animation fails
      if (backendImageUrl) {
        await deleteImageFromBackend(backendImageUrl);
      }
      resetForm();
      mapOpacity.setValue(1);
      actionsOpacity.setValue(1);
    }
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
    setBackendImageUrl(null);
    setSaving(false);
    setUploading(false);
    setNeedsLocation(false);
    setManualPin(null);
    setSearchQuery('');
    setSearchingLocation(false);
    setLocationSource(null);
    setChangeLocPressing(false);
    setIsUnsure(false);
  };

  return (
    <ScrollView 
      ref={scrollRef}
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      scrollEnabled={!saving} // Disable scrolling when saving
      showsVerticalScrollIndicator={!saving}
    >
      <View style={styles.statusBar}>
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>You are offline. Some features may not work.</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>Upload New Plant Discovery</Text>

      <View style={styles.uploadCard}>
        <View style={styles.uploadCardHeaderRow}>
          <Text style={styles.uploadCardHeader}>Add a Plant Image</Text>
          <Text style={styles.uploadCardSubheader}>Choose a photo or take one now</Text>
        </View>

        {image ? (
          <Image source={{ uri: image }} style={styles.imagePreviewEnhanced} />
        ) : (
          <View style={styles.imagePlaceholderFrame}>
            <Text style={styles.imagePlaceholderTitle}>No image selected</Text>
            <Text style={styles.imagePlaceholderHint}>Select or capture a clear photo of the plant</Text>
          </View>
        )}

        {!isClassifying && predictions.length === 0 && (
          <View style={styles.actionTiles}>
            <TouchableOpacity 
              style={[styles.actionTile, styles.actionTileSecondary, (uploading || saving) && styles.actionTileDisabled]}
              onPress={pickFile}
              disabled={uploading || saving}
            >
              <View style={styles.actionTileTextWrap}>
                <Text style={[styles.actionTileTitle, (uploading || saving) && styles.actionTileTitleDisabled]}>Upload Photo</Text>
                <Text style={styles.actionTileSubtitle}>Pick an existing photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionTile, styles.actionTilePrimary, (uploading || saving) && styles.actionTileDisabled]}
              onPress={takePhoto}
              disabled={uploading || saving}
            >
              <View style={styles.actionTileTextWrap}>
                <Text style={[styles.actionTileTitleFilled, (uploading || saving) && styles.actionTileTitleDisabled]}>Take Photo</Text>
                <Text style={styles.actionTileSubtitleFilled}>Open camera to capture</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      
        <View style={[styles.stepContainer, currentStep === 'ai' ? styles.stepVisible : styles.stepHidden]}>
        {image && !isClassifying && !backendImageUrl && (
          <TouchableOpacity 
            style={[
              styles.button, 
              styles.classifyButton, 
              (isOffline || saving || uploading) && styles.classifyButtonDisabled
            ]} 
            onPress={classifyPlantViaBackend}
            disabled={isOffline || saving || uploading}
          >
            {uploading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Uploading...</Text>
              </View>
            ) : (
              <Text style={[styles.buttonText, (isOffline || saving) && styles.classifyButtonTextDisabled]}>Classify Plant</Text>
            )}
          </TouchableOpacity>
        )}

        {isClassifying && (
          <View style={styles.classifyingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.classifyingText}>Identifying plant...</Text>
          </View>
        )}

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
                onPress={async () => { 
                  setPlantName(prediction.species);
                  setConfidenceScore(prediction.confidence);
                  
                  try {
                    // Fetch plant details first
                    const searchUrl = `${API_BASE}/identify/search-plant?plantName=${encodeURIComponent(prediction.species)}`;
                    const searchRes = await fetch(searchUrl);
                    const searchData = await searchRes.json();
                    
                    if (searchData.success && searchData.found) {
                      // Navigate with plant data and origin parameter for back navigation
                      navigation.navigate('PlantDetail', {
                        plant: {
                          plant_id: searchData.plant.plant_id,
                          common_name: searchData.plant.common_name,
                          scientific_name: searchData.plant.scientific_name,
                          image_url: searchData.plant.image_url,
                        },
                        origin: 'Upload', 
                      });
                    } else {
                      Alert.alert('Plant not found', `No detailed information found for "${prediction.species}".`);
                    }
                  } catch (err) {
                    console.error('Navigation error:', err);
                    Alert.alert('Error', 'Failed to load plant details.');
                  }
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
          </View>
        )}

        {/* Unsure checkbox */}
        {predictions.length > 0 && !isClassifying && (
          <View style={styles.unsureContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setIsUnsure(!isUnsure)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isUnsure && styles.checkboxChecked]}>
                {isUnsure && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I'm unsure about this identification
              </Text>
            </TouchableOpacity>
            {isUnsure && (
              <Text style={styles.unsureHint}>
                Your observation will be flagged for expert review
              </Text>
            )}
          </View>
        )}


        {predictions.length > 0 && !isClassifying && (
          <TouchableOpacity
            style={[styles.nextButton, (!plantName) && styles.nextButtonDisabled]}
            disabled={!plantName}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        )}
        </View>

        <View style={[styles.stepContainer, currentStep === 'location' ? styles.stepVisible : styles.stepHidden]} onLayout={(e) => setLocationSectionY(e.nativeEvent.layout.y)}>

        {extractedCoords && (
          <Animated.View style={[styles.locationCard, { opacity: mapOpacity }] }>
            <Text style={styles.locationTitle}>Extracted Location</Text>
            <Text style={styles.locationText}>Latitude: {extractedCoords.lat.toFixed(6)}</Text>
            <Text style={styles.locationText}>Longitude: {extractedCoords.lon.toFixed(6)}</Text>
            {googleMapsUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(googleMapsUrl)}>
                <Text style={styles.openMapsLink}>Open in Maps</Text>
              </TouchableOpacity>
            )}
            {(() => {
              const isAutoDetected = locationSource === 'auto';
              const isDisabled = !!extractedCoords && isAutoDetected; // disable when auto-detected
              const btnStyles = [
                styles.button,
                styles.changeLocationButton,
                isDisabled ? styles.changeLocationButtonDisabled : null,
                !isDisabled && changeLocPressing ? styles.changeLocationButtonActive : null,
                (searchingLocation || saving) && styles.changeLocationButtonDisabled
              ];
              return (
                <View>
                  <TouchableOpacity
                    style={btnStyles}
                    disabled={isDisabled || searchingLocation || saving}
                    accessible
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isDisabled || searchingLocation || saving }}
                    aria-disabled={isDisabled || searchingLocation || saving}
                    onPressIn={() => !(isDisabled || searchingLocation || saving) && setChangeLocPressing(true)}
                    onPressOut={() => setChangeLocPressing(false)}
                    onPress={() => {
                      if (isDisabled || searchingLocation || saving) return;
                      try {
                        const lat = extractedCoords?.lat;
                        const lon = extractedCoords?.lon;
                        if (typeof lat === 'number' && typeof lon === 'number') {
                          const nextPin = { lat, lon };
                          setManualPin(nextPin);
                          manualPinRef.current = nextPin;
                          setMapRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.02, longitudeDelta: 0.02 });
                        }
                        setExtractedCoords(null);
                        setNeedsLocation(true);
                        Alert.alert('Change location', 'You can now select a new location.');
                      } catch (err) {
                        console.error('Change location error:', err);
                      }
                    }}
                  >
                    <Text style={[styles.buttonText, (isDisabled || searchingLocation || saving) ? styles.buttonTextDisabled : null]}>Change Location</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
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
          </Animated.View>
        )}

        {!extractedCoords && backendImageUrl && (
          <Animated.View style={[styles.manualLocationSection, { opacity: mapOpacity }]}>
            <Text style={styles.locationTitle}>Select Location</Text>
            <Text style={styles.instructionText}>
              No GPS data was found. Drag the pin or tap on the map to set location, or search by place name.
            </Text>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search place or address (e.g., Kuching, Sarawak)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity
                style={[styles.button, styles.searchButton]}
                disabled={searchingLocation || !searchQuery.trim()}
                onPress={async () => {
                  try {
                    if (!searchQuery.trim()) return;
                    setSearchingLocation(true);
                    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchQuery.trim())}&limit=1`;
                    const res = await fetch(url, {
                      headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'COS30049-App/1.0 (+https://example.com)'
                      }
                    });
                    const contentType = res.headers?.get?.('content-type') || '';
                    const text = await res.text();
                    if (!res.ok) {
                      console.error('Nominatim HTTP error:', res.status, text?.slice(0, 200));
                      Alert.alert('Search error', `Location service error (HTTP ${res.status}). Please try again.`);
                      return;
                    }
                    let results;
                    try {
                      results = contentType.includes('application/json') ? JSON.parse(text) : JSON.parse(text);
                    } catch (parseErr) {
                      console.error('Nominatim parse error:', parseErr, 'Response preview:', text?.slice(0, 200));
                      Alert.alert('Search error', 'Unexpected response from location service. Please try again later.');
                      return;
                    }
                    if (Array.isArray(results) && results.length > 0) {
                      const r = results[0];
                      const latitude = parseFloat(r.lat);
                      const longitude = parseFloat(r.lon);
                      if (!isNaN(latitude) && !isNaN(longitude)) {
                        const nextPin = { lat: latitude, lon: longitude };
                        setManualPin(nextPin);
                        manualPinRef.current = nextPin;
                        setMapRegion({ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
                      } else {
                        Alert.alert('No result', 'Unable to parse location coordinates from result.');
                      }
                    } else {
                      Alert.alert('No result', 'No matching locations found. Try a different search.');
                    }
                  } catch (e) {
                    console.error('Location search error:', e);
                    Alert.alert('Search error', 'Failed to search location. Please try again.');
                  } finally {
                    setSearchingLocation(false);
                  }
                }}
              >
                <Text style={styles.buttonText}>{searchingLocation ? 'Searching...' : 'Search'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                region={mapRegion || {
                  latitude: 1.5325882484148807,
                  longitude: 110.35727946120764,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                initialRegion={mapRegion || {
                  latitude: 1.5325882484148807,
                  longitude: 110.35727946120764,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  const nextPin = { lat: latitude, lon: longitude };
                  setManualPin(nextPin);
                  manualPinRef.current = nextPin;
                }}
              >
                {manualPin && (
                  <Marker
                    coordinate={{ latitude: manualPin.lat, longitude: manualPin.lon }}
                    draggable
                    onDragEnd={(e) => {
                      const { latitude, longitude } = e.nativeEvent.coordinate;
                      const nextPin = { lat: latitude, lon: longitude };
                      setManualPin(nextPin);
                      manualPinRef.current = nextPin;
                    }}
                  />
                )}
              </MapView>
            </View>
            {manualPin && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.locationText}>Selected Latitude: {manualPin.lat.toFixed(6)}</Text>
                <Text style={styles.locationText}>Selected Longitude: {manualPin.lon.toFixed(6)}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.confirmLocationButton, (!manualPin || saving) && styles.confirmLocationButtonDisabled]}
              disabled={!manualPin || saving}
              onPress={() => {
                const target = manualPinRef.current || manualPin;
                if (!target) return;
                setExtractedCoords(target);
                setGoogleMapsUrl(`https://maps.google.com/?q=${target.lat},${target.lon}`);
                setNeedsLocation(false);
                setLocationSource('manual');
                setMapRegion({
                  latitude: target.lat,
                  longitude: target.lon,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                });
                Alert.alert('Location set', 'Manual location selected.');
              }}
            >
              <Text style={[styles.confirmLocationText, (!manualPin || saving) && styles.confirmLocationTextDisabled]}>Use This Location</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
        </View>

        {backendImageUrl && (
          <Animated.View style={[styles.actionButtons, { opacity: actionsOpacity }]}>
            <TouchableOpacity
              style={[
                styles.button, 
                styles.cancelButton,
                (saving || isClassifying) && styles.cancelButtonDisabled
              ]}
              onPress={cancelAndReset}
              disabled={saving || isClassifying}
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: saving || isClassifying }}
            >
              <Text style={[styles.buttonText, (saving || isClassifying) && styles.buttonTextDisabled]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button, 
                isSubmitEnabled() ? styles.submitButton : styles.submitButtonDisabled
              ]}
              onPress={submitObservationToBackend}
              disabled={!isSubmitEnabled()}
            >
              <Text style={[
                styles.buttonText,
                !isSubmitEnabled() && styles.buttonTextDisabled
              ]}>
                {saving ? 'Submitting...' : 'Submit Observation'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      </View>
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
    marginVertical: 50,
    color: '#2e7d32'
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
  uploadCard: {
    alignSelf: 'stretch',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  uploadCardHeaderRow: {
    marginBottom: 12,
    alignSelf: 'stretch',
  },
  uploadCardHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2e7d32',
  },
  uploadCardSubheader: {
    fontSize: 14,
    color: '#6a6a6a',
    marginTop: 4,
  },
  imagePlaceholderFrame: {
    alignSelf: 'stretch',
    minHeight: 180,
    borderWidth: 2,
    borderColor: '#c8e6c9',
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6fff7',
    marginBottom: 18,
    paddingVertical: 16,
  },
  imagePlaceholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#388e3c',
  },
  imagePlaceholderHint: {
    fontSize: 13,
    color: '#808080',
    marginTop: 4,
  },
  imagePreviewEnhanced: {
    alignSelf: 'stretch',
    height: 220,
    borderRadius: 14,
    marginBottom: 18,
    backgroundColor: '#f2f2f2',
  },
  actionTiles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  actionTile: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  actionTileDisabled: {
    backgroundColor: '#eeeeee',
    borderColor: '#dddddd',
  },
  actionTileTextWrap: {
    flex: 1,
    alignItems: 'left',
  },
  actionTileTitle: {
    textAlign:"left",
    fontSize: 16,
    fontWeight: '700',
    color: '#2e7d32',
  },
  actionTileTitleFilled: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionTileTitleDisabled: {
    color: '#888',
  },
  actionTileSubtitle: {
    textAlign: 'left',
    fontSize: 13,
    color: '#6a6a6a',
    marginTop: 2,
  },
  actionTileSubtitleFilled: {
    fontSize: 13,
    color: '#eef7ee',
    marginTop: 2,
  },
  actionTilePrimary: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  actionTileSecondary: {
    backgroundColor: '#ffffff',
    borderColor: '#4CAF50',
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
  manualLocationSection: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  instructionText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 10,
  },
  confirmLocationButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  confirmLocationButtonDisabled: {
    backgroundColor: "#cccccc",
  },
  confirmLocationText: {
    color: "white",
    fontWeight: "bold",
  },
  confirmLocationTextDisabled: {
    color: "#999999",
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: 'white',
  },
  searchButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  changeLocationButton: {
    backgroundColor: '#1e88e5',
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  changeLocationButtonDisabled: {
    backgroundColor: '#9bbbd3',
    opacity: 0.7,
  },
  changeLocationButtonActive: {
    backgroundColor: '#1565c0',
  },
  buttonTextDisabled: {
    color: '#e0e0e0',
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
    marginLeft: 5,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#CCCCCC",
    flex: 1,
    marginLeft: 5,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  buttonTextDisabled: {
    color: "#999999",
  },
  scrollContent: {
    flexGrow: 1,
  },
  uploadButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  uploadButtonTextDisabled: {
    color: "#999999",
  },
  classifyButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  classifyButtonTextDisabled: {
    color: "#999999",
  },
  changeLocationButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  changeLocationTextDisabled: {
    color: "#999999",
  },
  confirmLocationButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  cancelButton: {
    backgroundColor: "#f44336",
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  cancelButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
    classifyButton: {
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  // Step navigation styles
  stepContainer: {
    width: '100%',
  },
  stepHidden: {
    display: 'none',
  },
  stepVisible: {
    display: 'flex',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: 16,
    width: '100%',
  },
  nextButtonDisabled: {
    backgroundColor: '#9e9e9e',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#ffffff',
    borderColor: '#4CAF50',
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginTop: 4,
  },
  backButtonText: {
    color: '#2e7d32',
    fontSize: 14,
    fontWeight: '700',
  },

  //flag as unsure
  unsureContainer: {
    width: '100%',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  unsureHint: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 36,
  },
  predictionItem: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default UploadScreen;
